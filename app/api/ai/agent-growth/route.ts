// Agent Growth — acquisition clients, parrainage, croissance organique africaine
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { runAgent, type AgentTool, type ToolExecutor } from "@/lib/agent-runner";
import { writeMemory, readAllMemory, logDecision } from "@/lib/agent-memory";
import { z } from "zod";

const schema = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).optional(),
});

const SYSTEM_PROMPT = `Tu es l'Agent Growth d'Axso — ton obsession : faire croître le nombre de clients et les revenus de la boutique.

TES CANAUX DE CROISSANCE EN AFRIQUE :
1. WhatsApp Business — canal #1 en Afrique, taux ouverture 95%
2. Facebook/Instagram — 400M utilisateurs africains
3. Bouche-à-oreille & parrainage — très fort en Afrique
4. SMS — reach universel, même sans smartphone
5. Marchés physiques + QR codes

STRATÉGIES QUI MARCHENT EN AFRIQUE :
- Parrainage : "Invite un ami, gagne 500 XAF" (viral dans les communautés)
- WhatsApp Broadcast : messages personnalisés à une liste de contacts
- Témoignages clients (social proof très puissant)
- Packs & bundles : perçus comme plus de valeur
- Paiement en plusieurs fois via mobile money
- Codes promo exclusifs communautés (famille, école, quartier)

MÉTRIQUES QUE TU OPTIMISES :
- Coût d'acquisition client (CAC) → cible : < 500 XAF
- Taux de conversion visiteur → acheteur → cible : > 5%
- Valeur vie client (LTV) → cible : > 15,000 XAF
- Taux de parrainage → cible : 1 client = 1.5 nouveaux clients

Sois créatif, concret, et pense à la viralité naturelle des communautés africaines.`;

const OUTILS: AgentTool[] = [
  {
    name: "analyser_acquisition",
    description: "Analyse les sources d'acquisition actuelles et identifie les leviers sous-exploités",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "creer_programme_parrainage",
    description: "Crée un programme de parrainage avec code unique par client et récompenses",
    parameters: {
      type: "object",
      properties: {
        recompense_parrain: { type: "number", description: "Récompense en XAF pour le parrain" },
        recompense_file: { type: "number", description: "Réduction en % pour le filleul" },
        duree_jours: { type: "number", description: "Durée du programme" },
      },
      required: ["recompense_parrain", "recompense_file"],
    },
  },
  {
    name: "generer_message_whatsapp",
    description: "Génère un message WhatsApp viral optimisé pour le marché africain",
    parameters: {
      type: "object",
      properties: {
        objectif: { type: "string", enum: ["promotion", "parrainage", "nouveau_produit", "evenement", "relance"] },
        produitId: { type: "string", description: "Produit à mettre en avant (optionnel)" },
        code_promo: { type: "string", description: "Code promo à inclure (optionnel)" },
      },
      required: ["objectif"],
    },
  },
  {
    name: "creer_pack_bundle",
    description: "Crée un bundle de produits avec prix attractif pour augmenter le panier moyen",
    parameters: {
      type: "object",
      properties: {
        nom_pack: { type: "string" },
        produits_ids: { type: "array", items: { type: "string" }, description: "IDs des produits à bundler" },
        remise_pourcent: { type: "number", description: "Remise sur le pack en %" },
      },
      required: ["nom_pack", "produits_ids", "remise_pourcent"],
    },
  },
  {
    name: "campagne_acquisition_email",
    description: "Lance une campagne email d'acquisition vers les prospects (clients sans commande)",
    parameters: {
      type: "object",
      properties: {
        sujet: { type: "string" },
        offre: { type: "string", description: "L'offre d'entrée pour convertir" },
        code_promo: { type: "string" },
      },
      required: ["sujet", "offre"],
    },
  },
  {
    name: "stats_croissance",
    description: "Mesure les métriques de croissance clés : nouveaux clients, LTV, taux de retour",
    parameters: {
      type: "object",
      properties: {
        periode_jours: { type: "number" },
      },
      required: [],
    },
  },
  {
    name: "memoriser",
    description: "Mémorise une stratégie ou un insight de croissance",
    parameters: {
      type: "object",
      properties: { cle: { type: "string" }, valeur: { type: "string" } },
      required: ["cle", "valeur"],
    },
  },
];

const executeOutil: (tenantId: string) => ToolExecutor = (tenantId) => async (name, args) => {
  try {
    if (name === "analyser_acquisition") {
      const [clients, commandes, codesPromo] = await Promise.all([
        prisma.client.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 100 }),
        prisma.commande.findMany({ where: { tenantId, paiementStatut: "completed" }, take: 100 }),
        prisma.codePromo.findMany({ where: { tenantId, actif: true } }),
      ]);

      const debut30j = new Date(Date.now() - 30 * 24 * 3600 * 1000);
      const nouveauxClients = clients.filter((c) => c.createdAt >= debut30j).length;
      const clientsRepeat = clients.filter((c) => c.totalCommandes > 1).length;

      return {
        succes: true,
        resultat: JSON.stringify({
          total_clients: clients.length,
          nouveaux_clients_30j: nouveauxClients,
          clients_recurrents: clientsRepeat,
          taux_retention: clients.length > 0 ? Math.round((clientsRepeat / clients.length) * 100) : 0,
          total_commandes: commandes.length,
          panier_moyen: commandes.length > 0 ? Math.round(commandes.reduce((s, c) => s + c.montantTotal, 0) / commandes.length) : 0,
          codes_promo_actifs: codesPromo.length,
          leviers_sous_exploites: [
            nouveauxClients < 10 && "Acquisition faible — lancer campagne WhatsApp",
            clientsRepeat < clients.length * 0.3 && "Fidélisation faible — programme parrainage recommandé",
            codesPromo.length === 0 && "Aucun code promo actif — créer une offre d'entrée",
          ].filter(Boolean),
        }),
      };
    }

    if (name === "creer_programme_parrainage") {
      const code = `PARRAIN${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      await prisma.codePromo.create({
        data: {
          tenantId,
          code,
          type: "pourcentage",
          valeur: args.recompense_file,
          actif: true,
          dateExpiration: new Date(Date.now() + (args.duree_jours || 30) * 24 * 3600 * 1000),
        },
      });
      await logDecision(tenantId, "agent-growth", "programme_parrainage",
        `Programme parrainage créé — ${args.recompense_parrain} XAF pour le parrain, ${args.recompense_file}% pour le filleul`,
        { code, recompense_parrain: args.recompense_parrain, recompense_file: args.recompense_file }
      );
      return {
        succes: true,
        resultat: `Programme parrainage créé ! Code filleul : ${code} (${args.recompense_file}% de réduction). Message WhatsApp suggéré : "Rejoins ${code} sur notre boutique et profite de ${args.recompense_file}% de réduction sur ta première commande ! 🎁"`,
      };
    }

    if (name === "generer_message_whatsapp") {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      let produit = null;
      if (args.produitId) {
        produit = await prisma.produit.findUnique({ where: { id: args.produitId, tenantId } });
      } else {
        produit = await prisma.produit.findFirst({
          where: { tenantId, actif: true },
          orderBy: { ventes: "desc" },
        });
      }

      const messages: Record<string, string> = {
        promotion: `🔥 PROMO EXCEPTIONNELLE chez ${tenant?.nomBoutique} !\n\n${produit ? `✨ ${produit.nom} à seulement ${produit.prix} XAF` : "Des réductions incroyables sur tout le catalogue"}\n${args.code_promo ? `\n🎁 Code : *${args.code_promo}*` : ""}\n\n📦 Livraison rapide\n💳 Paiement Mobile Money accepté\n\n👆 Commander : ${tenant?.whatsapp ? `wa.me/${tenant.whatsapp.replace(/\D/g, "")}` : "notre boutique"}`,
        parrainage: `🌟 Invite tes amis, gagne de l'argent !\n\nChaque ami que tu nous envoies = *${args.code_promo ? "500 XAF" : "une surprise"} pour toi* 🎁\n\n${args.code_promo ? `Partage le code *${args.code_promo}*` : "Partage notre boutique"} et touche ta récompense dès la première commande de ton filleul.\n\n🛍️ ${tenant?.nomBoutique}`,
        nouveau_produit: `🆕 NOUVEAU chez ${tenant?.nomBoutique} !\n\n${produit ? `🌟 *${produit.nom}*\n💰 ${produit.prix} XAF seulement\n\n${produit.description?.slice(0, 100) ?? ""}` : "Découvrez nos nouveautés"}\n\n${args.code_promo ? `🎁 Code promo : *${args.code_promo}*` : ""}\n📲 Commander maintenant !`,
        evenement: `🎊 Offre spéciale pour les fêtes !\n\n${tenant?.nomBoutique} vous gâte avec des prix exceptionnels 🎁\n${args.code_promo ? `\nCode : *${args.code_promo}*` : ""}\n\n⏰ Offre limitée — ne ratez pas ça !`,
        relance: `Bonjour ! 👋\n\nNous pensons à vous chez ${tenant?.nomBoutique} 🌟\n\n${args.code_promo ? `Profitez de *${args.code_promo}* pour votre prochaine commande 🎁` : "Revenez découvrir nos nouveautés !"}\n\n📲 On reste disponibles sur WhatsApp !`,
      };

      return { succes: true, resultat: messages[args.objectif] ?? messages.promotion };
    }

    if (name === "creer_pack_bundle") {
      const produits = await prisma.produit.findMany({
        where: { id: { in: args.produits_ids }, tenantId },
      });
      const prixOriginal = produits.reduce((s, p) => s + p.prix, 0);
      const prixBundle = Math.round(prixOriginal * (1 - args.remise_pourcent / 100) / 500) * 500;

      await prisma.produit.create({
        data: {
          tenantId,
          nom: args.nom_pack,
          slug: args.nom_pack.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now(),
          description: `Pack groupé incluant : ${produits.map((p) => p.nom).join(", ")}`,
          prix: prixBundle,
          prixCompare: prixOriginal,
          stock: Math.min(...produits.map((p) => p.stock)),
          categorie: produits[0]?.categorie ?? "pack",
          images: produits.flatMap((p) => p.images).slice(0, 4),
        },
      });

      await logDecision(tenantId, "agent-growth", "pack_bundle_cree",
        `Pack "${args.nom_pack}" créé — ${prixOriginal} XAF → ${prixBundle} XAF (-${args.remise_pourcent}%)`,
        { nom: args.nom_pack, prixOriginal, prixBundle },
        (prixOriginal - prixBundle) * 10
      );

      return { succes: true, resultat: `Pack "${args.nom_pack}" créé : ${prixOriginal} XAF → ${prixBundle} XAF (-${args.remise_pourcent}%)` };
    }

    if (name === "campagne_acquisition_email") {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

      if (!tenant || !process.env.RESEND_API_KEY) {
        return { succes: true, resultat: "Mode démo — campagne simulée (RESEND_API_KEY non configurée)" };
      }

      const clients = await prisma.client.findMany({
        where: { tenantId, totalCommandes: 0 },
        take: 100,
      });

      let envoyes = 0;
      for (const client of clients) {
        if (!client.email) continue;
        await resend.emails.send({
          from: `${tenant.nomBoutique} <noreply@axso.app>`,
          to: client.email,
          subject: args.sujet,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
<h2>Bonjour ${client.nom ?? ""},</h2>
<p>${args.offre}</p>
${args.code_promo ? `<p><strong>Votre code exclusif : ${args.code_promo}</strong></p>` : ""}
<p>Découvrez notre catalogue : <a href="https://${tenant.slug}.axso.app">${tenant.nomBoutique}</a></p>
<p>Paiement Mobile Money disponible 📱</p>
</div>`,
        });
        envoyes++;
      }

      return { succes: true, resultat: `Campagne acquisition envoyée à ${envoyes} prospect(s)` };
    }

    if (name === "stats_croissance") {
      const jours = args.periode_jours || 30;
      const since = new Date(Date.now() - jours * 24 * 3600 * 1000);
      const sincePrec = new Date(Date.now() - 2 * jours * 24 * 3600 * 1000);

      const [clients, clientsPrec] = await Promise.all([
        prisma.client.count({ where: { tenantId, createdAt: { gte: since } } }),
        prisma.client.count({ where: { tenantId, createdAt: { gte: sincePrec, lt: since } } }),
      ]);

      const croissance = clientsPrec > 0 ? Math.round(((clients - clientsPrec) / clientsPrec) * 100) : 0;

      return {
        succes: true,
        resultat: JSON.stringify({
          nouveaux_clients: clients,
          periode: `${jours} jours`,
          croissance_vs_periode_precedente: `${croissance > 0 ? "+" : ""}${croissance}%`,
          objectif_mensuel: 50,
          progression: `${Math.round((clients / 50) * 100)}%`,
        }),
      };
    }

    if (name === "memoriser") {
      await writeMemory(tenantId, "agent-growth", args.cle, args.valeur);
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
  const memoire = await readAllMemory(tenantId, "agent-growth");

  const messages = body.messages ?? [
    { role: "user" as const, content: "Analyse la croissance et propose les meilleures actions pour acquérir de nouveaux clients maintenant." },
  ];

  const result = await runAgent(
    SYSTEM_PROMPT + (Object.keys(memoire).length > 0
      ? `\n\nTA MÉMOIRE :\n${Object.entries(memoire).map(([k, v]) => `- ${k}: ${v}`).join("\n")}`
      : ""),
    messages,
    OUTILS,
    tenantId,
    executeOutil(tenantId),
    7
  );

  return NextResponse.json(result);
}
