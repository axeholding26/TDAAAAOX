// Agent Livraison — routing livreurs, statuts commandes, exceptions
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runAgent, type AgentTool, type ToolExecutor } from "@/lib/agent-runner";
import { changerStatutCommande, assignerLivreurCommande } from "@/lib/cycle-livraison";
import { STATUTS_COURSE_ACTIVE } from "@/lib/commandes";
import { estSensible, demanderConfirmation } from "@/lib/axia/confirmation";
import { requireNiveau } from "@/lib/permissions-server";
import { z } from "zod";

const schema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })),
});

const PROMPT = `Tu es l'Agent Livraison d'Axso, expert en logistique e-commerce pour l'Afrique.
Tu optimises le routing des livreurs, gères les statuts et résous les exceptions de livraison.

Tes capacités :
- Voir les commandes en attente d'assignation
- Identifier les livreurs disponibles et leurs positions
- Assigner les livreurs aux commandes de façon optimale
- Mettre à jour les statuts de livraison
- Créer des notifications pour les livreurs

Critères d'assignation optimale :
1. Livreur disponible et actif en priorité
2. Zone de livraison compatible si renseignée
3. Livreur avec le moins de commandes actives

Sois proactif : propose toujours d'assigner les commandes non traitées.`;

const OUTILS: AgentTool[] = [
  {
    name: "lire_dashboard_livraison",
    description: "Vue d'ensemble : commandes à assigner, en cours, livreurs disponibles",
    parameters: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "lister_commandes_a_assigner",
    description: "Liste les commandes confirmées sans livreur assigné",
    parameters: {
      type: "object" as const,
      properties: {
        limite: { type: "number", description: "Nombre max de commandes" },
      },
      required: [],
    },
  },
  {
    name: "lister_livreurs_disponibles",
    description: "Liste les livreurs actifs et disponibles avec leur position",
    parameters: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "assigner_livreur",
    description: "Assigne un livreur à une commande et notifie le livreur",
    parameters: {
      type: "object" as const,
      properties: {
        commandeId: { type: "string", description: "ID de la commande" },
        livreurId: { type: "string", description: "ID du livreur" },
      },
      required: ["commandeId", "livreurId"],
    },
  },
  {
    name: "mettre_a_jour_statut",
    description: "Met à jour le statut de livraison d'une commande",
    parameters: {
      type: "object" as const,
      properties: {
        commandeId: { type: "string", description: "ID de la commande" },
        statut: { type: "string", enum: ["confirmee", "en_preparation", "expediee", "livree", "tentative_echouee", "annulee"], description: "Nouveau statut" },
        raison: { type: "string", description: "Raison de l'échec (pour tentative_echouee)" },
        numeroSuivi: { type: "string", description: "Numéro de suivi transporteur" },
      },
      required: ["commandeId", "statut"],
    },
  },
  {
    name: "lire_commande",
    description: "Lit les détails complets d'une commande avec livreur assigné",
    parameters: {
      type: "object" as const,
      properties: {
        commandeId: { type: "string", description: "ID de la commande" },
      },
      required: ["commandeId"],
    },
  },
];

const executeOutil: ToolExecutor = async (nom, args, tenantId) => {
  try {
    switch (nom) {
      case "lire_dashboard_livraison": {
        const [aAssigner, enCours, livrees, livreurs] = await Promise.all([
          prisma.commande.count({ where: { tenantId, statut: { in: ["confirmee", "en_preparation"] }, livreurId: null } }),
          prisma.commande.count({ where: { tenantId, statut: "expediee" } }),
          prisma.commande.count({ where: { tenantId, statut: "livree" } }),
          prisma.livreur.count({ where: { OR: [{ tenantId }, { tenantId: null }], disponible: true, actif: true } }),
        ]);
        return {
          succes: true,
          resultat: JSON.stringify({ a_assigner: aAssigner, en_cours: enCours, livrees_total: livrees, livreurs_disponibles: livreurs }),
        };
      }

      case "lister_commandes_a_assigner": {
        const commandes = await prisma.commande.findMany({
          where: { tenantId, statut: { in: ["confirmee", "en_preparation"] }, livreurId: null },
          orderBy: { createdAt: "asc" },
          take: args.limite ?? 10,
          select: {
            id: true, numero: true, clientNom: true, clientTelephone: true,
            adresseLivraison: true, ville: true, montantTotal: true, devise: true, createdAt: true,
          },
        });
        return { succes: true, resultat: JSON.stringify(commandes) };
      }

      case "lister_livreurs_disponibles": {
        const livreurs = await prisma.livreur.findMany({
          where: { OR: [{ tenantId }, { tenantId: null }], disponible: true, actif: true },
          select: {
            id: true, nom: true, telephone: true, vehicule: true, zone: true,
            latitude: true, longitude: true,
            commandes: { where: { statut: { in: STATUTS_COURSE_ACTIVE } }, select: { id: true } },
          },
        });
        const avecCharge = livreurs.map((l) => ({
          ...l,
          commandes_actives: l.commandes.length,
          commandes: undefined,
        }));
        return { succes: true, resultat: JSON.stringify(avecCharge) };
      }

      // Mêmes contrôles et effets que l'interface (lib/cycle-livraison.ts) ; jamais exécuté sans
      // l'accord du marchand (assigner_livreur et mettre_a_jour_statut sont des actions sensibles).
      case "assigner_livreur": {
        const r = await assignerLivreurCommande({ commandeId: args.commandeId, tenantId, livreurId: args.livreurId || null, source: "axia" });
        return r.ok
          ? { succes: true, resultat: `✅ Commande ${r.numero} assignée à ${r.livreurNom}` }
          : { succes: false, resultat: r.error };
      }

      case "mettre_a_jour_statut": {
        const r = await changerStatutCommande({ commandeId: args.commandeId, statut: args.statut, echecRaison: args.raison, acteur: { type: "marchand", tenantId, source: "axia" } });
        if (!r.ok) return { succes: false, resultat: r.error };
        if (args.numeroSuivi) await prisma.commande.update({ where: { id: args.commandeId }, data: { numeroSuivi: args.numeroSuivi } });
        return { succes: true, resultat: `✅ Commande ${r.numero} → statut : ${r.statut}` };
      }

      case "lire_commande": {
        const commande = await prisma.commande.findFirst({
          where: { id: args.commandeId, tenantId },
          include: {
            livreur: { select: { nom: true, telephone: true, vehicule: true } },
            lignes: { select: { nom: true, quantite: true, prix: true } },
          },
        });
        if (!commande) return { succes: false, resultat: "Commande introuvable" };
        return { succes: true, resultat: JSON.stringify(commande) };
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

    // Mêmes droits qu'à la main, et actions sensibles soumises à l'accord du marchand
    const refus = await requireNiveau(session, "commandes", "lecture");
    if (refus) return NextResponse.json({ message: refus.error }, { status: refus.status });
    const { messages } = schema.parse(await request.json());
    const executer: ToolExecutor = (nom, args, tid) =>
      estSensible(nom) ? demanderConfirmation(tid, nom, args, "agent-livraison", true) : executeOutil(nom, args, tid);
    const result = await runAgent(PROMPT, messages, OUTILS, tenantId, executer);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ message: "Format invalide" }, { status: 400 });
    console.error("[AGENT/LIVRAISON]", err);
    return NextResponse.json({ message: "Erreur agent livraison" }, { status: 500 });
  }
}
