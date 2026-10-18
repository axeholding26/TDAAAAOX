// Contenu des 7 rapports du Command Center (page /admin/rapports/[type] et e-mail
// du cron /api/cron/rapports-command-center). Module pur : une Vue + des fenêtres
// en entrée, des sections (KPIs, puces, tableaux) en sortie.
import { JOUR, debutJour, type Fenetre, type Fenetres } from "./contexte";
import { mesurer, ventiler, tranche, type Vue, type Mesure, type Format } from "./moteur";
import { variations, santeMarchand, NOM_STATUT, type Alerte, type Priorite, type RisqueChurn, type Expansion, type ImpactFonction, type StatsMarchand, type StatutSante } from "./insights";
import { formatValeur, formatVariation, formats, T_FR } from "./format";
import type { T } from "@/lib/i18n";
import { NOM_RAPPORT, type RapportPlanifie, type Reglages } from "./reglages";
import type { Section } from "./rbac";
import { nomPays, NOM_PLAN, SOURCES_ACQ, NOM_TYPE_IA, type TypeIA } from "./types";

export type TypeRapport = RapportPlanifie["type"];
export type Frequence = RapportPlanifie["frequence"];
export const TYPES_RAPPORT = Object.keys(NOM_RAPPORT) as TypeRapport[];

export const INFO_RAPPORT: Record<TypeRapport, { titre: string; description: string; frequence: Frequence | null; section: Section }> = {
  quotidien: { titre: "AXSO Daily Brief", description: "La journée d'hier, ce qui a changé, risques, opportunités et actions du jour.", frequence: "quotidien", section: "cc" },
  croissance: { titre: "Weekly Growth Report", description: "Acquisition, activation, rétention et marchands actifs sur 7 jours.", frequence: "hebdomadaire", section: "croissance" },
  revenus: { titre: "Monthly Revenue Report", description: "Revenu, MRR, mouvements d'abonnements et répartition du mois écoulé.", frequence: "mensuel", section: "revenus" },
  sante_marchands: { titre: "Merchant Health Report", description: "Répartition des scores santé, radar churn et opportunités d'upgrade.", frequence: null, section: "succes" },
  ia: { titre: "AI Report", description: "Usage et coût d'Axia par type, adoption et impact des fonctionnalités.", frequence: null, section: "ia" },
  marketing: { titre: "Marketing Report", description: "Dépenses, CAC et inscriptions par canal d'acquisition.", frequence: null, section: "marketing" },
  operations: { titre: "Operations Report", description: "Livraison, paiements, annulations et incidents.", frequence: null, section: "operations" },
};

export interface ColonneRapport { cle: string; nom: string; format?: Format | "texte"; droite?: boolean }
export type LigneRapport = Record<string, string | number | null> & { _id: string };
export interface TableauRapport { id: string; titre: string; colonnes: ColonneRapport[]; lignes: LigneRapport[]; vide?: string }
export interface SectionRapport { id: string; titre: string; note?: string; kpis?: Mesure[]; puces?: { texte: string; lien?: string; ton?: "bon" | "mauvais" }[]; tableaux?: TableauRapport[]; vide?: string }
export interface Rapport { type: TypeRapport; titre: string; periode: string; libelleComp: string; fen: Fenetres; sections: SectionRapport[] }

/** Analyses de la page (lib/command-center/serveur.ts → analyser) dont un rapport a besoin. */
export interface AnalyseRapport { stats: Map<string, StatsMarchand>; churn: RisqueChurn[]; expansion: Expansion[]; fonctions: ImpactFonction[]; alertes: Alerte[]; priorites: Priorite[] }

/** Fenêtre propre à une fréquence : hier, 7 derniers jours, mois civil précédent (UTC). */
export function fenetreFrequence(fr: Frequence, maintenant: number, t: T = T_FR): Fenetres {
  const jour = debutJour(maintenant);
  if (fr === "quotidien") return { cur: { debut: jour - JOUR, fin: jour }, prev: { debut: jour - 2 * JOUR, fin: jour - JOUR }, libelle: t("Hier ({0})", formats(t).dateLongue(jour - JOUR)), libelleComp: t("vs avant-hier") };
  if (fr === "hebdomadaire") return { cur: { debut: jour - 7 * JOUR, fin: jour }, prev: { debut: jour - 14 * JOUR, fin: jour - 7 * JOUR }, libelle: t("7 derniers jours complets"), libelleComp: t("vs 7 jours précédents") };
  // Mois civils à l'heure de Douala (UTC+1).
  const H = 3_600_000, d = new Date(maintenant + H), a = d.getUTCFullYear(), m = d.getUTCMonth();
  const debut = Date.UTC(a, m - 1, 1) - H, fin = Date.UTC(a, m, 1) - H;
  return { cur: { debut, fin }, prev: { debut: Date.UTC(a, m - 2, 1) - H, fin: debut }, libelle: new Date(debut).toLocaleDateString(t.loc, { month: "long", year: "numeric", timeZone: "Africa/Douala" }), libelleComp: t("vs mois précédent") };
}

const k = (v: Vue, ids: string[], f: Fenetres) => ids.map((id) => mesurer(v, id, f.cur, f.prev, 12));
const pct = (x: number | null) => (x == null ? null : Math.round(x * 1000) / 1000);

function parDimension(v: Vue, w: Fenetre, ids: { id: string; nom: string }[], dim: "pays" | "plan" | "source", titre: string, id: string): TableauRapport {
  const cols = ids.map((x) => ({ x, m: ventiler(v, x.id, w, dim) }));
  const cles = [...new Set(cols.flatMap((c) => [...c.m.keys()]))];
  const nom = (c: string) => (dim === "pays" ? nomPays(c) : dim === "plan" ? NOM_PLAN[c as keyof typeof NOM_PLAN] ?? c : SOURCES_ACQ[c] ?? c);
  const lignes = cles.map((c) => ({ _id: c, segment: nom(c), ...Object.fromEntries(cols.map(({ x, m }) => [x.id, m.get(c) ?? 0])) }))
    .filter((l) => ids.some((x) => (l as Record<string, unknown>)[x.id]))
    .sort((a, b) => Number((b as Record<string, unknown>)[ids[0].id]) - Number((a as Record<string, unknown>)[ids[0].id]));
  const fmt = (i: string) => (["revenu", "gmv", "mrr", "revenu_abonnements", "revenu_commissions", "cout_ia"].includes(i) ? "xaf" : "nombre") as Format;
  return { id, titre, colonnes: [{ cle: "segment", nom: dim === "pays" ? "Pays" : dim === "plan" ? "Plan" : "Canal" }, ...ids.map((x) => ({ cle: x.id, nom: x.nom, format: fmt(x.id), droite: true }))], lignes: lignes as LigneRapport[] };
}

function tableauVariations(v: Vue, f: Fenetres, t: T): SectionRapport {
  const { formatValeur, formatVariation } = formats(t);
  const vars = variations(v, f, undefined, t);
  const ligne = (x: (typeof vars)[number]): LigneRapport => ({ _id: x.id, metrique: x.nom, avant: formatValeur(x.mesure.precedente, x.mesure.format), apres: formatValeur(x.mesure.valeur, x.mesure.format), variation: formatVariation(x.mesure.variation, x.mesure.format), cause: x.cause });
  const colonnes = [{ cle: "metrique", nom: "Métrique" }, { cle: "avant", nom: "Avant", droite: true }, { cle: "apres", nom: "Après", droite: true }, { cle: "variation", nom: "Variation", droite: true }, { cle: "cause", nom: "Cause probable" }];
  const bonnes = vars.filter((x) => x.mesure.statut === "bon").slice(0, 5), mauvaises = vars.filter((x) => x.mesure.statut === "mauvais").slice(0, 5);
  return {
    id: "changements", titre: "Changements", note: t("Variations significatives {0}. Une cause n'est citée que si les données la soutiennent ; corrélation ≠ causalité.", t(f.libelleComp)),
    tableaux: [
      { id: "hausses", titre: "Évolutions favorables", colonnes, lignes: bonnes.map(ligne), vide: "Aucune évolution favorable significative." },
      { id: "baisses", titre: "Évolutions défavorables", colonnes, lignes: mauvaises.map(ligne), vide: "Aucune évolution défavorable significative." },
    ],
  };
}

const lienAlerte = (a: Alerte) => ({ texte: `${a.titre} — ${a.detail}`, lien: a.lien });

/** Construit un rapport. `a` = analyses du contexte (seuils, radars, priorités) ; `f` = fenêtre du rapport. */
export function construireRapport(type: TypeRapport, v: Vue, f: Fenetres, a: AnalyseRapport, r: Reglages, t: T = T_FR): Rapport {
  const s: SectionRapport[] = [];
  const w = f.cur;
  switch (type) {
    case "quotidien": {
      s.push({ id: "hier", titre: "Hier", kpis: k(v, ["revenu", "gmv", "commandes", "nouveaux_marchands"], f) });
      s.push(tableauVariations(v, f, t));
      const email = new Set(r.seuils.filter((x) => x.canal === "email").map((x) => `seuil:${x.id}`));
      const alertesEmail = a.alertes.filter((x) => email.has(x.id));
      if (alertesEmail.length) s.push({ id: "alertes", titre: "Alertes", note: "Seuils au canal e-mail actuellement franchis.", puces: alertesEmail.map((x) => ({ ...lienAlerte(x), ton: "mauvais" as const })) });
      const risques = a.alertes.filter((x) => x.categorie === "critique" || x.categorie === "alerte").slice(0, 3);
      s.push({ id: "risques", titre: "Risques", puces: risques.map((x) => ({ ...lienAlerte(x), ton: "mauvais" as const })), vide: "Aucun seuil franchi ni risque détecté." });
      const opp = a.alertes.filter((x) => x.categorie === "opportunite" || x.categorie === "insight").slice(0, 3);
      s.push({ id: "opportunites", titre: "Opportunités", puces: opp.map((x) => ({ ...lienAlerte(x), ton: "bon" as const })), vide: "Aucune opportunité détectée." });
      s.push({ id: "actions", titre: "Actions recommandées", puces: a.priorites.slice(0, 5).map((p) => ({ texte: `${p.titre} — ${p.pourquoi}`, lien: p.lien })), vide: "Aucune action prioritaire." });
      break;
    }
    case "croissance": {
      s.push({ id: "kpis", titre: "Indicateurs de croissance", kpis: k(v, ["nouveaux_marchands", "marchands_actifs", "north_star", "activation", "conversion_payante", "churn", "wau", "mau"], f) });
      s.push(tableauVariations(v, f, t));
      const tabs = [parDimension(v, w, [{ id: "nouveaux_marchands", nom: "Nouveaux marchands" }, { id: "marchands_actifs", nom: "Marchands actifs" }], "pays", "Par pays", "pays")];
      if (!v.ds.manques.includes("acquisition")) tabs.push(parDimension(v, w, [{ id: "nouveaux_marchands", nom: "Nouveaux marchands" }], "source", "Par canal d'acquisition", "canaux"));
      s.push({ id: "segments", titre: "Répartition", tableaux: tabs, note: v.ds.manques.includes("acquisition") ? "Canal d'acquisition non enregistré dans cette source de données." : undefined });
      break;
    }
    case "revenus": {
      s.push({ id: "kpis", titre: "Revenus", kpis: k(v, ["revenu", "mrr", "arr", "revenu_abonnements", "revenu_commissions", "arpu", "nrr", "churn"], f) });
      const mv = v.mouvementsMrr(w);
      s.push({ id: "mrr", titre: "Mouvements du MRR", tableaux: [{ id: "mouvements", titre: "Du début à la fin de la période", colonnes: [{ cle: "poste", nom: "Poste" }, { cle: "montant", nom: "Montant", format: "xaf", droite: true }], lignes: [
        { _id: "debut", poste: "MRR de début", montant: mv.debut }, { _id: "nouveau", poste: "Nouveaux abonnements", montant: mv.nouveau },
        { _id: "expansion", poste: "Expansion", montant: mv.expansion }, { _id: "contraction", poste: "Contraction", montant: -mv.contraction },
        { _id: "churn", poste: "Churn", montant: -mv.churn }, { _id: "fin", poste: "MRR de fin", montant: mv.fin },
      ] }] });
      const ids = [{ id: "revenu", nom: "Revenu" }, { id: "revenu_abonnements", nom: "Abonnements" }, { id: "revenu_commissions", nom: "Commissions" }, { id: "gmv", nom: "GMV" }];
      s.push({ id: "segments", titre: "Répartition", tableaux: [parDimension(v, w, ids, "pays", "Par pays", "pays"), parDimension(v, w, [{ id: "mrr", nom: "MRR" }, ...ids.slice(0, 1)], "plan", "Par plan (plan actuel)", "plans")] });
      break;
    }
    case "sante_marchands": {
      s.push({ id: "kpis", titre: "Base marchands", kpis: k(v, ["marchands_actifs", "north_star", "churn", "nrr"], f) });
      const compte: Record<StatutSante, number> = { croissance: 0, sain: 0, risque: 0, critique: 0 };
      for (const m of v.marchands) { const st = a.stats.get(m.id); if (st && (st.commandes30 || st.commandesPrec30 || st.mrr || st.joursInactif < 30)) compte[santeMarchand(m, st, r.poids_sante).statut]++; }
      const total = Object.values(compte).reduce((x, y) => x + y, 0);
      s.push({ id: "repartition", titre: "Répartition par statut de santé", note: "Marchands ayant eu une activité ou un abonnement sur 60 jours. Score composite pondéré (réglages → Health Score).", tableaux: [{ id: "statuts", titre: "Statuts", colonnes: [{ cle: "statut", nom: "Statut" }, { cle: "nombre", nom: "Marchands", format: "nombre", droite: true }, { cle: "part", nom: "Part", format: "pct", droite: true }],
        lignes: total ? (Object.keys(compte) as StatutSante[]).map((x) => ({ _id: x, statut: NOM_STATUT[x], nombre: compte[x], part: pct(compte[x] / total) })) : [], vide: "Aucun marchand actif sur 60 jours." }] });
      s.push({ id: "churn", titre: "Radar churn", tableaux: [{ id: "radar_churn", titre: "Marchands à risque (top 25)", vide: "Aucun marchand à risque.", colonnes: [{ cle: "marchand", nom: "Marchand" }, { cle: "pays", nom: "Pays" }, { cle: "plan", nom: "Plan" }, { cle: "risque", nom: "Risque", format: "pct", droite: true }, { cle: "revenu", nom: "Revenu en jeu", format: "xaf", droite: true }, { cle: "raisons", nom: "Signaux" }, { cle: "action", nom: "Action" }],
        lignes: a.churn.slice(0, 25).map((c) => ({ _id: c.marchand.id, marchand: c.marchand.nom, pays: nomPays(c.marchand.pays), plan: NOM_PLAN[c.marchand.plan], risque: c.risque, revenu: c.revenuRisque, raisons: c.raisons.join(", "), action: c.action })) }] });
      s.push({ id: "expansion", titre: "Opportunités d'upgrade", tableaux: [{ id: "radar_expansion", titre: "Marchands prêts à monter en gamme (top 25)", vide: "Aucune opportunité d'upgrade.", colonnes: [{ cle: "marchand", nom: "Marchand" }, { cle: "plan", nom: "Plan actuel" }, { cle: "cible", nom: "Plan recommandé" }, { cle: "raison", nom: "Raison" }, { cle: "potentiel", nom: "MRR potentiel", format: "xaf", droite: true }],
        lignes: a.expansion.slice(0, 25).map((e) => ({ _id: e.marchand.id, marchand: e.marchand.nom, plan: NOM_PLAN[e.marchand.plan], cible: e.planRecommande === "entreprise" ? "Entreprise" : NOM_PLAN[e.planRecommande], raison: e.raison, potentiel: e.revenuPotentiel })) }] });
      break;
    }
    case "ia": {
      s.push({ id: "kpis", titre: "Axia IA", kpis: k(v, ["requetes_ia", "cout_ia", "adoption_ia"], f), note: v.ds.manques.includes("tokens") ? "Tokens et coût non mesurés précisément dans cette source : le coût est une estimation." : undefined });
      const parType = new Map<string, { n: number; tokens: number; cout: number; m: Set<string> }>();
      for (const e of tranche(v.ia, w)) { const x = parType.get(e.type) ?? { n: 0, tokens: 0, cout: 0, m: new Set<string>() }; x.n += e.nombre; x.tokens += e.tokens; x.cout += e.cout; x.m.add(e.marchandId); parType.set(e.type, x); }
      s.push({ id: "types", titre: "Usage par type", tableaux: [{ id: "ia_types", titre: "Requêtes par type", vide: "Aucune requête Axia sur la période.", colonnes: [{ cle: "type", nom: "Type" }, { cle: "requetes", nom: "Requêtes", format: "nombre", droite: true }, { cle: "marchands", nom: "Marchands", format: "nombre", droite: true }, ...(v.ds.manques.includes("tokens") ? [] : [{ cle: "tokens", nom: "Tokens", format: "nombre" as const, droite: true }]), { cle: "cout", nom: "Coût estimé", format: "xaf", droite: true }],
        lignes: [...parType].sort((x, y) => y[1].n - x[1].n).map(([t, x]) => ({ _id: t, type: NOM_TYPE_IA[t as TypeIA] ?? t, requetes: x.n, marchands: x.m.size, tokens: x.tokens, cout: Math.round(x.cout) })) }] });
      s.push({ id: "fonctions", titre: "Adoption des fonctionnalités", note: "Écarts de GMV entre adopteurs et autres : corrélation observée, pas une preuve de causalité.", tableaux: [{ id: "fonctions", titre: "Fonctionnalités", colonnes: [{ cle: "fonction", nom: "Fonctionnalité" }, { cle: "adoption", nom: "Adoption", format: "pct", droite: true }, { cle: "adopteurs", nom: "Adopteurs", format: "nombre", droite: true }, { cle: "gmvA", nom: "GMV / adopteur", format: "xaf", droite: true }, { cle: "gmvB", nom: "GMV / autre", format: "xaf", droite: true }],
        lignes: a.fonctions.map((x) => ({ _id: x.fonction, fonction: x.nom, adoption: pct(x.adoption), adopteurs: x.adopteurs, gmvA: x.gmvParAdopteur, gmvB: x.gmvParAutre })) }] });
      break;
    }
    case "marketing": {
      if (v.ds.manques.includes("marketing")) { s.push({ id: "indisponible", titre: "Marketing", vide: "Les dépenses marketing ne sont pas encore enregistrées dans Axso : CAC, ROAS et dépenses par canal sont indisponibles. Saisissez les dépenses par canal et par campagne pour alimenter ce rapport." }); break; }
      s.push({ id: "kpis", titre: "Acquisition", kpis: k(v, ["cac", "nouveaux_marchands", "visiteurs"], f) });
      const dep = new Map<string, number>();
      for (const d of tranche(v.ds.depenses, w)) dep.set(d.canal, (dep.get(d.canal) ?? 0) + d.montant);
      const nv = new Map<string, number>();
      for (const m of v.nouveaux(w)) nv.set(m.source, (nv.get(m.source) ?? 0) + 1);
      const canaux = [...new Set([...dep.keys(), ...nv.keys()])];
      s.push({ id: "canaux", titre: "Par canal", note: v.filtreActif() ? "Les dépenses ne sont pas rattachées à un marchand : elles sont globales même si un segment est filtré." : undefined, tableaux: [{ id: "canaux", titre: "Dépenses et inscriptions", colonnes: [{ cle: "canal", nom: "Canal" }, { cle: "depense", nom: "Dépense", format: "xaf", droite: true }, { cle: "inscrits", nom: "Nouveaux marchands", format: "nombre", droite: true }, { cle: "cac", nom: "CAC", format: "xaf", droite: true }],
        lignes: canaux.map((c) => { const d = dep.get(c) ?? 0, n = nv.get(c) ?? 0; return { _id: c, canal: SOURCES_ACQ[c] ?? c, depense: d, inscrits: n, cac: d && n ? Math.round(d / n) : null }; }).sort((a, b) => Number(b.depense) - Number(a.depense)) }] });
      break;
    }
    case "operations": {
      s.push({ id: "kpis", titre: "Opérations", kpis: k(v, ["livraison", "delai_livraison", "succes_paiement", "echecs_paiement", "annulation", "remboursement"], f) });
      const met = new Map<string, { n: number; ok: number; ko: number }>();
      for (const c of v.commandesW(w)) { const x = met.get(c.methode) ?? { n: 0, ok: 0, ko: 0 }; x.n++; if (c.statut === "payee" || c.statut === "remboursee") x.ok++; if (c.statut === "echouee") x.ko++; met.set(c.methode, x); }
      s.push({ id: "methodes", titre: "Paiements par méthode", tableaux: [{ id: "methodes", titre: "Méthodes de paiement", vide: "Aucune commande sur la période.", colonnes: [{ cle: "methode", nom: "Méthode" }, { cle: "commandes", nom: "Commandes", format: "nombre", droite: true }, { cle: "echecs", nom: "Échecs", format: "nombre", droite: true }, { cle: "succes", nom: "Succès", format: "pct", droite: true }],
        lignes: [...met].sort((a, b) => b[1].n - a[1].n).map(([m, x]) => ({ _id: m, methode: m.replace(/_/g, " "), commandes: x.n, echecs: x.ko, succes: x.ok + x.ko ? pct(x.ok / (x.ok + x.ko)) : null })) }] });
      if (v.ds.manques.includes("incidents")) s.push({ id: "incidents", titre: "Incidents", vide: "Les incidents ne sont pas encore journalisés dans Axso." });
      else s.push({ id: "incidents", titre: "Incidents", tableaux: [{ id: "incidents", titre: "Incidents de la période", vide: "Aucun incident sur la période.", colonnes: [{ cle: "date", nom: "Date" }, { cle: "titre", nom: "Incident" }, { cle: "gravite", nom: "Gravité" }, { cle: "duree", nom: "Résolution", format: "heures", droite: true }],
        lignes: v.ds.incidents.filter((x) => x.date >= w.debut && x.date < w.fin).map((x) => ({ _id: x.id, date: new Date(x.date).toISOString().slice(0, 10), titre: x.titre, gravite: x.gravite, duree: x.resoluLe ? (x.resoluLe - x.date) / 3_600_000 : null })) }] });
      break;
    }
  }
  // Traduction des libellés (titres, colonnes, cellules texte) : la clé est le texte français, inchangé hors dictionnaire.
  const tr = (x: string | undefined) => (x == null ? x : t(x));
  const sections = s.map((x) => ({
    ...x, titre: t(x.titre), note: tr(x.note), vide: tr(x.vide), kpis: x.kpis?.map((m) => ({ ...m, nom: t(m.nom) })),
    tableaux: x.tableaux?.map((tb) => ({
      ...tb, titre: t(tb.titre), vide: tr(tb.vide), colonnes: tb.colonnes.map((c) => ({ ...c, nom: t(c.nom) })),
      lignes: tb.lignes.map((l) => Object.fromEntries(Object.entries(l).map(([cle, val]) => [cle, cle !== "_id" && typeof val === "string" ? t(val) : val])) as LigneRapport),
    })),
  }));
  return { type, titre: INFO_RAPPORT[type].titre, periode: t(f.libelle), libelleComp: t(f.libelleComp), fen: f, sections };
}

/** Valeur d'une cellule en texte (e-mail, export). */
export function texteCellule(v: string | number | null | undefined, f?: ColonneRapport["format"], t: T = T_FR): string {
  if (v == null || v === "") return "—";
  return typeof v === "number" && f && f !== "texte" ? formats(t).formatValeur(v, f) : String(v);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Rapport en HTML d'e-mail (styles en ligne, sans image ni script). `base` = URL du site pour les liens. */
export function rapportEnHtml(rp: Rapport, base: string): string {
  const td = "padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;";
  const lienAbs = (l: string) => esc(base.replace(/\/$/, "") + l);
  const corps = rp.sections.map((s) => {
    let h = `<h2 style="font-size:16px;margin:24px 0 8px;color:#111">${esc(s.titre)}</h2>`;
    if (s.note) h += `<p style="font-size:12px;color:#666;margin:0 0 8px">${esc(s.note)}</p>`;
    if (s.kpis?.length) h += `<table style="border-collapse:collapse;width:100%">${s.kpis.map((m) => `<tr><td style="${td}">${esc(m.nom)}</td><td style="${td}text-align:right;font-weight:600">${esc(formatValeur(m.valeur, m.format))}</td><td style="${td}text-align:right;color:${m.statut === "bon" ? "#15803d" : m.statut === "mauvais" ? "#b91c1c" : "#666"}">${esc(formatVariation(m.variation, m.format))}</td></tr>`).join("")}</table>`;
    if (s.puces?.length) h += `<ul style="padding-left:18px;margin:0">${s.puces.map((p) => `<li style="font-size:13px;margin:4px 0">${p.lien ? `<a href="${lienAbs(p.lien)}" style="color:#111">${esc(p.texte)}</a>` : esc(p.texte)}</li>`).join("")}</ul>`;
    for (const t of s.tableaux ?? []) {
      h += `<p style="font-size:13px;font-weight:600;margin:12px 0 4px">${esc(t.titre)}</p>`;
      h += !t.lignes.length ? `<p style="font-size:12px;color:#666">${esc(t.vide ?? "Aucune donnée")}</p>` : `<table style="border-collapse:collapse;width:100%"><tr>${t.colonnes.map((c) => `<th style="${td}text-align:${c.droite ? "right" : "left"};color:#666;font-weight:500">${esc(c.nom)}</th>`).join("")}</tr>${t.lignes.slice(0, 15).map((l) => `<tr>${t.colonnes.map((c) => `<td style="${td}text-align:${c.droite ? "right" : "left"}">${esc(texteCellule(l[c.cle], c.format))}</td>`).join("")}</tr>`).join("")}</table>${t.lignes.length > 15 ? `<p style="font-size:12px;color:#666">… ${t.lignes.length - 15} lignes de plus dans le Command Center.</p>` : ""}`;
    }
    if (!s.kpis?.length && !s.puces?.length && !s.tableaux?.length && s.vide) h += `<p style="font-size:13px;color:#666">${esc(s.vide)}</p>`;
    else if (s.puces && !s.puces.length && s.vide) h += `<p style="font-size:13px;color:#666">${esc(s.vide)}</p>`;
    return h;
  }).join("");
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:680px;margin:0 auto;color:#111">
<p style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#888;margin:0">Axso Command Center</p>
<h1 style="font-size:22px;margin:4px 0">${esc(rp.titre)}</h1>
<p style="font-size:13px;color:#666;margin:0">${esc(rp.periode)} · comparaison ${esc(rp.libelleComp)} · données réelles</p>
${corps}
<p style="font-size:12px;color:#888;margin-top:28px"><a href="${lienAbs(`/admin/rapports/${rp.type}`)}" style="color:#888">Ouvrir le rapport complet</a> · Programmation modifiable dans Command Center → Rapports.</p>
</div>`;
}

/** Le rapport planifié tombe-t-il ce jour (UTC) ? quotidien : chaque jour ; hebdomadaire : lundi ; mensuel : le 1er. */
export const estDu = (fr: Frequence, t: number) => { const d = new Date(t); return fr === "quotidien" || (fr === "hebdomadaire" && d.getUTCDay() === 1) || (fr === "mensuel" && d.getUTCDate() === 1); };
