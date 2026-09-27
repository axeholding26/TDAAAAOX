// Devise d'affichage du VISITEUR de la vitrine (server-only) : choix manuel
// (cookie posé par le sélecteur de pays) > pays détecté (Vercel / Cloudflare) > devise de
// la boutique. Les prix restent enregistrés et encaissés dans la devise de la
// boutique — seul l'affichage est converti.
import { cookies, headers } from "next/headers";
import { PAYS_DEVISES, deviseAffichable } from "./devise-convert";

export const COOKIE_PAYS = "axso_pays";

export async function paysVisiteur(): Promise<string | null> {
  const choisi = (await cookies()).get(COOKIE_PAYS)?.value;
  if (choisi && PAYS_DEVISES[choisi]) return choisi;
  const h = await headers();
  const detecte = h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry"); // Vercel, ou Cloudflare devant un déploiement Docker
  return detecte && PAYS_DEVISES[detecte] ? detecte : null;
}

export async function deviseVisiteur(deviseBoutique: string): Promise<string> {
  const pays = await paysVisiteur();
  return deviseAffichable(pays ? PAYS_DEVISES[pays] : null, deviseBoutique);
}
