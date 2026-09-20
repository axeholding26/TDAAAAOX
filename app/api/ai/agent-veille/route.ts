// Agent Veille — intelligence marché africain, tendances, pricing concurrentiel
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runAgent, type AgentTool, type ToolExecutor } from "@/lib/agent-runner";
import { writeMemory, readAllMemory, logDecision } from "@/lib/agent-memory";
import { z } from "zod";

const schema = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).optional(),
});

const SYSTEM_PROMPT = `Tu es l'Agent Veille d'Axso — ton intelligence du marché africain permet au vendeur de toujours avoir une longueur d'avance.

TES MISSIONS :
- Surveiller les tendances des marchés africains (mode, tech, alimentation, beauté...)
- Analyser la saisonnalité africaine (Tabaski, Noël, Noël africain, rentrée, fête des mères)
- Recommander des ajustements de prix basés sur le marché
- Identifier les produits tendance dans chaque pays cible
- Alerter sur les opportunités de croissance inexploitées

CALENDRIER SAISONNIER AFRICAIN (mémorise-le) :
- Janvier : Nouvel An, soldes post-fêtes
- Avril-Mai : Ramadan (pics halal, vêtements, cosmétiques)
- Mai : Tabaski (pic MAXIMUM — mode, alimentation x3-5)
- Juin : Fête des mères, fin d'année scolaire
- Août-Septembre : Rentrée scolaire (fournitures, mode enfant)
- Décembre : Noël, fêtes de fin d'année

MARCHÉS PRIORITAIRES :
🇸🇳 Sénégal : Dakar, Saint-Louis — Wolof, Français — XOF — Wave/OM dominant
🇨🇲 Cameroun : Douala, Yaoundé — Français, Anglais — XAF — MTN/Orange
🇨🇮 Côte d'Ivoire : Abidjan — Français — XOF — MTN MoMo, Wave
🇳🇬 Nigeria : Lagos — Anglais, Pidgin — NGN — Opulente, tech-forward
🇬🇭 Ghana : Accra — Anglais — GHS — marché premium croissant
🇰🇪 Kenya : Nairobi — Anglais, Swahili — KES — M-Pesa, très digital

Réponds en français avec des insights concrets et actionnables.`;

const OUTILS: AgentTool[] = [
  {
    name: "analyser_catalogue_vs_marche",
    description: "Compare le catalogue actuel aux tendances du marché africain et identifie les gaps",
    parameters: {
      type: "object",
      properties: {
        pays: { type: "string", description: "Pays cible (SN, CM, CI, NG, GH, KE)" },
        categorie: { type: "string", description: "Catégorie produit à analyser" },
      },
      required: [],
    },
  },
  {
    name: "alerte_saisonnalite",
    description: "Calcule les événements saisonniers africains à venir et leur impact estimé",
    parameters: {
      type: "object",
      properties: {
        horizon_jours: { type: "number", description: "Horizon en jours (défaut: 90)" },
      },
      required: [],
    },
  },
  {
    name: "recommander_nouveaux_produits",
    description: "Suggère des produits à ajouter au catalogue selon les tendances africaines actuelles",
    parameters: {
      type: "object",
      properties: {
        categorie: { type: "string" },
        pays: { type: "string" },
        budget_max: { type: "number", description: "Prix de vente max en devise locale" },
      },
      required: ["categorie"],
    },
  },
  {
    name: "enregistrer_concurrent",
    description: "Enregistre un concurrent détecté avec ses prix pour suivi",
    parameters: {
      type: "object",
      properties: {
        nomConcurrent: { type: "string" },
        urlConcurrent: { type: "string" },
        produitNom: { type: "string" },
        prixDetecte: { type: "number" },
        categorie: { type: "string" },
      },
      required: ["nomConcurrent", "produitNom"],
    },
  },
  {
    name: "lire_veille_historique",
    description: "Consulte les données de veille concurrentielle enregistrées précédemment",
    parameters: {
      type: "object",
      properties: {
        categorie: { type: "string" },
      },
      required: [],
    },
  },
  {
    name: "rapport_opportunites",
    description: "Génère un rapport complet des opportunités de marché à saisir dans les 30 prochains jours",
    parameters: {
      type: "object",
      properties: {
        pays: { type: "string" },
      },
      required: [],
    },
  },
  {
    name: "memoriser",
    description: "Mémorise une information de veille importante",
    parameters: {
      type: "object",
      properties: { cle: { type: "string" }, valeur: { type: "string" } },
      required: ["cle", "valeur"],
    },
  },
];

const TENDANCES_AFRICA: Record<string, string[]> = {
  mode: ["Wax africain moderne", "Robes Boubou stylisées", "Sneakers personnalisées", "Hijab fashion"],
  cosmetiques: ["Savon noir africain", "Beurre de karité pur", "Huile de coco", "Produits dépigmentants naturels"],
  alimentation: ["Épices locales premium", "Jus de bissap bio", "Miel artisanal", "Huile de palme rouge"],
  electronique: ["Panneaux solaires portables", "Powerbanks grande capacité", "Casques sans fil"],
  artisanat: ["Paniers tressés", "Sculptures bois", "Bijoux en bronze", "Sacs en cuir africain"],
  maison: ["Meubles en rotin", "Déco wax", "Bougies parfumées locales"],
};

const executeOutil: (tenantId: string) => ToolExecutor = (tenantId) => async (name, args) => {
  try {
    if (name === "analyser_catalogue_vs_marche") {
      const produits = await prisma.produit.findMany({
        where: { tenantId, actif: true },
        select: { categorie: true, nom: true, prix: true, ventes: true },
      });
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const categories = [...new Set(produits.map((p) => p.categorie).filter(Boolean))];
      const pays = args.pays || tenant?.pays || "SN";

      const tendances = args.categorie
        ? TENDANCES_AFRICA[args.categorie.toLowerCase()] ?? []
        : Object.values(TENDANCES_AFRICA).flat().slice(0, 10);

      return {
        succes: true,
        resultat: JSON.stringify({
          pays_cible: pays,
          nb_produits: produits.length,
          categories_actuelles: categories,
          tendances_africaines: tendances,
          produits_zero_ventes: produits.filter((p) => p.ventes === 0).length,
          opportunites_catalogue: tendances.filter(
            (t) => !produits.some((p) => p.nom.toLowerCase().includes(t.toLowerCase().split(" ")[0]))
          ).slice(0, 5),
        }),
      };
    }

    if (name === "alerte_saisonnalite") {
      const horizon = args.horizon_jours || 90;
      const maintenant = new Date();
      const evenements = [
        { nom: "Tabaski 2026", date: "2026-06-17", impact: "+300%", categories: ["mode", "alimentation", "cosmétiques"] },
        { nom: "Fête des Mères", date: "2026-05-31", impact: "+80%", categories: ["cosmétiques", "mode", "bijoux"] },
        { nom: "Rentrée Scolaire", date: "2026-09-01", impact: "+120%", categories: ["fournitures", "mode", "électronique"] },
        { nom: "Noël Africain", date: "2026-12-25", impact: "+200%", categories: ["mode", "électronique", "alimentation"] },
      ].filter((e) => {
        const diff = (new Date(e.date).getTime() - maintenant.getTime()) / (1000 * 3600 * 24);
        return diff >= 0 && diff <= horizon;
      }).map((e) => ({
        ...e,
        jours_restants: Math.round((new Date(e.date).getTime() - maintenant.getTime()) / (1000 * 3600 * 24)),
      }));

      return { succes: true, resultat: JSON.stringify({ evenements, conseil: evenements.length > 0 ? `Prépare ton stock et tes campagnes 2 semaines avant chaque événement` : "Aucun événement majeur dans l'horizon donné" }) };
    }

    if (name === "recommander_nouveaux_produits") {
      const tendances = TENDANCES_AFRICA[args.categorie?.toLowerCase()] ?? TENDANCES_AFRICA.mode;
      const recommendations = tendances.slice(0, 5).map((produit) => ({
        produit,
        prix_suggere_xaf: args.budget_max ?? 15000,
        marge_estimee: "35-60%",
        demande: "forte",
        fournisseurs_locaux: "Marché Sandaga (SN), Marché Mokolo (CM), Marché Adjamé (CI)",
      }));

      await logDecision(tenantId, "agent-veille", "recommandation_produits",
        `${recommendations.length} produits recommandés pour ${args.categorie}`,
        { categorie: args.categorie, recommendations }
      );

      return { succes: true, resultat: JSON.stringify(recommendations) };
    }

    if (name === "enregistrer_concurrent") {
      await prisma.veilleConcurrentielle.create({
        data: {
          tenantId,
          nomConcurrent: args.nomConcurrent,
          urlConcurrent: args.urlConcurrent,
          produitNom: args.produitNom,
          prixDetecte: args.prixDetecte,
          categorie: args.categorie,
        },
      });
      return { succes: true, resultat: `Concurrent ${args.nomConcurrent} enregistré` };
    }

    if (name === "lire_veille_historique") {
      const veille = await prisma.veilleConcurrentielle.findMany({
        where: { tenantId, ...(args.categorie && { categorie: args.categorie }) },
        orderBy: { detectedAt: "desc" },
        take: 20,
      });
      return { succes: true, resultat: JSON.stringify(veille) };
    }

    if (name === "rapport_opportunites") {
      const [produits, veille] = await Promise.all([
        prisma.produit.findMany({ where: { tenantId, actif: true }, select: { categorie: true, ventes: true, stock: true } }),
        prisma.veilleConcurrentielle.findMany({ where: { tenantId }, take: 10 }),
      ]);

      return {
        succes: true,
        resultat: JSON.stringify({
          nb_produits_actifs: produits.length,
          produits_sans_ventes: produits.filter((p) => p.ventes === 0).length,
          categories_fortes: [...new Set(produits.filter((p) => p.ventes > 5).map((p) => p.categorie))],
          concurrents_suivis: veille.length,
          top_opportunites: [
            "Optimiser les fiches produits sans ventes avec SEO africain",
            "Lancer une campagne WhatsApp pour les fêtes",
            "Ajouter des produits tendance manquants au catalogue",
          ],
        }),
      };
    }

    if (name === "memoriser") {
      await writeMemory(tenantId, "agent-veille", args.cle, args.valeur);
      return { succes: true, resultat: `Mémorisé : ${args.cle}` };
    }

    return { succes: false, resultat: `Outil inconnu : ${name}` };
  } catch (err) {
    return { succes: false, resultat: `Erreur : ${err instanceof Error ? err.message : String(err)}` };
  }
};

// Exporté pour l'exécution autonome (lib/agent-consumer.ts)
export { SYSTEM_PROMPT, OUTILS, executeOutil };

export async function POST(req: NextRequest) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const body = schema.parse(await req.json());
  const memoire = await readAllMemory(tenantId, "agent-veille");

  const messages = body.messages ?? [
    { role: "user" as const, content: "Analyse le marché africain et identifie les meilleures opportunités pour cette boutique." },
  ];

  const result = await runAgent(
    SYSTEM_PROMPT + (Object.keys(memoire).length > 0
      ? `\n\nTA MÉMOIRE MARCHÉ :\n${Object.entries(memoire).map(([k, v]) => `- ${k}: ${v}`).join("\n")}`
      : ""),
    messages,
    OUTILS,
    tenantId,
    executeOutil(tenantId),
    7
  );

  return NextResponse.json(result);
}
