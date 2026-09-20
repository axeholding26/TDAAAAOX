// NotchPay Webhook — point d'entrée unique pour paiements storefront, abonnements et retraits.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierSignatureWebhook, verifierPaiementNotchPay } from "@/lib/notchpay";
import { confirmerPaiementCommande } from "@/lib/paiement-commande";
import { rembourserRetraitEchoue, crediterPlateformeAvecFrais } from "@/lib/wallet";

export const maxDuration = 60;

const PALIER_PRIX: Record<string, number> = { palier1: 6000, palier2: 20000 };

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-notch-signature");

  if (!verifierSignatureWebhook(rawBody, signature)) {
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
  }

  const type: string = event?.type ?? "";
  const data = event?.data ?? {};
  // NotchPay attribue sa PROPRE référence ("trx.xxx") au champ `reference` —
  // la référence qu'on lui envoie à l'initialisation est renvoyée séparément
  // dans `merchant_reference` (alias `trxref`). Le dispatch par préfixe
  // (ORD-/SUB-/AXSO-) doit donc lire ce champ, pas `data.reference`.
  const merchantRef: string = data?.merchant_reference ?? data?.trxref ?? "";
  const notchpayRef: string = data?.reference ?? "";

  console.log("[notchpay/webhook]", type, merchantRef, notchpayRef);

  try {
    if (merchantRef.startsWith("ORD-")) {
      await traiterEvenementCommande(type, merchantRef, notchpayRef);
    } else if (merchantRef.startsWith("SUB-")) {
      await traiterEvenementAbonnement(type, merchantRef, notchpayRef);
    } else if (merchantRef.startsWith("AXSO-")) {
      await traiterEvenementRetrait(type, merchantRef);
    }
  } catch (err) {
    console.error("[notchpay/webhook] erreur traitement:", err);
    // On accuse quand même réception pour éviter les retentatives infinies de NotchPay
  }

  return NextResponse.json({ received: true });
}

// ─── Paiement d'une commande storefront ───────────────────────────────────────
async function traiterEvenementCommande(type: string, merchantRef: string, notchpayRef: string) {
  const commandeId = merchantRef.slice(4);

  if (type === "payment.failed" || type === "payment.canceled" || type === "payment.expired") {
    await prisma.commande.update({ where: { id: commandeId }, data: { paiementStatut: "failed" } }).catch(() => {});
    return;
  }

  if (type !== "payment.complete") return;

  await confirmerPaiementCommande(commandeId, notchpayRef || merchantRef);
}

// ─── Achat/renouvellement d'abonnement ────────────────────────────────────────
async function traiterEvenementAbonnement(type: string, merchantRef: string, notchpayRef: string) {
  // Format : SUB-{tenantId}-{plan}-{timestamp}
  const parts = merchantRef.split("-");
  const tenantId = parts[1];
  const plan = parts[2];
  if (!tenantId || !PALIER_PRIX[plan]) return;

  if (type === "payment.failed" || type === "payment.canceled" || type === "payment.expired") {
    await prisma.tenant.update({ where: { id: tenantId }, data: { planPendingRef: null } }).catch(() => {});
    return;
  }

  if (type !== "payment.complete") return;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: { planType: plan, planExpiresAt: expiresAt, planPendingRef: null },
  }).catch(() => null);
  if (!tenant) return;

  // Revenu d'abonnement = 100% Axso, net du frais de traitement NotchPay réel
  // (jamais deviné — lu directement sur la transaction).
  const reference = notchpayRef || merchantRef;
  let frais = 0;
  try {
    const { transaction } = await verifierPaiementNotchPay(reference);
    const fees = (transaction as any)?.fees;
    frais = Array.isArray(fees) ? fees.reduce((s: number, f: any) => s + (Number(f?.amount) || 0), 0) : 0;
  } catch {}

  await crediterPlateformeAvecFrais(
    PALIER_PRIX[plan],
    frais,
    "XAF",
    `Abonnement ${plan} — ${tenant.nomBoutique}`,
    reference
  ).catch(() => {});
}

// ─── Retrait wallet (transfert sortant) ───────────────────────────────────────
async function traiterEvenementRetrait(type: string, merchantRef: string) {
  if (type !== "transfer.complete" && type !== "transfer.failed") return;

  const retraitId = merchantRef.replace("AXSO-", "");

  if (type === "transfer.failed") {
    // Le marchand ne doit jamais perdre cet argent : remboursement automatique
    // (rembourserRetraitEchoue est idempotent, sûr même si déjà remboursé en synchrone).
    await rembourserRetraitEchoue(retraitId);
    return;
  }

  await prisma.retrait.update({
    where: { id: retraitId },
    data: { statut: "complete", updatedAt: new Date() },
  }).catch(() => {});
}
