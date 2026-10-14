// Médiathèque d'AXSO CONTROL : tout média produit par une IA est rangé dans le dossier
// Vercel Blob de la boutique (comme les imports du marchand, donc visible dans « Fichiers »)
// et indexé dans MediaIA, pour être retrouvé, rattaché à un produit ou une campagne, réutilisé
// ou supprimé. Les modules n'écrivent jamais un média ailleurs que par enregistrerMedia().
import { put, del } from "@vercel/blob";
import type { MediaIA, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dossierBoutique } from "@/lib/fichiers-boutique";
import { Refus, cleSupprimable, dimensionsPng, indisponible, urlTelechargeable, type Usage } from "./creation/regles";

/** Ce qu'un moteur rend : des octets, ou l'adresse où il a déposé le fichier. */
export interface Rendu { donnees?: Buffer; mime?: string; url?: string }

const MAX = { image: 15 * 1024 * 1024, video: 60 * 1024 * 1024, audio: 15 * 1024 * 1024 };
const MIME_DEFAUT = { image: "image/png", video: "video/mp4", audio: "audio/wav" };

/**
 * Télécharge un fichier (photo du produit à retoucher, rendu d'un moteur) : https public
 * uniquement, taille bornée, type vérifié. `suivre` : redirections acceptées (réservé aux
 * adresses d'un moteur de confiance ; sinon une redirection pourrait viser le réseau interne).
 */
export async function telecharger(url: string, type: keyof typeof MAX, o: { entetes?: Record<string, string>; suivre?: boolean } = {}): Promise<{ donnees: Buffer; mime: string }> {
  const data = /^data:([^;,]+);base64,([\s\S]+)$/.exec(url);
  if (data) return { donnees: Buffer.from(data[2], "base64"), mime: data[1] };
  if (!urlTelechargeable(url)) throw new Refus("INVALID_INPUT", "Adresse de fichier refusée (https public uniquement).");
  const r = await fetch(url, { headers: o.entetes, redirect: o.suivre ? "follow" : "error", signal: AbortSignal.timeout(25_000) }).catch(() => null);
  if (!r?.ok) throw indisponible("Fichier source inaccessible.");
  const mime = (r.headers.get("content-type") ?? "").split(";")[0].trim() || MIME_DEFAUT[type];
  if (!mime.startsWith(`${type}/`) && mime !== "application/octet-stream") throw new Refus("INVALID_INPUT", `Le fichier source n'est pas de type ${type}.`);
  if (Number(r.headers.get("content-length") ?? 0) > MAX[type]) throw new Refus("INVALID_INPUT", "Fichier source trop volumineux.");
  const donnees = Buffer.from(await r.arrayBuffer());
  if (donnees.length > MAX[type]) throw new Refus("INVALID_INPUT", "Fichier source trop volumineux.");
  return { donnees, mime: mime === "application/octet-stream" ? MIME_DEFAUT[type] : mime };
}

export interface NouveauMedia {
  tenantId: string;
  type: "image" | "video" | "audio";
  /** Moteur qui l'a produit (gemini, higgsfield…). */
  fournisseur: string;
  rendu: Rendu;
  /** connexionId (IA externe) ou userId. */
  creePar: string;
  /** Consigne, outil, format, statut « proposition »… Jamais de secret. */
  metadonnees?: Record<string, unknown>;
  usage?: Partial<Usage>;
  duree?: number;
}

/**
 * Range le média dans le dossier de la boutique et l'indexe. Un rendu livré par adresse est
 * recopié chez nous quand c'est possible (les adresses des moteurs expirent) ; sinon l'adresse
 * du moteur est gardée telle quelle, sans clé de stockage.
 */
export async function enregistrerMedia(m: NouveauMedia): Promise<MediaIA> {
  const blob = !!process.env.BLOB_READ_WRITE_TOKEN;
  let { donnees, mime } = m.rendu;
  let url = m.rendu.url ?? "", cle: string | null = null;
  if (!donnees && url && (blob || url.startsWith("data:"))) {
    const copie = await telecharger(url, m.type).catch(() => null);
    if (copie) ({ donnees, mime } = copie);
  }
  if (donnees) {
    mime ||= MIME_DEFAUT[m.type];
    if (blob) {
      const ext = mime.split("/")[1]?.split(/[+;]/)[0] || "bin";
      const depot = await put(`${dossierBoutique(m.tenantId)}${m.type}s/ia-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`, donnees, { access: "public", contentType: mime });
      url = depot.url; cle = depot.pathname;
    } else if (m.type === "image") {
      // Sans stockage configuré (poste de développement) : même repli que lib/image-gen.ts.
      url = `data:${mime};base64,${donnees.toString("base64")}`;
    } else if (!url) throw indisponible("Le stockage de fichiers d'Axso n'est pas configuré : la vidéo ne peut pas être conservée.");
  }
  if (!url) throw indisponible("Le moteur n'a renvoyé aucun fichier.");
  const dim = donnees && m.type === "image" ? dimensionsPng(donnees) : null;
  return prisma.mediaIA.create({
    data: {
      tenantId: m.tenantId, type: m.type, fournisseur: m.fournisseur, url, cleStockage: cle, creePar: m.creePar, duree: m.duree,
      largeur: dim?.largeur, hauteur: dim?.hauteur,
      metadonnees: { ...m.metadonnees, ...(donnees && { octets: donnees.length, mime }) } as Prisma.InputJsonValue,
      usage: { produits: [], campagnes: [], pages: [], ...m.usage },
    },
  });
}

/** Supprime le fichier du stockage s'il est bien dans le dossier de la boutique ; `false` = fichier laissé en place. */
export async function supprimerFichier(media: Pick<MediaIA, "tenantId" | "url" | "cleStockage">): Promise<boolean> {
  if (!process.env.BLOB_READ_WRITE_TOKEN || !cleSupprimable(media.tenantId, media.cleStockage)) return false;
  // L'adresse doit désigner la clé vérifiée : on ne supprime jamais sur la foi de l'adresse seule.
  let chemin = "";
  try { chemin = decodeURIComponent(new URL(media.url).pathname.slice(1)); } catch {}
  if (chemin !== media.cleStockage) return false;
  await del(media.url);
  return true;
}
