// Adresse publique du site pour la requête en cours (domaine de boutique, sous-domaine
// ou localhost) — sert à fabriquer des liens absolus (QR codes) sans dépendre de
// NEXT_PUBLIC_APP_URL. Serveur uniquement.
import { headers } from "next/headers";
import { domainePrincipal, sousDomainePret } from "./domaines";
import { adresseBoutique } from "./utils";

export async function origineSite(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Adresse AXSO de référence : NEXT_PUBLIC_APP_URL quand elle est renseignée
 * (production), sinon l'adresse de la requête en cours (local, préversions).
 */
export async function origineAxso(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env && !env.includes("xxxx")) return env.replace(/\/$/, "");
  try { return await origineSite(); } catch { return "https://axsoafrica.com"; }
}

/**
 * Lien public d'une page de boutique : sur son domaine personnalisé s'il est actif
 * (https://maboutique.com/tracking/…), sinon sur son sous-domaine AXSO
 * (https://slug.axsoafrica.com/tracking/…) s'il est accepté par Vercel, à défaut en …/slug/tracking/….
 * `chemin` commence par « / » ou est vide.
 */
export async function lienBoutique(slug: string, chemin = ""): Promise<string> {
  const domaine = await domainePrincipal(slug);
  if (domaine) return `https://${domaine}${chemin}`;
  const sousDomaine = (await sousDomainePret(slug)) ? adresseBoutique(slug) : null;
  return sousDomaine ? `${sousDomaine}${chemin}` : `${await origineAxso()}/${slug}${chemin}`;
}
