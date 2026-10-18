// Marketing : dépenses, CAC, conversions, revenu, ROAS et LTV par canal d'acquisition.
// Module pur. Les dépenses ne sont pas rattachées à un marchand : CAC et ROAS n'ont de
// sens que sans segment (comme METRIQUE.cac).
import { SOURCES_ACQ } from "./types";
import { Vue, tranche } from "./moteur";
import { JOUR, type Fenetre } from "./contexte";

/** Marchands minimum dans un canal pour classer sa LTV. */
export const MIN_CANAL = 20;

export interface Canal {
  canal: string; nom: string; depense: number; visiteurs: number;
  inscrits: number; actives: number; payants: number;
  /** Revenu Axso (abonnements + commissions) généré À CE JOUR par les inscrits de la période. */
  revenu: number;
  cac: number | null; roas: number | null;
  /** LTV observée : revenu cumulé moyen par marchand acquis par ce canal (tous les inscrits, depuis toujours). */
  ltv: number | null; ancienneteMois: number | null; marchandsLtv: number;
}

/** Revenu Axso cumulé par marchand jusqu'à `fin`. */
function revenuCumule(v: Vue, fin: number) {
  const r = new Map<string, number>();
  for (const p of v.abonnements) if (p.date < fin) r.set(p.marchandId, (r.get(p.marchandId) ?? 0) + p.montant);
  for (const c of v.commandes) if (c.date < fin && c.statut === "payee" && c.commission) r.set(c.marchandId, (r.get(c.marchandId) ?? 0) + c.commission);
  return r;
}

export function parCanal(v: Vue, w: Fenetre): Canal[] {
  const segment = v.filtreActif();
  const rev = revenuCumule(v, v.maintenant + 1);
  const payants = new Set(v.abonnements.map((p) => p.marchandId));
  const canaux = new Set<string>([...v.marchands.map((m) => m.source), ...(segment ? [] : v.ds.depenses.map((d) => d.canal))]);
  const depense = new Map<string, number>(), visiteurs = new Map<string, number>();
  if (!segment) {
    for (const d of tranche(v.ds.depenses, w)) depense.set(d.canal, (depense.get(d.canal) ?? 0) + d.montant);
    for (const x of tranche(v.ds.visites, w)) visiteurs.set(x.source, (visiteurs.get(x.source) ?? 0) + x.visiteurs);
  }
  const nouveaux = v.nouveaux(w);
  return [...canaux].map((canal) => {
    const ins = nouveaux.filter((m) => m.source === canal);
    const tous = v.marchands.filter((m) => m.source === canal && m.creeLe < w.fin);
    const revenu = ins.reduce((s, m) => s + (rev.get(m.id) ?? 0), 0);
    const dep = depense.get(canal) ?? 0;
    const ltvOk = tous.length >= MIN_CANAL;
    return {
      canal, nom: SOURCES_ACQ[canal] ?? canal, depense: dep, visiteurs: visiteurs.get(canal) ?? 0,
      inscrits: ins.length, actives: ins.filter((m) => v.active(m)).length, payants: ins.filter((m) => payants.has(m.id)).length,
      revenu,
      cac: segment || !dep || !ins.length ? null : dep / ins.length,
      roas: segment || !dep ? null : revenu / dep,
      ltv: ltvOk ? tous.reduce((s, m) => s + (rev.get(m.id) ?? 0), 0) / tous.length : null,
      ancienneteMois: ltvOk ? tous.reduce((s, m) => s + (v.maintenant - m.creeLe), 0) / tous.length / (30 * JOUR) : null,
      marchandsLtv: tous.length,
    };
  }).sort((a, b) => b.inscrits - a.inscrits || b.depense - a.depense);
}

/** Dépenses par campagne sur la fenêtre. */
export function campagnes(v: Vue, w: Fenetre) {
  const m = new Map<string, { campagne: string; canal: string; montant: number }>();
  for (const d of tranche(v.ds.depenses, w)) {
    const x = m.get(d.campagne) ?? { campagne: d.campagne, canal: d.canal, montant: 0 };
    x.montant += d.montant; m.set(d.campagne, x);
  }
  return [...m.values()].sort((a, b) => b.montant - a.montant);
}
