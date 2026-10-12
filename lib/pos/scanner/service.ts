// Scanner de la caisse : appairage des téléphones, scans, signal de vie,
// appareils enregistrés. SERVEUR uniquement — les règles pures sont dans
// ./regles.ts.
//
// - Appairage : la caisse crée un AppareilPos « en_attente » avec un secret à
//   usage unique (5 min) ; le téléphone l'échange contre un jeton, posé en
//   cookie httpOnly. En base : seulement les empreintes SHA-256 du secret et du
//   jeton. Les essais ratés sont comptés en base (AppareilPos.essais).
// - Un appareil est lié à UNE caisse ; changer de caisse = nouvel appairage
//   (l'ancien enregistrement du téléphone est alors révoqué).
// - Scan : idempotent sur ScanPos (tenantId, scanId) ; rejouer un scanId ne
//   crée ni seconde ligne ni second événement.
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../prisma";
import { COOKIE_APPAREIL, accesPos, droitsUtilisateur, hacherJeton } from "../acces";
import { journaliserAudit } from "../audit";
import { resoudreCode } from "../catalogue";
import { AUCUN_DROIT, droitsAppareil, exigerDroit, exigerUnDroit } from "../droits";
import { ErreurPos, reponseErreurPos } from "../erreurs";
import { publierEvenement } from "../evenements";
import { lireReglagesPos, sessionObligatoire } from "../flags";
import { resoudreCaisse } from "../magasins";
import type { ContextePos } from "../types";
import { DUREE_CODE_MS, ESSAIS_MAX, SEUIL_ECRAN_VENTE_MS, codeAmbigu, decouperCode, decrireAppareil, droitsDuContexte, enLigne, evaluerScan, horodatageScan } from "./regles";

// ── Accès ─────────────────────────────────────────────────────────────────────

/** Cookie du jeton d'appareil : httpOnly (illisible par le JavaScript de la page), 180 jours, révocable à tout moment côté serveur. */
export function poserCookieAppareil(reponse: NextResponse, jeton: string | null): NextResponse {
  reponse.cookies.set(COOKIE_APPAREIL, jeton ?? "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/",
    maxAge: jeton ? 180 * 24 * 3600 : 0,
  });
  return reponse;
}

/** Jeton d'appareil présenté par la requête (même lecture que accesPos, qui ne l'exporte pas). */
export function lireJetonAppareil(req: Request): string | null {
  const autorisation = req.headers.get("authorization");
  if (autorisation?.toLowerCase().startsWith("bearer ")) return autorisation.slice(7).trim() || null;
  const cookie = req.headers.get("cookie")?.split(";").map((c) => c.trim()).find((c) => c.startsWith(COOKIE_APPAREIL + "="));
  return cookie ? decodeURIComponent(cookie.slice(COOKIE_APPAREIL.length + 1)) || null : null;
}

/**
 * Contexte d'une route du scanner. Avec `?appareil=1` (l'écran /scanner du
 * téléphone), la requête est identifiée par son JETON D'APPAREIL uniquement :
 * accesPos donnerait la priorité à une session marchande ouverte dans le même
 * navigateur, et le scan perdrait son appareil (et sa caisse). Sans ce
 * paramètre (poste de caisse), c'est accesPos.
 */
export async function accesScanner(req: Request): Promise<ContextePos | NextResponse> {
  if (new URL(req.url).searchParams.get("appareil") !== "1") return accesPos(req);
  try {
    const jeton = lireJetonAppareil(req);
    if (!jeton) throw new ErreurPos("appareil_refuse", 401, "Ce téléphone n'est pas encore relié à une caisse. Sur la caisse, ouvrez « Connecter un scanner » et scannez le QR code.");
    const appareil = await prisma.appareilPos.findUnique({ where: { tokenHash: hacherJeton(jeton) } });
    if (!appareil || appareil.statut !== "actif") {
      throw new ErreurPos("appareil_refuse", 401, "Cet appareil n'est plus autorisé. Appairez-le de nouveau depuis la caisse.");
    }
    const proprietaire = await droitsUtilisateur(appareil.tenantId, appareil.appairePar);
    const { magasinId, caisseId } = await resoudreCaisse(appareil.tenantId, { caisseId: appareil.caisseId });
    const ouverte = await prisma.sessionCaisse.findUnique({ where: { caisseOuverteId: caisseId }, select: { id: true } });
    return {
      tenantId: appareil.tenantId, userId: appareil.appairePar, userNom: `Appareil « ${appareil.nom} »`,
      magasinId, caisseId, sessionCaisseId: ouverte?.id, appareilId: appareil.id,
      droits: proprietaire ? droitsAppareil(proprietaire.droits) : AUCUN_DROIT,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    };
  } catch (e) {
    const r = reponseErreurPos(e);
    const reponse = new NextResponse(r.body, { status: r.status, headers: r.headers });
    // Jeton refusé : on l'efface du téléphone, il ne servira plus.
    return e instanceof ErreurPos && e.code === "appareil_refuse" ? poserCookieAppareil(reponse, null) : reponse;
  }
}

/** Comme routePos, avec accesScanner. */
export function routeScanner(fn: (ctx: ContextePos, req: Request) => Promise<Response | object>) {
  return async (req: Request): Promise<Response> => {
    const ctx = await accesScanner(req);
    if (ctx instanceof NextResponse) return ctx;
    try {
      const r = await fn(ctx, req);
      return r instanceof Response ? r : NextResponse.json(r);
    } catch (e) {
      return reponseErreurPos(e);
    }
  };
}

// ── Appairage ─────────────────────────────────────────────────────────────────

export const schemaAppairage = z.object({ nom: z.string().trim().min(1).max(60).nullish() });
export const schemaEchange = z.object({ code: z.string().trim().min(10).max(120) });
export const schemaRenommage = z.object({ nom: z.string().trim().min(1, "Donnez un nom à l'appareil.").max(60) });

/**
 * Ouvre un appairage sur la caisse de travail : un appareil « en_attente » et
 * son code à usage unique. Droit : gerer_appareils. Le code n'est rendu qu'ici,
 * une fois ; la base n'en garde que l'empreinte.
 */
export async function ouvrirAppairage(ctx: ContextePos, d: z.infer<typeof schemaAppairage>): Promise<{ appareilId: string; code: string; expireAt: string }> {
  exigerDroit(ctx, "gerer_appareils");
  const { flags } = await lireReglagesPos(ctx.tenantId);
  if (!flags.scanner_v2) {
    throw new ErreurPos("fonction_desactivee", 403, "Le scanner mobile n'est pas encore activé pour cette boutique. Activez-le dans les réglages de la caisse.");
  }
  if (!flags.multi_scanner) {
    const dejaLa = await prisma.appareilPos.findFirst({ where: { tenantId: ctx.tenantId, caisseId: ctx.caisseId, statut: "actif" }, select: { nom: true } });
    if (dejaLa) {
      throw new ErreurPos("conflit", 409, `Cette caisse a déjà un scanner connecté (« ${dejaLa.nom} »). Révoquez-le, ou activez les scanners multiples dans les réglages de la caisse.`);
    }
  }
  const secret = randomBytes(18).toString("base64url");
  const expireAt = new Date(Date.now() + DUREE_CODE_MS);
  const appareil = await prisma.$transaction(async (tx) => {
    // Les demandes jamais abouties ne s'accumulent pas.
    await tx.appareilPos.deleteMany({ where: { tenantId: ctx.tenantId, statut: "en_attente", codeExpireAt: { lt: new Date() } } });
    const a = await tx.appareilPos.create({
      data: {
        tenantId: ctx.tenantId, magasinId: ctx.magasinId, caisseId: ctx.caisseId, nom: d.nom ?? "Scanner",
        statut: "en_attente", codeAppairage: hacherJeton(secret), codeExpireAt: expireAt, appairePar: ctx.userId,
      },
      select: { id: true },
    });
    await journaliserAudit(tx, ctx, { action: "appareil.appairage_ouvert", entite: "AppareilPos", entiteId: a.id, apres: { caisseId: ctx.caisseId, expireAt } });
    return a;
  });
  return { appareilId: appareil.id, code: `${appareil.id}.${secret}`, expireAt: expireAt.toISOString() };
}

/**
 * Échange le code du QR contre un jeton d'appareil. PUBLIC (le téléphone n'a
 * encore aucune identité) : tout repose sur le secret, sa durée de vie et le
 * compteur d'essais tenu en base. Rend le jeton EN CLAIR une seule fois.
 */
export async function echangerCode(p: { code: string; userAgent: string | null; ip: string | null; ancienJeton: string | null }): Promise<{ jeton: string; appareilId: string }> {
  const illisible = new ErreurPos("code_invalide", 400, "Ce QR code n'est pas un code d'appairage AXSO. Scannez celui affiché sur la caisse.");
  const code = decouperCode(p.code);
  if (!code) throw illisible;
  const appareil = await prisma.appareilPos.findUnique({ where: { id: code.id } });
  if (!appareil) throw new ErreurPos("code_invalide", 404, "Ce code d'appairage n'est pas reconnu. Affichez un nouveau QR code sur la caisse.");
  if (appareil.statut !== "en_attente") throw new ErreurPos("code_utilise", 409, "Ce code a déjà servi. Affichez un nouveau QR code sur la caisse.");
  if (appareil.essais >= ESSAIS_MAX) throw new ErreurPos("trop_d_essais", 429, "Trop d'essais avec ce code. Affichez un nouveau QR code sur la caisse.");
  if (!appareil.codeExpireAt || appareil.codeExpireAt.getTime() < Date.now()) {
    throw new ErreurPos("code_expire", 410, "Ce code a expiré : il n'est valable que 5 minutes. Affichez un nouveau QR code sur la caisse.");
  }

  const jeton = randomBytes(32).toString("base64url");
  const decrit = decrireAppareil(p.userAgent);
  const nom = appareil.nom === "Scanner" ? decrit.nom : appareil.nom;
  const acteur = { tenantId: appareil.tenantId, userId: appareil.appairePar, userNom: `Appareil « ${nom} »`, magasinId: appareil.magasinId ?? undefined, caisseId: appareil.caisseId ?? undefined, appareilId: appareil.id, ip: p.ip };

  const active = await prisma.$transaction(async (tx) => {
    // Une seule requête décide : bon secret, non expiré, pas déjà pris, essais restants.
    const { count } = await tx.appareilPos.updateMany({
      where: { id: appareil.id, statut: "en_attente", codeAppairage: hacherJeton(code.secret), codeExpireAt: { gt: new Date() }, essais: { lt: ESSAIS_MAX } },
      data: {
        statut: "actif", tokenHash: hacherJeton(jeton), codeAppairage: null, codeExpireAt: null,
        nom, type: decrit.type, userAgent: p.userAgent?.slice(0, 300) ?? null, dernierSignalAt: new Date(),
      },
    });
    if (!count) return false;
    // Ce téléphone était déjà relié (à cette caisse ou à une autre) : l'ancien lien tombe.
    if (p.ancienJeton) {
      await tx.appareilPos.updateMany({
        where: { tokenHash: hacherJeton(p.ancienJeton), tenantId: appareil.tenantId, statut: "actif", id: { not: appareil.id } },
        data: { statut: "revoque", revoqueAt: new Date(), tokenHash: null },
      });
    }
    await journaliserAudit(tx, acteur, { action: "appareil.connecte", entite: "AppareilPos", entiteId: appareil.id, apres: { nom, type: decrit.type, caisseId: appareil.caisseId } });
    await publierEvenement(tx, {
      tenantId: appareil.tenantId, magasinId: appareil.magasinId, caisseId: appareil.caisseId, type: "device.connected",
      payload: { appareilId: appareil.id, nom, type: decrit.type, origine: "appairage" },
    });
    return true;
  });
  if (!active) {
    await prisma.appareilPos.updateMany({ where: { id: appareil.id, statut: "en_attente" }, data: { essais: { increment: 1 } } });
    throw new ErreurPos("code_invalide", 401, "Ce code d'appairage est incorrect. Scannez de nouveau le QR code affiché sur la caisse.");
  }
  return { jeton, appareilId: appareil.id };
}

// ── Appareils enregistrés ─────────────────────────────────────────────────────

/** Appareils actifs de la caisse de travail, ou de toute la boutique (`boutique`), avec leur état de connexion. */
export async function listerAppareils(ctx: ContextePos, portee: "caisse" | "boutique") {
  if (portee === "boutique") exigerUnDroit(ctx, "gerer_appareils", "voir_caisse");
  else exigerUnDroit(ctx, "gerer_appareils", "voir_caisse", "vendre", "scanner");
  // Un membre limité à certains magasins ne voit que leurs appareils.
  const limites = portee === "boutique" && !ctx.appareilId ? (await droitsUtilisateur(ctx.tenantId, ctx.userId))?.magasinIds ?? [] : [];
  const appareils = await prisma.appareilPos.findMany({
    where: {
      tenantId: ctx.tenantId, statut: "actif",
      ...(portee === "caisse" ? { caisseId: ctx.caisseId } : limites.length ? { magasinId: { in: limites } } : {}),
    },
    select: { id: true, nom: true, type: true, magasinId: true, caisseId: true, dernierSignalAt: true, createdAt: true },
    orderBy: { createdAt: "asc" }, take: 200,
  });
  const maintenant = Date.now();
  return appareils.map((a) => ({
    ...a, dernierSignalAt: a.dernierSignalAt?.toISOString() ?? null, createdAt: a.createdAt.toISOString(),
    enLigne: enLigne(a.dernierSignalAt, maintenant),
  }));
}

export async function renommerAppareil(ctx: ContextePos, id: string, nom: string) {
  exigerDroit(ctx, "gerer_appareils");
  const avant = await prisma.appareilPos.findFirst({ where: { id, tenantId: ctx.tenantId, statut: "actif" }, select: { id: true, nom: true } });
  if (!avant) throw new ErreurPos("introuvable", 404, "Cet appareil est introuvable dans cette boutique.");
  await prisma.$transaction(async (tx) => {
    await tx.appareilPos.update({ where: { id }, data: { nom } });
    await journaliserAudit(tx, ctx, { action: "appareil.renomme", entite: "AppareilPos", entiteId: id, avant: { nom: avant.nom }, apres: { nom } });
  });
  return { id, nom };
}

/** Révoque un appareil : son jeton est effacé, sa requête suivante est refusée. Rejouable sans effet. */
export async function revoquerAppareil(ctx: ContextePos, id: string) {
  exigerDroit(ctx, "gerer_appareils");
  const appareil = await prisma.appareilPos.findFirst({ where: { id, tenantId: ctx.tenantId }, select: { id: true, nom: true, statut: true, magasinId: true, caisseId: true } });
  if (!appareil) throw new ErreurPos("introuvable", 404, "Cet appareil est introuvable dans cette boutique.");
  if (appareil.statut === "revoque") return { id, dejaRevoque: true };
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.appareilPos.updateMany({
      where: { id, tenantId: ctx.tenantId, statut: { not: "revoque" } },
      data: { statut: "revoque", revoqueAt: new Date(), tokenHash: null, codeAppairage: null, codeExpireAt: null },
    });
    if (!count) return;
    await journaliserAudit(tx, ctx, { action: "appareil.revoque", entite: "AppareilPos", entiteId: id, avant: { nom: appareil.nom, statut: appareil.statut }, apres: { statut: "revoque" } });
    await publierEvenement(tx, {
      tenantId: ctx.tenantId, magasinId: appareil.magasinId, caisseId: appareil.caisseId, type: "device.disconnected",
      payload: { appareilId: id, nom: appareil.nom, motif: "revoque" },
    });
  });
  return { id, dejaRevoque: false };
}

// ── Signal de vie ─────────────────────────────────────────────────────────────

export const schemaSignal = z.object({ etat: z.enum(["en_ligne", "hors_ligne"]).default("en_ligne"), ecran: z.literal("vente").nullable().optional() });

/**
 * Signe de vie d'un téléphone (AppareilPos.dernierSignalAt) ou d'un poste de
 * caisse (Caisse.dernierSignalAt). Un téléphone qui revient après un silence
 * publie `device.connected` ; celui qui ferme sa page publie
 * `device.disconnected`. Le silence lui-même est constaté par le flux.
 */
export async function signalDeVie(ctx: ContextePos, etat: "en_ligne" | "hors_ligne", ecran?: "vente" | null): Promise<void> {
  const maintenant = new Date();
  if (!ctx.appareilId) {
    // `ecran` : "vente" tant que l'écran de vente est affiché, null quand le caissier le quitte.
    if (etat === "en_ligne") await prisma.caisse.updateMany({ where: { id: ctx.caisseId, tenantId: ctx.tenantId }, data: { dernierSignalAt: maintenant, ...(ecran !== undefined ? { ecranVenteAt: ecran ? maintenant : null } : {}) } });
    return;
  }
  const id = ctx.appareilId;
  const appareil = await prisma.appareilPos.findFirst({ where: { id, tenantId: ctx.tenantId }, select: { nom: true, dernierSignalAt: true } });
  if (!appareil) return;
  const evenement = (type: "device.connected" | "device.disconnected", plus: Record<string, unknown>) =>
    ({ tenantId: ctx.tenantId, magasinId: ctx.magasinId, caisseId: ctx.caisseId, type, payload: { appareilId: id, nom: appareil.nom, ...plus } });
  if (etat === "hors_ligne") {
    await prisma.$transaction((tx) => publierEvenement(tx, evenement("device.disconnected", { motif: "ferme" })));
  } else if (!enLigne(appareil.dernierSignalAt, maintenant.getTime())) {
    await prisma.$transaction(async (tx) => {
      await tx.appareilPos.updateMany({ where: { id, statut: "actif" }, data: { dernierSignalAt: maintenant } });
      await publierEvenement(tx, evenement("device.connected", { origine: "reconnexion" }));
    });
  } else {
    await prisma.appareilPos.updateMany({ where: { id, statut: "actif" }, data: { dernierSignalAt: maintenant } });
  }
}

/** Ce que l'écran du téléphone affiche : sa caisse, son magasin, l'état de la session, ce qu'il a le droit de scanner. */
export async function infosPoste(ctx: ContextePos) {
  const [caisse, boutique, reglages, appareil] = await Promise.all([
    prisma.caisse.findFirst({ where: { id: ctx.caisseId, tenantId: ctx.tenantId }, select: { id: true, nom: true, magasin: { select: { id: true, nom: true } } } }),
    prisma.tenant.findUnique({ where: { id: ctx.tenantId }, select: { nomBoutique: true, devise: true } }),
    lireReglagesPos(ctx.tenantId),
    ctx.appareilId ? prisma.appareilPos.findFirst({ where: { id: ctx.appareilId, tenantId: ctx.tenantId }, select: { id: true, nom: true } }) : null,
  ]);
  return {
    appareil,
    caisse: caisse ? { id: caisse.id, nom: caisse.nom } : null,
    magasin: caisse?.magasin ?? null,
    boutique: { nom: boutique?.nomBoutique ?? "", devise: boutique?.devise ?? "XAF" },
    session: { ouverte: !!ctx.sessionCaisseId, obligatoire: sessionObligatoire(reglages) },
    droits: ctx.droits,
    serveurAt: new Date().toISOString(),
  };
}

// ── Scans ─────────────────────────────────────────────────────────────────────

export const schemaScan = z.object({
  scanId: z.string().trim().min(8).max(100),
  code: z.string().trim().min(1, "Le code lu est vide.").max(128),
  contexte: z.enum(["vente", "inventaire", "reception", "transfert", "recherche", "prix", "stock", "creation"]).default("vente"),
  source: z.enum(["camera", "clavier", "mobile"]).default("camera"),
  scanneAt: z.string().max(40).nullish(),
});

/** Article désigné par le code, et si ce code en désigne plusieurs (code-barres de variantes en double, SKU partagé…). */
async function catalogueScan(tenantId: string, code: string, magasinId: string) {
  const champs = { id: true, codeBarres: true, sku: true } as const;
  const [article, variantes, produits] = await Promise.all([
    resoudreCode(tenantId, code, { magasinId }),
    prisma.variante.findMany({ where: { actif: true, OR: [{ codeBarres: code }, { sku: code }], produit: { tenantId } }, select: { ...champs, produitId: true }, take: 5 }),
    prisma.produit.findMany({ where: { tenantId, OR: [{ codeBarres: code }, { sku: code }] }, select: champs, take: 5 }),
  ]);
  return { article, ambigu: !!article && codeAmbigu(code, variantes, produits) };
}

/**
 * Enregistre un scan et le publie sur le bus de la caisse (`scan.created`,
 * avec l'article résolu). Rejouer le même `scanId` ne crée rien : la réponse
 * porte `rejoue: true`. Le prix d'achat ne voyage jamais dans l'événement.
 */
export async function enregistrerScan(ctx: ContextePos, d: z.infer<typeof schemaScan>) {
  exigerUnDroit(ctx, ...droitsDuContexte(d.contexte));
  if (d.contexte === "vente" && !ctx.sessionCaisseId && sessionObligatoire(await lireReglagesPos(ctx.tenantId))) {
    throw new ErreurPos("caisse_fermee", 409, "La caisse est fermée. Ouvrez-la sur l'ordinateur avant de scanner des articles à vendre.");
  }
  // Téléphone → caisse : sans écran de VENTE à l'écoute (il donne signe de vie toutes les 15 s), le scan
  // n'irait dans aucun panier — y compris quand l'ordinateur affiche Retours ou Stock. Il est refusé
  // en le disant, plutôt qu'affiché « Envoyé à la caisse ».
  if (ctx.appareilId && d.contexte === "vente") {
    const poste = await prisma.caisse.findFirst({ where: { id: ctx.caisseId, tenantId: ctx.tenantId }, select: { ecranVenteAt: true } });
    if (!poste?.ecranVenteAt || Date.now() - poste.ecranVenteAt.getTime() > SEUIL_ECRAN_VENTE_MS) {
      throw new ErreurPos("poste_absent", 409, "L'écran de caisse ne répond pas sur l'ordinateur (fermé ou hors connexion) : ce scan n'a PAS été ajouté au panier. Ouvrez la caisse, puis scannez de nouveau.");
    }
  }
  const { article: brut, ambigu } = await catalogueScan(ctx.tenantId, d.code, ctx.magasinId);
  const article = brut ? { ...brut, cout: null, variantes: brut.variantes.map((v) => ({ ...v, cout: null })) } : null;
  const { etat, resultat, message } = evaluerScan(article, ambigu, d.contexte);
  // Un téléphone appairé est toujours la source « mobile » ; un poste ne peut pas s'en réclamer.
  const source = ctx.appareilId ? "mobile" : d.source === "mobile" ? "camera" : d.source;
  const scanneAt = horodatageScan(d.scanneAt);

  let rejoue = false;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.scanPos.create({
        data: {
          tenantId: ctx.tenantId, scanId: d.scanId, appareilId: ctx.appareilId ?? null, userId: ctx.userId,
          magasinId: ctx.magasinId, caisseId: ctx.caisseId, sessionCaisseId: ctx.sessionCaisseId ?? null,
          contexte: d.contexte, codeBarres: d.code, resultat, source, scanneAt,
          produitId: ambigu ? null : article?.produitId ?? null, varianteId: ambigu ? null : article?.varianteId ?? null,
        },
      });
      if (ctx.appareilId) await tx.appareilPos.updateMany({ where: { id: ctx.appareilId, statut: "actif" }, data: { dernierSignalAt: new Date() } });
      await publierEvenement(tx, {
        tenantId: ctx.tenantId, magasinId: ctx.magasinId, caisseId: ctx.caisseId, type: "scan.created",
        payload: {
          scanId: d.scanId, code: d.code, contexte: d.contexte, source, appareilId: ctx.appareilId ?? null, userId: ctx.userId, auteur: ctx.userNom,
          sessionCaisseId: ctx.sessionCaisseId ?? null, scanneAt: scanneAt.toISOString(), resultat, etat, message,
          article: ambigu ? null : article,
        },
      });
    });
  } catch (e) {
    // Seule contrainte unique de cette transaction : (tenantId, scanId). Le scan était déjà enregistré.
    if ((e as { code?: string })?.code !== "P2002") throw e;
    rejoue = true;
  }
  return { ok: true, rejoue, scanId: d.scanId, code: d.code, contexte: d.contexte, resultat, etat, message, article: ambigu ? null : article };
}
