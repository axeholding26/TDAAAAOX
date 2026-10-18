// Moteur de métriques : toutes les métriques sont DÉFINIES ici (nom, formule,
// unité, sens) et calculées sur n'importe quelle fenêtre et n'importe quel segment
// à partir du jeu de données normalisé. Aucune page ne recalcule une métrique à sa façon.
import type { Dataset, Marchand, Commande, PaiementAbonnement, EvtIA, EvtFonction, Fonction, PlanId } from "./types";
import { JOUR, type Fenetre, type Filtres } from "./contexte";

export type EtapeActivation = keyof Marchand["etapes"];
export const DELAI_ACTIVATION = 14 * JOUR;

/** Tranche [debut, fin[ d'un tableau trié par date (recherche dichotomique). */
export function tranche<T extends { date: number }>(a: T[], w: Fenetre): T[] {
  const bas = (x: number) => { let l = 0, h = a.length; while (l < h) { const m = (l + h) >> 1; if (a[m].date < x) l = m + 1; else h = m; } return l; };
  return a.slice(bas(w.debut), bas(w.fin));
}

const enLigne = (c: Commande) => c.canal === "en_ligne" && !c.methode.includes("cod");

/** Vue filtrée du jeu de données (segments appliqués aux marchands, puis à tous leurs événements). */
export class Vue {
  readonly ds: Dataset;
  readonly maintenant: number;
  readonly marchands: Marchand[];
  readonly parId: Map<string, Marchand>;
  readonly commandes: Commande[];
  readonly abonnements: PaiementAbonnement[];
  readonly ia: EvtIA[];
  readonly fonctions: EvtFonction[];
  /** GMV des 90 derniers jours par marchand (sert au segment « taille »). */
  readonly gmv90: Map<string, number>;
  /** Étape qui définit un marchand « activé » (réglable dans /admin/reglages). */
  etapeActivation: EtapeActivation = "commande";
  private memo = new Map<string, number | null>();

  constructor(ds: Dataset, f: Partial<Filtres> = {}, restreindre?: Set<string>, gmv90?: Map<string, number>) {
    this.ds = ds;
    this.maintenant = ds.genereA;
    if (!gmv90) {
      gmv90 = new Map<string, number>();
      for (const c of tranche(ds.commandes, { debut: this.maintenant - 90 * JOUR, fin: this.maintenant + 1 })) if (c.statut === "payee") gmv90.set(c.marchandId, (gmv90.get(c.marchandId) ?? 0) + c.montant);
    }
    this.gmv90 = gmv90;
    const taille = (id: string) => { const g = gmv90.get(id) ?? 0; return g >= 2_000_000 ? "grand" : g >= 200_000 ? "moyen" : "petit"; };
    const actif14 = (m: Marchand) => (m.derniereActivite ?? 0) >= this.maintenant - 14 * JOUR;
    this.marchands = ds.marchands.filter((m) => (!restreindre || restreindre.has(m.id)) &&
      (!f.pays || m.pays === f.pays) && (!f.plan || m.plan === f.plan) && (!f.taille || taille(m.id) === f.taille) &&
      (!f.industrie || m.industrie === f.industrie) && (!f.acq || m.source === f.acq) &&
      (!f.anciennete || (f.anciennete === "nouveau") === (m.creeLe >= this.maintenant - 30 * JOUR)) &&
      (!f.activite || (f.activite === "actif") === actif14(m)));
    this.parId = new Map(this.marchands.map((m) => [m.id, m]));
    const tous = this.marchands.length === ds.marchands.length;
    const garde = <T extends { marchandId: string }>(a: T[]) => (tous ? a : a.filter((e) => this.parId.has(e.marchandId)));
    this.commandes = garde(ds.commandes);
    this.abonnements = garde(ds.abonnements);
    this.ia = garde(ds.ia);
    this.fonctions = garde(ds.fonctions);
  }

  private sousVues = new Map<string, Vue>();
  /** Sous-vue restreinte à des marchands, mémorisée par clé (ex. "pays:CM"). */
  sous(cle: string, ids: () => Set<string>): Vue {
    let s = this.sousVues.get(cle);
    if (!s) { s = new Vue(this.ds, {}, ids(), this.gmv90); s.etapeActivation = this.etapeActivation; this.sousVues.set(cle, s); }
    return s;
  }

  cache(cle: string, calcul: () => number | null) {
    if (!this.memo.has(cle)) this.memo.set(cle, calcul());
    return this.memo.get(cle)!;
  }

  /** MRR par marchand à l'instant t : dernier paiement d'abonnement couvrant t (chaque paiement couvre 30 jours). */
  mrrParMarchand(t: number): Map<string, number> {
    const m = new Map<string, number>();
    for (const p of tranche(this.abonnements, { debut: t - 30 * JOUR, fin: t + 1 })) m.set(p.marchandId, p.montant);
    return m;
  }
  mrr(t: number) { let s = 0; for (const v of this.mrrParMarchand(t).values()) s += v; return s; }

  /** Marchands ayant au moins une activité (commande, usage produit, IA) dans la fenêtre. */
  actifs(w: Fenetre): Set<string> {
    const s = new Set<string>();
    for (const c of tranche(this.commandes, w)) s.add(c.marchandId);
    for (const e of tranche(this.fonctions, w)) s.add(e.marchandId);
    for (const e of tranche(this.ia, w)) s.add(e.marchandId);
    return s;
  }
  commandesW(w: Fenetre) { return tranche(this.commandes, w); }
  payees(w: Fenetre) { return tranche(this.commandes, w).filter((c) => c.statut === "payee"); }
  /** Activé = étape atteinte dans les 14 jours suivant l'inscription. */
  active(m: Marchand, etape: EtapeActivation = this.etapeActivation) { const d = m.etapes[etape]; return d != null && d - m.creeLe <= DELAI_ACTIVATION; }
  /** Inscrits de la fenêtre ayant eu 14 jours pour s'activer (sinon on comparerait des marchands qui n'ont pas eu le temps). */
  nouveauxMurs(w: Fenetre) { return this.nouveaux(w).filter((m) => m.creeLe <= this.maintenant - DELAI_ACTIVATION); }
  nouveaux(w: Fenetre) { return this.marchands.filter((m) => m.creeLe >= w.debut && m.creeLe < w.fin); }
  revenuAbonnements(w: Fenetre) { return tranche(this.abonnements, w).reduce((s, p) => s + p.montant, 0); }
  revenuCommissions(w: Fenetre) { return tranche(this.commandes, w).reduce((s, c) => s + (c.statut === "payee" ? c.commission : 0), 0); }
  depenses(w: Fenetre) { return tranche(this.ds.depenses, w).reduce((s, d) => s + d.montant, 0); }
  /** Les dépenses marketing ne sont pas rattachées à un marchand : elles n'ont de sens que sans segment. */
  filtreActif() { return this.marchands.length !== this.ds.marchands.length; }

  /** Évolution du MRR entre deux instants, ventilée par marchand (waterfall). */
  mouvementsMrr(w: Fenetre) {
    const a = this.mrrParMarchand(w.debut), b = this.mrrParMarchand(w.fin);
    const r = { debut: 0, nouveau: 0, expansion: 0, contraction: 0, churn: 0, fin: 0, parMarchand: [] as { id: string; avant: number; apres: number }[] };
    for (const v of a.values()) r.debut += v;
    for (const v of b.values()) r.fin += v;
    for (const id of new Set([...a.keys(), ...b.keys()])) {
      const x = a.get(id) ?? 0, y = b.get(id) ?? 0;
      if (x === y) continue;
      if (!x) r.nouveau += y; else if (!y) r.churn += x; else if (y > x) r.expansion += y - x; else r.contraction += x - y;
      r.parMarchand.push({ id, avant: x, apres: y });
    }
    return r;
  }

  adopteurs(f: Fonction, w: Fenetre) { const s = new Set<string>(); for (const e of tranche(this.fonctions, w)) if (e.fonction === f) s.add(e.marchandId); return s; }
  utilisateursIA(w: Fenetre) { return new Set(tranche(this.ia, w).map((e) => e.marchandId)); }
}

export type Format = "xaf" | "nombre" | "pct" | "heures" | "ratio";

export interface DefMetrique {
  id: string;
  nom: string;
  description: string;
  formule: string;
  format: Format;
  /** 1 : plus haut = mieux ; -1 : plus bas = mieux. */
  sens: 1 | -1;
  /** Métrique de stock (valeur à un instant, ex. MRR) plutôt que de flux sur la période. */
  instant?: boolean;
  /** Somme décomposable par segment (sert à attribuer une variation à un pays, un plan…). */
  additive?: boolean;
  /** Domaine de données requis (absent de certaines sources). */
  requiert?: string;
  page: string; // drill-down
  calc: (v: Vue, w: Fenetre) => number | null;
}

const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
const mensualise = (x: number, w: Fenetre) => (x * 30 * JOUR) / Math.max(JOUR, w.fin - w.debut);
const payantsA = (v: Vue, t: number) => new Set(v.mrrParMarchand(t).keys());

export const METRIQUES: DefMetrique[] = [
  { id: "mrr", nom: "MRR", description: "Revenu mensuel récurrent des abonnements actifs", formule: "Σ prix mensuel des abonnements payés couvrant la date de fin", format: "xaf", sens: 1, instant: true, additive: true, page: "/admin/revenus", calc: (v, w) => v.mrr(w.fin) },
  { id: "arr", nom: "ARR", description: "Revenu annuel récurrent", formule: "MRR × 12", format: "xaf", sens: 1, instant: true, additive: true, page: "/admin/revenus", calc: (v, w) => v.mrr(w.fin) * 12 },
  { id: "revenu", nom: "Revenu", description: "Revenu Axso encaissé : abonnements + commissions sur paiements en ligne", formule: "Σ paiements d'abonnement + Σ commissions capturées", format: "xaf", sens: 1, additive: true, page: "/admin/revenus", calc: (v, w) => v.revenuAbonnements(w) + v.revenuCommissions(w) },
  { id: "revenu_commissions", nom: "Commissions", description: "Commissions Axso sur les ventes payées en ligne", formule: "Σ commissions des commandes payées", format: "xaf", sens: 1, additive: true, page: "/admin/revenus", calc: (v, w) => v.revenuCommissions(w) },
  { id: "revenu_abonnements", nom: "Revenu abonnements", description: "Paiements d'abonnement reçus", formule: "Σ paiements d'abonnement", format: "xaf", sens: 1, additive: true, page: "/admin/revenus", calc: (v, w) => v.revenuAbonnements(w) },
  { id: "gmv", nom: "GMV", description: "Volume d'affaires des marchands (commandes payées)", formule: "Σ montant des commandes payées", format: "xaf", sens: 1, additive: true, page: "/admin/commerce", calc: (v, w) => v.payees(w).reduce((s, c) => s + c.montant, 0) },
  { id: "commandes", nom: "Commandes", description: "Commandes payées", formule: "Nombre de commandes au statut payé", format: "nombre", sens: 1, additive: true, page: "/admin/commerce", calc: (v, w) => v.payees(w).length },
  { id: "panier_moyen", nom: "Panier moyen", description: "Montant moyen d'une commande payée (AOV)", formule: "GMV ÷ commandes payées", format: "xaf", sens: 1, page: "/admin/commerce", calc: (v, w) => { const p = v.payees(w); return ratio(p.reduce((s, c) => s + c.montant, 0), p.length); } },
  { id: "marchands_actifs", nom: "Marchands actifs", description: "Marchands avec au moins une activité (commande, usage, IA)", formule: "Marchands distincts actifs sur la période", format: "nombre", sens: 1, additive: true, page: "/admin/marchands", calc: (v, w) => v.actifs(w).size },
  { id: "north_star", nom: "Marchands actifs générant du GMV", description: "North Star : marchands ayant encaissé au moins une commande payée", formule: "Marchands distincts avec ≥ 1 commande payée", format: "nombre", sens: 1, additive: true, page: "/admin/marchands", calc: (v, w) => new Set(v.payees(w).map((c) => c.marchandId)).size },
  { id: "nouveaux_marchands", nom: "Nouveaux marchands", description: "Inscriptions de marchands", formule: "Comptes marchands créés sur la période", format: "nombre", sens: 1, additive: true, page: "/admin/croissance", calc: (v, w) => v.nouveaux(w).length },
  { id: "arpu", nom: "ARPU", description: "Revenu mensuel moyen par marchand actif", formule: "Revenu mensualisé ÷ marchands actifs", format: "xaf", sens: 1, page: "/admin/revenus", calc: (v, w) => ratio(mensualise(v.revenuAbonnements(w) + v.revenuCommissions(w), w), v.actifs(w).size) },
  { id: "churn", nom: "Churn", description: "Part des marchands payants en début de période qui ne paient plus en fin de période", formule: "Payants perdus ÷ payants au début", format: "pct", sens: -1, page: "/admin/croissance#retention", calc: (v, w) => { const a = payantsA(v, w.debut), b = payantsA(v, w.fin); if (a.size < 1) return null; let perdus = 0; for (const id of a) if (!b.has(id)) perdus++; return perdus / a.size; } },
  { id: "ltv", nom: "LTV", description: "Valeur vie estimée d'un marchand", formule: "ARPU mensuel ÷ churn mensuel (churn plancher 2 %)", format: "xaf", sens: 1, page: "/admin/revenus", calc: (v, w) => { const arpu = METRIQUE.arpu.calc(v, w); const mois = { debut: w.fin - 30 * JOUR, fin: w.fin }; const ch = METRIQUE.churn.calc(v, mois); return arpu == null || ch == null ? null : arpu / Math.max(0.02, ch); } },
  { id: "cac", nom: "CAC", description: "Coût d'acquisition d'un marchand", formule: "Dépenses marketing ÷ nouveaux marchands", format: "xaf", sens: -1, requiert: "marketing", page: "/admin/marketing", calc: (v, w) => (v.filtreActif() || !v.ds.depenses.length ? null : ratio(v.depenses(w), v.nouveaux(w).length)) },
  { id: "nrr", nom: "Net Revenue Retention", description: "MRR conservé des marchands déjà payants (expansion − contraction − churn)", formule: "(MRR début + expansion − contraction − churn) ÷ MRR début", format: "pct", sens: 1, page: "/admin/revenus", calc: (v, w) => { const m = v.mouvementsMrr(w); return m.debut > 0 ? (m.debut + m.expansion - m.contraction - m.churn) / m.debut : null; } },
  { id: "activation", nom: "Taux d'activation", description: "Inscrits ayant atteint l'étape d'activation (par défaut : première commande) dans les 14 jours", formule: "Inscrits activés sous 14 j ÷ inscrits d'au moins 14 j", format: "pct", sens: 1, page: "/admin/croissance#activation", calc: (v, w) => { const n = v.nouveauxMurs(w); return n.length >= 5 ? n.filter((m) => v.active(m)).length / n.length : null; } },
  { id: "conversion_payante", nom: "Conversion payante", description: "Part des marchands actifs qui paient un abonnement", formule: "Marchands payants ÷ marchands actifs", format: "pct", sens: 1, page: "/admin/revenus#plans", calc: (v, w) => ratio(payantsA(v, w.fin).size, v.actifs(w).size) },
  { id: "succes_paiement", nom: "Succès des paiements", description: "Paiements en ligne aboutis", formule: "Payés ÷ (payés + échoués), paiements en ligne", format: "pct", sens: 1, page: "/admin/paiements", calc: (v, w) => { const c = v.commandesW(w).filter(enLigne); const ok = c.filter((x) => x.statut === "payee" || x.statut === "remboursee").length; return ratio(ok, ok + c.filter((x) => x.statut === "echouee").length); } },
  { id: "echecs_paiement", nom: "Paiements échoués", description: "Paiements en ligne échoués", formule: "Nombre de paiements au statut échoué", format: "nombre", sens: -1, additive: true, page: "/admin/paiements", calc: (v, w) => v.commandesW(w).filter((c) => c.statut === "echouee").length },
  { id: "annulation", nom: "Taux d'annulation", description: "Commandes annulées", formule: "Annulées ÷ commandes", format: "pct", sens: -1, page: "/admin/commerce", calc: (v, w) => { const c = v.commandesW(w); return ratio(c.filter((x) => x.statut === "annulee").length, c.length); } },
  { id: "remboursement", nom: "Taux de remboursement", description: "Commandes remboursées", formule: "Remboursées ÷ (payées + remboursées)", format: "pct", sens: -1, page: "/admin/commerce", calc: (v, w) => { const c = v.commandesW(w); const r = c.filter((x) => x.statut === "remboursee").length; return ratio(r, r + c.filter((x) => x.statut === "payee").length); } },
  { id: "livraison", nom: "Taux de livraison", description: "Livraisons réussies", formule: "Livrées ÷ (livrées + échecs)", format: "pct", sens: 1, page: "/admin/operations", calc: (v, w) => { const c = v.commandesW(w); const l = c.filter((x) => x.livraison === "livree").length; return ratio(l, l + c.filter((x) => x.livraison === "echec").length); } },
  { id: "delai_livraison", nom: "Délai de livraison", description: "Délai moyen commande → livraison", formule: "Moyenne (livrée − créée)", format: "heures", sens: -1, page: "/admin/operations", calc: (v, w) => { const d = v.commandesW(w).map((c) => c.delaiLivraisonH).filter((x): x is number => x != null); return d.length ? d.reduce((s, x) => s + x, 0) / d.length : null; } },
  { id: "requetes_ia", nom: "Requêtes Axia", description: "Requêtes adressées à Axia IA", formule: "Σ requêtes IA", format: "nombre", sens: 1, additive: true, page: "/admin/ia", calc: (v, w) => tranche(v.ia, w).reduce((s, e) => s + e.nombre, 0) },
  { id: "cout_ia", nom: "Coût IA", description: "Coût estimé des appels IA enregistrés (le coût des conversations Axia n'est pas encore suivi : valeur partielle)", formule: "Σ coût estimé des requêtes", format: "xaf", sens: -1, additive: true, page: "/admin/ia", calc: (v, w) => tranche(v.ia, w).reduce((s, e) => s + e.cout, 0) },
  { id: "adoption_ia", nom: "Adoption Axia", description: "Part des marchands actifs utilisant Axia", formule: "Marchands utilisant l'IA ÷ marchands actifs", format: "pct", sens: 1, page: "/admin/ia", calc: (v, w) => ratio(v.utilisateursIA(w).size, v.actifs(w).size) },
  { id: "visiteurs", nom: "Visiteurs", description: "Visiteurs du site Axso", formule: "Σ visiteurs", format: "nombre", sens: 1, requiert: "acquisition", page: "/admin/croissance", calc: (v, w) => (v.filtreActif() || !v.ds.visites.length ? null : tranche(v.ds.visites, w).reduce((s, x) => s + x.visiteurs, 0)) },
  { id: "dau", nom: "DAU", description: "Marchands actifs sur les dernières 24 h", formule: "Actifs sur 1 jour", format: "nombre", sens: 1, instant: true, page: "/admin/croissance#retention", calc: (v, w) => v.actifs({ debut: w.fin - JOUR, fin: w.fin }).size },
  { id: "wau", nom: "WAU", description: "Marchands actifs sur 7 jours", formule: "Actifs sur 7 jours", format: "nombre", sens: 1, instant: true, page: "/admin/croissance#retention", calc: (v, w) => v.actifs({ debut: w.fin - 7 * JOUR, fin: w.fin }).size },
  { id: "mau", nom: "MAU", description: "Marchands actifs sur 30 jours", formule: "Actifs sur 30 jours", format: "nombre", sens: 1, instant: true, page: "/admin/croissance#retention", calc: (v, w) => v.actifs({ debut: w.fin - 30 * JOUR, fin: w.fin }).size },
  { id: "stickiness", nom: "Stickiness", description: "Fréquence d'usage", formule: "DAU ÷ MAU", format: "pct", sens: 1, instant: true, page: "/admin/croissance#retention", calc: (v, w) => ratio(v.actifs({ debut: w.fin - JOUR, fin: w.fin }).size, v.actifs({ debut: w.fin - 30 * JOUR, fin: w.fin }).size) },
];
export const METRIQUE: Record<string, DefMetrique> = Object.fromEntries(METRIQUES.map((m) => [m.id, m]));


/** Valeur mise en cache par vue (même métrique + même fenêtre = un seul calcul par requête). */
export function valeur(v: Vue, id: string, w: Fenetre): number | null {
  const m = METRIQUE[id];
  if (!m) return null;
  if (m.requiert && v.ds.manques.includes(m.requiert)) return null;
  return v.cache(`${id}|${w.debut}|${w.fin}|${v.etapeActivation}`, () => m.calc(v, w));
}

export interface Mesure {
  id: string; nom: string; format: Format; sens: 1 | -1;
  valeur: number | null; precedente: number | null;
  variation: number | null; // relative (0.12 = +12 %) ; pour un pourcentage, écart en points
  statut: "bon" | "neutre" | "mauvais" | "inconnu";
  serie: (number | null)[];
  page: string;
  description: string; formule: string;
}

/** Valeur, comparaison et mini-tendance (n points) d'une métrique. */
export function mesurer(v: Vue, id: string, cur: Fenetre, prev: Fenetre, points = 12): Mesure {
  const m = METRIQUE[id];
  const a = valeur(v, id, cur), b = valeur(v, id, prev);
  const variation = a == null || b == null ? null : m.format === "pct" ? a - b : b === 0 ? (a === 0 ? 0 : null) : (a - b) / Math.abs(b);
  const seuil = m.format === "pct" ? 0.005 : 0.01;
  const statut = variation == null ? "inconnu" : Math.abs(variation) < seuil ? "neutre" : variation * m.sens > 0 ? "bon" : "mauvais";
  return { id, nom: m.nom, format: m.format, sens: m.sens, valeur: a, precedente: b, variation, statut, serie: serie(v, id, cur, points), page: m.page, description: m.description, formule: m.formule };
}

/** Série : la fenêtre découpée en n tranches (métriques de stock : valeur en fin de tranche, sur la même durée que la fenêtre). */
export function serie(v: Vue, id: string, w: Fenetre, n = 12): (number | null)[] {
  const pas = (w.fin - w.debut) / n;
  const m = METRIQUE[id];
  return Array.from({ length: n }, (_, i) => {
    const fin = w.debut + pas * (i + 1);
    return valeur(v, id, m.instant ? { debut: fin - (w.fin - w.debut), fin } : { debut: fin - pas, fin });
  });
}

/** Valeur d'une métrique ventilée par dimension (pays, plan, industrie, source), dans le segment courant. */
export function ventiler(v: Vue, id: string, w: Fenetre, dim: "pays" | "plan" | "industrie" | "source"): Map<string, number> {
  const groupes = new Map<string, Set<string>>();
  for (const m of v.marchands) { const k = m[dim] as string; if (!groupes.has(k)) groupes.set(k, new Set()); groupes.get(k)!.add(m.id); }
  const out = new Map<string, number>();
  for (const [k, ids] of groupes) out.set(k, valeur(v.sous(`${dim}:${k}`, () => ids), id, w) ?? 0);
  return out;
}

/** Vue restreinte à un ensemble de marchands. */
export function sousVue(v: Vue, ids: Set<string>) { const s = new Vue(v.ds, {}, ids, v.gmv90); s.etapeActivation = v.etapeActivation; return s; }

export const PLAN_ORDRE: PlanId[] = ["palier0", "palier1", "palier2"];
