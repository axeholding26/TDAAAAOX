// Chiffrement au repos des secrets (jetons des services reliés) : AES-256-GCM.
// Valeur stockée : "enc:v1:<iv>:<tag>:<données>" (base64url). Une valeur sans ce préfixe
// est un ancien jeton en clair : elle reste lisible et se chiffre à la prochaine écriture.
//
// Clé : AXSO_CLE_CHIFFREMENT si définie, sinon dérivée de AUTH_SECRET / NEXTAUTH_SECRET.
// Rotation : mettre l'ancienne valeur dans AXSO_CLE_CHIFFREMENT_ANCIENNE ; elle n'est
// essayée qu'au déchiffrement. Les clés dérivées de AUTH_SECRET / NEXTAUTH_SECRET sont
// elles aussi toujours essayées : définir AXSO_CLE_CHIFFREMENT plus tard ne casse rien.
//
// Sans aucune clé : rien ne plante au chargement ; `chiffrer` lève une erreur (on refuse
// d'enregistrer un secret en clair) et `dechiffrer` rend null pour une valeur chiffrée.
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const PREFIXE = "enc:v1:";
const cles = new Map<string, Buffer>();

// HKDF : la variable peut être n'importe quelle chaîne, la clé AES fait toujours 32 octets.
function cle(secret: string): Buffer {
  let k = cles.get(secret);
  if (!k) cles.set(secret, (k = Buffer.from(hkdfSync("sha256", secret, "", "axso-connect-v1", 32))));
  return k;
}

// Lu à chaque appel (et non au chargement) : l'absence de clé ne bloque pas le démarrage.
function secrets(): string[] {
  const e = process.env;
  return [e.AXSO_CLE_CHIFFREMENT, e.AXSO_CLE_CHIFFREMENT_ANCIENNE, e.AUTH_SECRET, e.NEXTAUTH_SECRET]
    .map((s) => s?.trim()).filter((s): s is string => !!s);
}

export const estChiffre = (valeur: unknown): boolean => typeof valeur === "string" && valeur.startsWith(PREFIXE);

/** Chiffre un texte. Une valeur déjà chiffrée est rendue telle quelle (pas de double chiffrement). */
export function chiffrer(texte: string): string {
  if (estChiffre(texte)) return texte;
  // AXSO_CLE_CHIFFREMENT_ANCIENNE ne sert jamais à chiffrer.
  const secret = [process.env.AXSO_CLE_CHIFFREMENT, process.env.AUTH_SECRET, process.env.NEXTAUTH_SECRET].map((s) => s?.trim()).find(Boolean);
  if (!secret) throw new Error("Chiffrement indisponible : définir AXSO_CLE_CHIFFREMENT (ou AUTH_SECRET).");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cle(secret), iv);
  const donnees = Buffer.concat([c.update(texte, "utf8"), c.final()]);
  return PREFIXE + [iv, c.getAuthTag(), donnees].map((b) => b.toString("base64url")).join(":");
}

/**
 * Déchiffre une valeur. En clair (héritée) : rendue telle quelle.
 * Illisible (clé changée, valeur altérée, aucune clé) : null, jamais d'exception.
 */
export function dechiffrer(valeur: string): string | null {
  if (!estChiffre(valeur)) return valeur;
  const [iv, tag, donnees] = valeur.slice(PREFIXE.length).split(":").map((p) => Buffer.from(p ?? "", "base64url"));
  if (iv?.length !== 12 || tag?.length !== 16 || !donnees) return null;
  for (const secret of secrets()) {
    try {
      const d = createDecipheriv("aes-256-gcm", cle(secret), iv);
      d.setAuthTag(tag);
      return Buffer.concat([d.update(donnees), d.final()]).toString("utf8");
    } catch { /* mauvaise clé ou valeur altérée : on essaie la suivante */ }
  }
  return null;
}
