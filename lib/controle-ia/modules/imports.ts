// Module « imports » d'AXSO CONTROL : une création faite par l'IA (ebook, modèle, pack audio…)
// devient un produit numérique de la boutique, sans téléchargement ni réimport manuel.
// Un serveur MCP n'a PAS accès aux fichiers internes de l'assistant : le fichier arrive en
// base64 (3 Mo au plus), par une adresse https publique, ou par un lien de dépôt que
// l'assistant donne à l'utilisateur. Tout passe par lib/import-creations/pipeline.ts.
import { origineAxso } from "@/lib/origine-site";
import { prisma } from "@/lib/prisma";
import { INCONNU, type CtxOutil, type ModuleIA, type OutilIA, type ResultatIA } from "../types";
import { creerLienDepot, importer, publier, reprendreEchus, resume, traiter, RefusImport, type EntreeImport, type MetaProduit, type SourceFichier } from "@/lib/import-creations/pipeline";
import { LIBELLES, type Statut } from "@/lib/import-creations/regles";

const COMMUN = { module: "produits", capacite: "import_creation" } as const;
const SOURCE = {
  type: "object",
  properties: {
    name: { type: "string", description: "Nom du fichier AVEC son extension (ex. guide.pdf)" },
    content_base64: { type: "string", description: "Contenu encodé en base64 (3 Mo au plus)" },
    url: { type: "string", description: "Adresse https publique où Axso peut télécharger le fichier (50 Mo au plus)" },
  },
};
const VISUEL = { ...SOURCE, properties: { ...SOURCE.properties, media_id: { type: "string", description: "Image déjà dans la médiathèque Axso (list_media) : réutilisée, pas régénérée" } } };
const META = {
  name: { type: "string", description: "Nom du produit" },
  description: { type: "string" },
  price: { type: "number", description: "Prix de vente (> 0) dans la devise de la boutique (axso_contexte)" },
  currency: { type: "string", description: "Facultatif : doit être la devise de la boutique (XAF par défaut), aucune conversion" },
  category: { type: "string" },
  benefits: { type: "array", items: { type: "string" }, description: "Bénéfices pour l'acheteur, affichés en liste" },
  tags: { type: "array", items: { type: "string" } },
  meta_title: { type: "string", description: "Titre SEO (60 caractères)" },
  meta_description: { type: "string", description: "Description SEO (155 caractères)" },
  instructions: { type: "string", description: "Instructions données à l'acheteur avec le téléchargement" },
};
const CLE = { import_key: { type: "string", description: "Clé stable de cette création (ex. « guide-ecommerce-v1 ») : rappeler avec la même clé renvoie le même import, ou le reprend s'il a échoué (renvoie alors les contenus base64)" } };
const IMPORT_ID = { import_id: { type: "string", description: "Identifiant renvoyé par importer_creation ou creer_lien_depot" } };

const OUTILS: OutilIA[] = [
  {
    name: "importer_creation", ...COMMUN, niveau: "ecriture", risque: "faible",
    description: "Transforme une création (PDF, DOCX, XLSX, PPTX, CSV, ZIP, MP3, MP4…) en PRODUIT NUMÉRIQUE vendable de la boutique : fichier stocké chez Axso et livré automatiquement après paiement, visuels, description, prix, SEO. Fichier en content_base64 (3 Mo max) ou url https publique ; si tu ne peux fournir ni l'un ni l'autre (fichier produit dans ta conversation), utilise creer_lien_depot. Le produit reste en BROUILLON tant qu'il n'est pas complet (fichier + prix + au moins un visuel) ; publish: true le met en ligne seul en mode autopilote, sinon appelle publier_import. Avec product_id : ajoute les fichiers et visuels à un produit numérique existant. Passe toujours un import_key : le même appel rejoué renvoie le même import (jamais un second produit). Reprise d'un import en échec : rappelle avec le même import_key et la liste des fichiers voulus — un fichier déjà stocké (même nom) est gardé tel quel, un fichier en échec est remplacé par celui de même nom, et un fichier en échec que tu ne renvoies pas est retiré. Pages web HTML, SVG et exécutables refusés : un jeu ou une page HTML se vend dans une archive .zip (l'acheteur l'extrait puis ouvre le .html) — précise-le dans instructions, et si le jeu a besoin d'Internet.",
    parameters: {
      type: "object",
      properties: {
        ...META,
        files: { type: "array", items: SOURCE, description: "Fichiers livrés à l'acheteur (5 au plus)" },
        images: { type: "array", items: VISUEL, description: "Visuels (8 au plus) ; le premier devient l'image principale" },
        product_id: { type: "string", description: "Facultatif : produit numérique existant à compléter" },
        publish: { type: "boolean", description: "Mettre en ligne dès que le produit est complet (autopilote seulement)" },
        ...CLE,
      },
      required: ["files"],
    },
    sortie: "{ import_id, status, product_id, files[], images[], last_error }",
    exemple: { name: "Guide du e-commerce au Cameroun", price: 5000, description: "40 pages pour lancer sa boutique.", benefits: ["Méthode pas à pas", "Modèles prêts à l'emploi"], files: [{ name: "guide.pdf", url: "https://exemple.com/guide.pdf" }], images: [{ name: "couverture.png", content_base64: "iVBORw0…" }], import_key: "guide-ecommerce-v1" },
  },
  {
    name: "ajouter_visuel_produit", ...COMMUN, niveau: "ecriture", risque: "faible",
    description: "Ajoute un visuel à un produit existant de la boutique (couverture, aperçu…) : image en content_base64, url https, ou media_id de la médiathèque (aucune régénération). main: true en fait l'image principale.",
    parameters: { type: "object", properties: { product_id: { type: "string" }, image: VISUEL, main: { type: "boolean" }, ...CLE }, required: ["product_id", "image"] },
    sortie: "{ import_id, status, product_id, images[] }",
    exemple: { product_id: "cmf0abc123", image: { media_id: "cm456" }, main: true },
  },
  {
    name: "creer_lien_depot", ...COMMUN, niveau: "ecriture", risque: "faible",
    description: "Quand tu ne peux pas envoyer le fichier toi-même (fichier généré dans la conversation, trop gros pour le base64) : crée un lien de dépôt sécurisé, à usage unique, valable 30 minutes. Donne ce lien à l'utilisateur : il y glisse le fichier et les visuels, et Axso crée le produit avec les informations que tu fournis ici. Suis ensuite l'import avec etat_import. Lien expiré, déjà utilisé, ou import en échec à compléter : rappelle creer_lien_depot avec import_id (le même import, ses fichiers déjà stockés sont gardés). Pas de HTML : un jeu HTML se dépose en .zip.",
    parameters: { type: "object", properties: { ...META, product_id: { type: "string", description: "Facultatif : produit numérique existant à compléter" }, ...IMPORT_ID, publish: { type: "boolean" }, ...CLE } },
    sortie: "{ upload_url, expires_at, import_id }",
    exemple: { name: "Pack de modèles Excel", price: 3000, import_key: "pack-excel-depot" },
  },
  {
    name: "etat_import", ...COMMUN, niveau: "lecture",
    description: "État d'un import (reçu, vérifié, stocké, produit créé, visuels associés, prêt, publié, échec, nouvelle tentative) avec la dernière erreur ; sans import_id : les 10 derniers imports. Relance un import dont la nouvelle tentative est due.",
    parameters: { type: "object", properties: IMPORT_ID },
    sortie: "{ import_id, status, product_id, files[], images[], last_error, next_retry_at }",
    exemple: { import_id: "cm789" },
  },
  {
    name: "publier_import", ...COMMUN, niveau: "ecriture", risque: "moyen", enLigne: () => true,
    description: "Met en vente le produit d'un import terminé. Refusé s'il manque le fichier stocké, un prix > 0 ou un visuel. En mode copilote, attend l'accord du marchand.",
    parameters: { type: "object", properties: IMPORT_ID, required: ["import_id"] },
    sortie: "{ import_id, status, product_id }",
    exemple: { import_id: "cm789" },
  },
];

const refus = (code: "INVALID_INPUT" | "NOT_FOUND" | "VALIDATION_FAILED" | "CONFLICT", message: string): ResultatIA => ({ succes: false, code, resultat: `${code} : ${message}` });

const txt = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
const sources = (v: unknown, max: number): SourceFichier[] => (Array.isArray(v) ? v.slice(0, max + 1) : []).map((s: any) => ({
  nom: txt(s?.name, 120), base64: txt(s?.content_base64, 6_000_000), url: txt(s?.url, 2000), mediaId: txt(s?.media_id, 64),
}));
const listeTextes = (v: unknown, n: number, max: number) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, n).map((x) => x.slice(0, max)) : undefined);

function meta(a: Record<string, any>): MetaProduit {
  const prix = a.price === undefined || a.price === null || a.price === "" ? undefined : Number(a.price);
  return {
    nom: txt(a.name, 150), description: txt(a.description, 10_000), prix, devise: txt(a.currency, 3), categorie: txt(a.category, 60),
    benefices: listeTextes(a.benefits, 12, 200), tags: listeTextes(a.tags, 30, 40), metaTitle: txt(a.meta_title, 60), metaDesc: txt(a.meta_description, 155),
    instructions: txt(a.instructions, 2000),
  };
}

/**
 * Réponse lisible par le modèle : ce qui a marché, ce qui a échoué et pourquoi, ce qui est
 * conservé, l'état réel du produit (brouillon ≠ en vente) et l'action suivante.
 */
function rendre(imp: Awaited<ReturnType<typeof traiter>>, mode: string): ResultatIA {
  const r = resume(imp);
  const s = imp.statut as Statut;
  const noms = (role: string, ok: boolean) => imp.fichiers.filter((f) => f.role === role && (f.statut === "stocke" || f.statut === "media") === ok).map((f) => f.nom);
  const gardes = [...noms("fichier", true), ...noms("visuel", true)];
  const manquants = imp.fichiers.filter((f) => f.statut === "echec");
  const produit = s === "published" ? "Le produit est EN VENTE ; la livraison du fichier après paiement est automatique."
    : imp.produitId ? `Produit ${imp.produitId} en BROUILLON (pas en vente).` : "Aucun produit créé pour l'instant.";
  const suite = s === "published" ? ""
    : s === "ready_for_review" ? (mode === "autopilot" ? "Produit complet : publier_import le met en vente." : "Produit complet : publier_import le met en vente après l'accord du marchand.")
    : s === "retrying" ? `Nouvelle tentative automatique prévue (${r.next_retry_at}) ; consulte etat_import.`
    : s === "failed" ? `Action suivante : ${manquants.some((f) => !f.sourceUrl)
      ? `renvoie le(s) fichier(s) en échec (${manquants.map((f) => f.nom).join(", ")}) avec le même import_key — en base64 ou url https — ou fais-les déposer (creer_lien_depot avec import_id ${imp.id}) ; un fichier refusé se remplace par un autre nom (ex. .zip), l'ancien est alors retiré.`
      : `donne une nouvelle url https valide avec le même import_key, ou fais déposer le fichier (creer_lien_depot avec import_id ${imp.id}).`}`
    : s === "received" ? `En attente du dépôt des fichiers. Le lien de dépôt ne sert qu'une fois et expire après 30 minutes : s'il a expiré ou servi, rappelle creer_lien_depot avec import_id ${imp.id} (même import, rien n'est perdu).`
    : imp.derniereErreur ?? "";
  const texte = [
    `Import ${imp.id} : ${LIBELLES[s]}.`,
    s === "failed" || s === "retrying" ? `Cause : ${imp.derniereErreur ?? "inconnue"}` : "",
    gardes.length && s !== "published" ? `Conservés : ${gardes.join(", ")}.` : "",
    produit, suite,
  ].filter(Boolean).join(" ");
  return { succes: s !== "failed", ...(s === "failed" && { code: "VALIDATION_FAILED" as const }), resultat: texte, donnees: r };
}

async function executer(nom: string, a: Record<string, any>, ctx: CtxOutil): Promise<ResultatIA> {
  const base = { tenantId: ctx.tenantId, source: "mcp" as const, fournisseur: ctx.client || "ia", creePar: ctx.connexionId, cle: txt(a.import_key, 120) ?? null };
  try {
    if (nom === "importer_creation") {
      const e: EntreeImport = { ...base, publierAuto: a.publish === true && ctx.mode === "autopilot", produit: meta(a), produitId: txt(a.product_id, 64), fichiers: sources(a.files, 5), visuels: sources(a.images, 8) };
      return rendre(await importer(e), ctx.mode);
    }
    if (nom === "ajouter_visuel_produit") {
      const e: EntreeImport = { ...base, publierAuto: false, produit: { principal: a.main === true }, produitId: txt(a.product_id, 64) ?? "", fichiers: [], visuels: sources([a.image], 1) };
      if (!e.produitId) return refus("INVALID_INPUT", "product_id est obligatoire.");
      return rendre(await importer(e), ctx.mode);
    }
    if (nom === "creer_lien_depot") {
      let importId = txt(a.import_id, 64);
      if (importId) {
        if (!(await prisma.importCreation.findFirst({ where: { id: importId, tenantId: ctx.tenantId }, select: { id: true } }))) return refus("NOT_FOUND", "Import introuvable dans cette boutique.");
      } else {
        // Même import_key qu'un import existant : on lui redonne un lien (jamais un second import).
        const m = meta(a), produitId = txt(a.product_id, 64);
        if (!produitId && (!m.nom || !(Number(m.prix) > 0))) return refus("INVALID_INPUT", "Donne au moins name et price (> 0), ou product_id d'un produit numérique existant.");
        importId = (await importer({ ...base, publierAuto: a.publish === true && ctx.mode === "autopilot", produit: m, produitId, fichiers: [], visuels: [], attendDepot: true })).id;
      }
      const cible = await prisma.importCreation.findUniqueOrThrow({ where: { id: importId }, select: { statut: true, produitId: true } });
      if (cible.statut === "published") return refus("CONFLICT", `Cet import est déjà publié. Pour ajouter des fichiers à son produit, appelle creer_lien_depot avec product_id ${cible.produitId}.`);
      const lien = await creerLienDepot(ctx.tenantId, importId, await origineAxso());
      return {
        succes: true, resultat: `Lien de dépôt : ${lien.url}\nDonne-le à l'utilisateur : il y dépose le fichier à vendre et les visuels ; Axso crée alors le produit. Suis l'avancement avec etat_import (import_id ${importId}).\nCe lien sert UNIQUEMENT au dépôt : une seule utilisation, expire dans 30 minutes (${lien.expireLe.toISOString()}, UTC). Ce n'est ni l'adresse du produit, ni celle du téléchargement de l'acheteur (créée après son paiement). Expiré ou déjà utilisé : rappelle creer_lien_depot avec import_id ${importId}, l'import et ses fichiers stockés sont conservés. Pages HTML refusées : un jeu HTML se dépose en .zip.`,
        donnees: { upload_url: lien.url, expires_at: lien.expireLe.toISOString(), import_id: importId },
      };
    }
    if (nom === "etat_import") {
      await reprendreEchus(ctx.tenantId);
      const id = txt(a.import_id, 64);
      if (!id) {
        const derniers = await prisma.importCreation.findMany({ where: { tenantId: ctx.tenantId }, include: { fichiers: true }, orderBy: { createdAt: "desc" }, take: 10 });
        return { succes: true, resultat: derniers.length ? derniers.map((i) => `• ${i.id} — ${(i.metadonnees as MetaProduit).nom ?? "ajout"} — ${LIBELLES[i.statut as Statut]}${i.derniereErreur ? ` (${i.derniereErreur})` : ""}`).join("\n") : "Aucun import.", donnees: { imports: derniers.map(resume) } };
      }
      const imp = await prisma.importCreation.findFirst({ where: { id, tenantId: ctx.tenantId }, include: { fichiers: true } });
      return imp ? { ...rendre(imp, ctx.mode), succes: true } : refus("NOT_FOUND", "Import introuvable dans cette boutique.");
    }
    if (nom === "publier_import") {
      const id = txt(a.import_id, 64) ?? "";
      if (!(await prisma.importCreation.findFirst({ where: { id, tenantId: ctx.tenantId }, select: { id: true } }))) return refus("NOT_FOUND", "Import introuvable dans cette boutique.");
      const manque = await publier(ctx.tenantId, id);
      if (manque.length) return refus("VALIDATION_FAILED", `Publication refusée, il manque : ${manque.join(", ")}.`);
      const imp = await prisma.importCreation.findUniqueOrThrow({ where: { id }, include: { fichiers: true } });
      return rendre(imp, ctx.mode);
    }
    return INCONNU;
  } catch (e) {
    if (e instanceof RefusImport) return refus("INVALID_INPUT", e.message);
    throw e;
  }
}

export const MODULE: ModuleIA = { id: "imports", nom: "imports de créations", outils: OUTILS, executer };
