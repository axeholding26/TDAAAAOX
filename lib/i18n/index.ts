// Traduction : la clé est le texte français lui-même (pas de dictionnaire fr à maintenir).
// Clé absente du dictionnaire → le français s'affiche tel quel.
export type Langue = "fr" | "en";
export type Dico = Record<string, string>;
export const ZONES = ["commun", "admin", "dashboard", "livreur", "boutique"] as const;
export type Zone = (typeof ZONES)[number];

export interface T {
  (texte: string, ...valeurs: unknown[]): string;
  <V>(valeur: V): V;
  langue: Langue;
  /** Locale pour toLocaleString / Intl. */
  loc: string;
}

export function creerT(langue: Langue, dico: Dico): T {
  const t = ((texte: unknown, ...valeurs: unknown[]) => {
    if (typeof texte !== "string") return texte;
    let r = texte;
    if (Object.hasOwn(dico, texte)) r = dico[texte];
    else {
      // Espaces en bord de chaîne (« Bonjour » + nom) : on traduit le cœur et on les garde.
      const coeur = texte.trim();
      if (coeur !== texte && Object.hasOwn(dico, coeur)) r = texte.replace(coeur, dico[coeur]);
    }
    return valeurs.length ? r.replace(/\{(\d+)\}/g, (m, i) => (i < valeurs.length ? String(valeurs[i] ?? "") : m)) : r;
  }) as T;
  t.langue = langue;
  t.loc = langue === "en" ? "en-US" : "fr-FR";
  return t;
}
