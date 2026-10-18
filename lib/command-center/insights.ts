// Couche INSIGHT → DÉCISION : variations et leurs causes, scores santé, radars
// churn/expansion, alertes, priorités, brief, prévisions, objectifs.
// Règle : une phrase n'est produite que si les données la soutiennent (volumes
// minimaux, écarts significatifs) ; sinon « Données insuffisantes ».
import type { Marchand, PlanId, Fonction } from "./types";
import { NOM_PLAN, PRIX_PLAN, nomPays, FONCTIONS, NOM_FONCTION, SOURCES_ACQ } from "./types";
import { Vue, METRIQUE, mesurer, valeur, ventiler, tranche, sousVue, type Mesure } from "./moteur";
import { JOUR, type Fenetre, type Fenetres } from "./contexte";
import { formatValeur, formatVariation } from "./format";
import type { Reglages, Seuil, PoidsSante } from "./reglages";
import { NOM_ETAPE } from "./reglages";

export const INSUFFISANT = "Données insuffisantes pour déterminer la cause.";

// ─── Variations (« What changed? ») ─────────────────────────────────────────

export interface Variation {
  id: string; metrique: string; nom: string; mesure: Mesure;
  cause: string; causeEtablie: boolean; impact: string; action: string; lien: string;
}

const NOM_DIM = { pays: "pays", plan: "plan", source: "canal d'acquisition", industrie: "secteur" } as const;
const libelleSegment = (dim: keyof typeof NOM_DIM, k: string) => dim === "pays" ? nomPays(k) : dim === "plan" ? NOM_PLAN[k as PlanId] ?? k : dim === "source" ? SOURCES_ACQ[k] ?? k : k;

/** Segment qui explique le plus une variation additive (≥ 40 % du delta, même sens). */
export function attribuer(v: Vue, id: string, f: Fenetres): { texte: string; segments: { dim: string; cle: string; nom: string; delta: number }[] } | null {
  const total = (valeur(v, id, f.cur) ?? 0) - (valeur(v, id, f.prev) ?? 0);
  if (!total) return null;
  let meilleur: { dim: keyof typeof NOM_DIM; deltas: [string, number][]; part: number } | null = null;
  // Pas de dimension « plan » : le plan actuel d'un marchand rend l'attribution triviale (nouveaux = Essentiel, MRR = payants).
  for (const dim of ["pays", "source", "industrie"] as const) {
    if (dim === "source" && v.ds.manques.includes("acquisition")) continue;
    const a = ventiler(v, id, f.cur, dim), b = ventiler(v, id, f.prev, dim);
    if (a.size < 2) continue;
    const base = [...b.values()].reduce((s, x) => s + Math.abs(x), 0) || 1;
    // Un segment n'« explique » la variation que s'il y pèse nettement plus que dans la base
    // (sinon « la hausse vient du plan Essentiel » ne dit rien : c'est déjà la majorité).
    const deltas = [...new Set([...a.keys(), ...b.keys()])]
      .map((k) => { const d = (a.get(k) ?? 0) - (b.get(k) ?? 0); return { k, d, sur: (d / total) / Math.max(0.02, Math.abs(b.get(k) ?? 0) / base) }; })
      .filter((x) => Math.sign(x.d) === Math.sign(total) && x.sur >= 1.3).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
    const top = deltas.slice(0, 2).map((x) => [x.k, x.d] as [string, number]);
    const part = top.reduce((s, [, d]) => s + d, 0) / total;
    if (top.length && part >= 0.4 && (!meilleur || part > meilleur.part)) meilleur = { dim, deltas: top, part };
  }
  if (!meilleur) return null;
  const noms = meilleur.deltas.filter(([, d]) => Math.abs(d) / Math.abs(total) >= 0.15).map(([k]) => libelleSegment(meilleur!.dim, k));
  return {
    texte: `${Math.round(Math.min(1, meilleur.part) * 100)} % de la variation vient ${noms.length > 1 ? "des segments" : "du segment"} ${noms.join(" et ")} (${NOM_DIM[meilleur.dim]}).`,
    segments: meilleur.deltas.map(([k, d]) => ({ dim: meilleur!.dim, cle: k, nom: libelleSegment(meilleur!.dim, k), delta: d })),
  };
}

const ACTIONS: Record<string, [string, string]> = {
  // [si ça va mal, si ça va bien]
  mrr: ["Analyser les marchands perdus et lancer une campagne de rétention.", "Identifier les plans qui portent la hausse et les pousser."],
  revenu: ["Vérifier les échecs de paiement et le churn des abonnés.", "Renforcer les canaux qui génèrent ce revenu."],
  gmv: ["Contacter les gros marchands en baisse d'activité.", "Mettre en avant les marchands et marchés en croissance."],
  commandes: ["Vérifier les paiements et la livraison sur les marchés en baisse.", "Capitaliser : campagnes sur les marchés en hausse."],
  nouveaux_marchands: ["Revoir les campagnes d'acquisition et la landing page.", "Augmenter le budget des canaux performants."],
  activation: ["Étudier l'étape de l'onboarding où les marchands décrochent.", "Documenter ce qui a amélioré l'onboarding."],
  churn: ["Lancer une campagne de rétention sur les marchands à risque.", "—"],
  succes_paiement: ["Ouvrir un incident avec le prestataire de paiement.", "—"],
  echecs_paiement: ["Analyser les échecs par moyen de paiement et par pays.", "—"],
  north_star: ["Accompagner les marchands sans vente récente.", "Partager les bonnes pratiques des marchands qui vendent."],
  marchands_actifs: ["Relancer les marchands dormants.", "Transformer ces actifs en marchands payants."],
  requetes_ia: ["Promouvoir Axia auprès des marchands actifs.", "Surveiller le coût IA et proposer Axia en upsell."],
  adoption_ia: ["Promouvoir Axia auprès des marchands actifs.", "Mettre en avant les cas d'usage Axia qui marchent."],
  conversion_payante: ["Revoir l'offre Pro et ses déclencheurs d'upgrade.", "Proposer l'Illimité aux Pro les plus actifs."],
  livraison: ["Vérifier les livreurs et zones en échec.", "—"],
  panier_moyen: ["Proposer bundles et ventes additionnelles aux marchands.", "—"],
};

const VARIATIONS_SUIVIES = ["gmv", "revenu", "mrr", "commandes", "north_star", "nouveaux_marchands", "activation", "conversion_payante", "churn", "succes_paiement", "echecs_paiement", "requetes_ia", "adoption_ia", "panier_moyen", "livraison"];

export function variations(v: Vue, f: Fenetres, ids = VARIATIONS_SUIVIES): Variation[] {
  const out: Variation[] = [];
  for (const id of ids) {
    const m = METRIQUE[id];
    const mes = mesurer(v, id, f.cur, f.prev, 8);
    if (mes.variation == null || mes.valeur == null || mes.precedente == null) continue;
    const significatif = m.format === "pct" ? Math.abs(mes.variation) >= 0.02 : Math.abs(mes.variation) >= 0.05;
    const volume = m.format === "pct" || m.format === "xaf" ? true : Math.max(mes.valeur, mes.precedente) >= 10;
    if (!significatif || !volume) continue;
    let cause = INSUFFISANT, etablie = false;
    if (m.additive) { const a = attribuer(v, id, f); if (a) { cause = a.texte; etablie = true; } }
    else if (id === "activation") {
      const fa = entonnoir(v, f.cur), fb = entonnoir(v, f.prev);
      const pires = fa.etapes.map((e, i) => ({ nom: e.nom, d: e.tauxEtape - fb.etapes[i].tauxEtape })).slice(1).sort((x, y) => x.d - y.d);
      if (fa.etapes[0].nombre >= 20 && pires[0] && Math.abs(pires[0].d) >= 0.03) { cause = `Le passage à l'étape « ${pires[0].nom} » a le plus évolué (${formatVariation(pires[0].d, "pct")}).`; etablie = true; }
    } else if (id === "panier_moyen" || id === "succes_paiement") {
      // Mesures de taux : on cherche le pays qui pèse le plus dans l'écart.
      const parPays = [...new Set(v.marchands.map((x) => x.pays))].map((p) => {
        const restreint = sousVue(v, new Set(v.marchands.filter((x) => x.pays === p).map((x) => x.id)));
        return { p, a: valeur(restreint, id, f.cur), b: valeur(restreint, id, f.prev), n: restreint.payees(f.cur).length };
      }).filter((x) => x.a != null && x.b != null && x.n >= 20).map((x) => ({ ...x, d: x.a! - x.b! })).sort((x, y) => (y.d - x.d) * Math.sign(mes.variation!));
      if (parPays[0] && Math.sign(parPays[0].d) === Math.sign(mes.variation)) { cause = `Variation la plus forte : ${nomPays(parPays[0].p)} (${formatValeur(parPays[0].b, m.format)} → ${formatValeur(parPays[0].a, m.format)}).`; etablie = true; }
    }
    const bon = mes.variation * m.sens > 0;
    const delta = mes.valeur - mes.precedente;
    out.push({
      id: `var:${id}`, metrique: id, nom: m.nom, mesure: mes, cause, causeEtablie: etablie,
      impact: m.format === "pct" ? `${formatVariation(mes.variation, "pct")} (${formatValeur(mes.precedente, "pct")} → ${formatValeur(mes.valeur, "pct")})` : `${delta > 0 ? "+" : "−"}${formatValeur(Math.abs(delta), m.format)} sur la période`,
      action: (ACTIONS[id]?.[bon ? 1 : 0] ?? "Analyser le détail de la métrique.").replace("—", "Aucune action requise."),
      lien: m.page,
    });
  }
  // Les plus fortes variations d'abord, les mauvaises nouvelles devant à amplitude égale.
  return out.sort((a, b) => Math.abs(b.mesure.variation!) * (b.mesure.statut === "mauvais" ? 1.2 : 1) - Math.abs(a.mesure.variation!) * (a.mesure.statut === "mauvais" ? 1.2 : 1));
}

// ─── Entonnoir d'activation ─────────────────────────────────────────────────

/** Entonnoir des inscrits de la fenêtre ayant eu 14 jours pour avancer ; étape comptée si atteinte sous 14 jours. */
export function entonnoir(v: Vue, w: Fenetre) {
  const n = v.nouveauxMurs(w);
  const etapes = (["inscription", "boutique", "produit", "commande", "paiement"] as const).map((e) => ({
    id: e, nom: e === "inscription" ? "Compte créé" : NOM_ETAPE[e], nombre: e === "inscription" ? n.length : n.filter((m) => v.active(m, e)).length,
  }));
  return { etapes: etapes.map((e, i) => ({ ...e, taux: n.length ? e.nombre / n.length : 0, tauxEtape: i === 0 ? 1 : etapes[i - 1].nombre ? e.nombre / etapes[i - 1].nombre : 0 })) };
}

// ─── Statistiques par marchand & score santé ────────────────────────────────

export interface StatsMarchand {
  id: string; commandes30: number; commandesPrec30: number; gmv30: number; gmvPrec30: number; commission30: number;
  joursInactif: number; fonctions30: Set<Fonction>; ia30: number; iaAvant: number; echecs30: number; ticketsOuverts: number;
  mrr: number; mrrAvant: number;
}

export function statsMarchands(v: Vue): Map<string, StatsMarchand> {
  const t = v.maintenant;
  const cur = { debut: t - 30 * JOUR, fin: t + 1 }, prev = { debut: t - 60 * JOUR, fin: t - 30 * JOUR };
  const mrr = v.mrrParMarchand(t), mrrAvant = v.mrrParMarchand(t - 30 * JOUR);
  const s = new Map<string, StatsMarchand>(v.marchands.map((m) => [m.id, {
    id: m.id, commandes30: 0, commandesPrec30: 0, gmv30: 0, gmvPrec30: 0, commission30: 0,
    joursInactif: m.derniereActivite ? Math.max(0, Math.floor((t - m.derniereActivite) / JOUR)) : 999,
    fonctions30: new Set(), ia30: 0, iaAvant: 0, echecs30: 0, ticketsOuverts: 0, mrr: mrr.get(m.id) ?? 0, mrrAvant: mrrAvant.get(m.id) ?? 0,
  }]));
  for (const c of tranche(v.commandes, { debut: prev.debut, fin: cur.fin })) {
    const x = s.get(c.marchandId); if (!x) continue;
    const recent = c.date >= cur.debut;
    if (c.statut === "payee") { if (recent) { x.commandes30++; x.gmv30 += c.montant; x.commission30 += c.commission; } else { x.commandesPrec30++; x.gmvPrec30 += c.montant; } }
    if (recent && c.statut === "echouee") x.echecs30++;
  }
  for (const e of tranche(v.fonctions, cur)) s.get(e.marchandId)?.fonctions30.add(e.fonction);
  for (const e of tranche(v.ia, { debut: t - 120 * JOUR, fin: cur.fin })) { const x = s.get(e.marchandId); if (x) { if (e.date >= cur.debut) x.ia30 += e.nombre; else x.iaAvant += e.nombre; } }
  for (const k of v.ds.tickets) if (!k.resoluLe) { const x = s.get(k.marchandId); if (x) x.ticketsOuverts++; }
  return s;
}

export type StatutSante = "croissance" | "sain" | "risque" | "critique";
export const NOM_STATUT: Record<StatutSante, string> = { croissance: "En croissance", sain: "Sain", risque: "À risque", critique: "Critique" };

export interface Sante { score: number; statut: StatutSante; criteres: Record<keyof PoidsSante, number>; signaux: string[]; croissance: number | null }

const borne = (x: number) => Math.max(0, Math.min(1, x));

export function santeMarchand(m: Marchand, s: StatsMarchand, poids: PoidsSante): Sante {
  const croissance = s.commandesPrec30 >= 3 ? (s.commandes30 - s.commandesPrec30) / s.commandesPrec30 : null;
  const criteres = {
    activite: borne(1 - s.joursInactif / 30),
    commandes: borne(s.commandes30 / 20),
    gmv: borne(Math.log10(1 + s.gmv30) / Math.log10(1 + 2_000_000)),
    usage: borne(s.fonctions30.size / 5),
    ia: borne(s.ia30 / 10),
    paiements: s.mrrAvant > 0 && s.mrr === 0 ? 0 : borne(1 - s.echecs30 / 5),
    support: borne(1 - s.ticketsOuverts / 3),
    croissance: croissance == null ? 0.5 : borne(0.5 + croissance),
  };
  const total = Object.values(poids).reduce((a, b) => a + b, 0) || 1;
  const score = Math.round((Object.keys(criteres) as (keyof PoidsSante)[]).reduce((a, k) => a + criteres[k] * poids[k], 0) / total * 100);
  const signaux: string[] = [];
  if (s.joursInactif >= 7 && s.joursInactif < 999) signaux.push(`${s.joursInactif} jours sans activité`);
  if (croissance != null && croissance <= -0.3) signaux.push(`commandes ${formatVariation(croissance, "nombre")} sur 30 jours`);
  if (s.ia30 === 0 && s.iaAvant > 0) signaux.push("n'utilise plus Axia");
  else if (s.ia30 === 0) signaux.push("aucun usage d'Axia");
  if (s.echecs30 > 0) signaux.push(`${s.echecs30} paiement${s.echecs30 > 1 ? "s" : ""} échoué${s.echecs30 > 1 ? "s" : ""}`);
  if (s.mrrAvant > 0 && s.mrr === 0) signaux.push("abonnement non renouvelé");
  if (s.ticketsOuverts > 0) signaux.push(`${s.ticketsOuverts} ticket${s.ticketsOuverts > 1 ? "s" : ""} support ouvert${s.ticketsOuverts > 1 ? "s" : ""}`);
  const statut: StatutSante = score < 40 ? "critique" : score < 60 ? "risque" : croissance != null && croissance >= 0.2 && s.commandes30 >= 5 ? "croissance" : "sain";
  return { score, statut, criteres, signaux, croissance };
}

// ─── Radars ─────────────────────────────────────────────────────────────────

export interface RisqueChurn { marchand: Marchand; risque: number; raisons: string[]; revenuRisque: number; action: string; sante: Sante }

export function radarChurn(v: Vue, stats: Map<string, StatsMarchand>, poids: PoidsSante): RisqueChurn[] {
  const out: RisqueChurn[] = [];
  for (const m of v.marchands) {
    const s = stats.get(m.id)!;
    // Ne concerne que les marchands qui apportent (ou apportaient) de la valeur.
    if (!(s.mrr > 0 || s.mrrAvant > 0 || s.commandesPrec30 >= 3 || s.commandes30 >= 3)) continue;
    const sante = santeMarchand(m, s, poids);
    const risque = Math.round(Math.max(0, Math.min(0.98, (100 - sante.score) / 100 * 1.15 - 0.05)) * 100) / 100;
    if (risque < 0.5) continue;
    const action = s.mrrAvant > 0 && s.mrr === 0 ? "Relancer le renouvellement d'abonnement" : s.echecs30 > 0 ? "Vérifier les moyens de paiement du marchand" : s.joursInactif >= 14 ? "Lancer une campagne de rétention" : "Proposer un accompagnement (appel support)";
    out.push({ marchand: m, risque, raisons: sante.signaux, revenuRisque: Math.max(s.mrr, s.mrrAvant) + s.commission30, action, sante });
  }
  return out.sort((a, b) => b.risque * (1 + b.revenuRisque / 10000) - a.risque * (1 + a.revenuRisque / 10000));
}

export interface Expansion { marchand: Marchand; score: number; raison: string; planRecommande: PlanId | "entreprise"; revenuPotentiel: number }

export function radarExpansion(v: Vue, stats: Map<string, StatsMarchand>): Expansion[] {
  const out: Expansion[] = [];
  for (const m of v.marchands) {
    const s = stats.get(m.id)!;
    if (m.plan === "palier0" && (s.commandes30 >= 40 || s.gmv30 >= 500_000)) {
      out.push({ marchand: m, score: Math.round(Math.min(99, Math.max(s.commandes30 / 60, s.gmv30 / 1_500_000) * 100)), raison: s.commandes30 >= 40 ? `${s.commandes30} commandes en 30 jours (limite Essentiel : 60/mois)` : `${formatValeur(s.gmv30, "xaf")} de GMV en 30 jours sur le plan gratuit`, planRecommande: "palier1", revenuPotentiel: PRIX_PLAN.palier1 });
    } else if (m.plan === "palier1" && (s.gmv30 >= 3_000_000 || s.ia30 >= 40 || s.fonctions30.size >= 6)) {
      out.push({ marchand: m, score: Math.round(Math.min(99, Math.max(s.gmv30 / 6_000_000, s.ia30 / 80, s.fonctions30.size / 8) * 100)), raison: s.gmv30 >= 3_000_000 ? `${formatValeur(s.gmv30, "xaf")} de GMV en 30 jours` : s.ia30 >= 40 ? `${s.ia30} requêtes Axia en 30 jours` : `${s.fonctions30.size} fonctionnalités utilisées`, planRecommande: "palier2", revenuPotentiel: PRIX_PLAN.palier2 - PRIX_PLAN.palier1 });
    } else if (m.plan === "palier2" && s.gmv30 >= 20_000_000) {
      out.push({ marchand: m, score: 90, raison: `${formatValeur(s.gmv30, "xaf")} de GMV en 30 jours : profil grand compte`, planRecommande: "entreprise", revenuPotentiel: 0 });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

// ─── Adoption des fonctionnalités ───────────────────────────────────────────

export interface ImpactFonction {
  fonction: Fonction; nom: string; adoption: number; adopteurs: number; frequence: number; croissance: number | null;
  retentionAdopteurs: number | null; retentionAutres: number | null; gmvParAdopteur: number | null; gmvParAutre: number | null;
  etiquettes: string[];
}

export function impactFonctions(v: Vue, f: Fenetres): ImpactFonction[] {
  const actifsCur = v.actifs(f.cur), actifsPrev = v.actifs(f.prev);
  const gmv = new Map<string, number>();
  for (const c of v.payees(f.cur)) gmv.set(c.marchandId, (gmv.get(c.marchandId) ?? 0) + c.montant);
  const events = new Map<string, number>();
  for (const e of tranche(v.fonctions, f.cur)) events.set(e.fonction, (events.get(e.fonction) ?? 0) + 1);
  const semaines = Math.max(1, (f.cur.fin - f.cur.debut) / (7 * JOUR));
  const res = FONCTIONS.map((fn) => {
    const ad = fn === "axia" ? v.utilisateursIA(f.cur) : v.adopteurs(fn, f.cur);
    const adPrev = fn === "axia" ? v.utilisateursIA(f.prev) : v.adopteurs(fn, f.prev);
    // Rétention : parmi les actifs de la période précédente, part encore active, adopteurs vs non-adopteurs (corrélation, pas causalité).
    let ra = 0, na = 0, ro = 0, no = 0;
    for (const id of actifsPrev) { if (adPrev.has(id)) { na++; if (actifsCur.has(id)) ra++; } else { no++; if (actifsCur.has(id)) ro++; } }
    let ga = 0, go = 0, nga = 0, ngo = 0;
    for (const id of actifsCur) { if (ad.has(id)) { ga += gmv.get(id) ?? 0; nga++; } else { go += gmv.get(id) ?? 0; ngo++; } }
    return {
      fonction: fn, nom: NOM_FONCTION[fn], adoption: actifsCur.size ? ad.size / actifsCur.size : 0, adopteurs: ad.size,
      frequence: ad.size ? (events.get(fn) ?? 0) / ad.size / semaines : 0,
      croissance: adPrev.size >= 5 ? (ad.size - adPrev.size) / adPrev.size : null,
      retentionAdopteurs: na >= 20 ? ra / na : null, retentionAutres: no >= 20 ? ro / no : null,
      gmvParAdopteur: nga >= 20 ? ga / nga : null, gmvParAutre: ngo >= 20 ? go / ngo : null, etiquettes: [] as string[],
    };
  });
  const top = (cle: (x: ImpactFonction) => number | null, etiquette: string, inverse = false) => {
    const tri = res.filter((x) => cle(x) != null).sort((a, b) => (inverse ? -1 : 1) * (cle(b)! - cle(a)!));
    if (tri[0]) tri[0].etiquettes.push(etiquette);
  };
  top((x) => x.adoption, "Plus utilisée");
  top((x) => x.croissance, "Plus forte croissance");
  // « Sous-utilisée » seulement sous 20 % d'adoption (sinon on étiquetterait une adoption honorable).
  top((x) => (x.fonction === "commandes" || x.adoption >= 0.2 ? null : x.adoption), "Sous-utilisée", true);
  top((x) => (["pos", "axia", "livraison", "marketing"].includes(x.fonction) && x.gmvParAdopteur != null && x.gmvParAutre ? x.gmvParAdopteur / x.gmvParAutre : null), "Fort impact revenu");
  return res;
}

// ─── Score santé Axso ───────────────────────────────────────────────────────

export interface SousScore { id: string; nom: string; score: number | null; precedent: number | null; causes: string[]; recommandation: string; lien: string }

const echelle = (x: number | null, zero: number, cent: number) => (x == null ? null : Math.round(borne((x - zero) / (cent - zero)) * 100));

export function scoreAxso(v: Vue, f: Fenetres, stats: Map<string, StatsMarchand>, poids: PoidsSante): { global: number | null; precedent: number | null; sous: SousScore[] } {
  const calc = (w: Fenetre, prev: Fenetre) => {
    const val = (id: string, x = w) => valeur(v, id, x);
    const croissance = (id: string) => { const a = val(id), b = val(id, prev); return a == null || b == null || b === 0 ? null : (a - b) / b; };
    const churnMois = valeur(v, "churn", { debut: w.fin - 30 * JOUR, fin: w.fin });
    const nrr = val("nrr");
    const actifs = v.actifs(w);
    let somme = 0, n = 0;
    if (w.fin >= v.maintenant - JOUR) for (const m of v.marchands) if (actifs.has(m.id)) { somme += santeMarchand(m, stats.get(m.id)!, poids).score; n++; }
    const incidentsOuverts = v.ds.incidents.filter((i) => !i.resoluLe && i.gravite !== "mineur").length;
    const succes = val("succes_paiement");
    return {
      croissance: echelle(moyenne([croissance("north_star"), croissance("nouveaux_marchands")]), -0.2, 0.2),
      revenus: echelle(croissance("revenu"), -0.2, 0.2),
      retention: moyenne([echelle(churnMois, 0.1, 0), echelle(nrr, 0.85, 1.1)]),
      produit: echelle(val("activation"), 0, 0.7),
      infrastructure: succes == null ? null : Math.max(0, (echelle(succes, 0.9, 0.99) ?? 0) - incidentsOuverts * 10),
      succes: n >= 5 ? Math.round(somme / n) : null,
      ia: echelle(val("adoption_ia"), 0, 0.5),
      operations: echelle(val("livraison"), 0.8, 0.98),
    };
  };
  const a = calc(f.cur, f.prev);
  const b = calc(f.prev, { debut: f.prev.debut - (f.prev.fin - f.prev.debut), fin: f.prev.debut });
  const m = (id: string) => mesurer(v, id, f.cur, f.prev, 2);
  const cause = (id: string) => { const x = m(id); return x.valeur == null ? `${x.nom} : pas de données` : `${x.nom} : ${formatValeur(x.valeur, x.format)} (${formatVariation(x.variation, x.format)})`; };
  const sous: SousScore[] = [
    { id: "croissance", nom: "Croissance", causes: [cause("north_star"), cause("nouveaux_marchands")], recommandation: "Accélérer l'acquisition sur les canaux au meilleur LTV.", lien: "/admin/croissance" },
    { id: "revenus", nom: "Revenus", causes: [cause("revenu"), cause("mrr")], recommandation: "Pousser les upgrades détectés par l'Expansion Radar.", lien: "/admin/revenus" },
    { id: "retention", nom: "Rétention", causes: [cause("churn"), cause("nrr")], recommandation: "Traiter en priorité le Churn Radar.", lien: "/admin/succes-client" },
    { id: "produit", nom: "Produit", causes: [cause("activation")], recommandation: "Réduire les frictions de l'onboarding.", lien: "/admin/produit" },
    { id: "infrastructure", nom: "Infrastructure", causes: [cause("succes_paiement"), `${v.ds.incidents.filter((i) => !i.resoluLe).length} incident(s) ouvert(s)`], recommandation: "Suivre le taux de succès des paiements avec le prestataire.", lien: "/admin/paiements" },
    { id: "succes", nom: "Succès client", causes: ["Moyenne des scores santé des marchands actifs"], recommandation: "Appeler les marchands « À risque » à fort revenu.", lien: "/admin/succes-client" },
    { id: "ia", nom: "IA", causes: [cause("adoption_ia"), cause("requetes_ia")], recommandation: "Promouvoir Axia aux marchands qui ne l'utilisent pas.", lien: "/admin/ia" },
    { id: "operations", nom: "Opérations", causes: [cause("livraison"), cause("delai_livraison")], recommandation: "Analyser les échecs de livraison par zone.", lien: "/admin/operations" },
  ].map((s) => ({ ...s, score: a[s.id as keyof typeof a], precedent: b[s.id as keyof typeof b] }));
  return { global: moyenne(sous.map((s) => s.score)), precedent: moyenne(sous.map((s) => s.precedent)), sous };
}

function moyenne(xs: (number | null)[]): number | null {
  const ok = xs.filter((x): x is number => x != null);
  return ok.length ? Math.round(ok.reduce((a, b) => a + b, 0) / ok.length) : null;
}

// ─── Alertes ────────────────────────────────────────────────────────────────

export type CategorieAlerte = "critique" | "alerte" | "opportunite" | "insight";
export interface Alerte { id: string; categorie: CategorieAlerte; titre: string; detail: string; lien: string; metrique?: string; ids?: string[] }

export function evaluerSeuil(s: Seuil, mes: Mesure): boolean {
  if (!s.actif) return false;
  const x = s.condition.startsWith("variation") ? mes.variation : mes.valeur;
  if (x == null) return false;
  return s.condition.endsWith("_inf") ? x < s.valeur : x > s.valeur;
}

export function alertes(v: Vue, f: Fenetres, r: Reglages, churn: RisqueChurn[], expansion: Expansion[], fonctions: ImpactFonction[]): Alerte[] {
  const out: Alerte[] = [];
  for (const s of r.seuils) {
    if (!METRIQUE[s.metrique]) continue;
    const mes = mesurer(v, s.metrique, f.cur, f.prev, 2);
    if (!evaluerSeuil(s, mes)) continue;
    const quoi = s.condition.startsWith("variation") ? `${formatVariation(mes.variation, mes.format)} ${f.libelleComp}` : formatValeur(mes.valeur, mes.format);
    const seuil = s.condition.startsWith("variation") ? formatVariation(s.valeur, mes.format === "pct" ? "pct" : "nombre") : formatValeur(s.valeur, mes.format);
    out.push({ id: `seuil:${s.id}`, categorie: s.gravite, metrique: s.metrique, titre: `${mes.nom} : ${quoi}`, detail: `Seuil franchi (${s.condition.endsWith("_inf") ? "<" : ">"} ${seuil}).`, lien: METRIQUE[s.metrique].page });
  }
  const crit = churn.filter((c) => c.risque >= 0.7);
  if (crit.length) out.push({ id: "churn:eleve", categorie: "alerte", titre: `${crit.length} marchand${crit.length > 1 ? "s" : ""} à risque de churn élevé`, detail: `${formatValeur(crit.reduce((s, c) => s + c.revenuRisque, 0), "xaf")} de revenu mensuel en jeu.`, lien: "/admin/succes-client", ids: crit.map((c) => c.marchand.id) });
  const pro = expansion.filter((e) => e.planRecommande === "palier1");
  if (pro.length) out.push({ id: "exp:pro", categorie: "opportunite", titre: `${pro.length} marchand${pro.length > 1 ? "s" : ""} éligible${pro.length > 1 ? "s" : ""} au plan Pro`, detail: `Potentiel : +${formatValeur(pro.reduce((s, e) => s + e.revenuPotentiel, 0), "xaf")} de MRR.`, lien: "/admin/succes-client#expansion", ids: pro.map((e) => e.marchand.id) });
  const ill = expansion.filter((e) => e.planRecommande === "palier2");
  if (ill.length) out.push({ id: "exp:illimite", categorie: "opportunite", titre: `${ill.length} marchand${ill.length > 1 ? "s" : ""} Pro prêt${ill.length > 1 ? "s" : ""} pour l'Illimité`, detail: `Potentiel : +${formatValeur(ill.reduce((s, e) => s + e.revenuPotentiel, 0), "xaf")} de MRR.`, lien: "/admin/succes-client#expansion", ids: ill.map((e) => e.marchand.id) });
  for (const fn of fonctions) {
    // Seules les fonctionnalités optionnelles : constructeur, stock, commandes et paiements sont des prérequis de la vente (comparaison absurde).
    if (fn.gmvParAdopteur == null || !fn.gmvParAutre || !["pos", "axia", "livraison", "marketing"].includes(fn.fonction)) continue;
    const x = fn.gmvParAdopteur / fn.gmvParAutre;
    if (x >= 1.5) out.push({ id: `insight:${fn.fonction}`, categorie: "insight", titre: `Les marchands utilisant ${fn.nom} génèrent ${formatValeur(x, "ratio")} plus de GMV`, detail: `${fn.adopteurs} adopteurs comparés aux autres marchands actifs. Corrélation observée, pas une preuve de causalité.`, lien: "/admin/produit" });
  }
  const ordre: CategorieAlerte[] = ["critique", "alerte", "opportunite", "insight"];
  return out.filter((a) => !r.ignores.includes(a.id)).sort((a, b) => ordre.indexOf(a.categorie) - ordre.indexOf(b.categorie));
}

// ─── Priorités ──────────────────────────────────────────────────────────────

export interface Priorite { id: string; titre: string; pourquoi: string; impact: "Élevé" | "Moyen" | "Faible"; urgence: "Immédiate" | "Cette semaine" | "Ce mois"; confiance: "Élevée" | "Moyenne" | "Faible"; revenuRisque: number; revenuOpportunite: number; lien: string; ids?: string[]; score: number }

export function priorites(al: Alerte[], churn: RisqueChurn[], expansion: Expansion[], vars: Variation[]): Priorite[] {
  const out: Priorite[] = [];
  for (const a of al.filter((x) => x.categorie === "critique")) out.push({ id: a.id, titre: `Traiter : ${a.titre}`, pourquoi: a.detail, impact: "Élevé", urgence: "Immédiate", confiance: "Élevée", revenuRisque: 0, revenuOpportunite: 0, lien: a.lien, score: 100 });
  const risque = churn.filter((c) => c.risque >= 0.6);
  if (risque.length) { const r = risque.reduce((s, c) => s + c.revenuRisque, 0); out.push({ id: "prio:churn", titre: `Contacter ${risque.length} marchand${risque.length > 1 ? "s" : ""} à risque de churn`, pourquoi: "Signaux d'inactivité, de baisse de commandes ou d'échecs de paiement.", impact: r >= 50_000 ? "Élevé" : "Moyen", urgence: "Cette semaine", confiance: "Moyenne", revenuRisque: r, revenuOpportunite: 0, lien: "/admin/succes-client", ids: risque.map((c) => c.marchand.id), score: 60 + Math.min(30, r / 5000) }); }
  if (expansion.length) { const p = expansion.reduce((s, e) => s + e.revenuPotentiel, 0); out.push({ id: "prio:expansion", titre: `Proposer un upgrade à ${expansion.length} marchand${expansion.length > 1 ? "s" : ""}`, pourquoi: "Usage proche ou au-delà des limites de leur plan.", impact: p >= 50_000 ? "Élevé" : "Moyen", urgence: "Cette semaine", confiance: "Élevée", revenuRisque: 0, revenuOpportunite: p, lien: "/admin/succes-client#expansion", ids: expansion.map((e) => e.marchand.id), score: 55 + Math.min(30, p / 5000) }); }
  for (const a of al.filter((x) => x.categorie === "alerte" && !x.id.startsWith("churn"))) out.push({ id: a.id, titre: `Analyser : ${a.titre}`, pourquoi: a.detail, impact: "Moyen", urgence: "Cette semaine", confiance: "Élevée", revenuRisque: 0, revenuOpportunite: 0, lien: a.lien, score: 50 });
  for (const x of vars.filter((x) => x.mesure.statut === "mauvais").slice(0, 3)) {
    if (out.some((p) => p.lien === x.lien && p.id.startsWith("seuil"))) continue;
    out.push({ id: `prio:${x.id}`, titre: x.action, pourquoi: `${x.nom} ${formatVariation(x.mesure.variation, x.mesure.format)}. ${x.cause}`, impact: Math.abs(x.mesure.variation!) >= 0.15 ? "Élevé" : "Moyen", urgence: "Cette semaine", confiance: x.causeEtablie ? "Moyenne" : "Faible", revenuRisque: 0, revenuOpportunite: 0, lien: x.lien, score: 40 + Math.min(20, Math.abs(x.mesure.variation!) * 100) });
  }
  return out.sort((a, b) => b.score - a.score);
}

// ─── Brief exécutif ─────────────────────────────────────────────────────────

export function brief(v: Vue, f: Fenetres, vars: Variation[], churn: RisqueChurn[], expansion: Expansion[], prios: Priorite[]): { phrases: string[]; priorites: string[]; suffisant: boolean } {
  const phrases: string[] = [];
  const rev = mesurer(v, "revenu", f.cur, f.prev, 2), gmv = mesurer(v, "gmv", f.cur, f.prev, 2), ns = mesurer(v, "north_star", f.cur, f.prev, 2);
  if (!gmv.valeur && !rev.valeur && !ns.valeur) return { phrases: ["Pas encore assez d'activité sur cette période pour produire un résumé."], priorites: [], suffisant: false };
  const sens = (x: Mesure) => (x.variation == null ? "" : x.variation > 0.005 ? ` (en hausse de ${formatVariation(x.variation, x.format).replace("+", "")} ${f.libelleComp})` : x.variation < -0.005 ? ` (en baisse de ${formatVariation(x.variation, x.format).replace("−", "")} ${f.libelleComp})` : " (stable)");
  phrases.push(`Revenu Axso : ${formatValeur(rev.valeur, "xaf")}${sens(rev)}.`);
  const vg = vars.find((x) => x.metrique === "gmv");
  phrases.push(`GMV : ${formatValeur(gmv.valeur, "xaf")}${sens(gmv)}.${vg?.causeEtablie ? " " + vg.cause : ""}`);
  phrases.push(`${formatValeur(ns.valeur, "nombre")} marchands ont vendu sur la période${sens(ns)}.`);
  const act = vars.find((x) => x.metrique === "activation");
  if (act) phrases.push(`L'activation ${act.mesure.variation! > 0 ? "progresse" : "recule"} de ${formatVariation(Math.abs(act.mesure.variation!), "pct").replace("+", "")}. ${act.cause}`);
  const pay = vars.find((x) => x.metrique === "echecs_paiement" && x.mesure.statut === "mauvais");
  if (pay) phrases.push(`Les échecs de paiement augmentent de ${formatVariation(pay.mesure.variation, "nombre").replace("+", "")}. ${pay.cause}`);
  if (expansion.length) phrases.push(`${expansion.length} marchand${expansion.length > 1 ? "s présentent" : " présente"} un fort potentiel d'upgrade.`);
  const risque = churn.filter((c) => c.risque >= 0.7);
  if (risque.length) phrases.push(`${risque.length} marchand${risque.length > 1 ? "s sont" : " est"} à risque de churn élevé.`);
  return { phrases, priorites: prios.slice(0, 5).map((p) => p.titre), suffisant: true };
}

// ─── Prévisions ─────────────────────────────────────────────────────────────

export interface Prevision { id: string; nom: string; format: Mesure["format"]; historique: { t: number; v: number }[]; projection: { t: number; prudent: number; attendu: number; ambitieux: number }[] }

/** Tendance linéaire sur les 6 derniers mois (≥ 4 mois non nuls requis). PROJECTION, pas une donnée. */
export function prevision(v: Vue, id: string, mois = 6): Prevision | null {
  const m = METRIQUE[id];
  const t = v.maintenant;
  const historique = Array.from({ length: 12 }, (_, i) => {
    const fin = t - (11 - i) * 30 * JOUR;
    return { t: fin, v: valeur(v, id, { debut: fin - 30 * JOUR, fin }) ?? 0 };
  });
  const base = historique.slice(-6);
  if (base.filter((p) => p.v > 0).length < 4) return null;
  const n = base.length, xs = base.map((_, i) => i), mx = (n - 1) / 2, my = base.reduce((s, p) => s + p.v, 0) / n;
  const pente = xs.reduce((s, x, i) => s + (x - mx) * (base[i].v - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const derniere = base[n - 1].v;
  const projection = Array.from({ length: mois }, (_, k) => {
    const h = k + 1, attendu = Math.max(0, derniere + pente * h), ecart = Math.abs(pente) * h * 0.5 + derniere * 0.03 * h;
    return { t: t + h * 30 * JOUR, prudent: Math.max(0, attendu - ecart), attendu, ambitieux: attendu + ecart };
  });
  return { id, nom: m.nom, format: m.format, historique, projection };
}

// ─── Objectifs ──────────────────────────────────────────────────────────────

export function objectifs(v: Vue, r: Reglages) {
  const t = v.maintenant, w = { debut: t - 30 * JOUR, fin: t };
  return r.objectifs.map((o) => {
    const actuel = o.metrique === "pays" ? new Set(v.marchands.filter((m) => v.actifs(w).has(m.id)).map((m) => m.pays)).size : valeur(v, o.metrique, w);
    const def = METRIQUE[o.metrique];
    return { ...o, nom: o.metrique === "pays" ? "Pays actifs" : def?.nom ?? o.metrique, format: o.metrique === "pays" ? ("nombre" as const) : def?.format ?? "nombre", actuel, progression: actuel == null ? null : Math.min(1, actuel / o.cible), periode: def?.instant || o.metrique === "pays" ? "aujourd'hui" : "30 derniers jours" };
  });
}

// ─── Cohortes ───────────────────────────────────────────────────────────────

export const SEMAINES_COHORTE = [1, 2, 4, 8, 12];

/** Rétention par cohorte hebdomadaire d'inscription : part de la cohorte active pendant la semaine k. */
export function cohortes(v: Vue, nb = 16) {
  const t = v.maintenant, S = 7 * JOUR;
  const debutSemaine = (x: number) => Math.floor(x / S) * S;
  const actifsParSemaine = new Map<string, Set<number>>();
  const marque = (id: string, d: number) => { let s = actifsParSemaine.get(id); if (!s) actifsParSemaine.set(id, (s = new Set())); s.add(debutSemaine(d)); };
  for (const c of v.commandes) marque(c.marchandId, c.date);
  for (const e of v.fonctions) marque(e.marchandId, e.date);
  for (const e of v.ia) marque(e.marchandId, e.date);
  const toutes = Array.from({ length: nb }, (_, i) => debutSemaine(t) - (nb - i) * S);
  return toutes.map((c) => {
    const membres = v.marchands.filter((m) => debutSemaine(m.creeLe) === c);
    return {
      debut: c, taille: membres.length,
      retention: SEMAINES_COHORTE.map((k) => {
        const sem = c + k * S;
        if (sem + S > t) return null;
        return membres.length ? membres.filter((m) => actifsParSemaine.get(m.id)?.has(sem)).length / membres.length : null;
      }),
    };
  });
}
