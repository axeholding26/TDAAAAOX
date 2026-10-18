// Livraison numérique — règles pures : contrôle d'un jeton de téléchargement, clé signée
// de la page d'accès, adresse de stockage servie en flux, transaction NotchPay liée à la commande.
// Le parcours complet (webhook signé, base, e-mail, reprise, remboursement) : tests/integration/livraison-numerique.test.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
process.env.AUTH_SECRET ||= "secret-de-test";
import { controlerJeton, cleAccesCommande, cleAccesValide, estFichierBlob, nouveauJeton } from "@/lib/livraison-numerique";
import { transactionAppartient } from "@/lib/paiement-commande";

const paye = { paiementStatut: "completed", statut: "livree" };
const jeton = { expireAt: null, revoqueAt: null, nbTelechargements: 0 };

test("jeton : seul un achat payé, non annulé, non révoqué, sous la limite, ouvre le fichier", () => {
  assert.equal(controlerJeton({ dl: jeton, commande: paye }), null);
  assert.equal(controlerJeton({ dl: null, commande: paye })?.status, 404);
  assert.equal(controlerJeton({ dl: jeton, commande: null })?.status, 404);
  for (const paiementStatut of ["pending", "failed", "refunded"]) assert.equal(controlerJeton({ dl: jeton, commande: { paiementStatut, statut: "en_attente" } })?.status, 403);
  assert.equal(controlerJeton({ dl: jeton, commande: { ...paye, statut: "annulee" } })?.status, 403);
  assert.equal(controlerJeton({ dl: { ...jeton, revoqueAt: new Date() }, commande: paye })?.status, 403);
  assert.equal(controlerJeton({ dl: { ...jeton, expireAt: new Date(0) }, commande: paye })?.status, 403, "ancienne révocation marchand (expireAt = epoch)");
  assert.equal(controlerJeton({ dl: { ...jeton, expireAt: new Date(Date.now() + 60_000) }, commande: paye }), null);
  assert.equal(controlerJeton({ dl: { ...jeton, nbTelechargements: 3 }, commande: paye, limite: 3 })?.status, 403);
  assert.equal(controlerJeton({ dl: { ...jeton, nbTelechargements: 2 }, commande: paye, limite: 3 }), null);
  assert.equal(controlerJeton({ dl: { ...jeton, nbTelechargements: 999 }, commande: paye, limite: null }), null, "accès à vie sans limite");
});

test("jetons : 256 bits aléatoires, jamais deux fois le même", () => {
  const a = nouveauJeton();
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, nouveauJeton());
});

test("clé d'accès : liée à la commande, tolère un suffixe de la passerelle, refuse le reste", () => {
  const k = cleAccesCommande("cmd_a");
  assert.equal(k.length, 32); // 128 bits
  assert.ok(cleAccesValide("cmd_a", k));
  assert.ok(cleAccesValide("cmd_a", `${k}?reference=trx.abc`));
  assert.ok(!cleAccesValide("cmd_b", k));
  assert.ok(!cleAccesValide("cmd_a", k.slice(0, 31)));
  assert.ok(!cleAccesValide("cmd_a", undefined));
});

test("seul le stockage Vercel Blob est lu par le serveur (pas de SSRF)", () => {
  assert.ok(estFichierBlob("https://abc.public.blob.vercel-storage.com/f.pdf"));
  for (const u of ["http://abc.public.blob.vercel-storage.com/f.pdf", "https://169.254.169.254/latest", "https://evil.com/blob.vercel-storage.com", "https://blob.vercel-storage.com.evil.com/x", "file:///etc/passwd", "pas une url"]) {
    assert.ok(!estFichierBlob(u), u);
  }
});

test("transaction NotchPay : aboutie, montant, devise et référence de CETTE commande", () => {
  const commande = { id: "c1", montantTotal: 5500, devise: "XAF", paiementReference: "trx.1" };
  const ok = { reference: "trx.1", merchant_reference: "ORD-c1", status: "complete", amount: 5500, currency: "XAF" };
  assert.ok(transactionAppartient(ok, commande, "trx.1"));
  assert.ok(!transactionAppartient({ ...ok, status: "pending" }, commande, "trx.1"));
  assert.ok(!transactionAppartient({ ...ok, amount: 5000 }, commande, "trx.1"));
  assert.ok(!transactionAppartient({ ...ok, currency: "EUR" }, commande, "trx.1"));
  assert.ok(!transactionAppartient({ ...ok, merchant_reference: "ORD-c2" }, commande, "trx.1"), "paiement d'une autre commande");
  assert.ok(!transactionAppartient(null, commande, "trx.1"));
  const sansRef = { ...ok, merchant_reference: undefined };
  assert.ok(transactionAppartient(sansRef, commande, "trx.1"), "sans référence marchande : la référence enregistrée fait foi");
  assert.ok(!transactionAppartient({ ...sansRef, reference: "trx.9" }, commande, "trx.9"));
});
