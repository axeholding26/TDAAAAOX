// AXSO MARKET — logique PURE (aucun accès réseau ni base) : simulateur d'activité, score
// d'opportunité de marché, et mise en forme honnête de ce qu'un modèle d'IA renvoie pour
// une étude. Tout ce qui est calculé ici l'est à partir d'hypothèses : le résultat porte
// toujours la mention que ce sont des projections, jamais des garanties.

export const MENTION_PROJECTION = "Projections calculées à partir des hypothèses fournies, pas des garanties : les ventes réelles dépendent du marché, de la publicité et de l'exécution. À vérifier par un test à petit budget.";

// ─── Simulateur ───────────────────────────────────────────────────────────────

export interface EntreeSimulation {
  capital: number;
  /** Coût d'achat et d'expédition d'UNE unité. Ignorés si `tauxMarge` est fourni. */
  coutProduit?: number;
  expedition?: number;
  /** Budget publicitaire de la période simulée. */
  budgetMarketing?: number;
  prixVente: number;
  /** Part des visiteurs qui commandent (0.02 = 2 %). */
  tauxConversion: number;
  /** Coût d'une visite achetée : c'est lui qui transforme le budget marketing en visiteurs. */
  coutParVisite?: number;
  /** Visiteurs obtenus sans publicité sur la période. */
  visiteurs?: number;
  /** Montant moyen d'une commande ; par défaut le prix de vente (une unité par commande). */
  panierMoyen?: number;
  /** Part du panier gardée après achat et expédition ; remplace coutProduit + expedition. Peut être négative. */
  tauxMarge?: number;
  /** Part des commandes retournées (remboursées, marchandise comptée perdue). */
  tauxRetour?: number;
  /** Coûts fixes de la période (loyer, abonnements, salaires…). */
  coutsExploitation?: number;
  /** true (défaut) : la marchandise est payée avant d'être vendue, le capital limite donc les ventes. false : dropshipping. */
  achatAvantVente?: boolean;
}

export interface Scenario {
  cle: "pessimiste" | "base" | "optimiste";
  tauxConversion: number;
  tauxRetour: number;
  commandes: number;
  /** Unités vendues. */
  ventes: number;
  chiffreAffaires: number;
  /** Chiffre d'affaires net des retours − coût des marchandises. */
  marge: number;
  /** Marge − marketing − coûts d'exploitation. */
  resultat: number;
  /** Commandes à atteindre pour couvrir les coûts fixes ; null = jamais (chaque vente perd de l'argent). */
  pointMort: number | null;
  tresorerieRestante: number;
  /** La demande dépassait ce que le capital permettait d'acheter. */
  limiteParCapital: boolean;
}

export interface Simulation {
  mention: string;
  capitalInsuffisant: boolean;
  scenarios: Scenario[];
  alertes: string[];
}

// ponytail: coefficients fixes autour du scénario de base, une seule période, pas d'invendus ;
// passer à des fourchettes saisies par hypothèse (ou à un tirage Monte-Carlo) si le marchand le demande.
const COEFFICIENTS = [
  { cle: "pessimiste", conversion: 0.5, retours: 1.5 },
  { cle: "base", conversion: 1, retours: 1 },
  { cle: "optimiste", conversion: 1.5, retours: 0.5 },
] as const;

/** Nombre fini et positif, plafonné : une entrée absurde ne produit jamais d'infini ni de NaN. */
const positif = (v: unknown, max = 1e12) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.min(v, max) : 0);
const part = (v: unknown) => positif(v, 1);

export function simulerBusiness(e: EntreeSimulation): Simulation {
  const capital = positif(e.capital), prix = positif(e.prixVente), panier = positif(e.panierMoyen) || prix;
  const marketing = positif(e.budgetMarketing), fixes = marketing + positif(e.coutsExploitation);
  const unitesParCommande = prix > 0 ? panier / prix : 0;
  const margeSaisie = typeof e.tauxMarge === "number" && Number.isFinite(e.tauxMarge);
  const coutCommande = margeSaisie ? panier * (1 - Math.max(-10, Math.min(1, e.tauxMarge!))) : (positif(e.coutProduit) + positif(e.expedition)) * unitesParCommande;
  const cpv = positif(e.coutParVisite);
  const visiteurs = positif(e.visiteurs) + (cpv > 0 ? marketing / cpv : 0);
  const achatAvant = e.achatAvantVente !== false;
  // Ce qu'il reste pour acheter la marchandise une fois les coûts fixes payés.
  const financables = coutCommande > 0 ? Math.floor(Math.max(0, capital - fixes) / coutCommande) : Infinity;

  const scenarios: Scenario[] = COEFFICIENTS.map((k) => {
    const tauxConversion = Math.min(1, part(e.tauxConversion) * k.conversion), tauxRetour = Math.min(1, part(e.tauxRetour) * k.retours);
    const demande = Math.floor(visiteurs * tauxConversion);
    const commandes = achatAvant ? Math.min(demande, financables) : demande;
    const chiffreAffaires = commandes * panier * (1 - tauxRetour);
    const marge = chiffreAffaires - commandes * coutCommande;
    const contribution = panier * (1 - tauxRetour) - coutCommande;
    return {
      cle: k.cle, tauxConversion, tauxRetour, commandes, ventes: Math.round(commandes * unitesParCommande),
      chiffreAffaires: Math.round(chiffreAffaires), marge: Math.round(marge), resultat: Math.round(marge - fixes),
      pointMort: contribution > 0 ? Math.ceil(fixes / contribution) : null,
      tresorerieRestante: Math.round(capital + marge - fixes), limiteParCapital: achatAvant && demande > financables,
    };
  });

  const base = scenarios[1];
  const alertes = [
    capital < fixes && `Capital insuffisant : il manque ${Math.round(fixes - capital)} pour couvrir le marketing et les coûts d'exploitation, avant même d'acheter la marchandise.`,
    base.pointMort === null && "Marge négative ou nulle : chaque vente perd de l'argent, aucun volume ne rend l'activité rentable à ce prix.",
    visiteurs === 0 ? "Aucun visiteur : sans coût par visite (ou visiteurs déjà acquis), le budget marketing n'apporte aucune vente dans le calcul."
      : base.tauxConversion === 0 && "Taux de conversion nul : aucune vente.",
    base.limiteParCapital && "Le capital limite les ventes : la demande estimée dépasse la marchandise que vous pouvez acheter.",
    base.tresorerieRestante < 0 && "Trésorerie négative dans le scénario de base : l'activité demande plus d'argent que le capital prévu.",
  ].filter((a): a is string => !!a);
  return { mention: MENTION_PROJECTION, capitalInsuffisant: capital < fixes, scenarios, alertes };
}

// ─── Score d'opportunité de marché ────────────────────────────────────────────

export interface EntreeOpportunite {
  /** Estimations de 1 à 5 ; 5 est toujours favorable (forte demande, PEU de concurrence, FAIBLE risque). */
  demande?: number;
  concurrence?: number;
  risque?: number;
  /** Bénéfice / prix de vente. */
  tauxMarge?: number;
  budgetRequis?: number;
  budgetDisponible?: number;
}

export interface CritereOpportunite { cle: string; libelle: string; poids: number; note: number | null; source: "calcule" | "estime" | "non_renseigne"; explication: string }
export interface ScoreOpportunite { total: number; confiance: number; niveau: "excellent" | "bon" | "moyen" | "risque"; verdict: string; criteres: CritereOpportunite[] }

const POIDS = { demande: 30, marge: 25, concurrence: 20, budget: 15, risque: 10 } as const;
const fini = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const borne10 = (n: number) => Math.round(Math.max(0, Math.min(10, n)) * 10) / 10;

/**
 * Score sur 100, explicable critère par critère (même convention que lib/sourcing/score.ts) :
 * un critère non renseigné ne compte pas, et `confiance` dit quelle part du barème l'est.
 */
export function scoreOpportunite(e: EntreeOpportunite): ScoreOpportunite {
  const criteres: CritereOpportunite[] = [];
  const estime = (cle: "demande" | "concurrence" | "risque", libelle: string, bas: string, haut: string) => {
    const v = e[cle], ok = fini(v) && v >= 1 && v <= 5;
    criteres.push({ cle, libelle, poids: POIDS[cle], note: ok ? borne10(((v - 1) / 4) * 10) : null, source: ok ? "estime" : "non_renseigne", explication: ok ? `Estimation ${v}/5 (1 = ${bas}, 5 = ${haut}).` : "À estimer (1 à 5)." });
  };
  estime("demande", "Demande", "presque personne ne le cherche", "beaucoup de gens le veulent");
  const m = e.tauxMarge;
  criteres.push({ cle: "marge", libelle: "Marge", poids: POIDS.marge, note: fini(m) ? borne10((m / 0.45) * 10) : null, source: fini(m) ? "calcule" : "non_renseigne", explication: fini(m) ? `Bénéfice de ${Math.round(m * 100)} % du prix de vente (45 % et plus = note maximale, 0 % ou moins = 0).` : "Marge inconnue." });
  estime("concurrence", "Concurrence", "déjà vendu partout", "peu de vendeurs");
  const requis = e.budgetRequis, dispo = e.budgetDisponible, budgetOk = fini(requis) && requis > 0 && fini(dispo) && dispo >= 0;
  criteres.push({
    cle: "budget", libelle: "Budget requis face au budget disponible", poids: POIDS.budget, note: budgetOk ? borne10((dispo / requis) * 10) : null, source: budgetOk ? "calcule" : "non_renseigne",
    explication: budgetOk ? (dispo >= requis ? `Le budget disponible couvre le budget requis (${Math.round((requis / dispo) * 100)} % utilisé).` : `Le budget disponible ne couvre que ${Math.round((dispo / requis) * 100)} % du budget requis.`) : "Budget requis ou disponible inconnu.",
  });
  estime("risque", "Risque", "risque élevé (réglementation, retours, qualité)", "risque faible");

  const notes = criteres.filter((c) => c.note !== null);
  const poids = notes.reduce((s, c) => s + c.poids, 0);
  const total = poids ? Math.round((notes.reduce((s, c) => s + c.note! * c.poids, 0) / poids) * 10) : 0;
  const niveau = total >= 80 ? "excellent" : total >= 65 ? "bon" : total >= 50 ? "moyen" : "risque";
  const verdict = { excellent: "Opportunité très favorable", bon: "Bonne opportunité", moyen: "À tester avec prudence", risque: "Risquée en l'état" }[niveau];
  return { total, confiance: poids / 100, niveau, verdict, criteres };
}

// ─── Étude de marché : mise en forme de la réponse du modèle ──────────────────

const CONFIANCES = ["faible", "moyenne", "elevee"] as const;
const confiance = (v: unknown) => (CONFIANCES.includes(v as any) ? (v as (typeof CONFIANCES)[number]) : "faible");
const texte = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const liste = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const montant = (v: unknown) => (fini(v) && v > 0 ? Math.min(v, 1e12) : null);

/**
 * Ne garde de la réponse du modèle que la forme attendue, et marque CHAQUE chiffre comme une
 * estimation avec son niveau de confiance (« faible » si le modèle ne l'a pas donné). Les
 * scores, les marges et les scénarios ne viennent pas du modèle : ils sont recalculés ici à
 * partir de ses hypothèses.
 */
export function structurerEtude(brut: unknown, o: { volets: string[]; plan: boolean; budget?: number }) {
  const b = (brut && typeof brut === "object" ? brut : {}) as Record<string, any>;
  const sections = Object.fromEntries(o.volets.map((cle) => {
    const s = b.sections?.[cle] ?? {};
    return [cle, {
      source: "estimation_modele" as const,
      analyse: texte(s.analyse, 3000),
      points: liste(s.points).map((p) => texte(p, 500)).filter(Boolean).slice(0, 10),
      chiffres: liste(s.chiffres).flatMap((c) => (fini(c?.valeur) ? [{ libelle: texte(c.libelle, 200), valeur: c.valeur as number, unite: texte(c.unite, 40), estimation: true as const, confiance: confiance(c.confiance), base: texte(c.base, 400) || "Non précisée par le modèle." }] : [])).slice(0, 10),
    }];
  }));
  if (!o.plan) return { resume: texte(b.resume, 1000), sections };

  const opportunites = liste(b.opportunites).slice(0, 8).flatMap((x) => {
    const nom = texte(x?.nom, 200);
    if (!nom) return [];
    const prix = montant(x.prix_vente_estime), cout = montant(x.cout_rendu_estime), budgetRequis = montant(x.budget_requis);
    const tauxMarge = prix !== null && cout !== null ? Math.round(((prix - cout) / prix) * 1000) / 1000 : null;
    return [{
      nom, pourquoi: texte(x.pourquoi, 600), estimation: true as const, confiance: confiance(x.confiance),
      prix_vente_estime: prix, cout_rendu_estime: cout, budget_requis_estime: budgetRequis, taux_marge_estime: tauxMarge,
      // Calculé par Axso à partir des estimations ci-dessus : le modèle ne donne pas le score.
      score: scoreOpportunite({ demande: x.demande, concurrence: x.concurrence, risque: x.risque, tauxMarge: tauxMarge ?? undefined, budgetRequis: budgetRequis ?? undefined, budgetDisponible: o.budget }),
    }];
  }).sort((x, y) => y.score.total - x.score.total);

  const postes = liste(b.repartition_budget).flatMap((p) => (texte(p?.poste, 120) && montant(p.montant) !== null ? [{ poste: texte(p.poste, 120), montant: Math.round(montant(p.montant)!), pourquoi: texte(p.pourquoi, 400) }] : [])).slice(0, 12);
  const total = postes.reduce((s, p) => s + p.montant, 0);

  // Hypothèses chiffrées du modèle : nombres seulement, et un taux hors de 0–1 est écarté (« 2 » pour 2 % donnerait 100 %).
  const brutes = (b.hypotheses_simulation ?? {}) as Record<string, unknown>;
  const h = Object.fromEntries(["cout_produit", "expedition", "budget_marketing", "prix_vente", "taux_conversion", "cout_par_visite", "taux_retour", "couts_exploitation"].map((k) => {
    const v = brutes[k];
    return [k, fini(v) && v >= 0 && (!k.startsWith("taux_") || v <= 1) ? Math.min(v, 1e12) : undefined];
  })) as Record<string, number | undefined>;
  const simulable = !!o.budget && !!h.prix_vente && h.taux_conversion !== undefined;
  return {
    resume: texte(b.resume, 1000), sections,
    opportunites_produit: opportunites,
    marges_estimees: opportunites.filter((x) => x.taux_marge_estime !== null).map((x) => ({ produit: x.nom, prix_vente_estime: x.prix_vente_estime, cout_rendu_estime: x.cout_rendu_estime, taux_marge_estime: x.taux_marge_estime, estimation: true as const, confiance: x.confiance })),
    repartition_budget: { source: "estimation_modele" as const, postes, total, budget: o.budget ?? null, depasse_budget: !!o.budget && total > o.budget },
    scenarios: simulable
      ? { source: "calcul_sur_hypotheses_du_modele" as const, hypotheses: h, ...simulerBusiness({ capital: o.budget!, coutProduit: h.cout_produit, expedition: h.expedition, budgetMarketing: h.budget_marketing, prixVente: h.prix_vente!, tauxConversion: h.taux_conversion!, coutParVisite: h.cout_par_visite, tauxRetour: h.taux_retour, coutsExploitation: h.couts_exploitation }) }
      : { source: "non_calcule" as const, raison: o.budget ? "Le modèle n'a pas fourni d'hypothèses exploitables (prix de vente, taux de conversion) : utilise simulate_business avec tes propres hypothèses." : "Aucun budget fourni : utilise simulate_business avec un capital." },
  };
}
