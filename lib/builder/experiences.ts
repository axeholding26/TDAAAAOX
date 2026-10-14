// AXSO BUILDER — expériences A/B de la vitrine. A = version en ligne, B = une config partielle
// (sections, thème…) posée par-dessus. Chaque visiteur reçoit un « seau » aléatoire (cookie
// sans donnée personnelle : un nombre de 0 à 9999 et sa date de création) ; la variante se
// déduit du seau et de l'expérience, donc reste stable. Mesure : visiteurs nouveaux pendant
// l'expérience et leurs commandes (lignes Analytics), comparées par un z-test de proportions.
import { prisma } from "@/lib/prisma";

export const COOKIE_XP = "axso_xp";
export const OPTIONS_COOKIE_XP = { maxAge: 365 * 86_400, path: "/", sameSite: "lax" as const, httpOnly: true };
export const SEUILS = { visiteurs: 100, conversions: 5, alpha: 0.05 };

// ─── Répartition (pur) ───────────────────────────────────────────────────────
export const nouveauCookieXp = (maintenant = Date.now()) => `${Math.floor(Math.random() * 10_000)}.${Math.floor(maintenant / 1000).toString(36)}`;

/** Seau et date de création (s) d'un cookie de répartition, ou null s'il est illisible. */
export function lireCookieXp(v: string | null | undefined): { seau: number; cree: number } | null {
  const m = /^(\d{1,4})\.([0-9a-z]{1,8})$/.exec(v ?? "");
  return m ? { seau: Number(m[1]), cree: parseInt(m[2], 36) } : null;
}

// FNV-1a : même seau + même expérience → même variante, sur toutes les instances.
function hachage(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** Variante d'un seau : B pour `repartition` % des seaux, A sinon. */
export const varianteDe = (seau: number, experienceId: string, repartition: number): "A" | "B" =>
  hachage(`${experienceId}:${seau}`) % 100 < Math.max(0, Math.min(100, repartition)) ? "B" : "A";

// ─── Statistiques (pur) ──────────────────────────────────────────────────────
// Fonction d'erreur (Abramowitz-Stegun 7.1.26, erreur < 1,5e-7) : assez pour une p-valeur.
function erf(x: number) {
  const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a);
  return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a));
}

export interface Bras { visiteurs: number; conversions: number }
export interface Verdict {
  a: Bras & { taux: number }; b: Bras & { taux: number };
  ecart: number; ecartRelatif: number | null; z: number | null; p: number | null;
  assezDeDonnees: boolean; gagnant: "A" | "B" | null; conclusion: string;
}

/**
 * z-test bilatéral de deux proportions (variance groupée). Aucun gagnant sous les seuils
 * (visiteurs et conversions par variante) ni sans différence significative à 5 %.
 */
export function zTest(a: Bras, b: Bras, seuils = SEUILS): Verdict {
  const taux = (x: Bras) => (x.visiteurs > 0 ? x.conversions / x.visiteurs : 0);
  const ta = taux(a), tb = taux(b);
  const base = { a: { ...a, taux: ta }, b: { ...b, taux: tb }, ecart: tb - ta, ecartRelatif: ta > 0 ? (tb - ta) / ta : null };
  const assez = Math.min(a.visiteurs, b.visiteurs) >= seuils.visiteurs && Math.min(a.conversions, b.conversions) >= seuils.conversions;
  if (!assez) {
    return { ...base, z: null, p: null, assezDeDonnees: false, gagnant: null,
      conclusion: `Pas assez de données : il faut au moins ${seuils.visiteurs} visiteurs et ${seuils.conversions} commandes par variante (A : ${a.visiteurs}/${a.conversions}, B : ${b.visiteurs}/${b.conversions}).` };
  }
  const p = (a.conversions + b.conversions) / (a.visiteurs + b.visiteurs);
  const se = Math.sqrt(p * (1 - p) * (1 / a.visiteurs + 1 / b.visiteurs));
  const z = se > 0 ? (tb - ta) / se : 0;
  const pval = 2 * (1 - 0.5 * (1 + erf(Math.abs(z) / Math.SQRT2)));
  const gagnant = pval < seuils.alpha && z !== 0 ? (z > 0 ? "B" : "A") : null;
  return { ...base, z, p: pval, assezDeDonnees: true, gagnant,
    conclusion: gagnant ? `Variante ${gagnant} meilleure (p = ${pval.toFixed(3)} < ${seuils.alpha}).` : `Pas de différence significative (p = ${pval.toFixed(3)}) : aucune variante ne gagne.` };
}

// ─── Personnalisation (préparée, NON rendue) ─────────────────────────────────
export interface RegleCiblage { pays?: string[]; appareil?: "mobile" | "tablette" | "ordinateur"; campagne?: string; langue?: string[] }

/**
 * Règles de ciblage d'une variante (§51) : validées et stockées, mais la vitrine ne les
 * applique pas encore — tous les visiteurs sont répartis au hasard.
 */
export function validerRegles(brut: unknown): { regles: RegleCiblage[] } | { erreur: string } {
  if (brut === undefined || brut === null) return { regles: [] };
  if (!Array.isArray(brut) || brut.length > 10) return { erreur: "`regles` : liste de 10 règles au plus." };
  const regles: RegleCiblage[] = [];
  for (const r of brut) {
    if (!r || typeof r !== "object") return { erreur: "règle illisible." };
    const x: RegleCiblage = {};
    if (r.pays !== undefined) { if (!Array.isArray(r.pays) || !r.pays.every((p: unknown) => typeof p === "string" && /^[A-Z]{2}$/.test(p))) return { erreur: "`pays` : codes ISO à 2 lettres (CM, CI…)." }; x.pays = r.pays.slice(0, 50); }
    if (r.appareil !== undefined) { if (!["mobile", "tablette", "ordinateur"].includes(r.appareil)) return { erreur: "`appareil` : mobile, tablette ou ordinateur." }; x.appareil = r.appareil; }
    if (r.campagne !== undefined) { if (typeof r.campagne !== "string" || !/^[\w.-]{1,60}$/.test(r.campagne)) return { erreur: "`campagne` : valeur utm_campaign (lettres, chiffres, . _ -)." }; x.campagne = r.campagne; }
    if (r.langue !== undefined) { if (!Array.isArray(r.langue) || !r.langue.every((l: unknown) => typeof l === "string" && /^[a-z]{2}$/.test(l))) return { erreur: "`langue` : codes à 2 lettres (fr, en…)." }; x.langue = r.langue.slice(0, 10); }
    if (!Object.keys(x).length) return { erreur: "règle vide." };
    regles.push(x);
  }
  return { regles };
}

// ─── Base ────────────────────────────────────────────────────────────────────
export interface Variante { id: "A" | "B"; nom: string; config: Record<string, any>; regles?: RegleCiblage[] }

const enCours = (tenantId: string) =>
  prisma.experienceBoutique.findFirst({ where: { tenantId, statut: "en_cours" }, select: { id: true, tenantId: true, repartition: true, variantes: true, debut: true } });

/**
 * Config partielle à poser sur la version en ligne pour ce visiteur, ou null (pas d'expérience,
 * pas de cookie, variante A). Appelée par resolveConfigVitrine, jamais pendant un aperçu.
 */
export async function varianteVitrine(tenantId: string, cookie: string | undefined): Promise<Record<string, any> | null> {
  const c = lireCookieXp(cookie);
  if (!c) return null;
  const xp = await enCours(tenantId).catch(() => null);
  if (!xp || varianteDe(c.seau, xp.id, xp.repartition) !== "B") return null;
  return ((xp.variantes as unknown as Variante[]).find((v) => v.id === "B")?.config) ?? null;
}

/**
 * Nouveau visiteur d'une vitrine (à appeler par proxy.ts quand le cookie est absent) :
 * rend la valeur du cookie à poser et, si une expérience tourne, le compte dans sa variante.
 */
export async function cookieVisiteurXp(slug: string, existant: string | undefined): Promise<string | null> {
  if (lireCookieXp(existant)) return null;
  const valeur = nouveauCookieXp();
  const t = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } }).catch(() => null);
  const xp = t ? await enCours(t.id).catch(() => null) : null;
  if (xp) {
    const v = varianteDe(lireCookieXp(valeur)!.seau, xp.id, xp.repartition);
    await prisma.analytics.create({ data: { tenantId: xp.tenantId, type: "xp_visiteur", metadata: { xp: xp.id, v } } }).catch(() => {});
  }
  return valeur;
}

/**
 * Commande passée sur la vitrine : attribuée à la variante du visiteur, seulement s'il est
 * arrivé pendant l'expérience (même population que les visiteurs comptés).
 */
export async function noterConversion(tenantId: string, cookie: string | undefined): Promise<void> {
  const c = lireCookieXp(cookie);
  if (!c) return;
  const xp = await enCours(tenantId).catch(() => null);
  if (!xp?.debut || c.cree * 1000 < xp.debut.getTime() - 1000) return;
  await prisma.analytics.create({ data: { tenantId, type: "xp_conversion", metadata: { xp: xp.id, v: varianteDe(c.seau, xp.id, xp.repartition) } } }).catch(() => {});
}

/** Comptes par variante depuis le début de l'expérience. */
export async function mesurer(tenantId: string, experienceId: string): Promise<{ A: Bras; B: Bras }> {
  const compter = (type: string, v: string) => prisma.analytics.count({ where: { tenantId, type, AND: [{ metadata: { path: ["xp"], equals: experienceId } }, { metadata: { path: ["v"], equals: v } }] } });
  const [va, ca, vb, cb] = await Promise.all([compter("xp_visiteur", "A"), compter("xp_conversion", "A"), compter("xp_visiteur", "B"), compter("xp_conversion", "B")]);
  return { A: { visiteurs: va, conversions: ca }, B: { visiteurs: vb, conversions: cb } };
}
