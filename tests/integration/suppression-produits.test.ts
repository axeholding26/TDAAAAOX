// SUPPRESSION DES PRODUITS PAR UNE IA — tests d'intégration sur la base LOCALE
// (`npm run test:integration`). Deux boutiques de test A et B, créées puis supprimées.
// Cause de l'incident « suppression impossible » (2Y Method, 19/10/2026) : la connexion n'avait pas
// le droit axso:delete:write, donc delete_catalog_item était absent de la liste, sans explication.
// Prouvé ici : le droit manquant est nommé, la suppression passe par l'accord du marchand, l'état
// est relu, un produit vendu ou encore lié n'est jamais supprimé (CONFLICT, plus « module en panne »),
// commandes intactes, étanchéité entre boutiques, double appel cohérent.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SCOPES, creerClientId } from "@/lib/controle-ia/regles";
import { TOUT_ECRITURE } from "@/lib/permissions";
import { appelerOutil, contexteDeConnexion, contexteDuJeton, echangerCode, emettreCode, executerAccordIA, outilsDisponibles, type ActionAccord, type ContexteIA } from "@/lib/controle-ia/serveur";
import { supprimerProduit } from "@/lib/produits";

const url = process.env.DATABASE_URL ?? "";
if (!/@localhost[/:]|host=\/var\/run/.test(url)) throw new Error("Tests d'intégration : DATABASE_URL doit pointer sur la base locale.");

const X = `zzsup${randomBytes(3).toString("hex")}`;
const REDIRECT = "http://localhost:9999/cb";
const id = { A: "", B: "", uA: "", uB: "", client: "" };
let sansDroit: ContexteIA, avecDroit: ContexteIA, lecture: ContexteIA;

async function relier(userId: string, boutique: string, scopes: string[], nom: string) {
  // Un nom de client par connexion : une nouvelle autorisation du même client remplace l'ancienne.
  const client = `Essai ${nom} ${X}`;
  const clientId = creerClientId(client, [REDIRECT])!;
  const verifier = randomBytes(40).toString("base64url");
  const code = await emettreCode({ userId, boutiques: [boutique], client, scopes, clientId, redirectUri: REDIRECT, challenge: createHash("sha256").update(verifier).digest("base64url") });
  const j = await echangerCode({ code, clientId, redirectUri: REDIRECT, verifier });
  const c = (await contexteDuJeton(j!.access_token))!;
  await prisma.connexionIA.update({ where: { id: c.connexionId }, data: { mode: "copilot" } });
  return (await contexteDeConnexion(c.connexionId))!;
}
let n = 0;
const produit = (tenantId: string, data: Partial<Prisma.ProduitUncheckedCreateInput> = {}) =>
  prisma.produit.create({ data: { tenantId, nom: `Produit ${++n} ${X}`, slug: `p-${n}-${X}`, prix: 5500, stock: 0, actif: false, ...data } });
const existe = async (pid: string) => (await prisma.produit.count({ where: { id: pid } })) === 1;

/** L'IA demande, le marchand accepte (vrai circuit d'accord) : renvoie la réponse finale. */
async function supprimerAvecAccord(ctx: ContexteIA, args: Record<string, unknown>) {
  const demande = await appelerOutil(ctx, "delete_catalog_item", args);
  assert.equal(demande.code, "APPROVAL_REQUIRED", demande.resultat);
  const p = await prisma.axiaProposition.findFirst({ where: { tenantId: ctx.tenantId, type: "confirmation", action: { path: ["ia", "actionId"], equals: demande.actionId } } });
  assert.ok(p, "demande d'accord visible par le marchand");
  return executerAccordIA(ctx.tenantId, p.action as unknown as ActionAccord, TOUT_ECRITURE);
}

before(async () => {
  process.env.AUTH_SECRET ||= "secret-de-test";
  for (const k of ["A", "B"] as const) {
    const u = await prisma.user.create({ data: { email: `${X}-${k}@exemple.test`, name: k, role: "owner" } });
    const t = await prisma.tenant.create({ data: { slug: `${X}-${k.toLowerCase()}`, nomBoutique: `Boutique ${k} ${X}`, categorie: "digital", pays: "CM", whatsapp: "+237600000000", email: `${X}-${k}@exemple.test`, planType: "palier2", planExpiresAt: new Date(Date.now() + 30 * 86_400_000), statut: "active" } });
    await prisma.proprietaireBoutique.create({ data: { userId: u.id, tenantId: t.id, role: "owner" } });
    id[k] = t.id; id[`u${k}`] = u.id;
  }
  id.client = (await prisma.client.create({ data: { tenantId: id.A, nom: `Client ${X}`, telephone: "+237611111111" } as any })).id;
  // Comme la connexion ChatGPT de 2Y Method : tout, sauf le droit de suppression.
  sansDroit = await relier(id.uA, id.A, SCOPES.filter((s) => s !== "axso:delete:write"), "sans");
  avecDroit = await relier(id.uA, id.A, SCOPES, "avec");
  lecture = await relier(id.uA, id.A, ["axso:products:read"], "lecture");
});

after(async () => {
  const boutiques = [id.A, id.B].filter(Boolean);
  await prisma.connexionIA.deleteMany({ where: { userId: { in: [id.uA, id.uB] } } });
  const commandes = (await prisma.commande.findMany({ where: { tenantId: { in: boutiques } }, select: { id: true } })).map((c) => c.id);
  await prisma.ligneCommande.deleteMany({ where: { commandeId: { in: commandes } } });
  await prisma.wishlist.deleteMany({ where: { clientId: id.client } });
  for (let passe = 0; passe < 3; passe++) {
    for (const m of Prisma.dmmf.datamodel.models) {
      if (!m.fields.some((f) => f.name === "tenantId")) continue;
      await (prisma as any)[m.name[0].toLowerCase() + m.name.slice(1)]?.deleteMany({ where: { tenantId: { in: boutiques } } }).catch(() => {});
    }
  }
  await prisma.tenant.deleteMany({ where: { id: { in: boutiques } } });
  await prisma.user.deleteMany({ where: { id: { in: [id.uA, id.uB] } } });
  await prisma.$disconnect();
});

test("Cause de l'incident : sans le droit de suppression, l'outil est fermé ET le droit manquant est nommé ; l'archivage reste possible", async () => {
  const p = await produit(id.A);
  assert.ok(!outilsDisponibles(sansDroit).some((o) => o.name === "delete_catalog_item"), "absent de tools/list");
  const r = await appelerOutil(sansDroit, "delete_catalog_item", { product_id: p.id });
  assert.equal(r.code, "INSUFFICIENT_PERMISSION");
  assert.equal(r.donnees?.required_scope, "axso:delete:write");
  assert.ok(await existe(p.id));
  const cap = await appelerOutil(sansDroit, "axso_capacites", {});
  assert.match(cap.resultat, /fermés : delete_catalog_item \(droit « Supprimer définitivement des produits, médias ou données » non accordé/);
  const catalogue = (cap.donnees!.capabilities as any[]).find((g) => g.id === "catalogue");
  assert.ok(catalogue.available && catalogue.tools.includes("archive_product"));
  assert.deepEqual(catalogue.locked.map((l: any) => l.tool), ["delete_catalog_item"]);
  // Droits insuffisants (lecture seule) : ni suppression ni archivage.
  assert.equal((await appelerOutil(lecture, "delete_catalog_item", { product_id: p.id })).code, "INSUFFICIENT_PERMISSION");
  assert.equal((await appelerOutil(lecture, "archive_product", { product_id: p.id })).code, "INSUFFICIENT_PERMISSION");
});

test("Avec le droit : la suppression attend TOUJOURS l'accord du marchand (risque élevé), même en autopilote", async () => {
  const p = await produit(id.A);
  const schema = outilsDisponibles(avecDroit).find((o) => o.name === "delete_catalog_item")!;
  assert.equal(schema.annotations.destructiveHint, true);
  assert.equal((await appelerOutil(avecDroit, "delete_catalog_item", { product_id: p.id })).code, "APPROVAL_REQUIRED");
  await prisma.connexionIA.update({ where: { id: avecDroit.connexionId }, data: { mode: "autopilot" } });
  const auto = (await contexteDeConnexion(avecDroit.connexionId))!;
  assert.equal((await appelerOutil(auto, "delete_catalog_item", { product_id: p.id })).code, "APPROVAL_REQUIRED");
  await prisma.connexionIA.update({ where: { id: avecDroit.connexionId }, data: { mode: "copilot" } });
  assert.ok(await existe(p.id), "rien n'est supprimé avant l'accord");
});

test("Brouillon puis produit publié jamais vendus : supprimés après accord, absents du catalogue relu", async () => {
  for (const actif of [false, true]) {
    const p = await produit(id.A, { actif, type: "fichier", produitFichier: { create: { fichiers: { create: [{ nom: "guide.pdf", url: "https://x.public.blob.vercel-storage.com/g.pdf" }] } } } });
    const r = await supprimerAvecAccord(avecDroit, { product_id: p.id });
    assert.ok(r.succes, r.resultat);
    assert.match(r.resultat, /supprimé\(e\) définitivement/);
    assert.equal(await existe(p.id), false);
    const cat = await appelerOutil(avecDroit, "lister_produits", { limite: 50 });
    assert.ok(!cat.resultat.includes(p.id), "absent du catalogue");
    assert.equal(await prisma.produitFichier.count({ where: { produitId: p.id } }), 0, "fichiers rattachés supprimés avec lui");
  }
});

test("Double appel, produit inexistant, identifiant invalide ou ambigu : erreurs explicites, jamais un faux succès", async () => {
  const p = await produit(id.A);
  assert.ok((await supprimerAvecAccord(avecDroit, { product_id: p.id })).succes);
  const second = await supprimerAvecAccord(avecDroit, { product_id: p.id });
  assert.equal(second.succes, false);
  assert.match(second.resultat, /NOT_FOUND.*déjà supprimé/);
  for (const args of [{ product_id: "inexistant-123" }, {}, { product_id: p.id, collection_id: "c1" }, { product_id: "x".repeat(200) }]) {
    const r = await supprimerAvecAccord(avecDroit, args);
    assert.equal(r.succes, false, JSON.stringify(args).slice(0, 60));
    assert.match(r.resultat, /NOT_FOUND|INVALID_INPUT/);
  }
});

test("Produit d'une autre boutique : introuvable, rien n'est touché chez B", async () => {
  const pB = await produit(id.B, { actif: true });
  const r = await supprimerAvecAccord(avecDroit, { product_id: pB.id });
  assert.equal(r.succes, false);
  assert.match(r.resultat, /NOT_FOUND/);
  assert.ok(await existe(pB.id));
  assert.deepEqual(await supprimerProduit(id.A, pB.id), { ok: false, status: 404, error: "Produit introuvable" });
});

test("Produit commandé : refus CONFLICT avec l'alternative archive_product ; commande et ligne intactes ; l'archivage marche", async () => {
  const p = await produit(id.A, { actif: true });
  const c = await prisma.commande.create({
    data: {
      numero: `${X}-1`, tenantId: id.A, clientNom: "Awa", clientTelephone: "+237600000001", adresseLivraison: "Digital", ville: "Douala", pays: "CM",
      montantSousTotal: 5500, montantTotal: 5500, devise: "XAF", methodePaiement: "notchpay", paiementStatut: "completed",
      lignes: { create: [{ produitId: p.id, nom: p.nom, prix: 5500, quantite: 1 }] },
    },
  });
  const r = await supprimerAvecAccord(avecDroit, { product_id: p.id });
  assert.equal(r.succes, false);
  assert.match(r.resultat, /CONFLICT.*archive_product/);
  assert.ok(await existe(p.id));
  assert.equal(await prisma.ligneCommande.count({ where: { commandeId: c.id, produitId: p.id } }), 1);
  assert.equal((await prisma.commande.findUniqueOrThrow({ where: { id: c.id } })).montantTotal, 5500);
  // Alternative : archiver (accord en copilote), puis relire.
  const demande = await appelerOutil(avecDroit, "archive_product", { product_id: p.id, archived: true });
  assert.equal(demande.code, "APPROVAL_REQUIRED");
  const prop = await prisma.axiaProposition.findFirstOrThrow({ where: { tenantId: id.A, action: { path: ["ia", "actionId"], equals: demande.actionId } } });
  assert.ok((await executerAccordIA(id.A, prop.action as unknown as ActionAccord, TOUT_ECRITURE)).succes);
  assert.equal((await prisma.produit.findUniqueOrThrow({ where: { id: p.id } })).actif, false);
});

test("Produit encore lié (liste de souhaits) : CONFLICT clair au lieu de « module momentanément indisponible »", async () => {
  const p = await produit(id.A, { actif: true });
  await prisma.wishlist.create({ data: { clientId: id.client, produitId: p.id } });
  const r = await supprimerAvecAccord(avecDroit, { product_id: p.id });
  assert.equal(r.succes, false);
  assert.match(r.resultat, /CONFLICT : .*encore lié.*archive_product/);
  assert.doesNotMatch(r.resultat, /indisponible/);
  assert.ok(await existe(p.id));
});

test("Produit créé par un import IA : après suppression, l'import ne se dit plus « prêt » ni « publié »", async () => {
  const p = await produit(id.A, { type: "fichier" });
  const imp = await prisma.importCreation.create({ data: { tenantId: id.A, source: "mcp", fournisseur: "test", creePar: "test", statut: "ready_for_review", produitId: p.id, metadonnees: { nom: p.nom, prix: 5500 } } });
  assert.ok((await supprimerAvecAccord(avecDroit, { product_id: p.id })).succes);
  const apres = await prisma.importCreation.findUniqueOrThrow({ where: { id: imp.id } });
  assert.equal(apres.statut, "failed");
  assert.equal(apres.produitId, null);
  assert.match(apres.derniereErreur!, /supprimé/);
  const e = await appelerOutil(avecDroit, "etat_import", { import_id: imp.id });
  assert.match(e.resultat, /Aucun produit créé/);
});
