// Axia AI Intelligence : usage, coût et « ROI » de l'IA. Module pur (sans Prisma).
// Honnêteté : on ne mesure PAS un « revenu généré par l'IA ». On compare le coût IA
// au GMV et au revenu Axso des marchands qui utilisent Axia, et utilisateurs vs
// non-utilisateurs — une corrélation, pas une causalité.
import { TYPES_IA, NOM_TYPE_IA, type TypeIA } from "./types";
import { Vue, tranche, sousVue } from "./moteur";
import type { Fenetre } from "./contexte";

/** Volume minimal par groupe pour comparer utilisateurs et non-utilisateurs. */
export const MIN_GROUPE = 20;

export function analyseIA(v: Vue, w: Fenetre) {
  const evts = tranche(v.ia, w);
  const parType = new Map<TypeIA, { requetes: number; tokens: number; cout: number; marchands: Set<string> }>(TYPES_IA.map((t) => [t, { requetes: 0, tokens: 0, cout: 0, marchands: new Set() }]));
  const parMarchand = new Map<string, { requetes: number; cout: number }>();
  let requetes = 0, tokens = 0, cout = 0;
  for (const e of evts) {
    const t = parType.get(e.type)!;
    t.requetes += e.nombre; t.tokens += e.tokens; t.cout += e.cout; t.marchands.add(e.marchandId);
    requetes += e.nombre; tokens += e.tokens; cout += e.cout;
    const m = parMarchand.get(e.marchandId) ?? { requetes: 0, cout: 0 };
    m.requetes += e.nombre; m.cout += e.cout; parMarchand.set(e.marchandId, m);
  }
  const utilisateurs = new Set(parMarchand.keys());
  const actifs = v.actifs(w);

  // GMV et revenu Axso par marchand sur la fenêtre.
  const gmv = new Map<string, number>(), commandes = new Map<string, number>();
  for (const c of v.payees(w)) { gmv.set(c.marchandId, (gmv.get(c.marchandId) ?? 0) + c.montant); commandes.set(c.marchandId, (commandes.get(c.marchandId) ?? 0) + 1); }
  const sv = sousVue(v, utilisateurs);
  const gmvUtilisateurs = [...utilisateurs].reduce((s, id) => s + (gmv.get(id) ?? 0), 0);
  const revenuUtilisateurs = sv.revenuAbonnements(w) + sv.revenuCommissions(w);

  // Comparaison parmi les marchands actifs : utilisateurs d'Axia vs les autres.
  const payants = new Set(v.mrrParMarchand(w.fin).keys());
  const groupe = (ids: string[]) => ids.length < MIN_GROUPE ? null : {
    n: ids.length,
    gmvParMarchand: ids.reduce((s, id) => s + (gmv.get(id) ?? 0), 0) / ids.length,
    tauxVente: ids.filter((id) => gmv.has(id)).length / ids.length,
    conversionPayante: ids.filter((id) => payants.has(id)).length / ids.length,
  };
  const actifsListe = [...actifs];
  const avecIA = groupe(actifsListe.filter((id) => utilisateurs.has(id)));
  const sansIA = groupe(actifsListe.filter((id) => !utilisateurs.has(id)));

  return {
    requetes, tokens, cout,
    coutParRequete: requetes ? cout / requetes : null,
    utilisateurs: utilisateurs.size,
    adoption: actifs.size ? utilisateurs.size / actifs.size : null,
    types: TYPES_IA.map((t) => { const x = parType.get(t)!; return { type: t, nom: NOM_TYPE_IA[t], requetes: x.requetes, tokens: x.tokens, cout: x.cout, marchands: x.marchands.size }; }),
    gmvUtilisateurs, revenuUtilisateurs,
    coutSurGmv: gmvUtilisateurs > 0 ? cout / gmvUtilisateurs : null,
    coutSurRevenu: revenuUtilisateurs > 0 ? cout / revenuUtilisateurs : null,
    avecIA, sansIA,
    top: [...parMarchand].map(([id, x]) => ({ id, nom: v.parId.get(id)?.nom ?? id, pays: v.parId.get(id)?.pays ?? "", ...x, gmv: gmv.get(id) ?? 0, commandes: commandes.get(id) ?? 0 }))
      .sort((a, b) => b.requetes - a.requetes),
  };
}
