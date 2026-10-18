// Africa Intelligence : indicateurs par pays et opportunités de marché (module pur).
import { nomPays } from "./types";
import { Vue, valeur } from "./moteur";
import type { Fenetres } from "./contexte";

/** Population 2024 en millions — source : ONU, World Population Prospects 2024 (arrondis). */
export const POPULATION_M: Record<string, number> = {
  CM: 29, CI: 31, SN: 18, CD: 109, GA: 2.5, TG: 9, BJ: 14, BF: 23, ML: 23, CG: 6, NE: 27, TD: 19, GN: 14,
  NG: 230, GH: 34, MA: 38, KE: 56, RW: 14, CF: 5.3, GQ: 1.9, FR: 68,
};

/** Centroïdes approximatifs [lat, lng] pour la carte. */
export const CENTROIDE: Record<string, [number, number]> = {
  CM: [5.7, 12.4], CI: [7.6, -5.5], SN: [14.4, -14.5], CD: [-2.9, 23.7], GA: [-0.6, 11.6], TG: [8.6, 0.9], BJ: [9.6, 2.3],
  BF: [12.3, -1.7], ML: [17.4, -3.5], NE: [17.4, 9.4], CG: [-0.7, 15.2], TD: [15.3, 18.7], GN: [10.4, -10.9], NG: [9.6, 8.1],
  GH: [7.9, -1.0], MA: [31.8, -7.1], KE: [0.2, 37.9], RW: [-2.0, 29.9], CF: [6.6, 20.9], GQ: [1.6, 10.4], FR: [46.6, 2.4],
};

const EN = new Set(["CI", "CD", "GN", "CF", "GQ", "FR", "GW", "ER", "ET", "ZM", "TZ", "MR", "LY", "EG", "DZ", "TN", "UG", "AO", "SL", "GM", "ZA", "SO", "NA"]);
const AUX = new Set(["KM", "SC"]);
/** « au Cameroun », « en Côte d'Ivoire », « aux Comores ». */
export function dansPays(iso: string): string {
  const nom = nomPays(iso);
  if (AUX.has(iso)) return `aux ${nom}`;
  return `${EN.has(iso) || /^[AEIOUÉ]/.test(nom) ? "en" : "au"} ${nom}`;
}

export type Opportunite = "demande" | "penetration" | "croissance";
export const NOM_OPPORTUNITE: Record<Opportunite, string> = { demande: "Forte demande", penetration: "Faible pénétration", croissance: "Forte croissance" };

export interface LignePays {
  pays: string; nom: string; marchands: number; actifs: number; commandes: number; gmv: number; gmvPrec: number;
  croissance: number | null; revenu: number; conversion: number | null; churn: number | null; panier: number | null;
  population: number | null; parMillion: number | null; gmvParActif: number | null; opportunites: Opportunite[];
}

/** Médiane — null sous 3 valeurs : comparer un pays à lui-même ou à un seul autre n'a pas de sens. */
const mediane = (a: number[]) => { if (a.length < 3) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Une ligne par pays présent dans la vue, puis classement en opportunités (relatif à la médiane des pays). */
export function statsPays(v: Vue, f: Fenetres): LignePays[] {
  const groupes = new Map<string, Set<string>>();
  for (const m of v.marchands) { if (!groupes.has(m.pays)) groupes.set(m.pays, new Set()); groupes.get(m.pays)!.add(m.id); }
  const lignes: LignePays[] = [...groupes].map(([pays, ids]) => {
    const s = v.sous(`pays:${pays}`, () => ids);
    const gmv = valeur(s, "gmv", f.cur) ?? 0, gmvPrec = valeur(s, "gmv", f.prev) ?? 0;
    const actifs = s.actifs(f.cur).size;
    const population = POPULATION_M[pays] ?? null;
    return {
      pays, nom: nomPays(pays), marchands: ids.size, actifs, commandes: valeur(s, "commandes", f.cur) ?? 0, gmv, gmvPrec,
      croissance: gmvPrec > 0 ? (gmv - gmvPrec) / gmvPrec : null,
      revenu: valeur(s, "revenu", f.cur) ?? 0, conversion: valeur(s, "conversion_payante", f.cur), churn: valeur(s, "churn", f.cur), panier: valeur(s, "panier_moyen", f.cur),
      population, parMillion: population ? ids.size / population : null, gmvParActif: actifs ? gmv / actifs : null, opportunites: [],
    };
  });
  const medDemande = mediane(lignes.filter((l) => l.actifs >= 3 && l.gmvParActif != null).map((l) => l.gmvParActif!));
  const medPen = mediane(lignes.filter((l) => l.parMillion != null).map((l) => l.parMillion!));
  for (const l of lignes) {
    if (medDemande && l.actifs >= 3 && l.gmvParActif! >= 1.5 * medDemande) l.opportunites.push("demande");
    if (medPen && l.parMillion != null && l.population! >= 5 && l.parMillion <= 0.5 * medPen) l.opportunites.push("penetration");
    if (l.croissance != null && l.croissance >= 0.2 && l.gmvPrec >= 100_000) l.opportunites.push("croissance");
  }
  return lignes.sort((a, b) => b.gmv - a.gmv || b.marchands - a.marchands);
}
