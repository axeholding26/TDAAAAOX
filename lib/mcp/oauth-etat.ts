// Paramètre `state` des connexions OAuth (Gmail, Meta) : jeton aléatoire gardé
// dans un cookie httpOnly et comparé au retour. Avant, `state` valait l'id de la
// boutique : n'importe qui pouvait rattacher son propre compte Google/Meta à la
// boutique d'un autre (ou piéger un marchand pour récupérer ses jetons).
// La boutique est prise de la session au retour, jamais du paramètre.
import { cookies } from "next/headers";
import { randomBytes, timingSafeEqual } from "crypto";

const COOKIE = "axso_oauth_etat";

export function etatsEgaux(recu: string | null | undefined, attendu: string | null | undefined): boolean {
  if (!recu || !attendu || recu.length !== attendu.length) return false;
  return timingSafeEqual(Buffer.from(recu), Buffer.from(attendu));
}

export async function creerEtatOAuth(): Promise<string> {
  const etat = randomBytes(24).toString("hex");
  (await cookies()).set(COOKIE, etat, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/" });
  return etat;
}

/** Vrai si `state` correspond au cookie posé au départ ; le cookie est consommé. */
export async function verifierEtatOAuth(recu: string | null): Promise<boolean> {
  const jar = await cookies();
  const attendu = jar.get(COOKIE)?.value;
  jar.delete(COOKIE);
  return etatsEgaux(recu, attendu);
}
