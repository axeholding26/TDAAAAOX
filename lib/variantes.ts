// Variantes choisies sur la vitrine — module pur (client et serveur).
// Une valeur par groupe (« Taille », « Couleur »…), libellé de ligne de commande
// « Taille: M · Couleur: Rouge » ; une seule variante garde le format historique
// « Taille: M ». Chaque valeur a son propre stock (modèle Variante) : une ligne
// à plusieurs groupes sort une unité de chacune (lib/stock.ts).

export const SEP_VARIANTES = " · ";

type V = { nom: string; valeur: string };

export function libelleVariantes(choix: V[]): string {
  return choix.map((v) => `${v.nom}: ${v.valeur}`).join(SEP_VARIANTES);
}

/** « Taille: M · Couleur: Rouge » → [{Taille, M}, {Couleur, Rouge}] ; null si mal formé. */
export function lireVariantes(libelle: string): V[] | null {
  const parts = libelle.split(SEP_VARIANTES).map((p) => {
    const i = p.indexOf(": ");
    return i < 0 ? null : { nom: p.slice(0, i), valeur: p.slice(i + 2) };
  });
  return parts.every(Boolean) ? (parts as V[]) : null;
}

/** Groupes de variantes d'un produit, dans l'ordre où le marchand les a créés. */
export function groupesVariantes(variantes: V[]): string[] {
  return [...new Set(variantes.map((v) => v.nom))];
}

/**
 * Variantes d'une ligne, revérifiées contre celles du produit : une valeur par groupe.
 * `obligatoire` : chaque groupe doit avoir sa valeur (sinon le client choisit un « M »
 * sans couleur et la commande part incomplète).
 */
export function choisirVariantes<T extends V>(variantes: T[], libelle: string | null | undefined, obligatoire: boolean): { choix: T[] } | { erreur: string } {
  const groupes = groupesVariantes(variantes);
  const lues = libelle ? lireVariantes(libelle) : [];
  const choix = (lues ?? []).map((l) => variantes.find((v) => v.nom === l.nom && v.valeur === l.valeur));
  if (!lues || choix.some((c) => !c)) return { erreur: `Variante « ${libelle} » introuvable` };
  if (new Set(choix.map((c) => c!.nom)).size !== choix.length) return { erreur: "Une seule valeur par option" };
  const manquants = groupes.filter((g) => !choix.some((c) => c!.nom === g));
  if (obligatoire && manquants.length) return { erreur: `Choisissez : ${manquants.join(", ")}` };
  return { choix: (choix as T[]).sort((a, b) => groupes.indexOf(a.nom) - groupes.indexOf(b.nom)) };
}

/** Prix d'un article selon ses variantes : le plus élevé des prix fixés, sinon le prix de base. */
export function prixVariantes(choix: { prix: number | null }[], base: number): number {
  const prix = choix.map((v) => v.prix).filter((p): p is number => p != null);
  return prix.length ? Math.max(...prix) : base;
}
