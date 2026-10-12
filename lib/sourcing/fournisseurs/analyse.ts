// Supplier Intelligence — détection fabricant, moteur de risque, score /100 et
// label « AXSO Verified Supplier ». Fonctions PURES et explicables : chaque
// note donne sa raison et la confiance de la donnée dont elle vient.
//
// Principes :
// - une donnée seulement déclarée compte moins qu'une donnée vérifiée
//   (DECOTE_CONFIANCE) ; un critère sans donnée vaut 0 et abaisse la couverture ;
// - la qualité vient d'abord de ce que le marchand a constaté (évaluations après
//   commande, échantillons contrôlés), pas de ce que le fournisseur annonce ;
// - le risque n'est jamais « faible » tant que rien n'a été vérifié.
import type { ProduitFournisseur } from "@prisma/client";
import { certificationsRequises, documentVerifiable, etatCertifications, etatDocument } from "./certifications";
import {
  CHAMPS_COORDONNEES, CHAMPS_VERIFIABLES, DECOTE_CONFIANCE, TYPES_ENTREPRISE, niveauConfiance,
  type AnalyseFournisseur, type Contexte, type Critere, type CritereLabel, type DetectionFabricant,
  type Dossier, type IndiceFabricant, type NiveauConfiance, type NiveauRisque, type SignalRisque,
} from "./types";

const JOUR = 86_400_000;
const borne = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const moyenne = (ns: number[]) => (ns.length ? ns.reduce((s, n) => s + n, 0) / ns.length : null);
const mediane = (ns: number[]) => {
  const t = [...ns].sort((a, b) => a - b);
  return t.length % 2 ? t[(t.length - 1) / 2] : (t[t.length / 2 - 1] + t[t.length / 2]) / 2;
};

/** Confiance d'un champ du fournisseur : sa dernière ligne au journal ; sinon « déclaré » s'il est rempli. */
export function confianceChamp(d: Dossier, champ: string, rempli: boolean): { niveau: NiveauConfiance; source: string } {
  const ligne = d.verifications.filter((v) => v.champ === champ).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (ligne) return { niveau: niveauConfiance(ligne.niveau), source: ligne.source };
  return rempli ? { niveau: "declare_fournisseur", source: "Déclaré, non vérifié" } : { niveau: "inconnu", source: "Non renseigné" };
}

/** Qualité réellement constatée par le marchand sur ses commandes. */
export function qualiteConstatee(d: Dossier) {
  const recues = d.evaluations.reduce((s, e) => s + e.unitesRecues, 0);
  const defauts = d.evaluations.reduce((s, e) => s + e.unitesDefectueuses, 0);
  return {
    nbEvaluations: d.evaluations.length,
    tauxDefaut: recues > 0 ? defauts / recues : null,
    moyenne: moyenne(d.evaluations.map((e) => (e.qualite + e.conformite + e.emballage) / 3)),
    delaiReelMoyen: moyenne(d.evaluations.flatMap((e) => (e.delaiReelJours != null ? [e.delaiReelJours] : []))),
  };
}

// ─── Détection fabricant ─────────────────────────────────────────────────────

export function detecterFabricant(d: Dossier, maintenant = new Date()): DetectionFabricant {
  // Vérification d'ensemble « informations fabricant » par un admin AXSO : elle
  // couvre les indices d'usine ; sinon chaque indice garde sa propre confiance.
  const global = confianceChamp(d, "fabricant", false);
  const conf = (champ: string, rempli: boolean): NiveauConfiance =>
    !rempli ? "inconnu" : global.niveau === "verifie" || global.niveau === "partiellement_verifie" ? global.niveau : confianceChamp(d, champ, true).niveau;

  const licence = d.documents.filter((x) => x.type === "licence" || x.type === "document_entreprise")
    .map((x) => etatDocument(x, maintenant).confiance).sort((a, b) => DECOTE_CONFIANCE[b] - DECOTE_CONFIANCE[a])[0];
  const audit = d.audits.filter((a) => a.type === "audit_usine" && a.statut === "reussi")
    .map((a) => niveauConfiance(a.confiance)).sort((a, b) => DECOTE_CONFIANCE[b] - DECOTE_CONFIANCE[a])[0];
  const fabricantDeclare = d.typeEntreprise === "fabricant" || d.typeEntreprise === "fabricant_trading";
  const nbCat = d.categoriesProduites.length;

  const brut: [string, string, number, boolean, NiveauConfiance?][] = [
    ["type", "Se déclare fabricant", 12, fabricantDeclare],
    ["adresseUsine", "Adresse de l'usine", 10, !!d.adresseUsine],
    ["nbEmployes", "Nombre d'employés", 8, !!d.nbEmployes],
    ["capaciteProduction", "Capacité de production", 8, !!d.capaciteProduction],
    ["categoriesProduites", "Gamme spécialisée (5 catégories au plus)", 6, nbCat > 0 && nbCat <= 5],
    ["anneeCreation", "Années d'activité", 6, !!d.anneeCreation],
    ["photosUsine", "Photos de l'usine", 8, d.photosUsine.length > 0],
    ["videoUsine", "Vidéo de l'usine", 8, !!d.videoUsine],
    ["equipements", "Équipements de production", 6, !!d.equipements],
    ["marchesExport", "Marchés d'exportation", 4, d.marchesExport.length > 0],
    ["licence", "Licence ou document d'entreprise", 9, !!licence, licence],
    ["audit", "Audit usine réussi", 15, !!audit, audit],
  ];
  const indices: IndiceFabricant[] = brut.map(([cle, libelle, points, present, c]) => {
    const confiance = present ? c ?? conf(cle === "type" ? "typeEntreprise" : cle, true) : "inconnu";
    return { cle, libelle, points, present, confiance, obtenu: Math.round(points * DECOTE_CONFIANCE[confiance] * 10) / 10 };
  });
  const score = borne(indices.reduce((s, i) => s + i.obtenu, 0));
  const presents = indices.filter((i) => i.present).length;
  const verifie = global.niveau === "verifie" || audit === "verifie";

  let statut: DetectionFabricant["statut"];
  let libelle: string;
  if (presents < 3) { statut = "insuffisant"; libelle = "Informations insuffisantes"; }
  else if (["trading", "grossiste", "distributeur"].includes(d.typeEntreprise)) { statut = "trading"; libelle = TYPES_ENTREPRISE[d.typeEntreprise]; }
  else if (d.typeEntreprise === "fabricant_trading") { statut = "fabricant_trading"; libelle = "Fabricant + trading"; }
  else if (score >= 50) { statut = "fabricant"; libelle = verifie ? "Fabricant vérifié" : "Semble être un fabricant (non vérifié)"; }
  else { statut = "insuffisant"; libelle = fabricantDeclare ? "Se déclare fabricant — preuves insuffisantes" : "Informations insuffisantes"; }

  return {
    statut, libelle, score, indices,
    confiance: verifie ? "verifie" : presents >= 3 ? "declare_fournisseur" : "inconnu",
    source: verifie ? (global.niveau === "verifie" ? global.source : "Audit usine vérifié") : "Informations déclarées, non vérifiées",
  };
}

// ─── Moteur de risque ────────────────────────────────────────────────────────

const POINTS_GRAVITE = { 1: 10, 2: 20, 3: 35 } as const;

export function detecterRisques(d: Dossier, offre: ProduitFournisseur | null, fabricant: DetectionFabricant, ctx: Contexte = {}): AnalyseFournisseur["risque"] {
  const maintenant = ctx.maintenant ?? new Date();
  const signaux: SignalRisque[] = [];
  const signal = (cle: string, gravite: 1 | 2 | 3, libelle: string, explication: string) => signaux.push({ cle, gravite, libelle, explication });

  // Informations contradictoires
  if ((d.typeEntreprise === "fabricant") && d.categoriesProduites.length > 8)
    signal("informations_contradictoires", 2, "Informations contradictoires", `Se déclare fabricant mais annonce ${d.categoriesProduites.length} catégories de produits : profil habituel d'un revendeur.`);
  const docAvantCreation = d.anneeCreation ? d.documents.find((x) => x.dateEmission && x.dateEmission.getFullYear() < d.anneeCreation!) : undefined;
  if (docAvantCreation)
    signal("informations_contradictoires_dates", 2, "Informations contradictoires", `Le document « ${docAvantCreation.nom} » est daté d'avant l'année de création déclarée (${d.anneeCreation}).`);

  // Changement fréquent de coordonnées (journal des 90 derniers jours)
  const changements = d.verifications.filter((v) => (CHAMPS_COORDONNEES as readonly string[]).includes(v.champ) && maintenant.getTime() - v.createdAt.getTime() < 90 * JOUR).length;
  if (changements >= 3)
    signal("changement_coordonnees", 2, "Changement fréquent de coordonnées", `${changements} changements d'e-mail, de téléphone, de site ou d'adresse en 90 jours.`);

  // Certifications non vérifiables, documents incohérents
  const certificats = d.documents.filter((x) => x.certification);
  const nonVerifiables = certificats.filter((x) => x.statutVerification !== "verifie" && x.statutVerification !== "rejete" && !documentVerifiable(x));
  if (nonVerifiables.length)
    signal("certifications_non_verifiables", 2, "Certifications non vérifiables", `${nonVerifiables.map((x) => x.certification).join(", ")} : affirmée(s) sans document, numéro ou organisme émetteur permettant le contrôle.`);
  const rejetes = d.documents.filter((x) => x.statutVerification === "rejete");
  if (rejetes.length)
    signal("documents_rejetes", 3, "Incohérences dans les documents", `Document(s) rejeté(s) à la vérification : ${rejetes.map((x) => x.nom).join(", ")}.`);
  const datesFausses = d.documents.filter((x) => x.dateEmission && x.dateExpiration && x.dateExpiration < x.dateEmission);
  if (datesFausses.length)
    signal("documents_incoherents", 2, "Incohérences dans les documents", `Date d'expiration antérieure à la date d'émission : ${datesFausses.map((x) => x.nom).join(", ")}.`);
  const expires = certificats.filter((x) => etatDocument(x, maintenant).expire);
  if (expires.length)
    signal("certification_expiree", 1, "Certification expirée", `${expires.map((x) => x.certification).join(", ")} : document expiré, plus considéré comme vérifié.`);

  // Prix anormalement bas (face aux offres comparables de la recherche)
  if (ctx.coutOffre && ctx.coutsComparables && ctx.coutsComparables.length >= 3 && ctx.coutOffre < 0.5 * mediane(ctx.coutsComparables))
    signal("prix_anormalement_bas", 2, "Prix anormalement bas", "Coût inférieur de plus de 50 % à la médiane des offres comparables : qualité, contrefaçon ou arnaque à écarter avant de payer.");

  // Entreprise très récente
  if (d.anneeCreation && maintenant.getFullYear() - d.anneeCreation <= 1)
    signal("entreprise_recente", 1, "Entreprise très récente", `Créée en ${d.anneeCreation} : pas d'historique sur lequel s'appuyer.`);

  // Absence d'informations fabricant
  if (fabricant.indices.filter((i) => i.present).length < 3)
    signal("absence_infos_fabricant", 2, "Absence d'informations fabricant", "Ni usine, ni effectif, ni capacité de production renseignés : impossible de savoir à qui vous achetez.");

  // MOQ incohérent
  if (offre) {
    const paliers = Array.isArray(offre.paliers) ? (offre.paliers as { quantiteMin?: number; prix?: number }[]).filter((p) => p?.quantiteMin && p?.prix) : [];
    const tries = [...paliers].sort((a, b) => a.quantiteMin! - b.quantiteMin!);
    const sousMoq = offre.moq != null && tries.some((p) => p.quantiteMin! < offre.moq!);
    const nonDegressif = tries.some((p, i) => i > 0 && p.prix! > tries[i - 1].prix!);
    if ((offre.moq != null && offre.moq <= 0) || sousMoq || nonDegressif)
      signal("moq_incoherent", 1, "MOQ incohérent", sousMoq ? `Des paliers de prix commencent sous le MOQ annoncé (${offre.moq}).` : nonDegressif ? "Les prix augmentent avec la quantité au lieu de baisser." : "MOQ nul ou négatif.");
  }

  // Refus et pressions rapportés par le marchand
  if (d.echantillonPossible === false || d.echantillons.some((e) => e.statut === "refuse_par_fournisseur"))
    signal("refus_echantillon", 3, "Refus de fournir un échantillon", "Le fournisseur refuse l'envoi d'un échantillon avant commande.");
  if (d.inspectionAcceptee === false)
    signal("refus_inspection", 3, "Refus d'inspection", "Le fournisseur refuse une inspection par un tiers.");
  if (d.paiementHorsPlateforme)
    signal("paiement_hors_plateforme", 3, "Pression pour un paiement hors plateforme", "Demande de paiement en dehors d'un canal protégé : aucun recours en cas de litige.");

  // Qualité constatée
  const q = qualiteConstatee(d);
  if (q.tauxDefaut !== null && q.tauxDefaut > 0.05)
    signal("taux_defaut_eleve", q.tauxDefaut > 0.1 ? 3 : 2, "Taux de défaut élevé", `${(q.tauxDefaut * 100).toFixed(1)} % d'unités défectueuses constatées sur vos commandes.`);

  const points = signaux.reduce((s, x) => s + POINTS_GRAVITE[x.gravite], 0);
  let niveau: NiveauRisque = points >= 50 ? "eleve" : points >= 20 ? "moyen" : "faible";
  // Jamais « faible » sans au moins un élément vérifié ou constaté.
  const preuve = Object.keys(CHAMPS_VERIFIABLES).some((c) => confianceChamp(d, c, false).niveau === "verifie") || d.audits.some((a) => a.confiance === "verifie") || d.documents.some((x) => etatDocument(x, maintenant).confiance === "verifie")
    || d.echantillons.some((e) => e.verdict === "conforme") || d.evaluations.length > 0;
  let plancher: string | undefined;
  if (niveau === "faible" && !preuve) {
    niveau = "moyen";
    plancher = "Aucune donnée vérifiée ni commande évaluée : le risque ne peut pas être qualifié de faible.";
  }
  return { niveau, points, signaux, plancher };
}

// ─── Score fournisseur /100 ──────────────────────────────────────────────────

const POIDS = { prix: 15, qualite: 15, fabricant: 10, certifications: 10, experience: 7, capacite: 6, moq: 8, logistique: 9, fiabilite: 10, risque: 10 };

/** Analyse complète d'un fournisseur pour une de ses offres (ou aucune) dans un contexte donné. */
export function analyserFournisseur(d: Dossier, offre: ProduitFournisseur | null, ctx: Contexte = {}): AnalyseFournisseur {
  const maintenant = ctx.maintenant ?? new Date();
  const fabricant = detecterFabricant(d, maintenant);
  const risque = detecterRisques(d, offre, fabricant, ctx);
  const qualite = qualiteConstatee(d);
  const requises = certificationsRequises(offre?.categorie, offre?.nomProduit, ctx.pays);
  const certifications = etatCertifications(d.documents, requises.exigences, maintenant);
  const criteres: Critere[] = [];
  const critere = (cle: keyof typeof POIDS, libelle: string, note: number | null, raison: string, confiance: NiveauConfiance) =>
    criteres.push({ cle, libelle, poids: POIDS[cle], note: note === null ? null : borne(note), raison, confiance: note === null ? "inconnu" : confiance });

  // Prix : position du coût rendu face aux offres comparables
  if (offre && ctx.coutOffre && ctx.coutsComparables && ctx.coutsComparables.length >= 2) {
    const ratio = ctx.coutOffre / mediane(ctx.coutsComparables);
    critere("prix", "Prix", 100 - ((ratio - 0.7) / 0.6) * 100,
      `Coût rendu ${ratio <= 1 ? `${Math.round((1 - ratio) * 100)} % sous` : `${Math.round((ratio - 1) * 100)} % au-dessus de`} la médiane de ${ctx.coutsComparables.length} offres comparables.`,
      niveauConfiance(offre.confiance));
  } else critere("prix", "Prix", null, offre ? "Aucune offre comparable pour situer ce prix." : "Aucune offre enregistrée.", "inconnu");

  // Qualité : constatée par le marchand, sinon échantillon contrôlé
  const echantillon = d.echantillons.filter((e) => e.statut === "controle").sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  if (qualite.moyenne !== null) {
    const malus = Math.min(40, (qualite.tauxDefaut ?? 0) * 400);
    critere("qualite", "Qualité", qualite.moyenne * 20 - malus,
      `${qualite.moyenne.toFixed(1)}/5 sur ${qualite.nbEvaluations} commande(s) évaluée(s)${qualite.tauxDefaut !== null ? `, ${(qualite.tauxDefaut * 100).toFixed(1)} % de défauts` : ""}.`,
      qualite.nbEvaluations >= 3 ? "verifie" : "partiellement_verifie");
  } else if (echantillon) {
    const notes = Object.values((echantillon.checklist ?? {}) as Record<string, { note?: number }>).flatMap((p) => (typeof p?.note === "number" ? [p.note] : []));
    const m = moyenne(notes);
    critere("qualite", "Qualité", m === null ? null : m * 20 * DECOTE_CONFIANCE.partiellement_verifie,
      m === null ? "Échantillon reçu, checklist non remplie." : `Échantillon contrôlé : ${m.toFixed(1)}/5 — un seul lot, à confirmer sur une vraie commande.`, "partiellement_verifie");
  } else critere("qualite", "Qualité", null, "Aucune commande évaluée ni échantillon contrôlé : qualité inconnue.", "inconnu");

  // Fabricant
  critere("fabricant", "Fabricant", fabricant.indices.some((i) => i.present) ? fabricant.score : null,
    `${fabricant.libelle} — indice de confiance fabricant ${fabricant.score}/100.`, fabricant.confiance);

  // Certifications
  if (certifications.length) {
    const sansFichier = (c: (typeof certifications)[number]) => c.source === "Affirmée sans document";
    const total = certifications.reduce((s, c) => s + (c.statut === "verifiee" ? 1 : c.statut === "declaree" ? (sansFichier(c) ? 0.2 : 0.4) : 0), 0);
    const nb = (s: string) => certifications.filter((c) => c.statut === s).length;
    critere("certifications", "Certifications", (total / certifications.length) * 100,
      `${nb("verifiee")} vérifiée(s), ${nb("declaree")} déclarée(s), ${nb("non_trouvee")} non trouvée(s), ${nb("expiree")} expirée(s) sur ${certifications.length}.`,
      nb("verifiee") === certifications.length ? "verifie" : nb("verifiee") ? "partiellement_verifie" : nb("declaree") ? "declare_fournisseur" : "inconnu");
  } else critere("certifications", "Certifications", null, "Aucune certification présentée et aucune exigence connue pour ce produit.", "inconnu");

  // Expérience
  // La vérification de l'entreprise par un admin couvre son année de création.
  const cEntreprise = confianceChamp(d, "entreprise", false);
  const cAnnee = d.anneeCreation && cEntreprise.niveau === "verifie" ? cEntreprise : confianceChamp(d, "anneeCreation", !!d.anneeCreation);
  const ans = d.anneeCreation ? maintenant.getFullYear() - d.anneeCreation : null;
  critere("experience", "Expérience", ans === null ? null : Math.min(100, ans * 10) * DECOTE_CONFIANCE[cAnnee.niveau],
    ans === null ? "Année de création inconnue." : `${ans} an(s) d'activité (${cAnnee.source.toLowerCase()}).`, cAnnee.niveau);

  // Capacité
  const cCapacite = confianceChamp(d, "fabricant", !!(d.nbEmployes || d.capaciteProduction));
  const baseCapacite = d.nbEmployes ? (d.nbEmployes >= 200 ? 100 : d.nbEmployes >= 50 ? 75 : d.nbEmployes >= 10 ? 50 : 30) : d.capaciteProduction ? 50 : null;
  critere("capacite", "Capacité", baseCapacite === null ? null : baseCapacite * DECOTE_CONFIANCE[cCapacite.niveau],
    baseCapacite === null ? "Effectif et capacité de production inconnus." : [d.nbEmployes && `${d.nbEmployes} employés`, d.capaciteProduction].filter(Boolean).join(", ") + ` (${cCapacite.source.toLowerCase()}).`,
    cCapacite.niveau);

  // MOQ
  if (offre?.moq != null && offre.moq > 0) {
    const q = ctx.quantite;
    critere("moq", "MOQ", q ? (offre.moq <= q ? 100 : (q / offre.moq) * 100) : offre.moq <= 50 ? 100 : offre.moq <= 100 ? 85 : offre.moq <= 500 ? 60 : offre.moq <= 1000 ? 40 : 20,
      q ? (offre.moq <= q ? `MOQ ${offre.moq} : compatible avec ${q} unités.` : `MOQ ${offre.moq} : supérieur aux ${q} unités visées.`) : `MOQ ${offre.moq} unités.`,
      niveauConfiance(offre.confiance));
  } else critere("moq", "MOQ", null, "MOQ non communiqué.", "inconnu");

  // Logistique : délai constaté sinon annoncé, et desserte du pays
  const delaiAnnonce = d.delaiLivraison === null ? null : (offre?.delaiProduction ?? 0) + d.delaiLivraison;
  const delai = qualite.delaiReelMoyen ?? delaiAnnonce;
  const destination = ctx.pays?.toUpperCase();
  const horsZone = !!destination && d.marchesExport.length > 0 && !d.marchesExport.some((m) => m.toUpperCase() === destination || /afri|monde|world/i.test(m));
  if (delai === null) critere("logistique", "Logistique", null, "Délai de livraison non communiqué.", "inconnu");
  else critere("logistique", "Logistique", (delai <= 15 ? 100 : delai <= 30 ? 80 : delai <= 45 ? 60 : delai <= 60 ? 40 : 20) * (qualite.delaiReelMoyen !== null ? 1 : DECOTE_CONFIANCE.declare_fournisseur) - (horsZone ? 20 : 0),
    `${Math.round(delai)} jours ${qualite.delaiReelMoyen !== null ? "constatés en moyenne" : "annoncés"}${horsZone ? ` ; ${destination} absent des marchés d'exportation déclarés` : ""}.`,
    qualite.delaiReelMoyen !== null ? "verifie" : "declare_fournisseur");

  // Fiabilité : historique réel des commandes passées par AXSO et évaluations
  const tauxLivraison = d.livraisonsTotal > 0 ? (d.livraisonsOk / d.livraisonsTotal) * 100 : null;
  const relation = moyenne(d.evaluations.map((e) => (e.delai + e.communication + e.conformite) / 3));
  const fiabilites = [tauxLivraison, relation === null ? null : relation * 20].filter((n): n is number => n !== null);
  critere("fiabilite", "Fiabilité", moyenne(fiabilites),
    fiabilites.length
      ? [tauxLivraison !== null && `${d.livraisonsOk}/${d.livraisonsTotal} commandes honorées`, relation !== null && `délai, communication et conformité notés ${relation.toFixed(1)}/5`].filter(Boolean).join(" ; ") + "."
      : "Aucun historique de commande avec ce fournisseur.",
    d.livraisonsTotal + d.evaluations.length >= 3 ? "verifie" : "partiellement_verifie");

  // Risque
  critere("risque", "Risque", 100 - risque.points,
    risque.signaux.length ? `${risque.signaux.length} signal(aux) : ${risque.signaux.map((s) => s.libelle.toLowerCase()).join(", ")}.` : risque.plancher ?? "Aucun signal de risque détecté.",
    risque.plancher ? "declare_fournisseur" : "partiellement_verifie");

  const score = Math.round(criteres.reduce((s, c) => s + c.poids * (c.note ?? 0), 0) / 100);
  const couverture = criteres.reduce((s, c) => s + (c.note === null ? 0 : c.poids), 0) / 100;
  const poidsVerifie = criteres.reduce((s, c) => s + (c.note !== null && (c.confiance === "verifie" || c.confiance === "partiellement_verifie") ? c.poids : 0), 0) / 100;
  const confiance: NiveauConfiance = poidsVerifie >= 0.8 ? "verifie" : poidsVerifie >= 0.3 ? "partiellement_verifie" : couverture > 0 ? "declare_fournisseur" : "inconnu";

  return {
    score, couverture, confiance, criteres, fabricant, risque, certifications, qualite,
    noteConformitePays: requises.notePays,
    label: labelVerifie(d, fabricant, certifications, requises.exigences.length > 0, qualite, maintenant),
  };
}

// ─── Label « AXSO Verified Supplier » ────────────────────────────────────────

/** Critères explicites et auditables ; le label est calculé, jamais accordé à la main. */
function labelVerifie(
  d: Dossier, fabricant: DetectionFabricant, certifications: AnalyseFournisseur["certifications"],
  exigencesConnues: boolean, q: AnalyseFournisseur["qualite"], maintenant: Date,
): AnalyseFournisseur["label"] {
  const champ = (c: string) => confianceChamp(d, c, false);
  const verifs = d.documents.map((x) => etatDocument(x, maintenant));
  const docsVerifies = verifs.filter((e) => e.confiance === "verifie").length;
  const seDitFabricant = d.typeEntreprise === "fabricant" || d.typeEntreprise === "fabricant_trading";
  const echantillonOk = d.echantillons.some((e) => e.statut === "controle" && e.verdict === "conforme");
  const historiqueOk = q.nbEvaluations >= 3 && (q.moyenne ?? 0) >= 4;
  const c = (cle: string, libelle: string, rempli: boolean, raison: string, applicable = true): CritereLabel => ({ cle, libelle, rempli: applicable && rempli, applicable, raison });

  const criteres: CritereLabel[] = [
    c("identite", "Identité vérifiée", champ("identite").niveau === "verifie", champ("identite").niveau === "verifie" ? champ("identite").source : "Non vérifiée par AXSO."),
    c("entreprise", "Entreprise vérifiée", champ("entreprise").niveau === "verifie", champ("entreprise").niveau === "verifie" ? champ("entreprise").source : "Non vérifiée par AXSO."),
    c("fabricant", "Informations fabricant vérifiées", fabricant.confiance === "verifie", seDitFabricant ? fabricant.source : "Sans objet : ne se présente pas comme fabricant.", seDitFabricant),
    c("documents", "Documents vérifiés", docsVerifies > 0 && !verifs.some((e) => e.rejete), `${docsVerifies} document(s) vérifié(s) sur ${d.documents.length}.`),
    c("certifications", "Certifications vérifiées", certifications.length > 0 && certifications.every((x) => x.statut === "verifiee"),
      exigencesConnues ? `${certifications.filter((x) => x.statut === "verifiee").length}/${certifications.length} certification(s) attendue(s) vérifiée(s).` : "Sans objet : aucune exigence connue pour ce produit.", exigencesConnues),
    c("echantillon", "Échantillon contrôlé", echantillonOk, echantillonOk ? "Échantillon reçu et jugé conforme." : "Aucun échantillon contrôlé conforme."),
    c("historique", "Historique de commandes satisfaisant", historiqueOk, `${q.nbEvaluations} commande(s) évaluée(s)${q.moyenne !== null ? `, ${q.moyenne.toFixed(1)}/5` : ""} — il en faut 3 à 4/5 ou plus.`),
    c("defauts", "Faible taux de défaut", q.tauxDefaut !== null && q.tauxDefaut <= 0.02, q.tauxDefaut === null ? "Aucune unité contrôlée." : `${(q.tauxDefaut * 100).toFixed(1)} % de défauts constatés (seuil : 2 %).`),
  ];
  return { attribue: criteres.every((x) => !x.applicable || x.rempli), criteres };
}
