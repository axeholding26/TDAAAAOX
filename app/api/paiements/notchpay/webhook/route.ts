// NotchPay Webhook — point d'entrée unique pour paiements storefront, abonnements et retraits.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierSignatureWebhook, verifierPaiementNotchPay, paiementCouvre } from "@/lib/notchpay";
import { confirmerPaiementCommande } from "@/lib/paiement-commande";
import { appliquerStatutTransfert, crediterPlateformeAvecFrais } from "@/lib/wallet";
import { rembourserPaiementCommissionEchoue } from "@/lib/affiliation";

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
    if (type.startsWith("transfer.")) {
      await traiterEvenementTransfert(type, data, merchantRef);
    } else if (merchantRef.startsWith("ORD-")) {
      await traiterEvenementCommande(type, merchantRef, notchpayRef, data);
    } else if (merchantRef.startsWith("SUB-")) {
      await traiterEvenementAbonnement(type, merchantRef, notchpayRef, data);
    }
  } catch (err) {
    console.error("[notchpay/webhook] erreur traitement:", err);
    // On accuse quand même réception pour éviter les retentatives infinies de NotchPay
  }

  return NextResponse.json({ received: true });
}

// ─── Paiement d'une commande storefront ───────────────────────────────────────
async function traiterEvenementCommande(type: string, merchantRef: string, notchpayRef: string, data: any) {
  const commandeId = merchantRef.slice(4);

  if (type === "payment.failed" || type === "payment.canceled" || type === "payment.expired") {
    // Seule une commande encore en attente passe en échec : un événement en retard
    // ne doit jamais écraser un paiement déjà reçu ou remboursé.
    await prisma.commande.updateMany({ where: { id: commandeId, paiementStatut: "pending" }, data: { paiementStatut: "failed" } }).catch(() => {});
    return;
  }

  if (type !== "payment.complete") return;

  await confirmerPaiementCommande(commandeId, notchpayRef || merchantRef, data);
}

// ─── Achat/renouvellement d'abonnement ────────────────────────────────────────
async function traiterEvenementAbonnement(type: string, merchantRef: string, notchpayRef: string, data: any) {
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

  // Le plan n'est activé que si le prix du palier a réellement été payé.
  const reference = notchpayRef || merchantRef;
  const transaction = await verifierPaiementNotchPay(reference).then((r) => r.transaction).catch(() => data);
  if (!paiementCouvre(transaction, PALIER_PRIX[plan], "XAF")) {
    console.error("[notchpay/webhook] abonnement refusé : montant insuffisant", { merchantRef, attendu: PALIER_PRIX[plan], recu: transaction?.amount, devise: transaction?.currency, statut: transaction?.status });
    return;
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: { planType: plan, planExpiresAt: expiresAt, planPendingRef: null },
  }).catch(() => null);
  if (!tenant) return;

  // Revenu d'abonnement = 100% Axso, net du frais de traitement NotchPay réel
  // (jamais deviné — lu directement sur la transaction).
  const fees = transaction?.fees;
  const frais = Array.isArray(fees) ? fees.reduce((s: number, f: any) => s + (Number(f?.amount) || 0), 0) : 0;

  await crediterPlateformeAvecFrais(
    PALIER_PRIX[plan],
    frais,
    "XAF",
    `Abonnement ${plan} — ${tenant.nomBoutique}`,
    reference
  ).catch(() => {});
}

// ─── Transfert sortant (retrait wallet ou commission d'affilié) ───────────────
// L'événement d'un transfert ne renvoie pas toujours notre référence marchande :
// on retrouve la ligne par l'identifiant passé en metadata, par le préfixe AXSO-,
// ou par la référence NotchPay ("po.xxx") enregistrée à l'initiation.
async function traiterEvenementTransfert(type: string, data: any, merchantRef: string) {
  const status: string = type.slice("transfer.".length);
  const refs = [data?.reference, data?.id, merchantRef].filter(Boolean).map(String);
  const idMarchand = merchantRef.startsWith("AXSO-") ? merchantRef.slice(5) : undefined;

  const retrait = await prisma.retrait.findFirst({
    where: { OR: [{ id: data?.metadata?.retraitId ?? idMarchand ?? "" }, { reference: { in: refs } }] },
  });
  if (retrait) {
    await appliquerStatutTransfert(retrait.id, status);
    return;
  }

  const commission = await prisma.paiementCommission.findFirst({
    where: { OR: [{ id: idMarchand?.replace(/^AFF-/, "") ?? "" }, { reference: { in: refs } }] },
  });
  if (!commission) return;
  if (status === "failed") await rembourserPaiementCommissionEchoue(commission.id);
  else if (status === "complete") await prisma.paiementCommission.updateMany({ where: { id: commission.id, statut: "en_attente" }, data: { statut: "traite" } });
}
