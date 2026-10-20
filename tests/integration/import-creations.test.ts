// IMPORT IA → BOUTIQUE — tests d'intégration sur la base LOCALE (`npm run test:integration`).
// Aucun réseau réel : Vercel Blob est un petit serveur local (VERCEL_BLOB_API_URL), sa lecture
// passe par un faux fetch et les adresses sources par un faux https.get. Deux boutiques de test
// sont créées puis entièrement supprimées. Rejoue l'incident Business Quest (2Y Method,
// 19/10/2026 : jeu .html refusé puis « HTTP 404 » à chaque reprise) et le parcours complet.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import https from "node:https";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { SCOPES, creerClientId } from "@/lib/controle-ia/regles";
import { appelerOutil, contexteDeConnexion, contexteDuJeton, echangerCode, emettreCode, outilsDisponibles, type ContexteIA } from "@/lib/controle-ia/serveur";
import { importer, lireDepot, traiter } from "@/lib/import-creations/pipeline";
import { HTML_REFUSE } from "@/lib/import-creations/regles";
import { POST as deposer } from "@/app/api/depot/[jeton]/route";
import { GET as telecharger } from "@/app/api/telechargements/[token]/route";

const url = process.env.DATABASE_URL ?? "";
if (!/@localhost[/:]|host=\/var\/run/.test(url)) throw new Error("Tests d'intégration : DATABASE_URL doit pointer sur la base locale.");

// ─── Faux stockage Vercel Blob ───────────────────────────────────────────────
const HOTE = "teststore.public.blob.vercel-storage.com";
const stock = new Map<string, Buffer>();
let stockageEnPanne = false;
const adresse = (chemin: string) => `https://${HOTE}/${chemin.split("/").map(encodeURIComponent).join("/")}`;
const cheminDe = (u: string | URL) => decodeURIComponent(new URL(u).pathname.slice(1));
const serveurBlob: Server = createServer(async (req, res) => {
  const morceaux: Buffer[] = [];
  for await (const m of req) morceaux.push(m as Buffer);
  const u = new URL(req.url!, "http://local");
  res.setHeader("content-type", "application/json");
  if (stockageEnPanne) { res.statusCode = 503; return res.end(JSON.stringify({ error: { code: "service_unavailable", message: "panne simulée" } })); }
  if (req.method === "PUT") {
    let chemin = u.searchParams.get("pathname")!;
    if (req.headers["x-add-random-suffix"] === "1") chemin = chemin.replace(/(\.[a-z0-9]+)?$/i, (e) => `-${randomBytes(4).toString("hex")}${e}`);
    stock.set(chemin, Buffer.concat(morceaux));
    return res.end(JSON.stringify({ url: adresse(chemin), downloadUrl: adresse(chemin), pathname: chemin, contentType: req.headers["x-content-type"], contentDisposition: "inline" }));
  }
  if (req.method === "POST" && u.pathname === "/delete") {
    for (const x of JSON.parse(Buffer.concat(morceaux).toString()).urls) stock.delete(cheminDe(x));
    return res.end("{}");
  }
  res.statusCode = 400; res.end(JSON.stringify({ error: { code: "bad_request", message: "inattendu" } }));
});

globalThis.fetch = (async (entree: any) => {
  const u = new URL(typeof entree === "string" ? entree : entree.url ?? String(entree));
  if (u.hostname === HOTE) { const d = stock.get(cheminDe(u)); return d ? new Response(new Uint8Array(d)) : new Response("introuvable", { status: 404 }); }
  throw new Error(`Réseau interdit en test : ${u.hostname}`);
}) as typeof fetch;

// Adresses sources (https.get de lib/import-creations/telechargement.ts).
type Reponse = { status: number; body?: Buffer; location?: string } | "delai";
const sources = new Map<string, Reponse>();
(https as any).get = (u: URL, _o: unknown, rappel: (res: any) => void) => {
  const req: any = new EventEmitter();
  req.destroy = (e?: Error) => { if (e) req.emit("error", e); req.emit("close"); };
  setImmediate(() => {
    const r: Reponse = u.hostname === HOTE ? (stock.has(cheminDe(u)) ? { status: 200, body: stock.get(cheminDe(u)) } : { status: 404 }) : sources.get(u.toString()) ?? { status: 404 };
    if (r === "delai") return req.emit("timeout");
    const res: any = Readable.from(r.body ? [r.body] : []);
    res.statusCode = r.status; res.headers = r.location ? { location: r.location } : {};
    rappel(res);
  });
  return req;
};

// ─── Fichiers ────────────────────────────────────────────────────────────────
const PDF = Buffer.from("%PDF-1.4\n%Valider son idee business\n1 0 obj<<>>endobj\n%%EOF");
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489", "hex");
const HTML = Buffer.from("<!DOCTYPE html><html><body><script>jouer()</script></body></html>");
const ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0]), Buffer.from("index.html du jeu")]);
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const b64 = (b: Buffer) => b.toString("base64");

// ─── Boutiques, comptes, connexion IA ────────────────────────────────────────
const X = `zzimp${randomBytes(3).toString("hex")}`;
const id = { A: "", B: "", uA: "", uB: "" };
const REDIRECT = "http://localhost:9999/cb";
let ctx: ContexteIA, ctx2: ContexteIA;

async function relier(userId: string, boutique: string) {
  const clientId = creerClientId(`Essai ${X}`, [REDIRECT])!;
  const verifier = randomBytes(40).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const code = await emettreCode({ userId, boutiques: [boutique], client: `Essai ${X}`, scopes: SCOPES.filter((s) => s !== "axso:delete:write"), clientId, redirectUri: REDIRECT, challenge });
  const j = await echangerCode({ code, clientId, redirectUri: REDIRECT, verifier });
  return (await contexteDuJeton(j!.access_token))!;
}
const mode = async (c: ContexteIA, m: string) => {
  await prisma.connexionIA.update({ where: { id: c.connexionId }, data: { mode: m } });
  return (await contexteDeConnexion(c.connexionId))!;
};
async function boutique(suffixe: string, userId: string) {
  const t = await prisma.tenant.create({ data: { slug: `${X}-${suffixe}`, nomBoutique: `Boutique ${suffixe} ${X}`, categorie: "digital", pays: "CM", whatsapp: "+237600000000", email: `${X}-${suffixe}@exemple.test`, planType: "palier2", planExpiresAt: new Date(Date.now() + 30 * 86_400_000), statut: "active" } });
  await prisma.proprietaireBoutique.create({ data: { userId, tenantId: t.id, role: "owner" } });
  return t.id;
}
/** Dépose des fichiers comme le navigateur (dossier temporaire de la boutique) puis appelle la vraie route. */
async function deposerFichiers(jeton: string, tenantId: string, fichiers: [string, Buffer, "fichier" | "visuel"][]) {
  const liste = fichiers.map(([nom, data, role]) => {
    const chemin = `boutiques/${tenantId}/depot/${randomBytes(4).toString("hex")}/${nom}`;
    stock.set(chemin, data);
    return { url: adresse(chemin), nom, role };
  });
  const r = await deposer(new Request(`http://localhost/api/depot/${jeton}`, { method: "POST", body: JSON.stringify({ fichiers: liste }), headers: { "content-type": "application/json" } }), { params: Promise.resolve({ jeton }) });
  return { status: r.status, corps: await r.json() };
}
const temporaires = (tenantId: string) => [...stock.keys()].filter((k) => k.startsWith(`boutiques/${tenantId}/depot/`));
const lignes = (importId: string) => prisma.fichierImport.findMany({ where: { importId }, orderBy: { createdAt: "asc" } });

before(async () => {
  await new Promise<void>((ok) => serveurBlob.listen(0, "127.0.0.1", ok));
  Object.assign(process.env, {
    VERCEL_BLOB_API_URL: `http://127.0.0.1:${(serveurBlob.address() as any).port}`, VERCEL_BLOB_RETRIES: "0",
    BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_teststore_secretdetest", NEXT_PUBLIC_APP_URL: "https://axso.test", AUTH_SECRET: process.env.AUTH_SECRET || "secret-de-test",
  });
  id.uA = (await prisma.user.create({ data: { email: `${X}-a@exemple.test`, name: "A", role: "owner" } })).id;
  id.uB = (await prisma.user.create({ data: { email: `${X}-b@exemple.test`, name: "B", role: "owner" } })).id;
  id.A = await boutique("a", id.uA); id.B = await boutique("b", id.uB);
  ctx = await mode(await relier(id.uA, id.A), "copilot");
  ctx2 = await mode(await relier(id.uA, id.A), "copilot"); // seconde connexion : les limites d'appels sont par connexion
});

after(async () => {
  const boutiques = [id.A, id.B].filter(Boolean);
  await prisma.connexionIA.deleteMany({ where: { userId: { in: [id.uA, id.uB] } } });
  for (const t of boutiques) await prisma.jetonIA.deleteMany({ where: { type: "depot", donnees: { path: ["tenantId"], equals: t } } }).catch(() => {});
  const commandes = (await prisma.commande.findMany({ where: { tenantId: { in: boutiques } }, select: { id: true } })).map((c) => c.id);
  await prisma.telechargement.deleteMany({ where: { commandeId: { in: commandes } } });
  await prisma.ligneCommande.deleteMany({ where: { commandeId: { in: commandes } } });
  for (let passe = 0; passe < 3; passe++) {
    for (const m of Prisma.dmmf.datamodel.models) {
      if (!m.fields.some((f) => f.name === "tenantId")) continue;
      await (prisma as any)[m.name[0].toLowerCase() + m.name.slice(1)]?.deleteMany({ where: { tenantId: { in: boutiques } } }).catch(() => {});
    }
  }
  serveurBlob.closeAllConnections(); serveurBlob.close();
  await prisma.tenant.deleteMany({ where: { id: { in: boutiques } } });
  await prisma.user.deleteMany({ where: { id: { in: [id.uA, id.uB] } } });
  await prisma.$disconnect();
});

// ─── Incident Business Quest ─────────────────────────────────────────────────
const BQ = {
  name: "Business Quest — Valider son idée business", price: 5500, currency: "XAF",
  description: "Le guide pratique en 7 jours et le jeu Business Quest pour tester une idée avant d'investir.",
  benefits: ["Guide PDF en 7 jours", "Jeu éducatif interactif"], instructions: "Ouvrez le PDF. Extrayez l'archive .zip puis ouvrez index.html dans votre navigateur (aucune connexion Internet requise).",
  meta_title: "Business Quest — Valider son idée", import_key: `bq-${X}`,
};
const etat: { importId: string; jeton1: string; produitId: string } = { importId: "", jeton1: "", produitId: "" };

test("Incident A→D reproduit : le .html est refusé avec la consigne .zip, PDF et visuel gardés, aucun produit, plus jamais de faux « 404 »", async () => {
  const lien = await appelerOutil(ctx, "creer_lien_depot", BQ);
  assert.ok(lien.succes, lien.resultat);
  const upload = String(lien.donnees!.upload_url);
  etat.importId = String(lien.donnees!.import_id);
  etat.jeton1 = upload.split("/depot/")[1];
  assert.match(lien.resultat, /UNIQUEMENT au dépôt/);
  assert.match(lien.resultat, /ni l'adresse du produit, ni celle du téléchargement/);

  // Le jeton du lien n'est jamais écrit en clair dans le journal.
  const journal = await prisma.actionIA.findFirst({ where: { connexionId: ctx.connexionId, outil: "creer_lien_depot" }, orderBy: { createdAt: "desc" } });
  assert.ok(journal && !journal.sortie?.includes(etat.jeton1) && !JSON.stringify(journal.donnees).includes(etat.jeton1), "jeton masqué dans le journal");
  assert.match(journal!.sortie!, /\/depot\/•••/);

  const r = await deposerFichiers(etat.jeton1, id.A, [["Valider-son-idee-business-2Y-Method.pdf", PDF, "fichier"], ["Business Quest.png", PNG, "visuel"], ["Business-Quest.html", HTML, "fichier"]]);
  assert.equal(r.status, 200);
  assert.equal(r.corps.status, "failed");
  assert.equal(r.corps.last_error, `« Business-Quest.html » refusé : ${HTML_REFUSE}`);

  const l = await lignes(etat.importId);
  assert.deepEqual(l.map((x) => `${x.nom}:${x.statut}`).sort(), ["Business Quest.png:stocke", "Business-Quest.html:echec", "Valider-son-idee-business-2Y-Method.pdf:stocke"]);
  assert.equal(l.find((x) => x.nom === "Business-Quest.html")!.sourceUrl, null, "adresse temporaire oubliée après refus");
  assert.deepEqual(temporaires(id.A), [], "fichiers temporaires supprimés (recopiés ou refusés)");
  assert.equal((await prisma.importCreation.findUniqueOrThrow({ where: { id: etat.importId } })).produitId, null, "aucun produit créé");

  // Diagnostic : cause, ce qui est gardé, état du produit, action suivante.
  const e = await appelerOutil(ctx, "etat_import", { import_id: etat.importId });
  assert.ok(e.succes);
  for (const attendu of ["Échec", ".zip", "Conservés : Valider-son-idee-business-2Y-Method.pdf, Business Quest.png", "Aucun produit créé", `creer_lien_depot avec import_id ${etat.importId}`]) assert.ok(e.resultat.includes(attendu), `${attendu} dans : ${e.resultat}`);

  // « Reprendre » (tableau de bord, cron) : la raison du refus reste, pas un « HTTP 404 ».
  const repris = await traiter(etat.importId);
  assert.equal(repris.statut, "failed");
  assert.ok(!repris.derniereErreur!.includes("404") && repris.derniereErreur!.includes(".zip"), repris.derniereErreur!);
});

test("Liens : le lien consommé ne resert pas, un lien expiré est refusé, un nouveau lien reprend le MÊME import", async () => {
  assert.equal(await lireDepot(etat.jeton1), null, "lien à usage unique consommé");
  assert.equal((await deposerFichiers(etat.jeton1, id.A, [["x.pdf", PDF, "fichier"]])).status, 410);

  // Même import_key sans import_id : le même import, aucun second import.
  const parCle = await appelerOutil(ctx, "creer_lien_depot", BQ);
  assert.equal(parCle.donnees!.import_id, etat.importId);
  const expire = String(parCle.donnees!.upload_url).split("/depot/")[1];
  await prisma.jetonIA.updateMany({ where: { type: "depot", expireLe: { gt: new Date() }, donnees: { path: ["importId"], equals: etat.importId } }, data: { expireLe: new Date(Date.now() - 1000) } });
  assert.equal(await lireDepot(expire), null);
  assert.equal((await deposerFichiers(expire, id.A, [["x.pdf", PDF, "fichier"]])).status, 410, "lien expiré : 410");
  assert.equal(await prisma.importCreation.count({ where: { tenantId: id.A, cleIdempotence: BQ.import_key } }), 1);
  // Les essais refusés ci-dessus ont posé x.pdf dans le dossier temporaire (en vrai, un lien
  // expiré empêche l'envoi lui-même) : on les retire pour la suite.
  for (const k of temporaires(id.A)) stock.delete(k);
});

test("Reprise : le jeu déposé en .zip remplace le .html, aucun doublon, produit complet en BROUILLON à 5 500 XAF", async () => {
  const lien = await appelerOutil(ctx, "creer_lien_depot", { import_id: etat.importId });
  assert.equal(lien.donnees!.import_id, etat.importId);
  const jeton = String(lien.donnees!.upload_url).split("/depot/")[1];
  // L'utilisateur redépose tout : PDF et visuel identiques (déjà stockés) + le jeu en .zip.
  const r = await deposerFichiers(jeton, id.A, [["Valider-son-idee-business-2Y-Method.pdf", PDF, "fichier"], ["Business Quest.png", PNG, "visuel"], ["Business-Quest.zip", ZIP, "fichier"]]);
  assert.equal(r.status, 200, JSON.stringify(r.corps));
  assert.equal(r.corps.status, "ready_for_review", JSON.stringify(r.corps));

  const l = await lignes(etat.importId);
  assert.deepEqual(l.filter((x) => x.role === "fichier").map((x) => x.nom).sort(), ["Business-Quest.zip", "Valider-son-idee-business-2Y-Method.pdf"], "le .html refusé est retiré, aucun doublon");
  assert.equal(l.filter((x) => x.role === "visuel").length, 1);
  assert.ok(l.every((x) => x.statut === "stocke"));
  assert.deepEqual(temporaires(id.A), [], "copies déposées en double supprimées");

  const imp = await prisma.importCreation.findUniqueOrThrow({ where: { id: etat.importId } });
  etat.produitId = imp.produitId!;
  const p = await prisma.produit.findUniqueOrThrow({ where: { id: etat.produitId }, include: { produitFichier: { include: { fichiers: { orderBy: { ordre: "asc" } } } } } });
  assert.equal(p.actif, false, "brouillon : pas en vente");
  assert.equal(p.prix, 5500);
  assert.equal((await prisma.tenant.findUniqueOrThrow({ where: { id: id.A } })).devise, "XAF");
  assert.equal(p.type, "fichier");
  assert.equal(p.images.length, 1);
  assert.match(p.description!, /• Jeu éducatif interactif/);
  assert.equal(p.metaTitle, BQ.meta_title);
  assert.equal(p.produitFichier!.instructionsAchat, BQ.instructions);
  assert.deepEqual(p.produitFichier!.fichiers.map((f) => [f.nom, f.mimeType]), [["Valider-son-idee-business-2Y-Method.pdf", "application/pdf"], ["Business-Quest.zip", "application/zip"]]);
  // Intégrité : les octets stockés sont exactement ceux déposés.
  assert.equal(sha(stock.get(cheminDe(p.produitFichier!.fichiers[1].url))!), sha(ZIP));

  const e = await appelerOutil(ctx, "etat_import", { import_id: etat.importId });
  assert.match(e.resultat, /BROUILLON \(pas en vente\)/);
  assert.match(e.resultat, /publier_import/);
});

test("Publication : en copilote elle attend l'accord du marchand ; rien n'est en vente avant", async () => {
  const r = await appelerOutil(ctx, "publier_import", { import_id: etat.importId });
  assert.equal(r.code, "APPROVAL_REQUIRED", r.resultat);
  assert.equal((await prisma.produit.findUniqueOrThrow({ where: { id: etat.produitId } })).actif, false);
  // Un produit incomplet (sans visuel) n'est jamais publié, même en autopilote.
  const auto = await mode(ctx2, "autopilot");
  const sans = await appelerOutil(auto, "importer_creation", { name: `Sans visuel ${X}`, price: 1000, files: [{ name: "a.pdf", content_base64: b64(PDF) }], import_key: `sans-visuel-${X}`, publish: true });
  assert.equal(sans.donnees!.status, "assets_attached", sans.resultat);
  assert.match(sans.resultat, /au moins un visuel/);
  const pub = await appelerOutil(auto, "publier_import", { import_id: String(sans.donnees!.import_id) });
  assert.equal(pub.code, "VALIDATION_FAILED");
  assert.equal((await prisma.produit.findUniqueOrThrow({ where: { id: String(sans.donnees!.product_id) } })).actif, false);
  // Le produit Business Quest (de test) : publié en autopilote, puis relu.
  const ok = await appelerOutil(auto, "publier_import", { import_id: etat.importId });
  assert.ok(ok.succes, ok.resultat);
  assert.equal((await prisma.produit.findUniqueOrThrow({ where: { id: etat.produitId } })).actif, true);
  await mode(ctx2, "copilot");
});

test("Acheteur : après paiement, le PDF et le jeu .zip se téléchargent, octets identiques", async () => {
  const c = await prisma.commande.create({
    data: {
      numero: `${X}-1`, tenantId: id.A, clientNom: "Awa Test", clientEmail: `awa-${X}@exemple.test`, clientTelephone: "+237600000001", adresseLivraison: "Digital", ville: "Douala", pays: "CM",
      montantSousTotal: 5500, montantTotal: 5500, devise: "XAF", methodePaiement: "notchpay", paiementStatut: "completed",
      lignes: { create: [{ produitId: etat.produitId, nom: BQ.name, prix: 5500, quantite: 1 }] },
    },
  });
  const token = randomBytes(24).toString("hex");
  await prisma.telechargement.create({ data: { produitId: etat.produitId, commandeId: c.id, token } });
  const fichiers = (await prisma.produitFichier.findUniqueOrThrow({ where: { produitId: etat.produitId }, include: { fichiers: { orderBy: { ordre: "asc" } } } })).fichiers;
  for (const [f, attendu] of [[fichiers[0], PDF], [fichiers[1], ZIP]] as const) {
    const r = await telecharger(new NextRequest(`http://localhost/api/telechargements/${token}?fichier=${f.id}`), { params: Promise.resolve({ token }) });
    assert.equal(r.status, 200, f.nom);
    assert.match(r.headers.get("content-disposition")!, new RegExp(`attachment; filename\\*=UTF-8''${encodeURIComponent(f.nom)}`));
    assert.equal(sha(Buffer.from(await r.arrayBuffer())), sha(attendu));
  }
});

// ─── Sources distantes, idempotence, pannes ──────────────────────────────────
test("Adresses sources : 404 définitif, 500 et délai repris plus tard, redirection interne refusée ; jamais de produit partiel", async () => {
  const cas: [string, Reponse, string, boolean][] = [
    ["404", { status: 404 }, "failed", false], ["500", { status: 500 }, "retrying", true], ["delai", "delai", "retrying", true],
    ["redir", { status: 302, location: "https://169.254.169.254/latest/meta-data" }, "failed", false],
  ];
  for (const [nom, rep, statut, prevue] of cas) {
    const src = `https://source.exemple.test/${nom}/guide.pdf`;
    sources.set(src, rep);
    const r = await appelerOutil(ctx2, "importer_creation", { name: `Source ${nom} ${X}`, price: 2000, files: [{ url: src }], images: [{ name: "c.png", content_base64: b64(PNG) }], import_key: `src-${nom}-${X}` });
    assert.equal(r.donnees!.status, statut, `${nom} : ${r.resultat}`);
    assert.equal(!!r.donnees!.next_retry_at, prevue, nom);
    assert.equal(r.donnees!.product_id, null, `${nom} : aucun produit`);
    assert.match(r.resultat, /Conservés : c\.png/);
  }
  // Reprise du 404 avec une nouvelle adresse (même import_key) : l'ancienne ligne est remplacée.
  sources.set("https://source.exemple.test/ok/guide-v2.pdf", { status: 200, body: PDF });
  const repris = await appelerOutil(ctx2, "importer_creation", { name: `Source 404 ${X}`, price: 2000, files: [{ url: "https://source.exemple.test/ok/guide-v2.pdf" }], import_key: `src-404-${X}` });
  assert.equal(repris.donnees!.status, "ready_for_review", repris.resultat);
  assert.deepEqual((repris.donnees!.files as any[]).map((f) => [f.name, f.status]), [["guide-v2.pdf", "stocke"]]);
  // SSRF : adresse interne refusée avant tout import.
  const ssrf = await appelerOutil(ctx2, "importer_creation", { name: "x", price: 1, files: [{ url: "https://127.0.0.1/a.pdf" }], import_key: `ssrf-${X}` });
  assert.equal(ssrf.code, "INVALID_INPUT");
  assert.equal(await prisma.importCreation.count({ where: { cleIdempotence: `ssrf-${X}` } }), 0);
});

test("Idempotence : appels simultanés et rejeu après exécution → un seul import, un seul produit, aucun fichier en double", async () => {
  const appel = { name: `Rejeu ${X}`, price: 3000, files: [{ name: "guide.pdf", content_base64: b64(PDF) }], images: [{ name: "c.png", content_base64: b64(PNG) }], import_key: `rejeu-${X}` };
  const rs = await Promise.all([1, 2, 3].map(() => appelerOutil(ctx2, "importer_creation", appel)));
  assert.equal(new Set(rs.map((r) => r.donnees?.import_id)).size, 1, rs.map((r) => r.resultat).join(" | "));
  // Rejeu (la réponse précédente s'est perdue côté client).
  const rejeu = await appelerOutil(ctx2, "importer_creation", appel);
  assert.equal(rejeu.donnees!.import_id, rs[0].donnees!.import_id);
  assert.equal(await prisma.produit.count({ where: { tenantId: id.A, nom: appel.name } }), 1);
  assert.equal((await lignes(String(rejeu.donnees!.import_id))).length, 2);
});

test("Panne du stockage : erreur passagère explicite, aucun produit ; renvoyer le même import_key termine l'import", async () => {
  // Contenu jamais stocké (sinon la déduplication SHA-256 le réutilise sans écrire).
  const unique = Buffer.concat([PDF, Buffer.from(`\n%${randomBytes(8).toString("hex")}`)]);
  const appel = { name: `Panne ${X}`, price: 3000, files: [{ name: "guide.pdf", content_base64: b64(unique) }], images: [{ name: "c.png", content_base64: b64(PNG) }], import_key: `panne-${X}` };
  stockageEnPanne = true;
  const r = await appelerOutil(ctx2, "importer_creation", appel).finally(() => { stockageEnPanne = false; });
  assert.equal(r.donnees!.status, "retrying", r.resultat);
  assert.match(r.resultat, /Stockage d'Axso momentanément indisponible/);
  assert.equal(r.donnees!.product_id, null);
  const ok = await appelerOutil(ctx2, "importer_creation", appel);
  assert.equal(ok.donnees!.status, "ready_for_review", ok.resultat);
  assert.equal(await prisma.produit.count({ where: { tenantId: id.A, nom: appel.name } }), 1);
});

test("Étanchéité : un import, un produit ou un dossier de dépôt d'une autre boutique est introuvable", async () => {
  const impB = await importer({ tenantId: id.B, source: "axso", fournisseur: "test", creePar: id.uB, publierAuto: false, produit: { nom: `B ${X}`, prix: 1000 }, fichiers: [], visuels: [], attendDepot: true });
  const pB = await prisma.produit.create({ data: { tenantId: id.B, nom: `Produit B ${X}`, slug: `produit-b-${X}`, prix: 1000, type: "fichier", stock: 1 } });
  // publier_import en autopilote (en copilote, l'accord du marchand est demandé avant ; l'exécution répondrait NOT_FOUND).
  const auto = await mode(ctx2, "autopilot");
  for (const [outil, args] of [["etat_import", { import_id: impB.id }], ["creer_lien_depot", { import_id: impB.id }], ["publier_import", { import_id: impB.id }]] as const) {
    assert.equal((await appelerOutil(auto, outil, args)).code, "NOT_FOUND", outil);
  }
  await mode(ctx2, "copilot");
  const autre = await appelerOutil(ctx2, "importer_creation", { product_id: pB.id, files: [{ name: "a.pdf", content_base64: b64(PDF) }], import_key: `etanche-${X}` });
  assert.equal(autre.code, "INVALID_INPUT");
  // Lien de dépôt de A, fichiers pris dans le dossier de B : refusés.
  const lien = await appelerOutil(ctx2, "creer_lien_depot", { name: `Etanche ${X}`, price: 1000, import_key: `etanche-depot-${X}` });
  const r = await deposerFichiers(String(lien.donnees!.upload_url).split("/depot/")[1], id.B, [["a.pdf", PDF, "fichier"]]);
  assert.equal(r.status, 400);
});

test("Contrats MCP : outil inconnu, paramètres manquants ou invalides, devise étrangère → erreurs structurées, rien de créé", async () => {
  assert.equal((await appelerOutil(ctx2, "outil_inexistant", {})).code, "NOT_FOUND");
  const avant = await prisma.importCreation.count({ where: { tenantId: id.A } });
  for (const args of [
    { name: "x", price: 1000, import_key: `c1-${X}` }, // pas de fichier
    { name: "x", price: 0, files: [{ name: "a.pdf", content_base64: b64(PDF) }], import_key: `c2-${X}` },
    { name: "x", price: 1000, currency: "EUR", files: [{ name: "a.pdf", content_base64: b64(PDF) }], import_key: `c3-${X}` },
    { name: "x", price: 1000, files: [{ name: "a.pdf", content_base64: b64(PDF), url: "https://source.exemple.test/a.pdf" }], import_key: `c4-${X}` },
    { name: "x", price: 1000, files: [{ content_base64: b64(PDF) }], import_key: `c5-${X}` },
    { name: "x", price: 1000, files: [{ name: "gros.pdf", content_base64: "A".repeat(4_200_000) }], import_key: `c6-${X}` },
  ]) {
    const r = await appelerOutil(ctx2, "importer_creation", args);
    assert.equal(r.code, "INVALID_INPUT", JSON.stringify(args).slice(0, 80));
    assert.ok(!r.succes);
  }
  assert.equal(await prisma.importCreation.count({ where: { tenantId: id.A } }), avant);
  // Schéma exposé : celui que le serveur exécute (paramètres requis, clés d'idempotence).
  const outil = outilsDisponibles(ctx2).find((o) => o.name === "importer_creation")!;
  assert.deepEqual(outil.inputSchema.required, ["files"]);
  assert.ok("import_key" in outil.inputSchema.properties && "idempotency_key" in outil.inputSchema.properties);
  assert.match(outil.description, /\.zip/);
});
