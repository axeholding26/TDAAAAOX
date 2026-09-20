// Agent Produits — enrichissement catalogue, SEO, prix, optimisation
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runAgent, type AgentTool, type ToolExecutor } from "@/lib/agent-runner";
import { z } from "zod";

const schema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })),
});

const PROMPT = `Tu es l'Agent Produits d'Axso, expert en merchandising et optimisation e-commerce pour l'Afrique.
Tu enrichis les catalogues pour maximiser les conversions : descriptions percutantes, SEO optimisé, prix compétitifs.

Tes capacités :
- Analyser le catalogue complet et identifier les faiblesses
- Générer des descriptions produit accrocheuses adaptées au marché africain
- Optimiser les balises SEO pour le référencement local
- Suggérer des ajustements de prix selon la compétitivité du marché
- Mettre à jour les produits directement dans la base

Workflow recommandé :
1. Commence par lister_produits pour voir le catalogue
2. Identifie les produits sans description ou avec des infos incomplètes
3. Enrichis-les un par un avec enrichir_et_sauvegarder
4. Propose des optimisations de prix si nécessaire

Ton style de description : bénéfices avant tout, ton africain chaleureux, appel à l'action clair.`;

const OUTILS: AgentTool[] = [
  {
    name: "lister_produits",
    description: "Liste tous les produits actifs du catalogue avec leur statut d'enrichissement",
    parameters: {
      type: "object" as const,
      properties: {
        limite: { type: "number", description: "Nombre max de produits à retourner (défaut 20)" },
        sans_description_seulement: { type: "boolean", description: "Ne retourner que les produits sans description" },
      },
      required: [],
    },
  },
  {
    name: "lire_produit",
    description: "Lit les détails complets d'un produit",
    parameters: {
      type: "object" as const,
      properties: {
        produitId: { type: "string", description: "ID du produit" },
      },
      required: ["produitId"],
    },
  },
  {
    name: "enrichir_et_sauvegarder",
    description: "Met à jour la description, le SEO et les tags d'un produit",
    parameters: {
      type: "object" as const,
      properties: {
        produitId: { type: "string", description: "ID du produit à enrichir" },
        description: { type: "string", description: "Nouvelle description enrichie" },
        descriptionIA: { type: "string", description: "Version description générée par IA" },
        metaTitle: { type: "string", description: "Balise meta title SEO (max 60 caractères)" },
        metaDesc: { type: "string", description: "Meta description SEO (max 155 caractères)" },
        tags: { type: "array", items: { type: "string" }, description: "Tags produit pour la recherche" },
      },
      required: ["produitId"],
    },
  },
  {
    name: "mettre_a_jour_prix",
    description: "Met à jour le prix d'un produit et son prix de comparaison",
    parameters: {
      type: "object" as const,
      properties: {
        produitId: { type: "string", description: "ID du produit" },
        prix: { type: "number", description: "Nouveau prix principal" },
        prixCompare: { type: "number", description: "Prix barré (ancien prix pour afficher une promotion)" },
      },
      required: ["produitId", "prix"],
    },
  },
  {
    name: "analyser_catalogue",
    description: "Analyse l'ensemble du catalogue et retourne un rapport avec les points d'amélioration",
    parameters: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

const executeOutil: ToolExecutor = async (nom, args, tenantId) => {
  try {
    switch (nom) {
      case "lister_produits": {
        const where: any = { tenantId, actif: true };
        if (args.sans_description_seulement) {
          where.OR = [{ description: null }, { description: "" }];
        }
        const produits = await prisma.produit.findMany({
          where,
          take: args.limite ?? 20,
          orderBy: { createdAt: "desc" },
          select: {
            id: true, nom: true, prix: true, categorie: true,
            description: true, metaTitle: true, tags: true,
            ventes: true, stock: true,
          },
        });
        const rapport = produits.map((p) => ({
          ...p,
          a_description: !!(p.description?.trim()),
          a_seo: !!(p.metaTitle?.trim()),
          a_tags: p.tags.length > 0,
        }));
        return { succes: true, resultat: JSON.stringify(rapport) };
      }

      case "lire_produit": {
        const produit = await prisma.produit.findFirst({
          where: { id: args.produitId, tenantId },
        });
        if (!produit) return { succes: false, resultat: "Produit introuvable" };
        return { succes: true, resultat: JSON.stringify(produit) };
      }

      case "enrichir_et_sauvegarder": {
        const data: any = {};
        if (args.description) data.description = args.description;
        if (args.descriptionIA) data.descriptionIA = args.descriptionIA;
        if (args.metaTitle) data.metaTitle = args.metaTitle.slice(0, 60);
        if (args.metaDesc) data.metaDesc = args.metaDesc.slice(0, 155);
        if (args.tags) data.tags = args.tags;

        const produit = await prisma.produit.findFirst({ where: { id: args.produitId, tenantId }, select: { nom: true } });
        if (!produit) return { succes: false, resultat: "Produit introuvable" };

        await prisma.produit.update({ where: { id: args.produitId }, data });
        const champs = Object.keys(data).join(", ");
        return { succes: true, resultat: `✅ "${produit.nom}" enrichi — champs mis à jour : ${champs}` };
      }

      case "mettre_a_jour_prix": {
        const produit = await prisma.produit.findFirst({ where: { id: args.produitId, tenantId }, select: { nom: true, prix: true } });
        if (!produit) return { succes: false, resultat: "Produit introuvable" };

        await prisma.produit.update({
          where: { id: args.produitId },
          data: {
            prix: args.prix,
            prixCompare: args.prixCompare ?? null,
          },
        });
        return { succes: true, resultat: `✅ Prix "${produit.nom}" : ${produit.prix} → ${args.prix}${args.prixCompare ? ` (barré: ${args.prixCompare})` : ""}` };
      }

      case "analyser_catalogue": {
        const [produits, tenant] = await Promise.all([
          prisma.produit.findMany({
            where: { tenantId },
            select: {
              id: true, nom: true, prix: true, categorie: true,
              description: true, metaTitle: true, tags: true,
              stock: true, ventes: true, actif: true,
            },
          }),
          prisma.tenant.findUnique({ where: { id: tenantId }, select: { devise: true, pays: true } }),
        ]);

        const total = produits.length;
        const actifs = produits.filter((p) => p.actif).length;
        const sansDescription = produits.filter((p) => !p.description?.trim()).length;
        const sansSEO = produits.filter((p) => !p.metaTitle?.trim()).length;
        const sansTags = produits.filter((p) => p.tags.length === 0).length;
        const stockFaible = produits.filter((p) => p.stock <= 3).length;
        const topVentes = [...produits].sort((a, b) => b.ventes - a.ventes).slice(0, 3).map((p) => p.nom);

        return {
          succes: true,
          resultat: JSON.stringify({
            devise: tenant?.devise,
            pays: tenant?.pays,
            total_produits: total,
            produits_actifs: actifs,
            sans_description: sansDescription,
            sans_seo: sansSEO,
            sans_tags: sansTags,
            stock_faible: stockFaible,
            top_ventes: topVentes,
            score_qualite: Math.round(((total - sansDescription - sansSEO) / (total * 2)) * 100),
          }),
        };
      }

      default:
        return { succes: false, resultat: `Outil inconnu: ${nom}` };
    }
  } catch (err: any) {
    return { succes: false, resultat: `Erreur: ${err.message}` };
  }
};

// Exporté pour l'exécution autonome (lib/agent-consumer.ts)
export { PROMPT, OUTILS, executeOutil };

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    if (!tenantId) return NextResponse.json({ message: "Boutique introuvable" }, { status: 404 });

    const { messages } = schema.parse(await request.json());
    const result = await runAgent(PROMPT, messages, OUTILS, tenantId, executeOutil);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ message: "Format invalide" }, { status: 400 });
    console.error("[AGENT/PRODUITS]", err);
    return NextResponse.json({ message: "Erreur agent produits" }, { status: 500 });
  }
}
