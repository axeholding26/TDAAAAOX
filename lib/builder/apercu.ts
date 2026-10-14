// Aperçu du BROUILLON dans la vraie vitrine : un lien signé (1 h) pose un cookie qui fait
// rendre le brouillon au lieu de la version en ligne, pour ce navigateur seulement.
// Le public ne voit jamais un brouillon.
import { createHmac, timingSafeEqual } from "crypto";

export const COOKIE_APERCU = "axso_brouillon";
const DUREE = 3600;
const secret = () => process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
const signer = (corps: string) => createHmac("sha256", secret()).update(`apercu-brouillon:${corps}`).digest("base64url");

export function jetonApercu(tenantId: string, maintenant = Date.now()): string | null {
  if (!secret()) return null;
  const corps = `${tenantId}.${Math.floor(maintenant / 1000) + DUREE}`;
  return `${corps}.${signer(corps)}`;
}

/** Boutique du jeton s'il est signé par Axso et non expiré, sinon null. */
export function lireJetonApercu(jeton: string | null | undefined, maintenant = Date.now()): string | null {
  const [tenantId, exp, sig] = (jeton ?? "").split(".");
  if (!tenantId || !exp || !sig || !secret()) return null;
  const attendu = Buffer.from(signer(`${tenantId}.${exp}`)), recu = Buffer.from(sig);
  if (attendu.length !== recu.length || !timingSafeEqual(attendu, recu)) return null;
  return Number(exp) * 1000 > maintenant ? tenantId : null;
}

export const DUREE_APERCU = DUREE;
