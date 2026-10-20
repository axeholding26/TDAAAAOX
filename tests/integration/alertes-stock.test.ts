// ALERTES DE STOCK — tests d'intégration sur la base LOCALE (`npm run test:integration`).
// Prouvé ici : une sortie de stock qui franchit le « stock minimum » puis 0 prévient le marchand
// tout de suite, une seule fois par article et par jour ; une sortie qui ne franchit rien se tait.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mouvementStock } from "@/lib/pos/stock";

const url = process.env.DATABASE_URL ?? "";
if (!/@localhost[/:]|host=\/var\/run/.test(url)) throw new Error("Tests d'intégration : DATABASE_URL doit pointer sur la base locale.");

const X = `zzstk${randomBytes(3).toString("hex")}`;
let tenantId = "";

before(async () => {
  tenantId = (await prisma.tenant.create({ data: { slug: X, nomBoutique: `Boutique ${X}`, categorie: "mode", pays: "CM", whatsapp: "+237600000000", email: `${X}@exemple.test`, planType: "palier2", planExpiresAt: new Date(Date.now() + 30 * 86_400_000), statut: "active" } })).id;
});

after(async () => {
  for (let passe = 0; passe < 3; passe++) {
    for (const m of Prisma.dmmf.datamodel.models) {
      if (!m.fields.some((f) => f.name === "tenantId")) continue;
      await (prisma as any)[m.name[0].toLowerCase() + m.name.slice(1)]?.deleteMany({ where: { tenantId } }).catch(() => {});
    }
  }
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
  await prisma.$disconnect();
});

const vendre = (produitId: string, quantite: number) =>
  prisma.$transaction((tx) => mouvementStock(tx, { tenantId, produitId, type: "vente", quantite }));

// Hors requête, l'alerte part 2 s après la transaction : on la guette, puis on laisse arriver un éventuel doublon.
async function alertes(attendues: number) {
  let titres: string[] = [];
  for (let i = 0; i < 50; i++) {
    titres = (await prisma.notificationMarchand.findMany({ where: { tenantId, type: "stock_faible" }, orderBy: { createdAt: "asc" }, select: { titre: true } })).map((n) => n.titre);
    if (titres.length >= attendues) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  await new Promise((r) => setTimeout(r, 2500)); // laisse arriver un éventuel doublon
  return (await prisma.notificationMarchand.findMany({ where: { tenantId, type: "stock_faible" }, orderBy: { createdAt: "asc" }, select: { titre: true } })).map((n) => n.titre);
}

test("Seuil puis rupture : une alerte chacun, pas de doublon, rien quand aucun seuil n'est franchi", async () => {
  const p = await prisma.produit.create({ data: { tenantId, nom: `Sac ${X}`, slug: `sac-${X}`, prix: 5000, stock: 10, stockMin: 3, type: "physique", actif: true } });

  await vendre(p.id, 2); // 10 → 8 : rien
  assert.deepEqual(await alertes(0), []);

  await vendre(p.id, 5); // 8 → 3 : seuil franchi
  assert.deepEqual(await alertes(1), [`Stock bas : Sac ${X}`]);

  await vendre(p.id, 1); // 3 → 2 : déjà sous le seuil, pas de nouvelle alerte
  await vendre(p.id, 2); // 2 → 0 : rupture
  assert.deepEqual(await alertes(2), [`Stock bas : Sac ${X}`, `Rupture de stock : Sac ${X}`]);

  // Réassort puis nouvelle rupture le même jour : toujours une seule alerte de rupture.
  await prisma.produit.update({ where: { id: p.id }, data: { stock: 1 } });
  await vendre(p.id, 1);
  assert.equal((await alertes(3)).length, 2);
});
