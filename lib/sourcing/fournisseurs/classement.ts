// Best Supplier Engine — comparaison, classement et recommandation expliquée.
// Fonctions pures. Le « meilleur » fournisseur dépend du produit, du volume et
// du pays de destination : tout est calculé sur le coût rendu dans ce pays.
// Une recommandation n'affirme que ce que les données établissent ; le reste
// part dans les réserves.
import type { ProduitFournisseur } from "@prisma/client";
import { analyserFournisseur, qualiteConstatee } from "./analyse";
import { calculerCoutTotal, grillePrix, type CoutTotal, type HypothesesTco, type Logistique } from "./cout";
import type { AnalyseFournisseur, Contexte, Dossier } from "./types";

export interface Candidat {
  /** Identifiant de la ligne comparée : fournisseur + offre. */
  ref: string;
  fournisseur: Pick<Dossier, "id" | "nom" | "pays" | "typeEntreprise" | "url" | "email" | "telephone" | "personnalisation" | "privateLabel" | "packagingPerso" | "protectionPaiement">;
  offre: (Pick<ProduitFournisseur, "id" | "produitId" | "nomProduit" | "categorie" | "urlOffre" | "prixUnitaire" | "devise" | "moq" | "delaiProduction" | "confiance" | "disponible" | "derniereVerificationAt"> & { grille: ReturnType<typeof grillePrix> }) | null;
  cout: CoutTotal | null;
  /** Délai total annoncé (production + livraison), ou constaté s'il a été mesuré. */
  delaiJours: number | null; // null : aucun délai annoncé ni constaté
  analyse: AnalyseFournisseur;
}

export type ReglagesTco = Pick<HypothesesTco, "fraisInspection" | "tauxDefautHypothese" | "tauxRetour" | "tauxCapitalAnnuel">;

/**
 * Analyse chaque couple fournisseur / offre retenu. `comparables` : les offres
 * portent sur le même produit, leurs coûts servent donc à noter le prix de chacune.
 */
export function construireCandidats(
  dossiers: Dossier[],
  offresRetenues: (d: Dossier) => ProduitFournisseur[],
  logistique: Logistique,
  options: { comparables: boolean; sansOffre?: boolean; tco?: ReglagesTco; maintenant?: Date } = { comparables: false },
): Candidat[] {
  const delai = (d: Dossier, o: ProduitFournisseur | null) => qualiteConstatee(d).delaiReelMoyen ?? (d.delaiLivraison === null ? null : (o?.delaiProduction ?? 0) + d.delaiLivraison);
  const couples = dossiers.flatMap((d) => {
    const offres = offresRetenues(d);
    return offres.length ? offres.map((o) => ({ d, o: o as ProduitFournisseur | null })) : options.sansOffre ? [{ d, o: null }] : [];
  }).map(({ d, o }) => ({
    d, o,
    cout: o ? calculerCoutTotal(o, logistique, { ...options.tco, tauxDefautConstate: qualiteConstatee(d).tauxDefaut, delaiJours: delai(d, o) ?? 0 }) : null,
  }));
  const couts = options.comparables ? couples.flatMap((c) => (c.cout ? [c.cout.total] : [])) : undefined;

  return couples.map(({ d, o, cout }) => {
    const ctx: Contexte = { quantite: logistique.quantite, pays: logistique.pays, maintenant: options.maintenant, coutOffre: cout?.total, coutsComparables: couts };
    return {
      ref: `${d.id}:${o?.id ?? ""}`,
      fournisseur: { id: d.id, nom: d.nom, pays: d.pays, typeEntreprise: d.typeEntreprise, url: d.url, email: d.email, telephone: d.telephone, personnalisation: d.personnalisation, privateLabel: d.privateLabel, packagingPerso: d.packagingPerso, protectionPaiement: d.protectionPaiement },
      offre: o && { id: o.id, produitId: o.produitId, nomProduit: o.nomProduit, categorie: o.categorie, urlOffre: o.urlOffre, prixUnitaire: o.prixUnitaire, devise: o.devise, moq: o.moq, delaiProduction: o.delaiProduction, confiance: o.confiance, disponible: o.disponible, derniereVerificationAt: o.derniereVerificationAt, grille: grillePrix(o) },
      cout, delaiJours: ((j) => (j === null ? null : Math.round(j)))(delai(d, o)),
      analyse: analyserFournisseur(d, o, ctx),
    };
  });
}

export interface Trophee { ref: string; nom: string; raison: string }
export interface Classement { global: Trophee | null; meilleurPrix: Trophee | null; meilleurFabricant: Trophee | null; meilleurRisquePrix: Trophee | null }

const montant = (n: number, devise: string) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${devise}`;
const meilleur = <T,>(liste: T[], valeur: (x: T) => number) => liste.reduce<T | null>((m, x) => (m === null || valeur(x) < valeur(m) ? x : m), null);

/** Les quatre podiums d'un produit. Il faut au moins deux fournisseurs pour parler de « meilleur ». */
export function classer(candidats: Candidat[]): Classement | null {
  if (candidats.length < 2) return null;
  const chiffres = candidats.filter((c) => c.cout);
  const t = (c: Candidat | null, raison: (c: Candidat) => string): Trophee | null => c && { ref: c.ref, nom: c.fournisseur.nom, raison: raison(c) };
  return {
    // Meilleur score ; à score égal, le coût rendu le plus bas.
    global: t(meilleur(candidats, (c) => -c.analyse.score * 1e9 + (c.cout?.total ?? 1e8)), (c) => `Score ${c.analyse.score}/100, le plus élevé de la comparaison.`),
    meilleurPrix: t(meilleur(chiffres, (c) => c.cout!.total), (c) => `Coût réel estimé le plus bas : ${montant(c.cout!.total, c.cout!.devise)} par unité.`),
    meilleurFabricant: t(
      meilleur(candidats.filter((c) => c.analyse.fabricant.statut === "fabricant" || c.analyse.fabricant.statut === "fabricant_trading"), (c) => -c.analyse.fabricant.score),
      (c) => `${c.analyse.fabricant.libelle} — indice fabricant ${c.analyse.fabricant.score}/100.`),
    // Coût majoré du risque : chaque point de risque renchérit le coût de 1 %.
    meilleurRisquePrix: t(meilleur(chiffres, (c) => c.cout!.total * (1 + c.analyse.risque.points / 100)),
      (c) => `${montant(c.cout!.total, c.cout!.devise)} par unité pour ${c.analyse.risque.signaux.length} signal(aux) de risque.`),
  };
}

export interface Recommandation {
  ref: string;
  nom: string;
  score: number;
  /** false : meilleur disponible, mais pas assez de données ou risque élevé — AXSO ne le recommande pas tel quel. */
  ferme: boolean;
  /** Points réellement établis par les données (les « ✓ »). */
  raisons: string[];
  /** Ce qui reste déclaré, inconnu ou préoccupant. */
  reserves: string[];
  explication: string;
  alternative: { ref: string; nom: string; score: number } | null;
  meilleurPrix: { ref: string; nom: string; score: number } | null;
}

const ARGUMENTS: Record<string, string> = {
  moq: "son MOQ est mieux adapté à votre volume",
  fiabilite: "son historique de fiabilité est meilleur",
  risque: "son niveau de risque est plus faible",
  qualite: "sa qualité constatée est meilleure",
  certifications: "ses certifications sont mieux établies",
  fabricant: "son statut de fabricant est mieux établi",
  logistique: "ses délais sont plus courts",
  experience: "il a plus d'années d'activité",
  capacite: "sa capacité de production est plus solide",
};

/** Recommandation finale parmi les candidats comparés (aucun candidat : null). */
export function recommander(candidats: Candidat[], quantite?: number): Recommandation | null {
  if (!candidats.length) return null;
  const tries = [...candidats].sort((a, b) => b.analyse.score - a.analyse.score || (a.cout?.total ?? Infinity) - (b.cout?.total ?? Infinity));
  const r = tries[0];
  const a = r.analyse;
  const moinsCher = meilleur(candidats.filter((c) => c.cout), (c) => c.cout!.total);
  const couts = candidats.flatMap((c) => (c.cout ? [c.cout.total] : [])).sort((x, y) => x - y);
  const medianeCouts = couts.length >= 2 ? couts[Math.floor((couts.length - 1) / 2)] : null;

  const raisons: string[] = [];
  const reserves: string[] = [];
  const fabricant = a.fabricant.statut === "fabricant" || a.fabricant.statut === "fabricant_trading";
  if (fabricant && a.fabricant.confiance === "verifie") raisons.push("Fabricant identifié");
  else reserves.push(fabricant ? "Statut fabricant déclaré, non vérifié" : a.fabricant.libelle);
  if (a.certifications.length && a.certifications.every((c) => c.statut === "verifiee")) raisons.push("Certification vérifiée");
  else if (a.certifications.length) reserves.push(`Certifications non vérifiées : ${a.certifications.filter((c) => c.statut !== "verifiee").map((c) => c.code).join(", ")}`);
  if (r.offre?.moq != null && quantite && r.offre.moq <= quantite) raisons.push("MOQ adapté");
  else if (r.offre?.moq != null && quantite) reserves.push(`MOQ de ${r.offre.moq} unités, supérieur aux ${quantite} visées`);
  if (a.label.criteres.find((c) => c.cle === "historique")?.rempli) raisons.push("Bon historique");
  else reserves.push(a.qualite.nbEvaluations ? "Historique de commandes encore court" : "Aucune commande évaluée avec ce fournisseur");
  if (r.cout && medianeCouts !== null && r.cout.total <= medianeCouts) raisons.push("Coût rendu compétitif");
  if (a.risque.niveau === "faible") raisons.push("Faible risque");
  else reserves.push(...a.risque.signaux.map((s) => s.libelle), ...(a.risque.plancher ? [a.risque.plancher] : []));
  // Seul fait établi ici : le marchand a déjà commandé et noté ce fournisseur (la compatibilité avec un marché ne se mesure pas).
  if (a.qualite.nbEvaluations > 0) raisons.push("Déjà évalué sur vos commandes");

  let explication: string;
  if (candidats.length === 1) explication = `${r.fournisseur.nom} est le seul fournisseur disponible pour cette recherche : aucune comparaison possible.`;
  else if (!moinsCher || moinsCher.ref === r.ref) explication = `${r.fournisseur.nom} obtient le meilleur score${moinsCher ? " et le coût réel estimé le plus bas" : ""} de la comparaison.`;
  else {
    // Les trois critères où l'écart avec le moins cher est le plus net.
    const ecartNote = (cle: string) => (a.criteres.find((x) => x.cle === cle)?.note ?? 0) - (moinsCher.analyse.criteres.find((x) => x.cle === cle)?.note ?? 0);
    const mieux = Object.keys(ARGUMENTS).filter((cle) => ecartNote(cle) >= 10).sort((x, y) => ecartNote(y) - ecartNote(x)).slice(0, 3).map((cle) => ARGUMENTS[cle]);
    const ecart = r.cout && moinsCher.cout ? ` malgré un coût réel supérieur de ${montant(r.cout.total - moinsCher.cout.total, r.cout.devise)} par unité` : "";
    explication = `${r.fournisseur.nom} est recommandé${ecart}${mieux.length ? `, car ${new Intl.ListFormat("fr").format(mieux)}` : ""} face à ${moinsCher.fournisseur.nom}, le moins cher.`;
  }
  const etaye = a.confiance === "verifie" || a.confiance === "partiellement_verifie";
  const ferme = a.couverture >= 0.5 && a.risque.niveau !== "eleve" && etaye;
  if (!etaye) explication += " Son score repose surtout sur des informations déclarées, non vérifiées.";
  if (a.couverture < 0.5) explication += ` Score calculé sur ${Math.round(a.couverture * 100)} % des critères seulement : données insuffisantes pour une recommandation ferme.`;
  if (a.risque.niveau === "eleve") explication += " Risque élevé : à ne pas commander sans lever les alertes.";

  const court = (c: Candidat | null | undefined) => (c && c.ref !== r.ref ? { ref: c.ref, nom: c.fournisseur.nom, score: c.analyse.score } : null);
  return { ref: r.ref, nom: r.fournisseur.nom, score: a.score, ferme, raisons, reserves, explication, alternative: court(tries[1]), meilleurPrix: court(moinsCher) };
}
