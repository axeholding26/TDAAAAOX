// Gains des livreurs (lib/gains-livreur.ts) : calcul selon le mode, espèces à remettre, pas de gain en double.
import { test } from "node:test";
import assert from "node:assert/strict";
import { aRemettre, calculerGain, enregistrerGainCourse, modeParDefaut } from "@/lib/gains-livreur";

const base = { montantFixe: 750, montantLivraison: 1500, montantTotal: 10000 };

test("gain selon le mode choisi par le marchand", () => {
  assert.equal(calculerGain({ ...base, mode: "frais_livraison", especes: false }), 1500);
  assert.equal(calculerGain({ ...base, mode: "fixe", especes: false }), 750);
  assert.equal(calculerGain({ ...base, mode: "hors_axso", especes: false }), 0);
  assert.equal(calculerGain({ ...base, mode: "fixe", montantFixe: -5, especes: false }), 0);
});

test("en espèces : jamais plus que l'encaissé ; à remettre = encaissé − part", () => {
  assert.equal(calculerGain({ ...base, mode: "fixe", montantFixe: 20000, especes: true }), 10000);
  assert.equal(aRemettre(10000, 1500), 8500);
  assert.equal(aRemettre(1000, 1500), 0);
});

test("par défaut : livreur plateforme payé aux frais de livraison, livreur de la boutique hors Axso", () => {
  assert.equal(modeParDefaut(null, "t1"), "frais_livraison");
  assert.equal(modeParDefaut("t1", "t1"), "hors_axso");
});

// Fausse transaction Prisma, en mémoire : juste ce que touche enregistrerGainCourse.
function fausseTx(livreurTenantId: string | null, reglage: { mode: string; montantFixe: number } | null) {
  const db = { gains: [] as any[], solde: 0, wallet: 5000, lignes: [] as any[] };
  const tx = {
    gainLivreur: {
      findUnique: async ({ where }: any) => db.gains.find((g) => g.commandeId === where.commandeId) ?? null,
      create: async ({ data }: any) => { const g = { id: `g${db.gains.length}`, ...data }; db.gains.push(g); return g; },
    },
    livreur: { findUnique: async () => ({ tenantId: livreurTenantId, nom: "Ali" }) },
    reglageLivreur: { findUnique: async () => reglage },
    soldeLivreur: { upsert: async ({ update }: any) => { db.solde += update.solde.increment; } },
    wallet: {
      upsert: async () => ({ id: "w1", devise: "XAF" }),
      update: async ({ data }: any) => { db.wallet -= data.solde.decrement; },
    },
    walletTransaction: { create: async ({ data }: any) => { db.lignes.push(data); } },
  };
  return { tx, db };
}
const commande = (methodePaiement: string) => ({ id: "c1", numero: "A1", tenantId: "t1", livreurId: "l1", montantLivraison: 1500, montantTotal: 10000, devise: "XAF", methodePaiement });

test("en ligne : crédité au livreur, débité du marchand, une seule fois", async () => {
  const { tx, db } = fausseTx(null, null);
  await enregistrerGainCourse(tx, commande("notchpay"));
  await enregistrerGainCourse(tx, commande("notchpay"));
  assert.equal(db.gains.length, 1);
  assert.equal(db.solde, 1500);
  assert.equal(db.wallet, 3500);
  assert.deepEqual(db.lignes.map((l) => [l.type, l.montant, l.commandeId]), [["LIVREUR", -1500, "c1"]]);
});

test("espèces : gain inscrit, rien au solde ni au wallet ; hors Axso : rien du tout", async () => {
  const cod = fausseTx(null, { mode: "fixe", montantFixe: 1000 });
  await enregistrerGainCourse(cod.tx, commande("whatsapp_cod"));
  assert.equal(cod.db.gains[0].paiement, "especes");
  assert.equal(cod.db.gains[0].montant, 1000);
  assert.equal(cod.db.solde, 0);
  assert.equal(cod.db.wallet, 5000);

  const salarie = fausseTx("t1", null);
  await enregistrerGainCourse(salarie.tx, commande("notchpay"));
  assert.equal(salarie.db.gains.length, 0);
  assert.equal(salarie.db.wallet, 5000);
});
