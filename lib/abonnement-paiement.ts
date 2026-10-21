// Paiement d'un palier d'abonnement par NotchPay : un seul point d'activation pour le
// webhook, la page de retour (/dashboard/abonnement?paiement=en_cours) et la réconciliation
// quotidienne. activerAbonnementPaye est idempotent : appeler plusieurs fois est sans risque.
// Aussi : rappels d'échéance.
import { prisma } from "./prisma";
import { verifierPaiementNotchPay, paiementCouvre } from "./notchpay";
import { activerAbonnementPaye } from "./wallet";
import { ajouterRefEnAttente, lireRefsEnAttente, rappelEcheanceDu, refTropVieille, retirerRefsEnAttente } from "./abonnement-regles";
import { boutiquesDuMemeCompte } from "./abonnement";
import { NOMS_PALIERS, palierAuMoins, type Palier } from "./plans";
import { envoyerRappelEssai } from "./email";
import { pousserMarchands } from "./push";

export const PALIER_PRIX: Record<string, number> = { palier1: 6000, palier2: 20000 };
const JOUR = 24 * 3600 * 1000;

/** Devise de facturation : XOF pour une boutique d'Afrique de l'Ouest (même prix, parité fixe 1 XOF = 1 XAF),
 *  sinon XAF. Avant, tout le monde payait en XAF, même au Sénégal ou en Côte d'Ivoire. */
export const deviseAbonnement = (deviseBoutique?: string | null) => (deviseBoutique?.toUpperCase() === "XOF" ? "XOF" : "XAF");

/** Référence marchande SUB-{tenantId}-{plan}-{horodatage} → boutique et palier. */
export function lireRefAbonnement(ref: string): { tenantId: string; plan: string } | null {
  const [prefixe, tenantId, plan] = ref.split("-");
  return prefixe === "SUB" && tenantId && PALIER_PRIX[plan] ? { tenantId, plan } : null;
}

const STATUTS_ECHEC = ["failed", "canceled", "cancelled", "expired", "rejected"];

/** Relit la transaction chez NotchPay et active le palier si elle est payée. `etat` : payee (activée
 *  maintenant ou déjà), echouee (ne sera jamais payée), attente (en cours ou NotchPay injoignable). */
async function verifierEtActiver(reference: string, secours?: any): Promise<{ etat: "payee" | "echouee" | "attente"; active: boolean }> {
  const transaction = await verifierPaiementNotchPay(reference).then((r) => r.transaction).catch(() => secours);
  if (!transaction) return { etat: "attente", active: false };
  if (STATUTS_ECHEC.includes(String(transaction.status))) return { etat: "echouee", active: false };
  const cible = lireRefAbonnement(String(transaction.merchant_reference ?? transaction.trxref ?? ""));
  if (!cible) return { etat: "echouee", active: false };
  const devise = deviseAbonnement(transaction.currency);
  if (!paiementCouvre(transaction, PALIER_PRIX[cible.plan], devise)) {
    if (transaction.status !== "complete") return { etat: "attente", active: false };
    console.error("[abonnement] paiement refusé : montant insuffisant", { reference, attendu: PALIER_PRIX[cible.plan], recu: transaction.amount, devise: transaction.currency });
    return { etat: "echouee", active: false };
  }
  // Revenu d'abonnement = 100 % Axso, net du frais NotchPay réel (lu sur la transaction).
  const fees = transaction.fees;
  const frais = Array.isArray(fees) ? fees.reduce((s: number, f: any) => s + (Number(f?.amount) || 0), 0) : 0;
  // Clé anti-doublon unique : la référence NotchPay de la transaction confirmée, quelle que soit
  // la référence d'appel (trx… du webhook, ou référence marchande gardée à l'initialisation).
  const cle = String(transaction.reference || reference);
  const active = await activerAbonnementPaye({ tenantId: cible.tenantId, plan: cible.plan, jours: 30, montant: PALIER_PRIX[cible.plan], frais, devise, reference: cle });
  return { etat: "payee", active };
}

/** Active le palier si la transaction NotchPay est payée et couvre le prix. `secours` : données du webhook signé si l'API ne répond pas. */
export async function confirmerPaiementAbonnement(reference: string, secours?: any): Promise<boolean> {
  return (await verifierEtActiver(reference, secours)).active;
}

/** Met à jour la liste des paiements en attente de la boutique (ligne verrouillée : aucun ajout perdu). */
async function majRefsEnAttente(tenantId: string, maj: (valeur: string | null) => string | null) {
  await prisma.$transaction(async (tx) => {
    const [t] = await tx.$queryRaw<{ planPendingRef: string | null }[]>`SELECT "planPendingRef" FROM "Tenant" WHERE "id" = ${tenantId} FOR UPDATE`;
    if (t) await tx.tenant.update({ where: { id: tenantId }, data: { planPendingRef: maj(t.planPendingRef) } });
  });
}

export const noterPaiementEnAttente = (tenantId: string, ref: string) => majRefsEnAttente(tenantId, (v) => ajouterRefEnAttente(v, ref));
export const oublierPaiementsEnAttente = (tenantId: string, refs: string[]) => majRefsEnAttente(tenantId, (v) => retirerRefsEnAttente(v, refs));

/** Paiements d'abonnement en attente pour cette boutique : vérifiés chez NotchPay, activés s'ils sont
 *  payés ; ceux qui ont échoué, abouti ou dépassé REF_ATTENTE_MAX_JOURS sortent de l'attente. */
export async function verifierAbonnementEnAttente(tenantId: string): Promise<boolean> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { planPendingRef: true } });
  let active = false;
  const finis: string[] = [];
  for (const r of lireRefsEnAttente(t?.planPendingRef)) {
    if (refTropVieille(r)) { finis.push(r.ref); continue; }
    const res = await verifierEtActiver(r.ref).catch((e) => { console.error("[abonnement] vérification", e); return { etat: "attente" as const, active: false }; });
    if (res.etat !== "attente") finis.push(r.ref);
    active ||= res.active;
  }
  if (finis.length) await oublierPaiementsEnAttente(tenantId, finis);
  return active;
}

// ─── Rappels d'échéance ───────────────────────────────────────────────────────

/** Tâche quotidienne : rappel 3 jours avant l'échéance du palier payé, puis le jour même (e-mail +
 *  notification), une fois chacun (Tenant.planRappel, remis à null à chaque paiement). */
export async function passeRappelsAbonnement(maintenant = new Date()): Promise<{ envoyes: number }> {
  const boutiques = await prisma.tenant.findMany({
    where: {
      planType: { in: ["palier1", "palier2"] },
      planExpiresAt: { gt: new Date(maintenant.getTime() - 2 * JOUR), lte: new Date(maintenant.getTime() + 3 * JOUR) },
      OR: [{ planRappel: null }, { planRappel: "j3" }],
    },
    select: { id: true, nomBoutique: true, email: true, planType: true, planExpiresAt: true, planRappel: true },
  });
  let envoyes = 0;
  for (const b of boutiques) {
    const rappel = rappelEcheanceDu(b.planExpiresAt!, b.planRappel, maintenant);
    if (!rappel) continue;
    // Conditionnel : deux passages simultanés n'envoient pas deux fois le même rappel.
    const { count } = await prisma.tenant.updateMany({ where: { id: b.id, planRappel: b.planRappel }, data: { planRappel: rappel } });
    if (!count) continue;
    // Une autre boutique du compte couvre ce palier plus longtemps : rien à renouveler ici.
    const compte = await boutiquesDuMemeCompte(b.id, { planType: true, planExpiresAt: true });
    if (compte.some((c) => (c.planType === "palier1" || c.planType === "palier2") && palierAuMoins(c.planType, b.planType as Palier) && c.planExpiresAt && c.planExpiresAt > b.planExpiresAt!)) continue;

    const nom = NOMS_PALIERS[b.planType as Palier];
    const date = b.planExpiresAt!.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
    const titre = rappel === "j3" ? `Ton abonnement ${nom} expire le ${date}`
      : b.planExpiresAt! > maintenant ? `Ton abonnement ${nom} expire aujourd'hui` : `Ton abonnement ${nom} a expiré`;
    const message = `Renouvelle-le pour garder tes avantages : les 30 jours s'ajoutent aux jours restants. Sinon ta boutique repasse en Essentiel.`;
    await Promise.allSettled([
      envoyerRappelEssai({ email: b.email, boutique: b.nomBoutique, titre, message }),
      pousserMarchands([b.id], { titre, message, lien: "/dashboard/abonnement", type: "abonnement" }),
    ]);
    envoyes++;
  }
  return { envoyes };
}
