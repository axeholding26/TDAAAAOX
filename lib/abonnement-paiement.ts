// Paiement d'un palier d'abonnement par NotchPay : un seul point d'activation pour le
// webhook, la page de retour (/dashboard/abonnement?paiement=en_cours) et la réconciliation
// quotidienne. activerAbonnementPaye est idempotent : appeler plusieurs fois est sans risque.
import { prisma } from "./prisma";
import { verifierPaiementNotchPay, paiementCouvre } from "./notchpay";
import { activerAbonnementPaye } from "./wallet";

export const PALIER_PRIX: Record<string, number> = { palier1: 6000, palier2: 20000 };

/** Référence marchande SUB-{tenantId}-{plan}-{horodatage} → boutique et palier. */
export function lireRefAbonnement(ref: string): { tenantId: string; plan: string } | null {
  const [prefixe, tenantId, plan] = ref.split("-");
  return prefixe === "SUB" && tenantId && PALIER_PRIX[plan] ? { tenantId, plan } : null;
}

/** Active le palier si la transaction NotchPay est payée et couvre le prix. `secours` : données du webhook signé si l'API ne répond pas. */
export async function confirmerPaiementAbonnement(reference: string, secours?: any): Promise<boolean> {
  const transaction = await verifierPaiementNotchPay(reference).then((r) => r.transaction).catch(() => secours);
  const cible = lireRefAbonnement(String(transaction?.merchant_reference ?? transaction?.trxref ?? ""));
  if (!cible) return false;
  if (!paiementCouvre(transaction, PALIER_PRIX[cible.plan], "XAF")) {
    console.error("[abonnement] paiement refusé : montant insuffisant ou non abouti", { reference, attendu: PALIER_PRIX[cible.plan], recu: transaction?.amount, devise: transaction?.currency, statut: transaction?.status });
    return false;
  }
  // Revenu d'abonnement = 100 % Axso, net du frais NotchPay réel (lu sur la transaction).
  const fees = transaction?.fees;
  const frais = Array.isArray(fees) ? fees.reduce((s: number, f: any) => s + (Number(f?.amount) || 0), 0) : 0;
  return activerAbonnementPaye({ tenantId: cible.tenantId, plan: cible.plan, jours: 30, montant: PALIER_PRIX[cible.plan], frais, devise: "XAF", reference });
}

/** Paiement d'abonnement en attente pour cette boutique : vérifié chez NotchPay et activé s'il est payé. */
export async function verifierAbonnementEnAttente(tenantId: string): Promise<boolean> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { planPendingRef: true } });
  if (!t?.planPendingRef) return false;
  return confirmerPaiementAbonnement(t.planPendingRef).catch((e) => { console.error("[abonnement] vérification", e); return false; });
}
