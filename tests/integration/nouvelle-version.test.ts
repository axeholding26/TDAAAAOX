// NOUVELLE VERSION PAYANTE — tests d'intégration sur la base LOCALE (`npm run test:integration`).
// Prouvé ici : la nouvelle version est un brouillon séparé SANS fichiers ; l'offre exige une version
// publiée ; le code n'est valable que sur la nouvelle version, autant de fois qu'il y a d'acheteurs ;
// les acheteurs de la version précédente gardent leur accès.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { creerNouvelleVersion } from "@/lib/produits";
import { acheteursDuProduit, preparerOffreNouvelleVersion } from "@/lib/livraison-numerique";
import { reductionPromo } from "@/lib/pricing";

const url = process.env.DATABASE_URL ?? "";
if (!/@localhost[/:]|host=\/var\/run/.test(url)) throw new Error("Tests d'intégration : DATABASE_URL doit pointer sur la base locale.");

const X = `zzver${randomBytes(3).toString("hex")}`;
let tenantId = "";

before(async () => {
  process.env.AUTH_SECRET ||= "secret-de-test";
  tenantId = (await prisma.tenant.create({ data: { slug: X, nomBoutique: `Boutique ${X}`, categorie: "digital", pays: "CM", whatsapp: "+237600000000", email: `${X}@exemple.test`, planType: "palier2", planExpiresAt: new Date(Date.now() + 30 * 86_400_000), statut: "active" } })).id;
});

after(async () => {
  const commandes = (await prisma.commande.findMany({ where: { tenantId }, select: { id: true } })).map((c) => c.id);
  await prisma.telechargement.deleteMany({ where: { commandeId: { in: commandes } } });
  await prisma.ligneCommande.deleteMany({ where: { commandeId: { in: commandes } } });
  for (let passe = 0; passe < 3; passe++) {
    for (const m of Prisma.dmmf.datamodel.models) {
      if (!m.fields.some((f) => f.name === "tenantId")) continue;
      await (prisma as any)[m.name[0].toLowerCase() + m.name.slice(1)]?.deleteMany({ where: { tenantId } }).catch(() => {});
    }
  }
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
  await prisma.$disconnect();
});

let n = 0;
async function achat(produitId: string, email: string) {
  const c = await prisma.commande.create({ data: { tenantId, numero: `${X}-${++n}`, clientNom: `Client ${n}`, clientEmail: email, clientTelephone: "+237611111111", adresseLivraison: "", ville: "", pays: "CM", montantSousTotal: 5000, methodePaiement: "notchpay", montantTotal: 5000, devise: "XAF", paiementStatut: "completed", statut: "livree" } as any });
  await prisma.telechargement.create({ data: { produitId, commandeId: c.id, token: randomBytes(32).toString("hex") } });
}

test("Nouvelle version : brouillon sans fichiers, offre réservée, anciens acheteurs intacts", async () => {
  const v1 = await prisma.produit.create({
    data: { tenantId, nom: `Guide ${X}`, slug: `guide-${X}`, prix: 5000, type: "fichier", actif: true,
      produitFichier: { create: { fichiers: { create: [{ nom: "guide.pdf", url: "https://x.public.blob.vercel-storage.com/guide.pdf" }] } } } },
  });
  await achat(v1.id, `a-${X}@exemple.test`);
  await achat(v1.id, `b-${X}@exemple.test`);
  await achat(v1.id, `A-${X}@exemple.test`); // même acheteur (casse différente) : compté une fois

  const r = await creerNouvelleVersion(tenantId, v1.id);
  assert.ok(r.ok);
  const v2 = await prisma.produit.findUniqueOrThrow({ where: { id: r.id }, include: { produitFichier: { include: { fichiers: true } } } });
  assert.equal(v2.actif, false);
  assert.equal(v2.versionPrecedenteId, v1.id);
  assert.equal(v2.produitFichier?.fichiers.length, 0, "aucun fichier partagé avec la v1");

  // Brouillon : pas d'offre.
  const refus = await preparerOffreNouvelleVersion(tenantId, v2.id, 30, 30);
  assert.equal(refus.ok, false);

  await prisma.produit.update({ where: { id: v2.id }, data: { actif: true } });
  const offre = await preparerOffreNouvelleVersion(tenantId, v2.id, 30, 30);
  assert.ok(offre.ok);
  assert.equal(offre.acheteurs, 2);
  const code = await prisma.codePromo.findFirstOrThrow({ where: { tenantId, code: offre.code } });
  assert.deepEqual(code.produitIds, [v2.id]);
  assert.equal(code.maxUtilisations, 2);

  // Le code ne réduit que la nouvelle version.
  assert.equal(reductionPromo(code, 10000, [{ produitId: v2.id, prix: 10000, quantite: 1 }]), 3000);
  assert.equal(reductionPromo(code, 10000, [{ produitId: v1.id, prix: 10000, quantite: 1 }]), 0);
  assert.equal(reductionPromo(code, 10000), 0, "sans lignes (caisse) : rien");

  // Les acheteurs de la v1 gardent leur accès.
  assert.equal((await acheteursDuProduit(tenantId, v1.id)).length, 2);
});
