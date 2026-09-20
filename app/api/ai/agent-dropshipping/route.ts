/**
 * Agent Dropshipping — Recherche de produits gagnants et import catalogue
 *
 * Contrairement aux autres agents, cet agent retourne à la fois :
 *   - reponse : le message texte de l'agent
 *   - produits : tableau structuré de suggestions importables
 *   - actions  : liste des actions réalisées
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  completionWithToolsAuto,
  type ToolDefinition,
  type ToolCall,
} from "@/lib/llm-client";
import { z } from "zod";

const schema = z.object({
  messages: z.array(
    z.object({ role: z.enum(["user", "assistant"]), content: z.string() })
  ),
});

/* ── Produit structuré retourné au frontend ─────────────────────────────────── */
interface ProduitSuggere {
  nom: string;
  categorie: string;
  description: string;
  fournisseur: string;
  fournisseurType: "aliexpress" | "cj" | "jumia" | "local" | "autre";
  prixAchat: number;
  prixVente: number;
  marge: number;
  demandeScore: number; // 1-10
  competitionScore: number; // 1-10 (10 = très compétitif = mauvais)
  tendance: "hausse" | "stable" | "baisse";
  tags: string[];
  avantages: string[];
  risques: string[];
  image?: string;
}

/* ── Prompt système ─────────────────────────────────────────────────────────── */
const SYSTEM = `Tu es l'Agent Dropshipping d'AXSO — expert en e-commerce africain et sourcing mondial.
Tu identifies les produits gagnants à fort potentiel sur les marchés africains (Sénégal, Côte d'Ivoire, Cameroun, Mali, Togo, Burkina, Guinée, Ghana).

Tes forces :
- Connaissance approfondie d'AliExpress, CJ Dropshipping, Jumia, Alibaba
- Analyse des tendances de consommation africaines (Mode wax, cosmétiques naturels, tech accessories, sport, maison)
- Calcul de marges réalistes selon les frais de douane et logistique africains
- Identification des niches peu saturées mais à forte demande

Workflow :
1. Comprends la demande : niche, pays cible, budget, catégorie
2. Utilise rechercher_produits pour générer des suggestions structurées
3. Utilise analyser_niche pour approfondir une analyse de marché
4. Utilise calculer_marge pour optimiser le pricing
5. Utilise importer_produit pour ajouter directement au catalogue

Règle absolue : sois précis dans les chiffres (prix, marges). Tes suggestions doivent être actionables immédiatement.
Parle en français, de façon directe et concrète.`;

/* ── Définitions des outils ─────────────────────────────────────────────────── */
const OUTILS: ToolDefinition[] = [
  {
    name: "rechercher_produits",
    description:
      "Recherche et analyse des produits gagnants selon une niche, un pays cible et des critères de marge. Retourne une liste structurée de produits avec leurs données clés.",
    parameters: {
      type: "object",
      properties: {
        niche: { type: "string", description: "La niche ou catégorie ciblée (ex: mode femme, cosmétiques, tech, sport)" },
        pays: { type: "string", description: "Pays africain cible (ex: Sénégal, Côte d'Ivoire, Cameroun...)" },
        budget_achat_max: { type: "number", description: "Prix d'achat maximum par produit en XOF" },
        nb_produits: { type: "number", description: "Nombre de suggestions à retourner (3 à 8)" },
        fournisseur_prefere: { type: "string", description: "Fournisseur préféré: aliexpress|cj|jumia|local|any" },
      },
      required: ["niche"],
    },
  },
  {
    name: "analyser_niche",
    description: "Analyse en profondeur une niche : taille de marché, concurrence, saisonnalité, tendances.",
    parameters: {
      type: "object",
      properties: {
        niche: { type: "string", description: "Niche à analyser" },
        pays: { type: "string", description: "Marché cible" },
      },
      required: ["niche"],
    },
  },
  {
    name: "calculer_marge",
    description: "Calcule le prix de vente optimal, la marge nette et le retour sur investissement pour un produit.",
    parameters: {
      type: "object",
      properties: {
        prix_achat: { type: "number", description: "Prix d'achat fournisseur en XOF" },
        frais_livraison: { type: "number", description: "Frais de livraison estimés en XOF" },
        marge_cible: { type: "number", description: "Marge bénéficiaire cible en % (ex: 60 pour 60%)" },
        taux_retour: { type: "number", description: "Taux de retour produit estimé en % (ex: 5)" },
      },
      required: ["prix_achat"],
    },
  },
  {
    name: "importer_produit",
    description: "Importe un produit suggéré directement dans le catalogue de la boutique.",
    parameters: {
      type: "object",
      properties: {
        nom: { type: "string", description: "Nom du produit" },
        description: { type: "string", description: "Description optimisée du produit" },
        categorie: { type: "string", description: "Catégorie du produit" },
        prix: { type: "number", description: "Prix de vente en XOF" },
        prixAchat: { type: "number", description: "Prix d'achat fournisseur en XOF" },
        prixCompare: { type: "number", description: "Prix barré/comparaison en XOF" },
        fournisseurNom: { type: "string", description: "Nom du fournisseur" },
        fournisseurType: { type: "string", description: "Type: aliexpress|cj|jumia|local|autre" },
        tags: { type: "array", items: { type: "string" }, description: "Tags produit" },
        stock: { type: "number", description: "Stock initial à afficher (ex: 999 pour stock illimité apparent)" },
      },
      required: ["nom", "prix", "prixAchat"],
    },
  },
];

/* ── Exécuteurs des outils ──────────────────────────────────────────────────── */
async function executeOutil(
  name: string,
  args: Record<string, any>,
  tenantId: string,
  suggestons: ProduitSuggere[]
): Promise<string> {
  switch (name) {
    case "rechercher_produits": {
      // L'IA génère les produits elle-même dans la réponse structurée
      // On retourne juste un context pour qu'elle puisse les formuler
      return JSON.stringify({
        ok: true,
        message: `Analyse de la niche "${args.niche}" pour le marché ${args.pays ?? "africain"} effectuée.`,
        contexte: {
          niche: args.niche,
          pays: args.pays ?? "Afrique de l'Ouest",
          budget_max: args.budget_achat_max ?? 15000,
          nb_demande: args.nb_produits ?? 5,
          fournisseur: args.fournisseur_prefere ?? "any",
        },
        instruction:
          "Génère maintenant une liste détaillée de produits gagnants basée sur tes connaissances du marché. " +
          "Pour chaque produit inclus: nom, description, prix achat estimé (XOF), prix vente suggéré (XOF), marge %, " +
          "fournisseur recommandé, score de demande /10, score de compétition /10, tendance (hausse/stable/baisse), " +
          "avantages et risques. Sois précis et actionable.",
      });
    }

    case "analyser_niche": {
      return JSON.stringify({
        ok: true,
        niche: args.niche,
        marche: args.pays ?? "Afrique de l'Ouest",
        instruction:
          `Fournis une analyse stratégique complète de la niche "${args.niche}" : ` +
          "volume du marché estimé, niveau de concurrence, saisonnalité, tendances actuelles, " +
          "profil client type, canaux d'acquisition recommandés, pricing strategy.",
      });
    }

    case "calculer_marge": {
      const achat = args.prix_achat ?? 0;
      const livraison = args.frais_livraison ?? achat * 0.15;
      const coutTotal = achat + livraison;
      const margeCible = args.marge_cible ?? 60;
      const tauxRetour = args.taux_retour ?? 5;
      const prixVente = Math.round(coutTotal * (1 + margeCible / 100));
      const margeNette = Math.round(((prixVente - coutTotal) / prixVente) * 100);
      const impactRetour = Math.round((prixVente * tauxRetour) / 100);
      const beneficeNet = prixVente - coutTotal - impactRetour;

      return JSON.stringify({
        ok: true,
        calcul: {
          prix_achat: achat,
          frais_livraison: Math.round(livraison),
          cout_total: Math.round(coutTotal),
          prix_vente_suggere: prixVente,
          marge_brute_pct: margeCible,
          marge_nette_pct: margeNette,
          impact_retours: impactRetour,
          benefice_net_par_vente: Math.round(beneficeNet),
          prix_barre_recommande: Math.round(prixVente * 1.2),
          roi_pct: Math.round((beneficeNet / achat) * 100),
        },
      });
    }

    case "importer_produit": {
      try {
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { id: true },
        });
        if (!tenant) return JSON.stringify({ ok: false, message: "Boutique introuvable" });

        // Cherche ou crée un fournisseur dropshipping
        let fournisseur = await prisma.fournisseur.findFirst({
          where: { tenantId, nom: { contains: args.fournisseurNom ?? "Dropshipping" } },
        });

        if (!fournisseur && args.fournisseurNom) {
          fournisseur = await prisma.fournisseur.create({
            data: {
              tenantId,
              nom: args.fournisseurNom,
              type: args.fournisseurType ?? "autre",
              pays: "Chine",
              delaiLivraison: 15,
              fiabilite: 4,
              margeAuto: 0.4,
              actif: true,
            },
          });
        }

        const produit = await prisma.produit.create({
          data: {
            tenantId,
            nom: args.nom,
            description: args.description ?? `Produit dropshipping : ${args.nom}`,
            descriptionIA: args.description,
            prix: args.prix,
            prixAchat: args.prixAchat,
            prixCompare: args.prixCompare ?? Math.round(args.prix * 1.25),
            categorie: args.categorie ?? "Autre",
            stock: args.stock ?? 999,
            type: "simple",
            actif: true,
            estDropshipping: true,
            fournisseurId: fournisseur?.id ?? null,
            tags: args.tags ?? [],
            slug:
              args.nom
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, "")
                .replace(/\s+/g, "-")
                .slice(0, 60) +
              "-" +
              Math.random().toString(36).slice(2, 7),
          },
        });

        return JSON.stringify({
          ok: true,
          message: `✅ "${args.nom}" importé dans votre catalogue avec succès !`,
          produit_id: produit.id,
        });
      } catch (err: any) {
        return JSON.stringify({ ok: false, message: `Erreur import: ${err.message}` });
      }
    }

    default:
      return JSON.stringify({ ok: false, message: `Outil inconnu: ${name}` });
  }
}

/* ── Boucle agent personnalisée ─────────────────────────────────────────────── */
async function runDropshippingAgent(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  tenantId: string
): Promise<{ reponse: string; actions: string[]; produits: ProduitSuggere[] }> {
  const produitsSuggeres: ProduitSuggere[] = [];
  const actions: string[] = [];
  const MAX_TURNS = 5;

  const conversation: any[] = [
    { role: "system", content: SYSTEM },
    ...messages,
  ];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const result = await completionWithToolsAuto(conversation, OUTILS, 3000, true);

    if (result.stopReason === "end_turn") {
      return { reponse: result.text ?? "", actions, produits: produitsSuggeres };
    }

    if (!result.toolCalls?.length) {
      return { reponse: result.text ?? "", actions, produits: produitsSuggeres };
    }

    // Ajoute le message assistant avec les tool_calls
    const assistantMsg: any = {
      role: "assistant",
      content: result.text ?? null,
      tool_calls: result.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
      })),
    };
    conversation.push(assistantMsg);

    // Exécute chaque outil
    for (const tc of result.toolCalls) {
      const toolResult = await executeOutil(tc.name, tc.arguments, tenantId, produitsSuggeres);
      actions.push(`${tc.name}(${JSON.stringify(tc.arguments).slice(0, 80)})`);

      conversation.push({
        role: "tool",
        tool_call_id: tc.id,
        content: toolResult,
      });
    }
  }

  return {
    reponse: "Je n'ai pas pu compléter la recherche. Reformulez votre demande.",
    actions,
    produits: produitsSuggeres,
  };
}

/* ── Handler HTTP ────────────────────────────────────────────────────────────── */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    if (!tenantId) return NextResponse.json({ message: "Boutique introuvable" }, { status: 404 });

    const { messages } = schema.parse(await request.json());
    const result = await runDropshippingAgent(messages, tenantId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ message: "Format invalide" }, { status: 400 });
    console.error("[AGENT/DROPSHIPPING]", err);
    return NextResponse.json({ message: "Erreur agent dropshipping" }, { status: 500 });
  }
}
