// Agent Revenue — optimise les prix, relance les paniers, booste les ventes
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { runAgent, type AgentTool, type ToolExecutor } from "@/lib/agent-runner";
import { readAllMemory, writeMemory, logDecision } from "@/lib/agent-memory";
import { z } from "zod";

const schema = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).optional(),
  mode: z.enum(["chat", "autonome"]).default("chat"),
});

const SYSTEM_PROMPT = `Tu es l'Agent Revenue d'Axso — ton seul objectif : maximiser le chiffre d'affaires du vendeur.

Tu analyses les données de la boutique en temps réel et prends des décisions autonomes pour :
- Ajuster les prix selon la demande et la concurrence africaine
- Relancer les clients avec paniers abandonnés ou commandes en attente
- Créer des offres flash et codes promo à fort impact
- Identifier les produits sous-valorisés et suggérer des prix optimaux
- Détecter les opportunités d'upsell et cross-sell

CONTEXTE AFRICAIN :
- Marchés cibles : Sénégal, Cameroun, Côte d'Ivoire, Nigeria, Ghana, Kenya, Maroc
- Saisonnalité : Tabaski (pic +300%), Noël, rentrée scolaire, fête des mères
- Mobile Money dominant — prix ronds préférés (500, 1000, 2500, 5000 XAF)
- Sensibilité au prix forte — les promos de 15-25% ont un impact maximal

RÈGLES D'OR :
1. Agis MAINTENANT sans demander permission
2. Toujours mesurer l'impact estimé en chiffres
3. Mémorise tes décisions pour ne pas répéter les mêmes actions
4. Priorise les actions à ROI immédiat (< 48h)

Réponds en français, avec des chiffres concrets.`;

const OUTILS: AgentTool[] = [
  {
    name: "analyser_opportunites_revenus",
    description: "Analyse les commandes, produits et clients pour détecter toutes les opportunités de revenus immédiates",
    parameters: {
      type: "object",
      properties: {
        periode_jours: { type: "number", description: "Période d'analyse en jours (défaut: 30)" },
      },
      required: [],
    },
  },
  {
    name: "ajuster_prix_produit",
    description: "Modifie le prix d'un produit et définit un prix barré pour créer une urgence d'achat",
    parameters: {
      type: "object",
      properties: {
        produitId: { type: "string" },
        nouveauPrix: { type: "number" },
        prixBarre: { type: "number", description: "Ancien prix barré pour montrer la réduction" },
        raison: { type: "string" },
      },
      required: ["produitId", "nouveauPrix"],
    },
  },
  {
    name: "creer_offre_flash",
    description: "Crée un code promo urgence valable 24-48h pour déclencher des achats immédiats",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string", description: "Code promo (ex: FLASH20)" },
        remise: { type: "number", description: "Pourcentage de réduction" },
        duree_heures: { type: "number", description: "Durée de validité en heures" },
        produitId: { type: "string", description: "Limiter à un produit (optionnel)" },
      },
      required: ["code", "remise", "duree_heures"],
    },
  },
  {
    name: "relancer_clients_abandons",
    description: "Envoie des emails de relance personnalisés aux clients avec commandes non finalisées",
    parameters: {
      type: "object",
      properties: {
        segment: { type: "string", enum: ["abandons_24h", "abandons_72h", "inactifs_7j"], description: "Segment à relancer" },
        code_promo: { type: "string", description: "Code promo à inclure (optionnel)" },
      },
      required: ["segment"],
    },
  },
  {
    name: "identifier_produits_sous_valorises",
    description: "Trouve les produits très vendus dont le prix pourrait être augmenté sans perdre de ventes",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "rapport_revenus",
    description: "Génère un rapport détaillé des revenus avec projections et actions recommandées",
    parameters: {
      type: "object",
      properties: {
        periode: { type: "string", enum: ["aujourd_hui", "semaine", "mois", "trimestre"] },
      },
      required: ["periode"],
    },
  },
  {
    name: "memoriser",
    description: "Sauvegarde une information importante pour les prochaines analyses",
    parameters: {
      type: "object",
      properties: {
        cle: { type: "string" },
        valeur: { type: "string" },
      },
      required: ["cle", "valeur"],
    },
  },
];

const executeOutil: (tenantId: string) => ToolExecutor = (tenantId) => async (name, args) => {
  try {
    if (name === "analyser_opportunites_revenus") {
      const jours = args.periode_jours || 30;
      const since = new Date(Date.now() - jours * 24 * 3600 * 1000);

      const [commandes, produitsTop, clientsInactifs, wallet] = await Promise.all([
        prisma.commande.findMany({
          where: { tenantId, createdAt: { gte: since } },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
        prisma.produit.findMany({
          where: { tenantId, actif: true },
          orderBy: { ventes: "desc" },
          take: 10,
        }),
        prisma.client.findMany({
          where: {
            tenantId,
            createdAt: { lte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
          },
          orderBy: { totalDepense: "desc" },
          take: 20,
        }),
        prisma.wallet.findUnique({ where: { tenantId } }),
      ]);

      const caTotal = commandes
        .filter((c) => c.paiementStatut === "completed")
        .reduce((s, c) => s + c.montantTotal, 0);
      const commandesEnAttente = commandes.filter((c) => c.statut === "en_attente");
      const devise = commandes[0]?.devise ?? "XAF";

      return {
        succes: true,
        resultat: JSON.stringify({
          ca_total: caTotal,
          devise,
          nb_commandes: commandes.length,
          commandes_en_attente: commandesEnAttente.length,
          montant_bloque: commandesEnAttente.reduce((s, c) => s + c.montantTotal, 0),
          wallet_solde: wallet?.solde ?? 0,
          produits_top: produitsTop.slice(0, 5).map((p) => ({
            id: p.id,
            nom: p.nom,
            prix: p.prix,
            ventes: p.ventes,
            stock: p.stock,
            revenu_estime: p.prix * p.ventes,
          })),
          clients_inactifs: clientsInactifs.length,
          opportunites: [
            commandesEnAttente.length > 0 && `${commandesEnAttente.length} commande(s) en attente de paiement`,
            clientsInactifs.length > 5 && `${clientsInactifs.length} clients inactifs à relancer`,
            produitsTop.some((p) => p.stock <= 3) && "Produits populaires en rupture imminente",
          ].filter(Boolean),
        }),
      };
    }

    if (name === "ajuster_prix_produit") {
      await prisma.produit.update({
        where: { id: args.produitId, tenantId },
        data: {
          prix: args.nouveauPrix,
          ...(args.prixBarre && { prixCompare: args.prixBarre }),
        },
      });
      await logDecision(tenantId, "agent-revenue", "prix_ajuste",
        `Prix ajusté à ${args.nouveauPrix} (raison: ${args.raison || "optimisation"})`,
        { produitId: args.produitId, nouveauPrix: args.nouveauPrix, prixBarre: args.prixBarre }
      );
      return { succes: true, resultat: `Prix mis à jour : ${args.nouveauPrix}` };
    }

    if (name === "creer_offre_flash") {
      const expireAt = new Date(Date.now() + args.duree_heures * 3600 * 1000);
      await prisma.codePromo.create({
        data: {
          tenantId,
          code: args.code.toUpperCase(),
          type: "pourcentage",
          valeur: args.remise,
          dateExpiration: expireAt,
          actif: true,
        },
      });
      await logDecision(tenantId, "agent-revenue", "offre_flash_cree",
        `Code ${args.code} créé — ${args.remise}% pendant ${args.duree_heures}h`,
        { code: args.code, remise: args.remise },
        args.remise * 50
      );
      return { succes: true, resultat: `Code promo ${args.code} créé (${args.remise}% — expire dans ${args.duree_heures}h)` };
    }

    if (name === "relancer_clients_abandons") {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant || !process.env.RESEND_API_KEY) {
        return { succes: true, resultat: "Mode démo — relance simulée (RESEND_API_KEY non configurée)" };
      }

      let since: Date;
      if (args.segment === "abandons_24h") since = new Date(Date.now() - 24 * 3600 * 1000);
      else if (args.segment === "abandons_72h") since = new Date(Date.now() - 72 * 3600 * 1000);
      else since = new Date(Date.now() - 7 * 24 * 3600 * 1000);

      const clients = await prisma.client.findMany({
        where: { tenantId, createdAt: { lte: since } },
        take: 50,
      });

      let envoyes = 0;
      for (const client of clients) {
        if (!client.email) continue;
        await resend.emails.send({
          from: `${tenant.nomBoutique} <noreply@axso.app>`,
          to: client.email,
          subject: client.nom ? `${client.nom}, on pense à toi 🌟` : "Une offre spéciale pour toi 🌟",
          html: `<p>Bonjour ${client.nom ?? "cher(e) client(e)"},</p>
<p>Nous avons remarqué que vous n'avez pas encore finalisé votre commande chez <strong>${tenant.nomBoutique}</strong>.</p>
${args.code_promo ? `<p>Profitez de <strong>${args.code_promo}</strong> pour obtenir une réduction exclusive !</p>` : ""}
<p>Notre équipe est disponible sur WhatsApp : <a href="https://wa.me/${tenant.whatsapp}">${tenant.whatsapp}</a></p>`,
        });
        envoyes++;
      }

      await logDecision(tenantId, "agent-revenue", "relance_email",
        `${envoyes} client(s) relancés (segment: ${args.segment})`,
        { segment: args.segment, envoyes }
      );
      return { succes: true, resultat: `${envoyes} email(s) de relance envoyé(s)` };
    }

    if (name === "identifier_produits_sous_valorises") {
      const produits = await prisma.produit.findMany({
        where: { tenantId, actif: true, ventes: { gt: 5 } },
        orderBy: { ventes: "desc" },
        take: 20,
      });

      const suggestions = produits
        .filter((p) => p.ventes > 10 && p.stock > 5)
        .map((p) => ({
          id: p.id,
          nom: p.nom,
          prix_actuel: p.prix,
          ventes: p.ventes,
          prix_suggere: Math.round(p.prix * 1.15 / 500) * 500,
          gain_estime: Math.round(p.ventes * p.prix * 0.15),
        }));

      return { succes: true, resultat: JSON.stringify(suggestions) };
    }

    if (name === "rapport_revenus") {
      const periodeMap: Record<string, number> = {
        aujourd_hui: 1, semaine: 7, mois: 30, trimestre: 90,
      };
      const jours = periodeMap[args.periode] ?? 30;
      const since = new Date(Date.now() - jours * 24 * 3600 * 1000);

      const commandes = await prisma.commande.findMany({
        where: { tenantId, createdAt: { gte: since }, paiementStatut: "completed" },
      });

      const ca = commandes.reduce((s, c) => s + c.montantTotal, 0);
      const devise = commandes[0]?.devise ?? "XAF";
      const panier_moyen = commandes.length > 0 ? ca / commandes.length : 0;

      return {
        succes: true,
        resultat: JSON.stringify({
          periode: args.periode,
          ca_total: ca,
          devise,
          nb_commandes: commandes.length,
          panier_moyen: Math.round(panier_moyen),
          projection_mensuelle: jours < 30 ? Math.round((ca / jours) * 30) : ca,
        }),
      };
    }

    if (name === "memoriser") {
      await writeMemory(tenantId, "agent-revenue", args.cle, args.valeur);
      return { succes: true, resultat: `Mémorisé : ${args.cle}` };
    }

    return { succes: false, resultat: `Outil inconnu : ${name}` };
  } catch (err) {
    return { succes: false, resultat: `Erreur : ${err instanceof Error ? err.message : String(err)}` };
  }
};

// Exporté pour l'exécution autonome (lib/agent-consumer.ts) — consomme les
// tâches publiées par l'orchestrateur sans repasser par une requête HTTP.
export { SYSTEM_PROMPT, OUTILS, executeOutil };

export async function POST(req: NextRequest) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const body = schema.parse(await req.json());

  const memoire = await readAllMemory(tenantId, "agent-revenue");
  const contexteMemoire = Object.keys(memoire).length > 0
    ? `\n\nTA MÉMOIRE :\n${Object.entries(memoire).map(([k, v]) => `- ${k}: ${v}`).join("\n")}`
    : "";

  const messages = body.messages ?? [
    { role: "user" as const, content: "Analyse la boutique et prends les meilleures décisions pour maximiser les revenus maintenant." },
  ];

  const result = await runAgent(
    SYSTEM_PROMPT + contexteMemoire,
    messages,
    OUTILS,
    tenantId,
    executeOutil(tenantId),
    8
  );

  return NextResponse.json(result);
}
