// RETRAITS ET COMMISSIONS VALIDÉS PAR AXSO — tests d'intégration sur la base LOCALE (`npm run test:integration`).
// Prouvé ici : un retrait débite le wallet et reste « en attente » sans transfert automatique ;
// le numéro prend l'indicatif du pays de la boutique (invalide → refusé, rien débité) ; le canal
// NotchPay est bien déduit ; « payé » clôt et prévient ; « refusé » recrédite. Idem pour les
// commissions d'affiliés (refusé → commissions de nouveau payables).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canalNotchPay, cloturerRetraitManuel, initierRetrait } from "@/lib/wallet";
import { cloturerCommissionManuelle, payerCommissionsAffilie } from "@/lib/affiliation";

const url = process.env.DATABASE_URL ?? "";
if (!/@localhost[/:]|host=\/var\/run/.test(url)) throw new Error("Tests d'intégration : DATABASE_URL doit pointer sur la base locale.");
delete process.env.RESEND_API_KEY; // jamais de vrai e-mail depuis un test

const X = `zzret${randomBytes(3).toString("hex")}`;
let tenantId = "";

before(async () => {
  tenantId = (await prisma.tenant.create({ data: { slug: X, nomBoutique: `Boutique ${X}`, categorie: "mode", pays: "CM", whatsapp: "+237600000000", email: `${X}@exemple.test`, planType: "palier2", planExpiresAt: new Date(Date.now() + 30 * 86_400_000), statut: "active" } })).id;
  await prisma.wallet.create({ data: { tenantId, devise: "XAF", solde: 10000 } });
});

after(async () => {
  for (let passe = 0; passe < 3; passe++) {
    await prisma.walletTransaction.deleteMany({ where: { wallet: { tenantId } } }).catch(() => {});
    for (const m of Prisma.dmmf.datamodel.models) {
      if (!m.fields.some((f) => f.name === "tenantId")) continue;
      await (prisma as any)[m.name[0].toLowerCase() + m.name.slice(1)]?.deleteMany({ where: { tenantId } }).catch(() => {});
    }
  }
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
  await prisma.$disconnect();
});

const solde = async () => (await prisma.wallet.findUniqueOrThrow({ where: { tenantId } })).solde;

test("canal NotchPay : MTN/Orange Cameroun en XAF seulement", () => {
  assert.equal(canalNotchPay({ methode: "mobile_money", operateur: "MTN", devise: "XAF", destinataire: "677 12 34 56" }), "cm.mtn");
  assert.equal(canalNotchPay({ methode: "mobile_money", operateur: "Orange", devise: "XAF", destinataire: "+237699123456" }), "cm.orange");
  assert.equal(canalNotchPay({ methode: "mobile_money", operateur: "Wave", devise: "XAF", destinataire: "677123456" }), null);
  // Opérateur MTN/Orange déclaré par erreur : le préfixe du numéro fait foi (69x = Orange).
  assert.equal(canalNotchPay({ methode: "mobile_money", operateur: "MTN", devise: "XAF", destinataire: "699123456" }), "cm.orange");
  assert.equal(canalNotchPay({ methode: "virement_bancaire", operateur: null, devise: "XAF", destinataire: "CM21 1234 5678" }), null);
});

test("Retrait : en attente sans transfert, puis payé (marchand prévenu) ou refusé (recrédité)", async () => {
  const r1 = await initierRetrait({ tenantId, montant: 3000, devise: "XAF", methode: "mobile_money", destinataire: "677123456", operateur: "MTN" });
  assert.equal(r1.statut, "en_attente");
  assert.equal(r1.reference, null, "aucun transfert NotchPay tenté");
  assert.equal(r1.destinataire, "+237677123456", "indicatif du pays de la boutique");
  assert.equal(await solde(), 7000);

  await cloturerRetraitManuel(r1.id, true);
  assert.equal((await prisma.retrait.findUniqueOrThrow({ where: { id: r1.id } })).statut, "complete");
  assert.ok(await prisma.notificationMarchand.findFirst({ where: { tenantId, type: "retrait_paye" } }));

  const r2 = await initierRetrait({ tenantId, montant: 2000, devise: "XAF", methode: "mobile_money", destinataire: "699123456", operateur: "Orange" });
  assert.equal(await solde(), 5000);
  await cloturerRetraitManuel(r2.id, false);
  assert.equal(await solde(), 7000, "recrédité");
  assert.ok(await prisma.notificationMarchand.findFirst({ where: { tenantId, type: "retrait_refuse" } }));
  await assert.rejects(cloturerRetraitManuel(r2.id, true), /déjà traité/);
});

test("Numéro invalide pour le pays de la boutique : refusé avant tout débit", async () => {
  const avant = await solde();
  await assert.rejects(initierRetrait({ tenantId, montant: 1000, devise: "XAF", methode: "mobile_money", destinataire: "12 34", operateur: "MTN" }), /invalide/);
  assert.equal(await solde(), avant);
});

test("Commission d'affilié : en attente, payée (prévenu) ou refusée (recrédité, de nouveau payable)", async () => {
  const affilie = await prisma.affilie.create({ data: { tenantId, nom: `Aff ${X}`, email: `aff-${X}@exemple.test`, telephone: "699 12 34 56", codeParrainage: `C${X}` } });
  const commission = () => prisma.commissionAffilie.create({ data: { tenantId, affilieId: affilie.id, montantCommission: 1500, statut: "approuvee" } });
  await commission();
  const avant = await solde();

  const p1 = await payerCommissionsAffilie({ tenantId, affilieId: affilie.id });
  const paiement1 = await prisma.paiementCommission.findUniqueOrThrow({ where: { id: p1.paiementId } });
  assert.equal(paiement1.statut, "en_attente");
  assert.equal(paiement1.reference, null);
  assert.equal(paiement1.telephone, "+237699123456");
  assert.equal(await solde(), avant - 1500);
  await cloturerCommissionManuelle(p1.paiementId, true);
  assert.equal((await prisma.paiementCommission.findUniqueOrThrow({ where: { id: p1.paiementId } })).statut, "traite");
  assert.ok(await prisma.notificationMarchand.findFirst({ where: { tenantId, type: "commission_payee" } }));

  const c2 = await commission();
  const p2 = await payerCommissionsAffilie({ tenantId, affilieId: affilie.id });
  await cloturerCommissionManuelle(p2.paiementId, false);
  assert.equal(await solde(), avant - 1500, "recrédité");
  assert.equal((await prisma.commissionAffilie.findUniqueOrThrow({ where: { id: c2.id } })).statut, "approuvee");
  await assert.rejects(cloturerCommissionManuelle(p2.paiementId, true), /déjà traité/);
});
