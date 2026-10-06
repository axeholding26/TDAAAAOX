// Types et tailles de fichiers acceptés à l'import (source unique : navigateur et serveur).
// "document" : PDF, tableurs… importés dans Fichiers (comme Shopify) ; "digital" : fichiers livrés avec un produit digital.
export type CategorieFichier = "image" | "video" | "digital" | "document";

export const TYPES_FICHIERS: Record<CategorieFichier, string[]> = {
  document: [], // rempli juste après : mêmes types que "digital", sans le binaire générique
  image: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"],
  video: ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"],
  digital: [
    "application/pdf", "application/zip", "application/x-zip-compressed", "application/octet-stream",
    "audio/mpeg", "audio/wav", "audio/ogg",
    "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain", "text/csv", "text/markdown", "text/html",
  ],
};

TYPES_FICHIERS.document = TYPES_FICHIERS.digital.filter((t) => t !== "application/octet-stream");

export const TAILLE_MAX: Record<CategorieFichier, { octets: number; libelle: string }> = {
  document: { octets: 20 * 1024 * 1024, libelle: "20 Mo" }, // limite des fichiers génériques de Shopify
  image: { octets: 5 * 1024 * 1024, libelle: "5 Mo" },
  video: { octets: 100 * 1024 * 1024, libelle: "100 Mo" },
  digital: { octets: 200 * 1024 * 1024, libelle: "200 Mo" },
};

export function categorieFichier(type: string): CategorieFichier | null {
  if (TYPES_FICHIERS.image.includes(type)) return "image";
  if (TYPES_FICHIERS.video.includes(type)) return "video";
  if (TYPES_FICHIERS.digital.includes(type) || type.startsWith("text/") || type === "") return "digital";
  return null;
}
