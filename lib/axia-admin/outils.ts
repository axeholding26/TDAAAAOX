// AXIA admin — outils de l'assistante de l'administrateur. Séparé de l'AXIA
// marchand (lib/axia) : autres données (toute la plateforme), autres droits.
// Lecture libre ; toute action passe par une demande d'accord (AdminAxiaAction)
// que seul l'admin qui l'a demandée peut autoriser (app/api/admin/axia/actions).
import { prisma } from "@/lib/prisma";
import type { AgentTool, ToolExecutor } from "@/lib/agent-runner";
import { PLATFORM_TENANT_SLUG, getPlatformTenantId, getWalletResume } from "@/lib/wallet";
import { totalCommissionsXAF } from "@/lib/finances-admin";
import {
  ErreurAdmin, STATUTS_BOUTIQUE, PLANS, changerStatutBoutique, changerPlanBoutique, certifierBoutique,
  recompenserBoutique, publierPostAxsocial, supprimerPostAxsocial, revoquerMembreAdmin, retirerWalletPlateforme,
  changerActivationLivreur,
} from "@/lib/admin-actions";

const filtreBoutiques = { slug: { not: PLATFORM_TENANT_SLUG } };
const obj = (properties: Record<string, any>, required: string[] = []) => ({ type: "object", properties, required });
const idBoutique = { boutique_id: { type: "string", description: "id de la boutique (donné par chercher_boutiques)" } };

export const OUTILS_LECTURE: AgentTool[] = [
  { name: "stats_plateforme", description: "Chiffres globaux : boutiques, commandes payées, revenus (commissions), clients, livreurs", parameters: obj({}) },
  { name: "chercher_boutiques", description: "Cherche des boutiques par nom, slug ou email du marchand (vide = les plus récentes). Donne leur id, nécessaire pour agir dessus.", parameters: obj({ query: { type: "string" } }) },
  { name: "dernieres_commandes", description: "Dernières commandes payées, éventuellement d'une boutique (slug)", parameters: obj({ slug: { type: "string" } }) },
  { name: "lister_abonnements", description: "Boutiques en plan payant, triées par date d'expiration", parameters: obj({}) },
  { name: "wallet_plateforme", description: "Solde et dernières opérations du wallet de la plateforme", parameters: obj({}) },
  { name: "lister_posts_axsocial", description: "Dernières publications officielles Axso sur AxSocial (avec leur id)", parameters: obj({}) },
  { name: "lister_equipe_admin", description: "Membres de l'équipe d'administration (avec leur id et rôle)", parameters: obj({}) },
  { name: "lister_livreurs", description: "Livreurs de la plateforme avec leur id et leur état : en attente de validation, actif, suspendu ; boutique, livraisons réussies et échecs, dernière position. filtre = a_valider pour ne voir que les inscriptions à valider.", parameters: obj({ filtre: { type: "string", enum: ["tous", "a_valider", "suspendus"] } }) },
  { name: "livraisons_en_cours", description: "Courses en route ou en échec sur toute la plateforme : boutique, livreur, heure de départ, fraîcheur de la position — les plus anciennes d'abord", parameters: obj({}) },
];

// Chaque action ci-dessous est exactement ce que l'admin peut faire à la main dans l'administration.
export const OUTILS_ACTION: (AgentTool & { libelle: string })[] = [
  { name: "changer_statut_boutique", libelle: "Changer le statut d'une boutique", description: "Activer, suspendre ou supprimer une boutique", parameters: obj({ ...idBoutique, statut: { type: "string", enum: [...STATUTS_BOUTIQUE] } }, ["boutique_id", "statut"]) },
  { name: "changer_plan_boutique", libelle: "Changer le plan d'une boutique", description: "Attribuer un plan (palier0 = gratuit, palier1 = Pro, palier2 = Illimité) pour un nombre de jours", parameters: obj({ ...idBoutique, plan: { type: "string", enum: [...PLANS] }, jours: { type: "number", description: "Durée en jours (30 par défaut)" } }, ["boutique_id", "plan"]) },
  { name: "certifier_boutique", libelle: "Certifier une boutique", description: "Donner ou retirer le badge « certifiée »", parameters: obj({ ...idBoutique, certifie: { type: "boolean" } }, ["boutique_id", "certifie"]) },
  { name: "recompenser_boutique", libelle: "Récompenser une boutique", description: "Créditer un bonus sur le wallet du marchand et/ou lui attribuer un badge", parameters: obj({ ...idBoutique, montant: { type: "number" }, raison: { type: "string" }, titre: { type: "string", description: "Titre du badge" }, emoji: { type: "string" } }, ["boutique_id"]) },
  { name: "publier_post_axsocial", libelle: "Publier sur AxSocial", description: "Publier un message officiel Axso sur AxSocial", parameters: obj({ contenu: { type: "string" } }, ["contenu"]) },
  { name: "supprimer_post_axsocial", libelle: "Supprimer une publication AxSocial", description: "Supprimer une publication officielle Axso", parameters: obj({ post_id: { type: "string" } }, ["post_id"]) },
  { name: "revoquer_membre_admin", libelle: "Révoquer un membre de l'équipe admin", description: "Supprimer un compte admin en lecture seule", parameters: obj({ user_id: { type: "string" } }, ["user_id"]) },
  { name: "valider_livreur", libelle: "Valider un livreur", description: "Activer un livreur en attente de validation (ou réactiver un livreur suspendu) : il pourra recevoir des livraisons", parameters: obj({ livreur_id: { type: "string", description: "id donné par lister_livreurs" } }, ["livreur_id"]) },
  { name: "suspendre_livreur", libelle: "Suspendre un livreur", description: "Suspendre un livreur : il ne peut plus être assigné à une commande", parameters: obj({ livreur_id: { type: "string", description: "id donné par lister_livreurs" } }, ["livreur_id"]) },
  { name: "retrait_wallet_plateforme", libelle: "Retirer de l'argent du wallet de la plateforme", description: "Retrait du wallet plateforme vers mobile money ou virement", parameters: obj({ montant: { type: "number" }, methode: { type: "string", enum: ["mobile_money", "virement_bancaire"] }, destinataire: { type: "string", description: "Numéro ou IBAN" }, operateur: { type: "string" }, notes: { type: "string" } }, ["montant", "methode", "destinataire"]) },
];

const LIBELLES = Object.fromEntries(OUTILS_ACTION.map((o) => [o.name, o.libelle]));
export const estActionAdmin = (nom: string) => nom in LIBELLES;

const ok = (resultat: string) => ({ succes: true, resultat });

export const executerLecture: ToolExecutor = async (name, args) => {
  switch (name) {
    case "stats_plateforme": {
      const debutMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const [boutiques, actives, commandes, commandesMois, revenus, revenusMois, enAttente, clients, livreurs] = await Promise.all([
        prisma.tenant.count({ where: filtreBoutiques }),
        prisma.tenant.count({ where: { statut: "active", ...filtreBoutiques } }),
        prisma.commande.count({ where: { paiementStatut: "completed" } }),
        prisma.commande.count({ where: { paiementStatut: "completed", createdAt: { gte: debutMois } } }),
        totalCommissionsXAF({ statut: "captured" }),
        totalCommissionsXAF({ statut: "captured", createdAt: { gte: debutMois } }),
        totalCommissionsXAF({ statut: "pending" }),
        prisma.client.count(),
        prisma.livreur.count({ where: { actif: true } }),
      ]);
      return ok(`Boutiques : ${actives} actives / ${boutiques}\nCommandes payées : ${commandes} (${commandesMois} ce mois)\nRevenus capturés : ${revenus.toLocaleString()} XAF (${revenusMois.toLocaleString()} ce mois)\nEn attente de capture : ${enAttente.toLocaleString()} XAF\nClients : ${clients}\nLivreurs actifs : ${livreurs}`);
    }
    case "chercher_boutiques": {
      const q = args.query?.trim();
      const boutiques = await prisma.tenant.findMany({
        where: { ...filtreBoutiques, ...(q && { OR: [
          { nomBoutique: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ] }) },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, nomBoutique: true, slug: true, email: true, statut: true, planType: true, planExpiresAt: true, certifie: true, pays: true, createdAt: true, _count: { select: { commandes: true, produits: true } } },
      });
      if (!boutiques.length) return ok("Aucune boutique trouvée.");
      return ok(boutiques.map((b) =>
        `• ${b.nomBoutique} (slug ${b.slug}, id ${b.id}) — ${b.email} — ${b.statut}${b.certifie ? " — certifiée" : ""} — plan ${b.planType}${b.planExpiresAt ? ` jusqu'au ${b.planExpiresAt.toLocaleDateString("fr-FR")}` : ""} — ${b.pays} — ${b._count.produits} produits, ${b._count.commandes} commandes — créée le ${b.createdAt.toLocaleDateString("fr-FR")}`
      ).join("\n"));
    }
    case "dernieres_commandes": {
      const commandes = await prisma.commande.findMany({
        where: { paiementStatut: "completed", ...(args.slug && { tenant: { slug: args.slug } }) },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { tenant: { select: { nomBoutique: true } } },
      });
      if (!commandes.length) return ok("Aucune commande payée trouvée.");
      return ok(commandes.map((c) => `• ${c.numero} — ${c.tenant.nomBoutique} — ${c.montantTotal.toLocaleString()} ${c.devise} — ${c.statut} — ${c.createdAt.toLocaleDateString("fr-FR")}`).join("\n"));
    }
    case "lister_abonnements": {
      const boutiques = await prisma.tenant.findMany({
        where: { ...filtreBoutiques, planType: { not: "palier0" } },
        orderBy: { planExpiresAt: "asc" },
        take: 25,
        select: { id: true, nomBoutique: true, planType: true, planExpiresAt: true },
      });
      if (!boutiques.length) return ok("Aucune boutique en plan payant.");
      return ok(boutiques.map((b) => `• ${b.nomBoutique} (id ${b.id}) — ${b.planType} — expire ${b.planExpiresAt ? `le ${b.planExpiresAt.toLocaleDateString("fr-FR")}` : "jamais"}`).join("\n"));
    }
    case "wallet_plateforme": {
      const w = await getWalletResume(await getPlatformTenantId());
      if (!w) return ok("Le wallet de la plateforme est vide (aucune opération).");
      return ok(`Solde : ${w.solde.toLocaleString()} ${w.devise}\nTotal reçu : ${w.totalRecu.toLocaleString()} — total retiré : ${w.totalRetire.toLocaleString()} — retraits en attente : ${w.retraitsEnAttente.toLocaleString()}\nDernières opérations :\n${w.transactions.slice(0, 8).map((t) => `• ${t.createdAt.toLocaleDateString("fr-FR")} — ${t.description} — ${t.montant.toLocaleString()} ${t.devise} (${t.statut})`).join("\n")}`);
    }
    case "lister_posts_axsocial": {
      const posts = await prisma.postSocial.findMany({
        where: { tenantId: await getPlatformTenantId() },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { _count: { select: { reactions: true, commentaires: true } } },
      });
      if (!posts.length) return ok("Aucune publication officielle.");
      return ok(posts.map((p) => `• id ${p.id} — ${p.createdAt.toLocaleDateString("fr-FR")} — « ${(p.contenu ?? "").slice(0, 100)} » — ${p._count.reactions} réactions, ${p._count.commentaires} commentaires`).join("\n"));
    }
    case "lister_equipe_admin": {
      const membres = await prisma.user.findMany({ where: { role: { in: ["admin", "admin_lecteur"] } }, select: { id: true, email: true, name: true, role: true } });
      return ok(membres.map((m) => `• ${m.name ?? m.email} (${m.email}, id ${m.id}) — ${m.role === "admin" ? "admin complet" : "lecture seule"}`).join("\n"));
    }
    case "lister_livreurs": {
      const where = args.filtre === "a_valider" ? { actif: false, valideAt: null } : args.filtre === "suspendus" ? { actif: false, valideAt: { not: null } } : {};
      const livreurs = await prisma.livreur.findMany({
        where, orderBy: [{ actif: "asc" }, { createdAt: "desc" }], take: 40,
        select: { id: true, nom: true, telephone: true, vehicule: true, zone: true, actif: true, valideAt: true, disponible: true, positionAt: true, createdAt: true, user: { select: { email: true } }, tenant: { select: { nomBoutique: true } } },
      });
      if (!livreurs.length) return ok(args.filtre === "a_valider" ? "Aucun livreur en attente de validation." : "Aucun livreur.");
      const [livrees, echecs] = await Promise.all([
        prisma.commande.groupBy({ by: ["livreurId"], where: { livreurId: { in: livreurs.map((l) => l.id) }, statut: "livree" }, _count: true }),
        prisma.commande.groupBy({ by: ["livreurId"], where: { livreurId: { in: livreurs.map((l) => l.id) }, echecCount: { gt: 0 } }, _sum: { echecCount: true } }),
      ]);
      const nbL = new Map(livrees.map((g) => [g.livreurId, g._count])), nbE = new Map(echecs.map((g) => [g.livreurId, g._sum.echecCount ?? 0]));
      return ok(livreurs.map((l) => [
        `• ${l.nom} (id ${l.id}) — ${l.user.email} — ${l.telephone}`,
        l.actif ? (l.disponible ? "actif, disponible" : "actif, indisponible") : l.valideAt ? "SUSPENDU" : "EN ATTENTE DE VALIDATION",
        l.tenant ? `boutique ${l.tenant.nomBoutique}` : "indépendant",
        `${l.vehicule}${l.zone ? `, zone ${l.zone}` : ""}`,
        `${nbL.get(l.id) ?? 0} livrée(s), ${nbE.get(l.id) ?? 0} échec(s)`,
        l.positionAt ? `position du ${l.positionAt.toLocaleString("fr-FR")}` : "position jamais partagée",
        `inscrit le ${l.createdAt.toLocaleDateString("fr-FR")}`,
      ].join(" — ")).join("\n"));
    }
    case "livraisons_en_cours": {
      const commandes = await prisma.commande.findMany({
        where: { livreurId: { not: null }, statut: { in: ["expediee", "tentative_echouee"] } },
        orderBy: [{ expedieeAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }], take: 40,
        select: { numero: true, statut: true, ville: true, expedieeAt: true, echecCount: true, echecRaison: true, livreurPosition: true, livreurNom: true, tenant: { select: { nomBoutique: true } } },
      });
      if (!commandes.length) return ok("Aucune livraison en route.");
      return ok(commandes.map((c) => {
        const maj = (c.livreurPosition as { updatedAt?: string } | null)?.updatedAt;
        return [
          `• #${c.numero} — ${c.tenant.nomBoutique} — ${c.ville} — ${c.livreurNom ?? "livreur"}`,
          c.statut === "expediee" ? "en route" : `échec ×${c.echecCount}${c.echecRaison ? ` (${c.echecRaison})` : ""}`,
          c.expedieeAt ? `parti le ${c.expedieeAt.toLocaleString("fr-FR")}` : "heure de départ inconnue",
          maj ? `dernière position le ${new Date(maj).toLocaleString("fr-FR")}` : "position jamais partagée",
        ].join(" — ");
      }).join("\n"));
    }
  }
  return { succes: false, resultat: "Outil inconnu." };
};

/** Exécute une action admin — uniquement après l'accord de l'admin. */
export async function executerAction(nom: string, a: Record<string, any>, adminId: string) {
  try {
    switch (nom) {
      case "changer_statut_boutique": await changerStatutBoutique(a.boutique_id, a.statut); return ok(`Statut passé à « ${a.statut} ».`);
      case "changer_plan_boutique": {
        const r = await changerPlanBoutique(a.boutique_id, a.plan, a.jours);
        return ok(`Plan ${r.plan} attribué${r.planExpiresAt ? ` jusqu'au ${r.planExpiresAt.toLocaleDateString("fr-FR")}` : ""}.`);
      }
      case "certifier_boutique": await certifierBoutique(a.boutique_id, a.certifie); return ok(a.certifie ? "Boutique certifiée." : "Certification retirée.");
      case "recompenser_boutique": await recompenserBoutique(a.boutique_id, a); return ok("Récompense attribuée.");
      case "publier_post_axsocial": await publierPostAxsocial(a.contenu); return ok("Publication en ligne sur AxSocial.");
      case "supprimer_post_axsocial": await supprimerPostAxsocial(a.post_id); return ok("Publication supprimée.");
      case "revoquer_membre_admin": await revoquerMembreAdmin(a.user_id, adminId); return ok("Accès révoqué.");
      case "retrait_wallet_plateforme": await retirerWalletPlateforme(a as any); return ok("Retrait initié.");
      case "valider_livreur": await changerActivationLivreur(a.livreur_id, true); return ok("Livreur validé : il peut recevoir des livraisons.");
      case "suspendre_livreur": await changerActivationLivreur(a.livreur_id, false); return ok("Livreur suspendu.");
    }
    return { succes: false, resultat: "Action inconnue." };
  } catch (err: any) {
    return { succes: false, resultat: err instanceof ErreurAdmin ? err.message : `Erreur : ${err?.message?.slice(0, 150) ?? "inconnue"}` };
  }
}

/** Texte lisible de la carte d'accord (les ids sont remplacés par les noms). */
export async function decrireAction(nom: string, a: Record<string, any>): Promise<string> {
  const boutique = a.boutique_id ? await prisma.tenant.findUnique({ where: { id: a.boutique_id }, select: { nomBoutique: true } }) : null;
  const livreur = a.livreur_id ? await prisma.livreur.findUnique({ where: { id: a.livreur_id }, select: { nom: true, telephone: true } }) : null;
  const details = Object.entries(a)
    .filter(([k, v]) => k !== "boutique_id" && k !== "livreur_id" && v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k.replace(/_/g, " ")} : ${String(v).slice(0, 120)}`);
  return [LIBELLES[nom], boutique && `« ${boutique.nomBoutique} »`, livreur && `${livreur.nom} (${livreur.telephone})`, ...details].filter(Boolean).join(" — ");
}
