// Cycle de livraison d'une commande : changement de statut et assignation d'un
// livreur. Point de passage unique pour l'interface (marchand et livreur), AXIA,
// les agents IA et les actions autorisées depuis la bulle AXIA — mêmes contrôles
// (transitions, code de remise, périmètre des livreurs, quota) et mêmes effets
// (WhatsApp, notifications, commission, analytics) quel que soit l'acteur.
import { randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { TRANSITIONS_VALIDES, livraisonStatutPour } from "@/lib/commandes";
import { capturerCommissionAffiliation } from "@/lib/affiliation";
import { quotaCommandesAtteint } from "@/lib/abonnement";
import { notifierMarchand } from "@/lib/notifications-marchand";
import { notifierClientWhatsApp, notifierLivreurAssigneWhatsApp, notifierLivreurNouvelleCourse } from "@/lib/whatsapp";
import { PAIEMENT } from "@/lib/commandes";
import { compterVentes } from "@/lib/stock";
import { libererCommande, rembourserCommande } from "@/lib/remboursement";

// "interface" : le marchand a cliqué lui-même, il reçoit le lien WhatsApp de secours dans la réponse.
// "axia" : action d'AXIA (directe ou autorisée dans la bulle), le lien de secours part dans ses notifications.
export type Acteur =
  | { type: "livreur"; userId: string }
  | { type: "marchand"; tenantId: string; source: "interface" | "axia" };

export type Resultat<T = {}> =
  | ({ ok: true } & T)
  | { ok: false; status: number; error: string; code?: string };

const QUOTA_ATTEINT = { ok: false as const, status: 403, code: "quota_atteint", error: "Quota de commandes du Palier 0 atteint ce mois-ci — passez à un palier supérieur pour continuer à gérer vos commandes." };

// Au-delà, le livreur ne peut plus confirmer : le marchand vérifie avec le client et confirme lui-même.
const MAX_ESSAIS_CODE = 5;

// Ce que le marchand voit dans ses notifications quand le livreur agit lui-même.
const NOTIF_LIVREUR: Record<string, { type: string; titre: (n: string) => string }> = {
  expediee:          { type: "livraison_demarree", titre: n => `Livraison #${n} démarrée` },
  livree:            { type: "livraison_terminee", titre: n => `Commande #${n} livrée` },
  tentative_echouee: { type: "livraison_echec",    titre: n => `Échec de livraison #${n}` },
};

/**
 * Message WhatsApp non parti automatiquement (boutique sans WhatsApp connecté…) :
 * sans ce relais, seul le marchand qui clique dans l'interface voyait le lien de
 * secours — une action du livreur ou d'AXIA laissait le destinataire sans rien.
 */
async function relayerWhatsAppNonEnvoye(p: { tenantId: string; commandeId: string; numero: string; destinataire: string; whatsappUrl: string | null }) {
  if (!p.whatsappUrl) return;
  await notifierMarchand({
    tenantId: p.tenantId,
    type: "whatsapp_a_envoyer",
    titre: `WhatsApp à envoyer — #${p.numero}`,
    message: `L'envoi automatique au ${p.destinataire} n'a pas fonctionné. Touche pour l'envoyer toi-même.`,
    lien: p.whatsappUrl,
    commandeId: p.commandeId,
  });
}

export async function changerStatutCommande(p: {
  commandeId: string;
  statut: string;
  acteur: Acteur;
  echecRaison?: string | null;
  code?: string | null;
}): Promise<Resultat<{ statut: string; numero: string; envoyeAuto: boolean; whatsappUrl: string | null }>> {
  const { commandeId: id, statut, acteur } = p;
  const commande = await prisma.commande.findUnique({
    where: { id },
    include: { commission: true, tenant: { select: { slug: true, nomBoutique: true } } },
  });
  if (!commande) return { ok: false, status: 404, error: "Commande introuvable" };

  if (acteur.type === "livreur") {
    // Pas de filtre tenantId : un livreur plateforme (tenantId null) assigné
    // doit pouvoir faire avancer la commande ; l'assignation suffit.
    const livreur = await prisma.livreur.findFirst({ where: { userId: acteur.userId }, select: { id: true, actif: true } });
    if (!livreur || commande.livreurId !== livreur.id) return { ok: false, status: 403, error: "Accès refusé" };
    if (!livreur.actif) return { ok: false, status: 403, error: "Compte livreur suspendu ou en attente de validation : la boutique termine la livraison" };
    if (!["expediee", "livree", "tentative_echouee"].includes(statut)) {
      return { ok: false, status: 403, error: "Le livreur peut seulement démarrer la livraison, marquer comme livré ou signaler un échec" };
    }
  } else if (commande.tenantId !== acteur.tenantId) {
    return { ok: false, status: 404, error: "Commande introuvable" };
  }

  if (await quotaCommandesAtteint(commande.tenantId)) return QUOTA_ATTEINT;

  if (!(TRANSITIONS_VALIDES[commande.statut] || []).includes(statut)) {
    return { ok: false, status: 400, error: `Transition invalide : ${commande.statut} → ${statut}` };
  }

  // Preuve de remise : le livreur doit saisir le code que seul le client a reçu.
  // Le marchand n'en a pas besoin. Les commandes parties avant l'ajout du code n'en ont pas.
  if (acteur.type === "livreur" && statut === "livree" && commande.codeLivraison) {
    const bloque = { ok: false as const, status: 423, code: "code_bloque", error: "Trop de codes incorrects : demandez à la boutique de confirmer la livraison" };
    if (commande.codeEssais >= MAX_ESSAIS_CODE) return bloque;
    if (String(p.code ?? "").trim() !== commande.codeLivraison) {
      const { codeEssais } = await prisma.commande.update({ where: { id }, data: { codeEssais: { increment: 1 } }, select: { codeEssais: true } });
      const restants = Math.max(0, MAX_ESSAIS_CODE - codeEssais);
      return restants ? { ok: false, status: 400, code: "code_incorrect", error: `Code incorrect — ${restants} essai(s) restant(s)` } : bloque;
    }
  }

  // Annuler une commande déjà payée en ligne, c'est d'abord la rembourser : si
  // NotchPay refuse, la commande n'est pas annulée. La marchandise n'est pas
  // encore livrée (annulee n'est possible qu'avant), elle revient donc en stock.
  if (statut === "annulee" && commande.paiementStatut === PAIEMENT.PAYE) {
    const r = await rembourserCommande({ commandeId: id, tenantId: commande.tenantId, motif: `Annulation #${commande.numero}`, restock: true });
    if (!r.ok) return r;
  }

  // Même code sur toutes les tentatives : le client garde celui reçu au premier départ.
  const codeLivraison = statut === "expediee"
    ? commande.codeLivraison ?? String(randomInt(0, 10000)).padStart(4, "0")
    : commande.codeLivraison;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // dejaVente : paiement en ligne déjà reçu (wallet crédité dans le webhook)
  const dejaVente = commande.paiementStatut === "completed";
  // dejaCommission : livraison déjà traitée (analytics déjà enregistrée)
  const dejaCommission = commande.commission?.statut === "captured";

  await prisma.$transaction(async (tx) => {
    await tx.commande.update({
      where: { id },
      data: {
        statut,
        livraisonStatut: livraisonStatutPour(statut),
        ...(statut === "expediee" ? { expedieeAt: now, codeLivraison } : {}),
        ...(statut === "livree" ? { livreeAt: now } : {}),
        // COD : marquer le paiement complété à la livraison
        ...(statut === "livree" && !dejaVente ? { paiementStatut: PAIEMENT.PAYE } : {}),
        ...(statut === "tentative_echouee" ? { echecRaison: p.echecRaison || null, echecCount: { increment: 1 } } : {}),
        updatedAt: now,
      },
    });

    // Annulation : stock, code promo et commissions d'affiliation libérés.
    if (statut === "annulee") {
      await libererCommande(tx, { commandeId: id, motif: `Annulation #${commande.numero}`, restock: true });
    }

    if (statut === "livree") {
      // Paiement à la livraison : la vente est acquise maintenant.
      if (!dejaVente) await compterVentes(tx, id, 1);
      if (commande.commission && commande.commission.statut !== "captured") {
        await tx.commission.update({ where: { commandeId: id }, data: { statut: "captured", capturedAt: now } });
      }
      // Vente comptée dans le CA à la livraison confirmée (garde dejaCommission contre les doublons)
      if (!dejaCommission) {
        await tx.analytics.create({
          data: { tenantId: commande.tenantId, type: "purchase", date: today, valeur: commande.montantTotal / 10000, metadata: { commandeId: id, source: "marchand_livree" } },
        });
      }
    }
  });

  if (statut === "livree") await capturerCommissionAffiliation(id).catch(() => {});

  if (acteur.type === "livreur" && NOTIF_LIVREUR[statut]) {
    await notifierMarchand({
      tenantId: commande.tenantId,
      type: NOTIF_LIVREUR[statut].type,
      titre: NOTIF_LIVREUR[statut].titre(commande.numero),
      message: `${commande.livreurNom ?? "Le livreur"} · ${commande.clientNom}, ${commande.ville}${statut === "tentative_echouee" && p.echecRaison ? ` · ${p.echecRaison}` : ""}`,
      lien: `/dashboard/commandes/${id}`,
      commandeId: id,
    });
  }

  // Pas de crédit wallet pour les commandes COD : le client paie le marchand
  // directement, Axso ne reçoit jamais cet argent (voir lib/wallet.ts).
  const { envoyeAuto, whatsappUrl } = await notifierClientWhatsApp({
    telephone: commande.clientTelephone,
    statut,
    numero: commande.numero,
    boutique: commande.tenant.nomBoutique,
    slug: commande.tenant.slug,
    trackingToken: commande.trackingToken,
    tenantId: commande.tenantId,
    codeLivraison: statut === "expediee" ? codeLivraison : null,
  });

  const interfaceMarchand = acteur.type === "marchand" && acteur.source === "interface";
  if (!envoyeAuto && !interfaceMarchand) {
    await relayerWhatsAppNonEnvoye({ tenantId: commande.tenantId, commandeId: id, numero: commande.numero, destinataire: "client", whatsappUrl });
  }

  return { ok: true, statut, numero: commande.numero, envoyeAuto, whatsappUrl: interfaceMarchand ? whatsappUrl : null };
}

export async function assignerLivreurCommande(p: {
  commandeId: string;
  tenantId: string;
  livreurId: string | null;
  source: "interface" | "axia";
}): Promise<Resultat<{ numero: string; livreurNom: string | null; whatsappLivreurUrl: string | null; whatsappClientUrl: string | null }>> {
  const commande = await prisma.commande.findUnique({
    where: { id: p.commandeId },
    include: { tenant: { select: { nomBoutique: true, slug: true } } },
  });
  if (!commande || commande.tenantId !== p.tenantId) return { ok: false, status: 404, error: "Commande introuvable" };
  if (await quotaCommandesAtteint(p.tenantId)) return QUOTA_ATTEINT;
  if (["livree", "annulee"].includes(commande.statut)) {
    return { ok: false, status: 400, error: "Commande déjà livrée ou annulée : impossible de changer de livreur" };
  }

  let livreur: { id: string; nom: string; telephone: string } | null = null;
  if (p.livreurId) {
    // Livreurs de la boutique ou indépendants (tenantId null) — jamais le livreur privé d'une autre boutique
    livreur = await prisma.livreur.findFirst({
      where: { id: p.livreurId, actif: true, OR: [{ tenantId: p.tenantId }, { tenantId: null }] },
      select: { id: true, nom: true, telephone: true },
    });
    if (!livreur) return { ok: false, status: 404, error: "Livreur introuvable, inactif ou rattaché à une autre boutique" };
  }

  await prisma.commande.update({
    where: { id: commande.id },
    data: { livreurId: livreur?.id ?? null, livreurNom: livreur?.nom ?? null, livreurTelephone: livreur?.telephone ?? null },
  });

  let whatsappLivreurUrl: string | null = null;
  let whatsappClientUrl: string | null = null;
  if (livreur && livreur.id !== commande.livreurId) {
    await prisma.notification.create({
      data: {
        livreurId: livreur.id,
        type: "nouvelle_commande",
        titre: "Nouvelle livraison assignée",
        message: `Commande #${commande.numero} — ${commande.adresseLivraison}, ${commande.ville}`,
        commandeId: commande.id,
      },
    }).catch(() => {});

    const versLivreur = await notifierLivreurNouvelleCourse({
      telephone: livreur.telephone, numero: commande.numero, boutique: commande.tenant.nomBoutique,
      adresse: commande.adresseLivraison, ville: commande.ville, commandeId: commande.id, tenantId: commande.tenantId,
    }).catch(() => ({ envoyeAuto: false, whatsappUrl: null }));
    const versClient = commande.clientTelephone
      ? await notifierLivreurAssigneWhatsApp({
          telephone: commande.clientTelephone, numero: commande.numero, boutique: commande.tenant.nomBoutique,
          slug: commande.tenant.slug, trackingToken: commande.trackingToken, livreurNom: livreur.nom, tenantId: commande.tenantId,
        }).catch(() => ({ envoyeAuto: false, whatsappUrl: null }))
      : { envoyeAuto: true, whatsappUrl: null };

    if (p.source === "interface") {
      whatsappLivreurUrl = versLivreur.envoyeAuto ? null : versLivreur.whatsappUrl;
      whatsappClientUrl = versClient.envoyeAuto ? null : versClient.whatsappUrl;
    } else {
      const base = { tenantId: commande.tenantId, commandeId: commande.id, numero: commande.numero };
      if (!versLivreur.envoyeAuto) await relayerWhatsAppNonEnvoye({ ...base, destinataire: "livreur", whatsappUrl: versLivreur.whatsappUrl });
      if (!versClient.envoyeAuto) await relayerWhatsAppNonEnvoye({ ...base, destinataire: "client", whatsappUrl: versClient.whatsappUrl });
    }
  }

  return { ok: true, numero: commande.numero, livreurNom: livreur?.nom ?? null, whatsappLivreurUrl, whatsappClientUrl };
}

/**
 * Le marchand confirme avoir reçu l'argent liquide (paiement à la livraison) remis
 * par un livreur. Le livreur ne peut jamais se marquer remis lui-même.
 */
export async function marquerEspecesRemises(p: {
  tenantId: string;
  userId: string | null; // null : autorisé depuis la bulle AXIA (tracé dans le journal des décisions)
  commandeIds?: string[];
  livreurId?: string; // toutes les commandes non remises de ce livreur
}): Promise<Resultat<{ count: number }>> {
  if (!p.commandeIds?.length && !p.livreurId) return { ok: false, status: 400, error: "Précise les commandes ou le livreur" };
  if (await quotaCommandesAtteint(p.tenantId)) return QUOTA_ATTEINT;
  const { count } = await prisma.commande.updateMany({
    where: {
      tenantId: p.tenantId,
      ...(p.commandeIds?.length ? { id: { in: p.commandeIds } } : { livreurId: p.livreurId }),
      methodePaiement: { in: ["whatsapp_cod", "direct_cod"] },
      statut: "livree",
      codRemis: false,
    },
    data: { codRemis: true, codRemisAt: new Date(), codRemisParId: p.userId },
  });
  return { ok: true, count };
}
