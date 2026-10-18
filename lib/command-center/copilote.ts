// « Ask Axso » : reconnaît l'intention d'une question et y répond UNIQUEMENT avec
// des valeurs calculées par le moteur (aucun texte généré librement, aucune donnée
// inventée). Une explication non démontrée est marquée comme hypothèse.
import type { ContexteCC } from "./serveur";
import type { ReponseCopilote } from "@/components/command-center/Copilote";
import { mesurer, ventiler, METRIQUES, type Mesure } from "./moteur";
import { attribuer, entonnoir, statsMarchands, radarChurn, radarExpansion, impactFonctions, INSUFFISANT } from "./insights";
import { formats, T_FR } from "./format";
import type { T } from "@/lib/i18n";
import { nomPays, NOM_PLAN, PRIX_PLAN, PAYS } from "./types";
import { qs } from "./contexte";
import { peutVoir, sectionDe, type Section } from "./rbac";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const a = (q: string, ...mots: string[]) => mots.some((m) => q.includes(m));

type Rep = Omit<ReponseCopilote, "question">;
const metrBase = (m: Mesure, t: T = T_FR): Rep["metriques"][number] => ({ nom: t(m.nom), valeur: formats(t).formatValeur(m.valeur, m.format), variation: m.variation == null ? undefined : formats(t).formatVariation(m.variation, m.format), ton: m.statut === "bon" ? "good" : m.statut === "mauvais" ? "bad" : "neutre" });

export function repondre(c0: ContexteCC, question: string, t: T = T_FR): ReponseCopilote {
  const { formatValeur, formatVariation } = formats(t);
  const metr = (x: Mesure) => metrBase(x, t);
  const q = norm(question);
  // Un pays cité dans la question (« MRR Cameroun ») restreint le périmètre, comme le filtre pays.
  const iso = c0.filtres.pays ? null : Object.entries(PAYS).find(([, nom]) => q.includes(norm(nom)))?.[0];
  const c: ContexteCC = iso ? { ...c0, filtres: { ...c0.filtres, pays: iso }, vue: c0.vue.sous(`pays:${iso}`, () => new Set(c0.vue.marchands.filter((x) => x.pays === iso).map((x) => x.id))) } : c0;
  const v = c.vue, f = c.fen, ctx = qs(c.filtres);
  const href = (p: string) => p + ctx;
  const m = (id: string) => mesurer(v, id, f.cur, f.prev, 2);
  const voit = (s: Section) => peutVoir(c.session.role, s);
  const refus = (s: Section): ReponseCopilote | null => (voit(s) ? null : { question, reponse: t("Votre rôle ne donne pas accès à ces données."), preuves: [], metriques: [], entites: [], actions: [], confiance: "elevee", hypothese: false });
  const perimetre = c.filtres.pays ? t("Période : {0} ({1}) · périmètre : {2}.", t(f.libelle).toLowerCase(), t(f.libelleComp), t(nomPays(c.filtres.pays))) : t("Période : {0} ({1}).", t(f.libelle).toLowerCase(), t(f.libelleComp));
  const fin = (r: Rep): ReponseCopilote => ({ question, ...r, preuves: [...r.preuves, perimetre] });

  // 1. Plan pour augmenter le MRR
  if (a(q, "plan", "augmenter", "increase", "grow") && a(q, "mrr", "revenu", "revenue")) {
    const r = refus("revenus"); if (r) return r;
    const mrr = v.mrr(v.maintenant), cible = mrr * 1.2, ecart = cible - mrr;
    const stats = statsMarchands(v);
    const exp = radarExpansion(v, stats, t), churn = radarChurn(v, stats, c.reglages.poids_sante, t);
    const potExp = exp.reduce((s, e) => s + e.revenuPotentiel, 0);
    const risque = churn.reduce((s, x) => s + (v.mrrParMarchand(v.maintenant).get(x.marchand.id) ?? 0), 0);
    const gratuitsActifs = v.marchands.filter((x) => x.plan === "palier0" && (stats.get(x.id)?.commandes30 ?? 0) >= 5).length;
    const leviers = [
      { nom: t("Upgrades détectés (Expansion Radar)"), montant: potExp, detail: t("{0} marchands", exp.length) },
      { nom: t("MRR à sauver (Churn Radar)"), montant: risque, detail: t("{0} marchands à risque", churn.length) },
      { nom: t("Conversion de 10 % des gratuits actifs vers Pro"), montant: Math.round(gratuitsActifs * 0.1) * PRIX_PLAN.palier1, detail: t("{0} gratuits avec ≥ 5 commandes / 30 j", gratuitsActifs) },
    ];
    const couvert = leviers.reduce((s, l) => s + l.montant, 0);
    if (!mrr) return fin({ reponse: t("Le MRR actuel est nul : il n'y a pas encore de base pour calculer un plan de +20 %. Priorité : obtenir les premiers abonnements payants."), preuves: [], metriques: [], entites: [], actions: [{ titre: t("Voir les candidats à l'upgrade"), href: href("/admin/succes-client#expansion") }], confiance: "elevee", hypothese: false });
    return fin({
      reponse: t("Objectif : passer de {0} à {1} de MRR (+{2}).", formatValeur(mrr, "xaf"), formatValeur(cible, "xaf"), formatValeur(ecart, "xaf")) + "\n" + t(couvert >= ecart ? "Les trois leviers identifiés représentent {0}, soit {1} % de l'écart : l'objectif est atteignable si une partie suffisante de ces leviers est convertie." : "Les trois leviers identifiés représentent {0}, soit {1} % de l'écart : ils ne suffisent pas seuls, il faudra aussi de l'acquisition.", formatValeur(couvert, "xaf"), Math.round((couvert / ecart) * 100)),
      preuves: leviers.map((l) => `${l.nom} : ${formatValeur(l.montant, "xaf")} (${l.detail})`),
      metriques: [metr(m("mrr")), metr(m("churn")), metr(m("conversion_payante")), metr(m("nrr"))],
      entites: exp.slice(0, 5).map((e) => ({ nom: e.marchand.nom, detail: `→ ${t(e.planRecommande === "entreprise" ? "Grand compte" : NOM_PLAN[e.planRecommande])}`, href: href(`/admin/marchands/${e.marchand.id}`) })),
      actions: [
        { titre: t("Contacter les {0} candidats à l'upgrade", exp.length), href: href("/admin/succes-client#expansion") },
        { titre: t("Sécuriser les {0} marchands à risque", churn.length), href: href("/admin/succes-client") },
        { titre: t("Activer les gratuits les plus actifs (offre Pro)"), href: href("/admin/marchands?plan=palier0") },
      ],
      confiance: "moyenne", hypothese: true,
    });
  }

  // 2. Churn / marchands à risque
  if (a(q, "churn", "partir", "risque", "at risk", "quitter", "perdre")) {
    const r = refus("succes"); if (r) return r;
    const churn = radarChurn(v, statsMarchands(v), c.reglages.poids_sante, t);
    const total = churn.reduce((s, x) => s + x.revenuRisque, 0);
    const raisons = new Map<string, number>();
    for (const x of churn) for (const s of x.raisons) { const k = s.replace(/\d+/g, "N"); raisons.set(k, (raisons.get(k) ?? 0) + 1); }
    return fin({
      reponse: churn.length ? t(churn.length > 1 ? "{0} marchands présentent un risque de churn d'au moins 50 %, pour {1} de revenu mensuel en jeu. Le risque est un score calculé à partir de signaux d'activité (pas un modèle prédictif entraîné)." : "{0} marchand présente un risque de churn d'au moins 50 %, pour {1} de revenu mensuel en jeu. Le risque est un score calculé à partir de signaux d'activité (pas un modèle prédictif entraîné).", churn.length, formatValeur(total, "xaf")) : t("Aucun marchand générant du revenu ne présente actuellement de risque de churn élevé."),
      preuves: [...raisons].sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, n]) => t(n > 1 ? "Signal « {0} » chez {1} marchands" : "Signal « {0} » chez {1} marchand", k.replace("N", t("plusieurs")), n)),
      metriques: [metr(m("churn")), metr(m("nrr"))],
      entites: churn.slice(0, 8).map((x) => ({ nom: x.marchand.nom, detail: `${Math.round(x.risque * 100)} % · ${formatValeur(x.revenuRisque, "xaf")}`, href: href(`/admin/marchands/${x.marchand.id}`) })),
      actions: [{ titre: t("Ouvrir le Churn Radar"), href: href("/admin/succes-client") }, ...(churn[0] ? [{ titre: `${churn[0].action} (${churn[0].marchand.nom})` }] : [])],
      confiance: "moyenne", hypothese: false,
    });
  }

  // 3. Activation
  if (a(q, "activation", "onboarding")) {
    const r = refus("croissance"); if (r) return r;
    const fa = entonnoir(v, f.cur, t), fb = entonnoir(v, f.prev, t), mes = m("activation");
    const ecarts = fa.etapes.slice(1).map((e, i) => ({ nom: e.nom, a: e.tauxEtape, b: fb.etapes[i + 1].tauxEtape, d: e.tauxEtape - fb.etapes[i + 1].tauxEtape })).sort((x, y) => x.d - y.d);
    const assez = fa.etapes[0].nombre >= 20 && fb.etapes[0].nombre >= 20;
    const pire = ecarts[0];
    return fin({
      reponse: mes.valeur == null ? t("Pas assez d'inscriptions de plus de 14 jours sur la période pour mesurer l'activation.") : !assez ? `${t("Taux d'activation : {0} ({1}).", formatValeur(mes.valeur, "pct"), formatVariation(mes.variation, "pct"))} ${t(INSUFFISANT)}` : `${t("Taux d'activation : {0} ({1}).", formatValeur(mes.valeur, "pct"), formatVariation(mes.variation, "pct"))} ${t("L'étape qui a le plus reculé est « {0} » : {1} → {2} des marchands passent cette étape.", pire.nom, formatValeur(pire.b, "pct"), formatValeur(pire.a, "pct"))}`,
      preuves: ecarts.map((e) => `${e.nom} : ${formatValeur(e.b, "pct")} → ${formatValeur(e.a, "pct")}`),
      metriques: [metr(mes), metr(m("nouveaux_marchands"))],
      entites: [], actions: [{ titre: t("Analyser l'entonnoir d'activation"), href: href("/admin/croissance#activation") }],
      confiance: assez ? "elevee" : "faible", hypothese: false,
    });
  }

  // 4. Meilleurs marchés
  if (a(q, "marche", "market", "pays", "countr", "geograph")) {
    const r = refus("geographie"); if (r) return r;
    const cur = ventiler(v, "gmv", f.cur, "pays"), prev = ventiler(v, "gmv", f.prev, "pays");
    const pays = [...cur].map(([p, g]) => ({ p, g, cr: prev.get(p) ? (g - prev.get(p)!) / prev.get(p)! : null })).filter((x) => x.g > 0).sort((x, y) => y.g - x.g);
    if (!pays.length) return fin({ reponse: t("Aucun GMV sur la période : impossible de classer les marchés."), preuves: [], metriques: [], entites: [], actions: [], confiance: "elevee", hypothese: false });
    const croissance = pays.filter((x) => x.cr != null && x.g >= pays[0].g * 0.05).sort((x, y) => y.cr! - x.cr!)[0];
    return fin({
      reponse: t("Premier marché : {0} avec {1} de GMV.", t(nomPays(pays[0].p)), formatValeur(pays[0].g, "xaf")) + (croissance ? " " + t("Plus forte croissance : {0} ({1}).", t(nomPays(croissance.p)), formatVariation(croissance.cr, "nombre")) : ""),
      preuves: pays.slice(0, 5).map((x) => `${t(nomPays(x.p))} : ${formatValeur(x.g, "xaf")}${x.cr != null ? ` (${formatVariation(x.cr, "nombre")})` : ""}`),
      metriques: [metr(m("gmv")), metr(m("north_star"))],
      entites: pays.slice(0, 8).map((x) => ({ nom: t(nomPays(x.p)), detail: formatValeur(x.g, "xaf"), href: `/admin/geographie${qs(c.filtres, { pays: x.p })}` })),
      actions: [{ titre: t("Voir l'analyse géographique"), href: href("/admin/geographie") }],
      confiance: "elevee", hypothese: false,
    });
  }

  // 5. Fonctionnalités à promouvoir
  if (a(q, "fonctionnalit", "feature", "promouvoir", "promote")) {
    const r = refus("produit"); if (r) return r;
    const fns = impactFonctions(v, f).filter((x) => ["pos", "axia", "livraison", "marketing"].includes(x.fonction));
    const cotes = fns.filter((x) => x.gmvParAdopteur != null && x.gmvParAutre).map((x) => ({ ...x, ratio: x.gmvParAdopteur! / x.gmvParAutre! })).sort((x, y) => y.ratio - x.ratio);
    if (!cotes.length) return fin({ reponse: t("Pas assez de marchands (20 par groupe minimum) pour comparer l'effet des fonctionnalités."), preuves: [], metriques: [], entites: [], actions: [{ titre: t("Voir l'adoption des fonctionnalités"), href: href("/admin/produit") }], confiance: "faible", hypothese: false });
    const top = cotes[0];
    return fin({
      reponse: t("À promouvoir en priorité : {0}. Ses utilisateurs génèrent {1} plus de GMV que les autres marchands actifs, alors que seuls {2} des actifs l'utilisent. C'est une corrélation : les marchands déjà performants adoptent peut-être plus volontiers cette fonctionnalité.", t(top.nom), formatValeur(top.ratio, "ratio"), formatValeur(top.adoption, "pct")),
      preuves: cotes.map((x) => t("{0} : adoption {1}, GMV ×{2} vs non-utilisateurs", t(x.nom), formatValeur(x.adoption, "pct"), x.ratio.toFixed(2)) + (x.retentionAdopteurs != null && x.retentionAutres != null ? t(", rétention {0} vs {1}", formatValeur(x.retentionAdopteurs, "pct"), formatValeur(x.retentionAutres, "pct")) : "")),
      metriques: [metr(m("adoption_ia"))], entites: [],
      actions: [{ titre: t("Campagne de découverte de {0} auprès des non-utilisateurs", t(top.nom)), href: href("/admin/produit") }],
      confiance: "moyenne", hypothese: true,
    });
  }

  // 6. Meilleurs marchands
  if (a(q, "top", "meilleur", "best") && a(q, "marchand", "merchant", "boutique")) {
    const r = refus("marchands"); if (r) return r;
    const g = new Map<string, number>();
    for (const x of v.payees(f.cur)) g.set(x.marchandId, (g.get(x.marchandId) ?? 0) + x.montant);
    const top = [...g].sort((x, y) => y[1] - x[1]).slice(0, 10);
    const total = [...g.values()].reduce((s, x) => s + x, 0);
    return fin({
      reponse: top.length ? t("Les 10 premiers marchands réalisent {0} du GMV de la période. Premier : {1} ({2}).", formatValeur(top.reduce((s, x) => s + x[1], 0) / (total || 1), "pct"), v.parId.get(top[0][0])?.nom, formatValeur(top[0][1], "xaf")) : t("Aucune vente sur la période."),
      preuves: [], metriques: [metr(m("gmv")), metr(m("north_star"))],
      entites: top.map(([id, x]) => ({ nom: v.parId.get(id)?.nom ?? id, detail: formatValeur(x, "xaf"), href: href(`/admin/marchands/${id}`) })),
      actions: [{ titre: t("Ouvrir la table des marchands"), href: href("/admin/marchands") }], confiance: "elevee", hypothese: false,
    });
  }

  // 7. Paiements échoués
  if (a(q, "paiement", "payment", "echec", "failed")) {
    const r = refus("paiements"); if (r) return r;
    const ech = v.commandesW(f.cur).filter((x) => x.statut === "echouee");
    const parMethode = new Map<string, number>(), parPays = new Map<string, number>();
    for (const x of ech) { parMethode.set(x.methode, (parMethode.get(x.methode) ?? 0) + 1); const p = v.parId.get(x.marchandId)?.pays ?? "?"; parPays.set(p, (parPays.get(p) ?? 0) + 1); }
    const att = attribuer(v, "echecs_paiement", f, t);
    return fin({
      reponse: `${t(ech.length > 1 ? "{0} paiements échoués sur la période." : "{0} paiement échoué sur la période.", ech.length)} ${att?.texte ?? t(INSUFFISANT)}`,
      preuves: [...[...parMethode].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, n]) => t("Moyen « {0} » : {1} échecs", k, n)), ...[...parPays].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, n]) => t("{0} : {1} échecs", t(nomPays(k)), n))],
      metriques: [metr(m("succes_paiement")), metr(m("echecs_paiement"))], entites: [],
      actions: [{ titre: t("Analyser les paiements"), href: href("/admin/paiements") }], confiance: att ? "elevee" : "moyenne", hypothese: false,
    });
  }

  // 8. Axia IA
  if (a(q, "axia", " ia", "ai ", "intelligence", "ai usage")) {
    const r = refus("ia"); if (r) return r;
    return fin({
      reponse: t("Axia a reçu {0} requêtes pour un coût estimé de {1}. {2} des marchands actifs l'utilisent.", formatValeur(m("requetes_ia").valeur, "nombre"), formatValeur(m("cout_ia").valeur, "xaf"), formatValeur(m("adoption_ia").valeur, "pct")),
      preuves: [], metriques: [metr(m("requetes_ia")), metr(m("adoption_ia")), metr(m("cout_ia"))], entites: [],
      actions: [{ titre: t("Voir l'intelligence Axia"), href: href("/admin/ia") }], confiance: "elevee", hypothese: false,
    });
  }

  // 9. Une métrique nommée (« pourquoi le GMV a baissé ? », « MRR Cameroun »)
  const cible = METRIQUES.find((x) => q.includes(norm(x.nom)) || q.includes(x.id.replace("_", " "))) ?? (a(q, "revenu", "revenue") ? METRIQUES.find((x) => x.id === "revenu") : undefined);
  if (cible) {
    const r = refus(sectionDe(cible.page)); if (r) return r;
    const mes = m(cible.id);
    const att = cible.additive ? attribuer(v, cible.id, f, t) : null;
    const mouvements = cible.id === "mrr" || cible.id === "revenu" ? v.mouvementsMrr(f.cur) : null;
    // La question peut partir d'une prémisse fausse (« pourquoi ça a baissé ? » alors que ça monte) : on la corrige.
    const baisse = a(q, "baiss", "chut", "drop", "fall", "decline", "recul"), hausse = a(q, "hausse", "augment", "rise", "grow", "monte");
    const contredit = mes.variation != null && ((baisse && mes.variation > 0) || (hausse && mes.variation < 0)) ? t(baisse ? (mes.variation > 0 ? "{0} n'a pas baissé : il a progressé." : "{0} n'a pas baissé : il a reculé.") : (mes.variation > 0 ? "{0} n'a pas augmenté : il a progressé." : "{0} n'a pas augmenté : il a reculé."), t(cible.nom)) + " " : "";
    return fin({
      reponse: `${contredit}${t("{0} : {1} ({2} {3}).", t(cible.nom), formatValeur(mes.valeur, cible.format), formatVariation(mes.variation, cible.format), t(f.libelleComp))}\n${att ? att.texte : a(q, "pourquoi", "why", "cause") ? t(INSUFFISANT) : ""}`.trim(),
      preuves: [
        t("Définition : {0} ({1}).", t(cible.description), t(cible.formule)),
        t("Valeur de comparaison : {0}.", formatValeur(mes.precedente, cible.format)),
        ...(att?.segments.map((s) => `${s.nom} : ${s.delta > 0 ? "+" : "−"}${formatValeur(Math.abs(s.delta), cible.format)}`) ?? []),
        ...(mouvements ? [t("MRR : +{0} nouveau, +{1} expansion, −{2} contraction, −{3} churn", formatValeur(mouvements.nouveau, "xaf"), formatValeur(mouvements.expansion, "xaf"), formatValeur(mouvements.contraction, "xaf"), formatValeur(mouvements.churn, "xaf"))] : []),
      ],
      metriques: [metr(mes)], entites: [],
      actions: [{ titre: t("Explorer {0}", t(cible.nom)), href: href(cible.page) }],
      confiance: att ? "elevee" : "moyenne", hypothese: false,
    });
  }

  return {
    question,
    reponse: t("Je ne sais pas encore répondre à cette question avec les données disponibles. Essayez une métrique (MRR, GMV, churn, activation…), un pays, les marchands à risque, les meilleurs marchés ou les fonctionnalités à promouvoir."),
    preuves: [], metriques: [], entites: [], actions: [{ titre: t("Explorer les données"), href: href("/admin/explorer") }], confiance: "faible", hypothese: false,
  };
}

