// Import de fichier depuis le navigateur, envoyé DIRECTEMENT à Vercel Blob
// (le serveur ne délivre qu'un jeton, voir /api/upload/client). Passer par
// /api/upload faisait transiter le fichier par la fonction serveur, limitée à
// 4,5 Mo par requête sur Vercel : vidéos et fichiers digitaux échouaient.
// Renvoie une Response au même format que l'ancien /api/upload ({ url, nom, taille… }).
import { upload } from "@vercel/blob/client";
import { categorieFichier, TAILLE_MAX } from "./types-fichiers";

const reponse = (corps: object, status: number) => new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json" } });

export async function televerser(fd: FormData): Promise<Response> {
  const file = fd.get("file") as File | null;
  if (!file) return reponse({ error: "Aucun fichier" }, 400);
  const categorie = categorieFichier(file.type);
  if (!categorie) return reponse({ error: `Type de fichier non supporté (${file.type || "inconnu"})` }, 400);
  if (file.size > TAILLE_MAX[categorie].octets) return reponse({ error: `Fichier trop volumineux (max ${TAILLE_MAX[categorie].libelle})` }, 400);
  try {
    const blob = await upload(`${categorie}s/${file.name}`, file, {
      access: "public", handleUploadUrl: "/api/upload/client", clientPayload: categorie,
      contentType: file.type || "application/octet-stream",
    });
    return reponse({ url: blob.url, filename: blob.pathname, categorie, nom: file.name, taille: file.size, type: file.type }, 200);
  } catch (e) {
    return reponse({ error: e instanceof Error ? e.message : "Envoi impossible" }, 500);
  }
}
