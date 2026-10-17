// Réglages « Ma boutique → Livraison » (Tenant.parametresLivraison, JSON) : lecture unique, utilisable
// côté serveur et navigateur. Accepte les anciens formats : zones en simple liste de noms, et les clés
// locale / gratuiteA écrites par l'inscription IA (jamais lues par le calcul jusqu'ici).

export type ZoneLivraison = { nom: string; frais: number | null; delai: string }; // frais null = tarif standard
export type ReglagesLivraison = { gratuite: boolean; frais: number; minimum: number; delai: string; zones: ZoneLivraison[] };

/** « Bépanda » = « bepanda » = « BEPANDA  » : comparaison des noms de quartier. */
export const normaliserZone = (t?: string | null) =>
  (t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const montant = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : null);

export function lireReglagesLivraison(brut: unknown): ReglagesLivraison {
  const pl = (brut && typeof brut === "object" ? brut : {}) as Record<string, any>;
  const vues = new Set<string>();
  const zones = (Array.isArray(pl.zones) ? pl.zones : [])
    .map((z: any): ZoneLivraison => typeof z === "string"
      ? { nom: z.trim(), frais: null, delai: "" }
      : { nom: String(z?.nom ?? "").trim(), frais: montant(z?.frais), delai: String(z?.delai ?? "").trim() })
    .filter((z: ZoneLivraison) => {
      const cle = normaliserZone(z.nom);
      if (!cle || vues.has(cle)) return false;
      vues.add(cle);
      return true;
    });
  return {
    gratuite: !!pl.gratuite,
    frais: montant(pl.frais) ?? montant(pl.locale) ?? 0,
    minimum: montant(pl.minimum) ?? montant(pl.gratuiteA) ?? 0,
    delai: String(pl.delai ?? "").trim(),
    zones,
  };
}

export function trouverZone(zones: ZoneLivraison[], nom?: string | null) {
  const cle = normaliserZone(nom);
  return cle ? zones.find((z) => normaliserZone(z.nom) === cle) : undefined;
}

/** Commande.ville = « Akwa, Douala » (zone choisie, puis ville saisie) : la zone est la première partie. */
export const zoneDeVille = (ville?: string | null) => (ville ?? "").split(",")[0].trim();

/** Le livreur couvre-t-il la zone de la commande ? (Livreur.zone : une ou plusieurs zones séparées par des virgules) */
export function livreurCouvre(zoneLivreur: string | null | undefined, ville: string | null | undefined) {
  const cible = normaliserZone(zoneDeVille(ville));
  return !!cible && (zoneLivreur ?? "").split(",").some((z) => normaliserZone(z) === cible);
}

/** Commande.ville : la zone choisie, puis la ville saisie par le client si elle diffère (« Akwa, Douala »). */
export function villeCommande(zone?: string | null, ville?: string | null) {
  const z = (zone ?? "").trim(), v = (ville ?? "").trim();
  return !z ? v : !v || normaliserZone(v) === normaliserZone(z) ? z : `${z}, ${v}`;
}
