// IMPORT IA → BOUTIQUE — circuit unique : ce qu'une IA externe (MCP, REST, lien de dépôt) ou
// Axso lui-même transmet (fichier en base64, adresse https, média de la médiathèque) devient un
// produit numérique de la boutique. Étapes persistées dans ImportCreation (voir regles.ts) :
// reçu → vérifié → stocké → produit créé → visuels associés → prêt → publié ; échec / reprise.
// Le produit n'est créé qu'une fois TOUS les fichiers stockés et relus : un échec ne laisse
// jamais de produit incomplet, et rien n'est mis en ligne sans fichier, prix et visuel.
import { createHash, randomBytes } from "crypto";
import { put, del } from "@vercel/blob";
import type { ImportCreation, FichierImport, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { dossierBoutique, SOUS_DOSSIER_DIGITAL } from "@/lib/fichiers-boutique";
import { enregistrerMedia } from "@/lib/controle-ia/mediatheque";
import { empreinte } from "@/lib/controle-ia/regles";
import { telechargerSur, DELAI_TELECHARGEMENT } from "./telechargement";
import {
  ErreurImport, TENTATIVES_MAX, delaiReprise, descriptionAvecBenefices, manquePourPublier, nomPropre, urlAcceptee, verifierFichier,
  type Statut,
} from "./regles";

// ─── Limites ─────────────────────────────────────────────────────────────────
// base64 : le corps d'une requête est limité à 4,5 Mo sur Vercel → 3 Mo de fichier.
export const MAX_BASE64 = 3 * 1024 * 1024;
export const MAX = { fichier: 50 * 1024 * 1024, visuel: 5 * 1024 * 1024 };
export const NB_MAX = { fichier: 5, visuel: 8 };
const BUDGET_TRAITEMENT = 45_000;

export { telechargerSur, type Telecharge } from "./telechargement";

// ─── Entrée ──────────────────────────────────────────────────────────────────
export interface SourceFichier { nom?: string; base64?: string; url?: string; mediaId?: string }
export interface MetaProduit {
  nom?: string; description?: string; prix?: number; devise?: string; categorie?: string; benefices?: string[]; tags?: string[];
  metaTitle?: string; metaDesc?: string; instructions?: string;
  /** Ajout de visuel à un produit existant : le nouveau visuel devient l'image principale. */
  principal?: boolean;
}
export interface EntreeImport {
  tenantId: string; source: "mcp" | "rest" | "depot" | "axso"; fournisseur: string; creePar: string; cle?: string | null;
  publierAuto: boolean; produit: MetaProduit; produitId?: string; fichiers: SourceFichier[]; visuels: SourceFichier[];
  /** Créé pour un lien de dépôt : les fichiers arriveront par la page de dépôt. */
  attendDepot?: boolean;
}

const dec64 = (s: string) => Buffer.from(s.replace(/^data:[^;,]+;base64,/, ""), "base64");
const taille64 = (s: string) => Math.floor((s.replace(/^data:[^;,]+;base64,/, "").length * 3) / 4);

/** Contrôles synchrones (avant tout stockage) : renvoie la raison d'un refus, sinon null. */
async function controler(e: EntreeImport): Promise<string | null> {
  if (e.fichiers.length > NB_MAX.fichier || e.visuels.length > NB_MAX.visuel) return `${NB_MAX.fichier} fichiers et ${NB_MAX.visuel} visuels au plus.`;
  for (const [role, s] of [...e.fichiers.map((s) => ["fichier", s] as const), ...e.visuels.map((s) => ["visuel", s] as const)]) {
    const n = [s.base64, s.url, s.mediaId].filter(Boolean).length;
    if (n !== 1) return `Chaque ${role} doit avoir exactement un contenu : content_base64, url${role === "visuel" ? " ou media_id" : ""}.`;
    if (s.mediaId && role === "fichier") return "media_id ne sert qu'aux visuels.";
    if (s.base64 && taille64(s.base64) > MAX_BASE64) return `Contenu base64 trop gros (max 3 Mo) : donne une adresse https ou crée un lien de dépôt (creer_lien_depot).`;
    if (s.base64 && !s.nom) return `Le nom du ${role} (avec son extension) est obligatoire avec content_base64.`;
    if (s.url && !urlAcceptee(s.url)) return `Adresse refusée « ${s.url.slice(0, 80)} » : https public uniquement.`;
  }
  const t = await prisma.tenant.findUnique({ where: { id: e.tenantId }, select: { devise: true } });
  if (!t) return "Boutique introuvable.";
  if (e.produit.devise && e.produit.devise.toUpperCase() !== t.devise) return `La boutique vend en ${t.devise} : donne le prix en ${t.devise} (aucune conversion automatique).`;
  if (e.produitId) {
    const p = await prisma.produit.findFirst({ where: { id: e.produitId, tenantId: e.tenantId }, select: { type: true } });
    if (!p) return "Produit introuvable dans cette boutique.";
    if (e.fichiers.length && p.type !== "fichier") return "Ce produit n'est pas un produit numérique à fichiers : ajoute seulement des visuels, ou crée un nouveau produit.";
  } else if (!e.attendDepot) {
    if (!e.produit.nom?.trim()) return "Le nom du produit est obligatoire.";
    if (!(Number(e.produit.prix) > 0)) return "Le prix doit être supérieur à 0.";
    if (!e.fichiers.length) return "Au moins un fichier téléchargeable est requis (ou crée un lien de dépôt).";
  }
  if (e.visuels.some((v) => v.mediaId)) {
    const ids = e.visuels.flatMap((v) => (v.mediaId ? [v.mediaId] : []));
    const n = await prisma.mediaIA.count({ where: { tenantId: e.tenantId, type: "image", id: { in: ids } } });
    if (n !== new Set(ids).size) return "media_id introuvable dans la médiathèque de cette boutique.";
  }
  return null;
}

export class RefusImport extends Error {}

/**
 * Crée (ou retrouve, même clé d'idempotence) un import puis le traite. Un import déjà connu
 * reçoit les contenus base64 renvoyés pour ses fichiers encore manquants (reprise).
 */
export async function importer(e: EntreeImport): Promise<ImportCreation & { fichiers: FichierImport[] }> {
  const raison = await controler(e);
  if (raison) throw new RefusImport(raison);
  const deja = e.cle ? await prisma.importCreation.findUnique({ where: { tenantId_cleIdempotence: { tenantId: e.tenantId, cleIdempotence: e.cle } }, include: { fichiers: true } }) : null;
  if (deja) {
    // Même clé : jamais un second import ni un second produit. Un produit en vente n'est pas
    // retouché par un rejeu ; sinon les fichiers envoyés complètent ou remplacent ce qui manque.
    const arrivees = [...e.fichiers.map((s) => ({ ...s, role: "fichier" as const })), ...e.visuels.map((s) => ({ ...s, role: "visuel" as const }))];
    if (deja.statut === "published" || e.attendDepot) return deja;
    if (arrivees.length) return traiter(deja.id, await fusionner(deja, arrivees));
    return ["failed", "retrying"].includes(deja.statut) ? traiter(deja.id) : deja;
  }
  const lignes = (role: "fichier" | "visuel", s: SourceFichier) => ({
    tenantId: e.tenantId, role, nom: nomDe(s, role), sourceUrl: s.url, ...(s.mediaId && { statut: "media", cle: s.mediaId }),
  });
  let imp: ImportCreation & { fichiers: FichierImport[] };
  try {
    imp = await prisma.importCreation.create({
      data: {
        tenantId: e.tenantId, source: e.source, fournisseur: e.fournisseur.slice(0, 40), creePar: e.creePar, cleIdempotence: e.cle || null,
        publierAuto: e.publierAuto, produitId: e.produitId, metadonnees: e.produit as Prisma.InputJsonValue,
        fichiers: { create: [...e.fichiers.map((s) => lignes("fichier", s)), ...e.visuels.map((s) => lignes("visuel", s))] },
      },
      include: { fichiers: true },
    });
  } catch (err: any) {
    // Deux appels simultanés avec la même clé : le second lit le premier.
    if (err?.code === "P2002" && e.cle) return prisma.importCreation.findUniqueOrThrow({ where: { tenantId_cleIdempotence: { tenantId: e.tenantId, cleIdempotence: e.cle } }, include: { fichiers: true } });
    throw err;
  }
  if (e.attendDepot) return imp;
  return traiter(imp.id, contenusPour(imp.fichiers, e));
}

/** Associe les contenus base64 reçus aux lignes encore non stockées (même rôle, dans l'ordre). */
function contenusPour(lignes: FichierImport[], e: EntreeImport): Map<string, Buffer> {
  const m = new Map<string, Buffer>();
  for (const role of ["fichier", "visuel"] as const) {
    const sources = (role === "fichier" ? e.fichiers : e.visuels);
    const cibles = lignes.filter((l) => l.role === role);
    sources.forEach((s, i) => { if (s.base64 && cibles[i] && cibles[i].statut !== "stocke") m.set(cibles[i].id, dec64(s.base64)); });
  }
  return m;
}

const nomDe = (s: SourceFichier, role: string) =>
  nomPropre(s.nom || (s.url ? decodeURIComponent(new URL(s.url).pathname.split("/").pop() || "") : "") || role);
const dejaStocke = (l: FichierImport) => l.statut === "stocke" || l.statut === "media";

/**
 * Reprise d'un import existant (même import_key, ou nouveau dépôt) : chaque fichier arrivé est
 * rapproché PAR SON NOM. Déjà stocké → ignoré (aucun doublon) ; pas encore stocké → sa source est
 * remplacée ; inconnu → ajouté. Pour un rôle où des fichiers arrivent, une ligne non stockée que
 * rien ne remplace est retirée : c'est ainsi qu'un jeu .html refusé est remplacé par son .zip.
 */
async function fusionner(imp: ImportCreation & { fichiers: FichierImport[] }, arrivees: (SourceFichier & { role: "fichier" | "visuel" })[]) {
  const contenus = new Map<string, Buffer>();
  for (const role of ["fichier", "visuel"] as const) {
    const nouvelles = arrivees.filter((a) => a.role === role);
    if (!nouvelles.length) continue;
    const lignes = imp.fichiers.filter((l) => l.role === role);
    const gardees = new Set<string>();
    for (const s of nouvelles) {
      const nom = nomDe(s, role);
      const l = s.mediaId ? lignes.find((x) => x.cle === s.mediaId) : lignes.find((x) => x.nom === nom && x.statut !== "media");
      if (l && dejaStocke(l)) {
        gardees.add(l.id);
        if (urlDepot(imp.tenantId, s.url)) await del(s.url!).catch(() => {}); // re-déposé pour rien
        continue;
      }
      const source = { sourceUrl: s.url ?? null, statut: s.mediaId ? "media" : "en_attente", cle: s.mediaId ?? null, erreur: null };
      const id = l
        ? (await prisma.fichierImport.update({ where: { id: l.id }, data: source })).id
        : (await prisma.fichierImport.create({ data: { importId: imp.id, tenantId: imp.tenantId, role, nom, ...source } })).id;
      gardees.add(id);
      if (s.base64) contenus.set(id, dec64(s.base64));
    }
    const retirees = lignes.filter((l) => !gardees.has(l.id) && !dejaStocke(l)).map((l) => l.id);
    if (retirees.length) await prisma.fichierImport.deleteMany({ where: { id: { in: retirees } } });
  }
  return contenus;
}

// ─── Stockage ────────────────────────────────────────────────────────────────
const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

/** Relit le fichier stocké et compare l'empreinte : le succès n'est annoncé qu'après cette preuve. */
async function relisible(url: string, empreinteAttendue: string): Promise<boolean> {
  if (url.startsWith("data:")) return sha256(dec64(url)) === empreinteAttendue;
  const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) }).catch(() => null);
  return !!r?.ok && sha256(Buffer.from(await r.arrayBuffer())) === empreinteAttendue;
}

/**
 * Range un fichier vérifié. Fichier vendu : dossier digitals/ de la boutique, nom suivi d'un
 * suffixe aléatoire (adresse impossible à deviner, jamais listée dans « Fichiers » ni renvoyée
 * à l'IA ou au client). Visuel : médiathèque (MediaIA), donc réutilisable ailleurs.
 * Même contenu déjà stocké pour la boutique (SHA-256) : réutilisé, pas de doublon.
 * ponytail: @vercel/blob 0.27 n'a que l'accès public ; passer les fichiers vendus en accès
 * privé quand le paquet sera mis à jour (la livraison les lit déjà côté serveur).
 */
/** Panne du stockage (Vercel Blob, médiathèque) : erreur passagère, l'import sera repris. */
const auStockage = <T>(p: Promise<T>) => p.catch((err) => {
  if (err instanceof ErreurImport) throw err;
  console.error(JSON.stringify({ evt: "import_creation_stockage", message: String(err?.message).slice(0, 200) }));
  throw new ErreurImport("Stockage d'Axso momentanément indisponible : nouvelle tentative automatique.", true);
});

async function stocker(imp: ImportCreation, f: FichierImport, donnees: Buffer, mime: string): Promise<Partial<FichierImport>> {
  const h = sha256(donnees);
  const meme = await prisma.fichierImport.findFirst({ where: { tenantId: imp.tenantId, sha256: h, role: f.role, statut: "stocke", url: { not: null } }, orderBy: { createdAt: "desc" } });
  if (meme?.url && await relisible(meme.url, h)) return { url: meme.url, cle: meme.cle, sha256: h, taille: donnees.length, mime, statut: "stocke", erreur: null };
  let url: string, cle: string | null;
  if (f.role === "visuel") {
    const media = await auStockage(enregistrerMedia({ tenantId: imp.tenantId, type: "image", fournisseur: imp.fournisseur, rendu: { donnees, mime }, creePar: imp.creePar, metadonnees: { origine: "import", importId: imp.id, nom: f.nom } }));
    url = media.url; cle = media.id; // cle d'un visuel = id MediaIA
  } else {
    if (!process.env.BLOB_READ_WRITE_TOKEN) throw new ErreurImport("Le stockage de fichiers d'Axso n'est pas configuré.");
    const depot = await auStockage(put(`${dossierBoutique(imp.tenantId)}${SOUS_DOSSIER_DIGITAL}import-${f.nom}`, donnees, { access: "public", contentType: mime, addRandomSuffix: true }));
    url = depot.url; cle = depot.pathname;
  }
  if (!(await relisible(url, h))) throw new ErreurImport("Le fichier stocké n'a pas pu être relu.", true);
  return { url, cle, sha256: h, taille: donnees.length, mime, statut: "stocke", erreur: null };
}

/** Fichier du dossier temporaire de dépôt de la boutique : supprimé une fois recopié ou refusé. */
const urlDepot = (tenantId: string, url: string | null | undefined): url is string =>
  !!url && !!process.env.BLOB_READ_WRITE_TOKEN && url.includes(`/${dossierBoutique(tenantId)}depot/`);

// ─── Traitement ──────────────────────────────────────────────────────────────
const maj = (id: string, data: Prisma.ImportCreationUpdateInput) => prisma.importCreation.update({ where: { id }, data });
const avancer = (id: string, statut: Statut) => maj(id, { statut });

async function slugLibre(tenantId: string, nom: string) {
  const base = slugify(nom) || "produit";
  const pris = await prisma.produit.findUnique({ where: { tenantId_slug: { tenantId, slug: base } }, select: { id: true } });
  return pris ? `${base}-${Date.now().toString(36)}` : base;
}

/** Exécute (ou reprend) un import ; idempotent : chaque étape faite n'est pas refaite. */
export async function traiter(importId: string, contenus = new Map<string, Buffer>()): Promise<ImportCreation & { fichiers: FichierImport[] }> {
  const debut = Date.now();
  let imp = await prisma.importCreation.findUniqueOrThrow({ where: { id: importId }, include: { fichiers: true } });
  if (imp.statut === "published") return imp;
  await maj(imp.id, { tentatives: { increment: 1 }, prochaineTentative: null });
  try {
    // 1-2. Chaque fichier manquant : acquisition, vérification, stockage durable, relecture.
    // Les contenus déjà reçus (base64) passent d'abord et sont stockés aussitôt : une adresse en
    // échec ne fait pas perdre le reste. Un fichier en échec n'arrête pas les autres.
    let premiere: ErreurImport | null = null;
    const attente = imp.fichiers.filter((x) => x.statut !== "stocke" && x.statut !== "media").sort((x, y) => Number(contenus.has(y.id)) - Number(contenus.has(x.id)));
    for (const f of attente) {
      const role = f.role as "fichier" | "visuel";
      try {
        let donnees = contenus.get(f.id);
        if (!donnees && f.sourceUrl) {
          const reste = BUDGET_TRAITEMENT - (Date.now() - debut);
          if (reste < 3000) throw new ErreurImport("Temps de traitement épuisé : la suite reprend à la prochaine tentative.", true);
          donnees = (await telechargerSur(f.sourceUrl, MAX[role], Math.min(DELAI_TELECHARGEMENT, reste))).donnees;
        }
        // Plus de source : la raison du dernier refus reste la meilleure explication.
        if (!donnees) throw new ErreurImport(f.statut === "echec" && f.erreur ? f.erreur : `Contenu de « ${f.nom} » à renvoyer (même import_key) ou à déposer par un lien de dépôt.`);
        if (donnees.length > MAX[role]) throw new ErreurImport(`« ${f.nom} » est trop volumineux.`);
        const v = verifierFichier(donnees, f.nom, role);
        if (!v.ok) {
          // Fichier temporaire refusé : supprimé, et son adresse oubliée (une reprise ne la
          // retéléchargera pas pour annoncer un faux « lien expiré », HTTP 404).
          if (urlDepot(imp.tenantId, f.sourceUrl)) {
            await del(f.sourceUrl).catch(() => {});
            await prisma.fichierImport.update({ where: { id: f.id }, data: { sourceUrl: null } });
          }
          throw new ErreurImport(`« ${f.nom} » refusé : ${v.raison}`);
        }
        await prisma.fichierImport.update({ where: { id: f.id }, data: await stocker(imp, f, donnees, v.mime) });
        // Fichier temporaire d'un dépôt : supprimé une fois recopié.
        if (urlDepot(imp.tenantId, f.sourceUrl)) await del(f.sourceUrl).catch(() => {});
      } catch (err) {
        if (!(err instanceof ErreurImport)) throw err;
        await prisma.fichierImport.update({ where: { id: f.id }, data: { statut: "echec", erreur: err.message.slice(0, 300) } });
        // L'erreur retenue : une erreur définitive l'emporte (inutile de retenter un 404).
        if (!premiere || (premiere.passagere && !err.passagere)) premiere = err;
      }
    }
    if (premiere) throw premiere;
    await avancer(imp.id, "validated");
    await avancer(imp.id, "stored");
    imp = await prisma.importCreation.findUniqueOrThrow({ where: { id: importId }, include: { fichiers: true } });

    // 3. Produit : créé une seule fois, puis complété.
    const meta = imp.metadonnees as MetaProduit;
    const fichiers = imp.fichiers.filter((f) => f.role === "fichier" && f.url);
    if (!imp.produitId) {
      // Import d'ajout (visuel, fichier) dont le produit a été supprimé : rien à recréer.
      if (!meta.nom?.trim() || !(Number(meta.prix) > 0)) throw new ErreurImport("Le produit visé n'existe plus : lance un nouvel import.");
      const produit = await prisma.produit.create({
        data: {
          tenantId: imp.tenantId, nom: meta.nom!.trim().slice(0, 150), slug: await slugLibre(imp.tenantId, meta.nom!), type: "fichier", actif: false,
          prix: Number(meta.prix), stock: 99999, // pas d'inventaire pour un fichier (comme /api/produits/digitaux)
          description: descriptionAvecBenefices(meta.description, meta.benefices), categorie: meta.categorie || null, tags: meta.tags ?? [],
          metaTitle: meta.metaTitle || null, metaDesc: meta.metaDesc || null, images: [],
          produitFichier: { create: { instructionsAchat: meta.instructions || null } },
        },
        select: { id: true },
      });
      imp = await prisma.importCreation.update({ where: { id: imp.id }, data: { produitId: produit.id }, include: { fichiers: true } });
    }
    const produitId = imp.produitId!;
    if (fichiers.length) {
      const pf = await prisma.produitFichier.upsert({ where: { produitId }, create: { produitId }, update: {}, include: { fichiers: { select: { url: true, ordre: true } } } });
      const connus = new Set(pf.fichiers.map((x) => x.url));
      let ordre = pf.fichiers.reduce((m, x) => Math.max(m, x.ordre + 1), 0);
      for (const f of fichiers.filter((x) => !connus.has(x.url!))) {
        await prisma.fichierNumerique.create({ data: { produitFichierId: pf.id, nom: f.nom, url: f.url!, taille: f.taille, mimeType: f.mime, ordre: ordre++ } });
      }
    }
    await avancer(imp.id, "product_created");

    // 4. Visuels : importés ou repris de la médiathèque (jamais régénérés).
    const medias = imp.fichiers.filter((f) => f.role === "visuel" && f.statut === "media");
    const urlsMedias = medias.length ? await prisma.mediaIA.findMany({ where: { tenantId: imp.tenantId, id: { in: medias.map((m) => m.cle!) } }, select: { id: true, url: true } }) : [];
    const nouvelles = [
      ...imp.fichiers.filter((f) => f.role === "visuel" && f.statut === "stocke" && f.url).map((f) => f.url!),
      ...medias.flatMap((m) => urlsMedias.filter((u) => u.id === m.cle).map((u) => u.url)),
    ];
    const p = await prisma.produit.findUniqueOrThrow({ where: { id: produitId }, select: { images: true } });
    const restantes = p.images.filter((u) => !nouvelles.includes(u));
    const images = (meta.principal ? [...nouvelles, ...restantes] : [...restantes, ...nouvelles]).slice(0, 12);
    if (images.join() !== p.images.join()) await prisma.produit.update({ where: { id: produitId }, data: { images } });
    const idsMedias = [...imp.fichiers.filter((f) => f.role === "visuel" && f.cle && !f.cle.includes("/")).map((f) => f.cle!)];
    for (const m of await prisma.mediaIA.findMany({ where: { tenantId: imp.tenantId, id: { in: idsMedias } }, select: { id: true, usage: true } })) {
      const usage = (m.usage ?? {}) as Record<string, any>;
      await prisma.mediaIA.update({ where: { id: m.id }, data: { usage: { ...usage, produits: [...new Set([...(usage.produits ?? []), produitId])] } } });
    }
    await avancer(imp.id, "assets_attached");

    // 5. Prêt (complet) ; publication automatique si elle a été demandée ET autorisée.
    const prod = await prisma.produit.findUniqueOrThrow({ where: { id: produitId }, select: { actif: true, type: true } });
    const manque = await manqueProduit(imp.tenantId, produitId);
    if (prod.actif) {
      await maj(imp.id, { statut: "published", derniereErreur: null }); // ajout à un produit déjà en vente
    } else if (prod.type !== "fichier") {
      await maj(imp.id, { derniereErreur: null }); // visuel ajouté à un autre type de produit : rien à publier ici
    } else if (manque.length) {
      await maj(imp.id, { derniereErreur: `À compléter avant publication : ${manque.join(", ")}.` });
    } else {
      await maj(imp.id, { statut: "ready_for_review", derniereErreur: null });
      if (imp.publierAuto) await publier(imp.tenantId, imp.id);
    }
  } catch (err: any) {
    const connue = err instanceof ErreurImport;
    if (!connue) console.error(JSON.stringify({ evt: "import_creation_erreur", import: importId, message: String(err?.message).slice(0, 300) }));
    const message = connue ? err.message : "Erreur interne pendant l'import.";
    const essais = (await prisma.importCreation.findUniqueOrThrow({ where: { id: importId }, select: { tentatives: true } })).tentatives;
    const retenter = (!connue || err.passagere) && essais < TENTATIVES_MAX;
    await maj(importId, { statut: retenter ? "retrying" : "failed", derniereErreur: message.slice(0, 500), prochaineTentative: retenter ? new Date(Date.now() + delaiReprise(essais)) : null });
  }
  return prisma.importCreation.findUniqueOrThrow({ where: { id: importId }, include: { fichiers: true } });
}

async function manqueProduit(tenantId: string, produitId: string): Promise<string[]> {
  const p = await prisma.produit.findFirst({ where: { id: produitId, tenantId }, select: { nom: true, prix: true, images: true, produitFichier: { select: { _count: { select: { fichiers: true } } } } } });
  if (!p) return ["le produit (supprimé)"];
  return manquePourPublier({ nom: p.nom, prix: p.prix, images: p.images, fichiersStockes: p.produitFichier?._count.fichiers ?? 0 });
}

/** Met le produit en vente, seulement s'il est complet. Renvoie ce qui manque (vide = publié). */
export async function publier(tenantId: string, importId: string): Promise<string[]> {
  const imp = await prisma.importCreation.findFirst({ where: { id: importId, tenantId } });
  if (!imp?.produitId) return ["un produit créé (l'import n'est pas allé jusque-là)"];
  const manque = await manqueProduit(tenantId, imp.produitId);
  if (manque.length) return manque;
  await prisma.produit.update({ where: { id: imp.produitId }, data: { actif: true } });
  await maj(imp.id, { statut: "published", derniereErreur: null });
  return [];
}

/** Reprend les imports dont la temporisation est passée (appelé à la consultation : suivi, etat_import). */
export async function reprendreEchus(tenantId: string, max = 2) {
  const echus = await prisma.importCreation.findMany({ where: { tenantId, statut: "retrying", prochaineTentative: { lte: new Date() } }, select: { id: true }, take: max });
  for (const e of echus) await traiter(e.id).catch(() => {});
}

/** Toutes boutiques confondues, pour le cron quotidien : quelques imports échus repris par passage. */
export async function reprendreImportsEchus(max = 5) {
  const echus = await prisma.importCreation.findMany({ where: { statut: "retrying", prochaineTentative: { lte: new Date() } }, select: { id: true }, orderBy: { prochaineTentative: "asc" }, take: max });
  let repris = 0;
  for (const e of echus) { await traiter(e.id).then(() => repris++).catch(() => {}); }
  return { repris };
}

// ─── Lien de dépôt ───────────────────────────────────────────────────────────
export const DUREE_DEPOT = 30 * 60_000;

/** Lien à usage unique et durée courte : l'utilisateur y dépose les fichiers que son assistant ne peut pas envoyer. */
export async function creerLienDepot(tenantId: string, importId: string, origine: string): Promise<{ url: string; expireLe: Date }> {
  const jeton = randomBytes(24).toString("base64url");
  const expireLe = new Date(Date.now() + DUREE_DEPOT);
  await prisma.jetonIA.create({ data: { hash: empreinte(jeton), type: "depot", expireLe, donnees: { tenantId, importId } } });
  return { url: `${origine}/depot/${jeton}`, expireLe };
}

export async function lireDepot(jeton: string): Promise<{ tenantId: string; importId: string; expireLe: Date } | null> {
  const j = await prisma.jetonIA.findUnique({ where: { hash: empreinte(jeton) } });
  if (!j || j.type !== "depot" || j.expireLe < new Date()) return null;
  const d = j.donnees as { tenantId: string; importId: string };
  return { ...d, expireLe: j.expireLe };
}

/** Consomme le lien (atomique : un second envoi échoue) et lance l'import avec les fichiers déposés. */
export async function finaliserDepot(jeton: string, depots: { url: string; nom: string; role: "fichier" | "visuel" }[]) {
  const d = await lireDepot(jeton);
  if (!d) return null;
  const prefixe = `/${dossierBoutique(d.tenantId)}depot/`;
  if (!depots.length || depots.some((x) => !urlAcceptee(x.url) || !new URL(x.url).hostname.endsWith(".blob.vercel-storage.com") || !new URL(x.url).pathname.startsWith(prefixe))) throw new RefusImport("Fichiers déposés invalides.");
  if (depots.filter((x) => x.role === "fichier").length > NB_MAX.fichier || depots.filter((x) => x.role === "visuel").length > NB_MAX.visuel) throw new RefusImport("Trop de fichiers.");
  const imp = await prisma.importCreation.findFirst({ where: { id: d.importId, tenantId: d.tenantId }, include: { fichiers: true } });
  if (!imp) return null;
  if (imp.statut === "published") throw new RefusImport("Ce produit est déjà en vente : demande à ton assistant un nouveau lien de dépôt pour ce produit.");
  if (!imp.produitId && !depots.some((x) => x.role === "fichier") && !imp.fichiers.some((l) => l.role === "fichier" && dejaStocke(l))) throw new RefusImport("Dépose au moins un fichier à vendre.");
  if ((await prisma.jetonIA.deleteMany({ where: { hash: empreinte(jeton), type: "depot", expireLe: { gt: new Date() } } })).count !== 1) return null;
  // Un nouveau dépôt sur un import en échec le reprend (mêmes règles que importer_creation).
  await fusionner(imp, depots.map((x) => ({ nom: x.nom, url: x.url, role: x.role })));
  await maj(d.importId, { statut: "received", source: "depot" });
  return traiter(d.importId);
}

// ─── Lecture ─────────────────────────────────────────────────────────────────
/** Vue d'un import pour l'IA ou le tableau de bord : jamais l'adresse d'un fichier vendu. */
export function resume(imp: ImportCreation & { fichiers: FichierImport[] }) {
  return {
    import_id: imp.id, status: imp.statut, product_id: imp.produitId, attempts: imp.tentatives, last_error: imp.derniereErreur,
    next_retry_at: imp.prochaineTentative?.toISOString() ?? null, auto_publish: imp.publierAuto,
    files: imp.fichiers.filter((f) => f.role === "fichier").map((f) => ({ name: f.nom, status: f.statut, size: f.taille, mime: f.mime, sha256: f.sha256, error: f.erreur })),
    images: imp.fichiers.filter((f) => f.role === "visuel").map((f) => ({ name: f.nom, status: f.statut, url: f.statut === "stocke" ? f.url : null, error: f.erreur })),
  };
}
