// Supplier Intelligence — accès base de données (SERVEUR uniquement) : charge
// les dossiers fournisseurs de la boutique, applique le moteur pur (analyse,
// coût, classement) et tient à jour le cache des scores. La recherche ne porte
// QUE sur les fournisseurs réellement présents dans la base de la boutique :
// aucun fournisseur n'est inventé, et une recherche vide le dit.
import type { Prisma, ProduitFournisseur } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { notifierMarchand } from "@/lib/notifications-marchand";
import { contexteCalcul } from "../acces";
import { configPays } from "../pays";
import { MOTIFS_IMPUTABLES_FOURNISSEUR } from "../statuts";
import { classer, construireCandidats, recommander, type Candidat, type ReglagesTco } from "./classement";
import { etatDocument } from "./certifications";
import type { Logistique } from "./cout";
import { CHAMPS_COORDONNEES, type Dossier } from "./types";

const INCLURE = { offres: { orderBy: { createdAt: "desc" } }, documents: true, audits: true, echantillons: true, evaluations: true, verifications: true } satisfies Prisma.FournisseurInclude;

export const chargerDossiers = (tenantId: string, where: Prisma.FournisseurWhereInput = {}): Promise<Dossier[]> =>
  prisma.fournisseur.findMany({ where: { ...where, tenantId }, include: INCLURE, orderBy: { createdAt: "desc" }, take: 300 });

/** Paramètres d'envoi et hypothèses de la boutique (Sourcing → Pays & intégrations). */
export async function parametresBoutique(tenantId: string, quantite = 100) {
  const ctx = await contexteCalcul(tenantId);
  const r = ctx.reglages;
  const logistique: Logistique = {
    quantite: Math.max(1, Math.floor(quantite) || 1), pays: ctx.pays, deviseCible: ctx.devise, tauxChange: ctx.taux,
    tarifTransportKg: r.tarifTransportKg, fraisTransitaire: r.fraisTransitaire, fraisDedouanement: r.fraisDedouanement,
    livraisonLocale: r.livraisonLocale, tauxDroits: r.tauxDroits,
  };
  const tco: ReglagesTco = { tauxRetour: r.tauxRetour };
  return { logistique, tco, contexte: { pays: ctx.pays, paysNom: configPays(ctx.pays).nom, devise: ctx.devise, quantite: logistique.quantite } };
}

const norme = (s: string | null | undefined) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Deux offres portent sur le même produit : même produit du catalogue, ou même désignation. */
const memeProduit = (a: ProduitFournisseur, b: ProduitFournisseur) =>
  (!!a.produitId && a.produitId === b.produitId) || norme(a.nomProduit) === norme(b.nomProduit);

export interface Filtres {
  q?: string;
  /** Formulations alternatives du produit recherché (remplacent `q`). */
  termes?: string[];
  produitId?: string;
  /** Références « fournisseurId:offreId » à comparer (5 au plus). */
  refs?: string[];
  /** fabricant | fabricant_verifie | trading | grossiste | distributeur */
  type?: string;
  moqMax?: number;
  /** Prix unitaire maximum, dans la devise de la boutique. */
  prixMax?: number;
  certification?: string;
  quantite?: number;
  tco?: ReglagesTco;
}

/** Supplier Discovery, comparaison et meilleur fournisseur : une seule recherche, filtrée. */
export async function rechercher(tenantId: string, f: Filtres = {}) {
  const [{ logistique, tco, contexte }, tous] = await Promise.all([parametresBoutique(tenantId, f.quantite), chargerDossiers(tenantId, { actif: true })]);
  // Chaque terme est une formulation possible du produit (l'agent IA en propose plusieurs) : une seule suffit.
  const termes = (f.termes ?? [f.q]).map((t) => norme(t).split(" ").filter((m) => m.length > 1)).filter((t) => t.length);
  const refs = f.refs?.slice(0, 5);
  const certif = norme(f.certification).replace(/ /g, "");

  const retenues = (d: Dossier): ProduitFournisseur[] => {
    if (refs) return d.offres.filter((o) => refs.includes(`${d.id}:${o.id}`));
    if (f.produitId) return d.offres.filter((o) => o.produitId === f.produitId);
    if (!termes.length) return d.offres.slice(0, 1); // sans recherche : une ligne par fournisseur
    const duFournisseur = norme(`${d.nom} ${d.categoriesProduites.join(" ")}`);
    return d.offres.filter((o) => { const texte = `${norme(o.nomProduit)} ${norme(o.categorie)} ${duFournisseur}`; return termes.some((mots) => mots.every((m) => texte.includes(m))); });
  };
  const dossiers = tous.filter((d) => !certif || d.documents.some((x) => x.statutVerification !== "rejete" && norme(x.certification).replace(/ /g, "") === certif));
  // Les offres d'une recherche ciblée (texte, produit, sélection) sont comparables entre elles.
  const comparables = !!(refs || f.produitId || termes.length);
  let candidats = construireCandidats(
    refs ? dossiers.filter((d) => refs.some((r) => r.startsWith(`${d.id}:`))) : dossiers,
    retenues, logistique, { comparables, sansOffre: !!refs || !comparables, tco: { ...tco, ...f.tco } },
  );

  candidats = candidats.filter((c) => {
    const fab = c.analyse.fabricant;
    if (f.type === "fabricant_verifie" && !(fab.statut === "fabricant" && fab.confiance === "verifie")) return false;
    if (f.type === "fabricant" && !(c.fournisseur.typeEntreprise === "fabricant" || c.fournisseur.typeEntreprise === "fabricant_trading" || fab.statut === "fabricant")) return false;
    if (f.type && !f.type.startsWith("fabricant") && c.fournisseur.typeEntreprise !== f.type) return false;
    if (f.moqMax && !(c.offre?.moq != null && c.offre.moq <= f.moqMax)) return false;
    if (f.prixMax && !(c.cout && (c.cout.lignes.find((l) => l.cle === "produit")?.montant ?? Infinity) <= f.prixMax)) return false;
    return true;
  }).sort((a, b) => b.analyse.score - a.analyse.score);

  return {
    candidats,
    classement: comparables ? classer(candidats) : null,
    recommandation: comparables ? recommander(candidats, f.quantite) : null,
    contexte,
    /** Nombre de fournisseurs actifs dans la base de la boutique — pour un message honnête quand la recherche est vide. */
    totalFournisseurs: tous.length,
  };
}

/** Fiche complète d'un fournisseur : dossier + analyse de chacune de ses offres face aux offres comparables. */
export async function ficheFournisseur(tenantId: string, id: string, quantite?: number) {
  const [{ logistique, tco, contexte }, tous] = await Promise.all([parametresBoutique(tenantId, quantite), chargerDossiers(tenantId)]);
  const dossier = tous.find((d) => d.id === id);
  if (!dossier) return null;
  const actifs = tous.filter((d) => d.actif || d.id === id);
  const offres = dossier.offres.flatMap((o) => {
    const c = construireCandidats(actifs, (d) => d.offres.filter((x) => memeProduit(o, x)), logistique, { comparables: true, tco }).find((x) => x.ref === `${id}:${o.id}`);
    return c ? [c] : [];
  });
  // Vue d'ensemble : l'offre la plus récente, sinon le fournisseur seul.
  const principal = offres[0] ?? construireCandidats([dossier], () => [], logistique, { comparables: false, sansOffre: true, tco })[0];
  return { dossier, analyse: principal.analyse, offres, contexte };
}

// ponytail: chaque recalcul recharge les dossiers de la boutique (300 au plus) ; passer les dossiers déjà chargés si la tâche planifiée devient lente.
/** Recalcule l'analyse d'un fournisseur et met à jour le cache des scores. À appeler après toute modification. */
export async function recalculer(tenantId: string, id: string) {
  const fiche = await ficheFournisseur(tenantId, id);
  if (!fiche) return null;
  const note = (c: Candidat, cle: string) => c.analyse.criteres.find((x) => x.cle === cle)?.note ?? null;
  await prisma.$transaction([
    prisma.fournisseur.update({
      where: { id },
      data: { scoreGlobal: fiche.analyse.score, scoreFabricant: fiche.analyse.fabricant.score, niveauRisque: fiche.analyse.risque.niveau, labelVerifie: fiche.analyse.label.attribue, analyseLe: new Date() },
    }),
    ...fiche.offres.map((c) => prisma.produitFournisseur.update({
      where: { id: c.offre!.id },
      data: {
        scoreQualite: note(c, "qualite"), scoreCertification: note(c, "certifications"), scoreLogistique: note(c, "logistique"), scoreRisque: note(c, "risque"),
        scoreFournisseur: c.analyse.score, coutRenduTotal: c.cout?.total ?? null, coutRenduDevise: c.cout?.devise ?? null,
      },
    })),
  ]);
  return fiche;
}

// Champs d'un fournisseur que le marchand peut écrire. Tout ce qui relève de la
// vérification (niveaux de confiance, scores, label) est absent : calculé, ou
// réservé à un admin AXSO (/api/fournisseurs/[id]/verifier).
const vide = (v: unknown) => (v === "" ? null : v);
const txt = (max = 300) => z.preprocess(vide, z.string().trim().max(max).nullable().optional());
const nb = (min: number, max: number) => z.preprocess(vide, z.coerce.number().int().min(min).max(max).nullable().optional());
const oui = z.boolean().nullable().optional();
const liste = z.array(z.string().trim().min(1).max(120)).max(30).optional();
export const schemaFournisseur = z.object({
  nom: z.string().trim().min(2).max(200),
  pays: z.string().trim().min(2).max(80).optional(),
  type: z.string().trim().max(40).optional(),
  url: z.preprocess(vide, z.string().url().max(2000).nullable().optional()),
  email: z.preprocess(vide, z.string().email().max(200).nullable().optional()),
  telephone: txt(40),
  delaiLivraison: z.coerce.number().int().min(0).max(365).optional(),
  margeAuto: z.coerce.number().min(0).max(10).optional(),
  actif: z.boolean().optional(),
  notes: txt(5000),
  typeEntreprise: z.enum(["fabricant", "fabricant_trading", "trading", "grossiste", "distributeur", "inconnu"]).optional(),
  anneeCreation: nb(1800, 2100), nbEmployes: nb(1, 10_000_000),
  capaciteProduction: txt(), adresseUsine: txt(500), equipements: txt(2000), numeroLicence: txt(120), protectionPaiement: txt(120),
  categoriesProduites: liste, marchesExport: liste,
  photosUsine: z.array(z.string().url().max(2000)).max(20).optional(),
  videoUsine: z.preprocess(vide, z.string().url().max(2000).nullable().optional()),
  personnalisation: oui, privateLabel: oui, packagingPerso: oui, echantillonPossible: oui, inspectionAcceptee: oui,
  paiementHorsPlateforme: z.boolean().optional(),
});

/** Journalise les changements de coordonnées (des changements fréquents sont un signal de risque). */
export async function journaliserCoordonnees(tenantId: string, avant: Record<string, unknown>, apres: Record<string, unknown>) {
  const lignes = CHAMPS_COORDONNEES.filter((c) => apres[c] !== undefined && avant[c] && apres[c] !== avant[c])
    .map((c) => ({ tenantId, fournisseurId: avant.id as string, champ: c, niveau: "declare_fournisseur", source: "Modification par le marchand", note: `${avant[c]} → ${apres[c] ?? "(vide)"}` }));
  if (lignes.length) await prisma.verificationFournisseur.createMany({ data: lignes });
}

// Champs du fournisseur couverts par chaque vérification d'un admin AXSO.
const CHAMPS_COUVERTS: Record<string, readonly string[]> = {
  identite: ["nom", "email", "telephone", "url"],
  entreprise: ["nom", "pays", "typeEntreprise", "anneeCreation", "numeroLicence"],
  fabricant: ["typeEntreprise", "adresseUsine", "nbEmployes", "capaciteProduction", "equipements", "categoriesProduites", "marchesExport", "photosUsine", "videoUsine"],
};

/**
 * Une vérification ne vaut que pour ce qui a été contrôlé : si le marchand
 * modifie un champ couvert, elle retombe à « déclaré » (ligne au journal, la
 * dernière fait foi). Renvoie les vérifications retirées.
 */
export async function invaliderVerifications(tenantId: string, avant: Record<string, unknown>, apres: Record<string, unknown>) {
  const fournisseurId = avant.id as string;
  const modifie = (c: string) => apres[c] !== undefined && JSON.stringify(apres[c] ?? null) !== JSON.stringify(avant[c] ?? null);
  const journal = await prisma.verificationFournisseur.findMany({ where: { fournisseurId, champ: { in: Object.keys(CHAMPS_COUVERTS) } }, orderBy: { createdAt: "desc" } });
  const lignes = Object.entries(CHAMPS_COUVERTS).flatMap(([champ, couverts]) => {
    const modifies = couverts.filter(modifie);
    const niveau = journal.find((v) => v.champ === champ)?.niveau;
    if (!modifies.length || (niveau !== "verifie" && niveau !== "partiellement_verifie")) return [];
    return [{ tenantId, fournisseurId, champ, niveau: "declare_fournisseur", source: "Modification par le marchand", note: `Vérification retirée : ${modifies.join(", ")} modifié(s) après le contrôle.` }];
  });
  if (lignes.length) await prisma.verificationFournisseur.createMany({ data: lignes });
  return lignes.map((l) => l.champ);
}

/**
 * Reprend comme offres les produits du catalogue sourcing rattachés à ce
 * fournisseur (ProduitSource.fournisseurId). Jamais les produits « sandbox »
 * (démonstration) ; prix et MOQ restent « déclarés par le fournisseur ».
 */
export async function importerOffresCatalogue(tenantId: string, fournisseurId: string) {
  const [sources, existantes] = await Promise.all([
    prisma.produitSource.findMany({ where: { tenantId, fournisseurId, connecteur: { not: "sandbox" } } }),
    prisma.produitFournisseur.findMany({ where: { tenantId, fournisseurId }, select: { nomProduit: true } }),
  ]);
  const connues = new Set(existantes.map((o) => norme(o.nomProduit)));
  const nouvelles = sources.filter((s) => !connues.has(norme(s.nom)));
  if (nouvelles.length) await prisma.produitFournisseur.createMany({
    data: nouvelles.map((s) => ({
      tenantId, fournisseurId, produitId: s.produitId, nomProduit: s.nom, urlOffre: s.url, prixUnitaire: s.prixFournisseur, devise: s.deviseFournisseur,
      moq: s.moq, poidsKg: s.poidsKg, delaiProduction: Number((s.logistique as { delaiJours?: number } | null)?.delaiJours) || null,
      source: "connecteur", derniereVerificationAt: s.updatedAt,
    })),
  });
  return nouvelles.length;
}

// ─── Surveillance continue ───────────────────────────────────────────────────

const lien = (id: string) => `/dashboard/sourcing/fournisseurs/${id}`;

/**
 * Tâche planifiée : un fournisseur n'est pas « vérifié pour toujours ».
 * - alerte avant puis à l'expiration des certifications ;
 * - recalcul des scores, alerte quand de nouveaux signaux de risque apparaissent ;
 * - « Un meilleur fournisseur est maintenant disponible » quand, pour un produit
 *   du catalogue, une autre offre passe devant le fournisseur actuel.
 * Les prix et disponibilités ne sont PAS rafraîchis ici : aucun connecteur
 * fournisseur n'est branché, ils restent ceux saisis (date affichée sur l'offre).
 */
export async function surveiller(tenantId?: string, maintenant = new Date()) {
  const bilan = { boutiques: 0, fournisseurs: 0, alertesExpiration: 0, alertesRisque: 0, meilleursFournisseurs: 0 };
  const boutiques = tenantId ? [tenantId] : (await prisma.fournisseur.findMany({ where: { actif: true }, select: { tenantId: true }, distinct: ["tenantId"], take: 500 })).map((x) => x.tenantId);

  for (const tid of boutiques) {
    const [{ logistique, tco }, dossiers] = await Promise.all([parametresBoutique(tid), chargerDossiers(tid, { actif: true })]);
    bilan.boutiques++;

    for (const d of dossiers) {
      bilan.fournisseurs++;
      // Expiration des documents : une alerte dans les 60 jours, une autre le jour venu.
      for (const doc of d.documents) {
        if (!doc.dateExpiration) continue;
        const etat = etatDocument(doc, maintenant);
        const dejaAvant = !!doc.alerteExpirationLe;
        const dejaApres = !!doc.alerteExpirationLe && doc.alerteExpirationLe >= doc.dateExpiration;
        if (!etat.alerte || (etat.expire ? dejaApres : dejaAvant)) continue;
        await notifierMarchand({ tenantId: tid, type: "fournisseur_certification", titre: `${d.nom} — ${doc.certification ?? doc.nom}`, message: etat.alerte, lien: lien(d.id) });
        await prisma.documentFournisseur.update({ where: { id: doc.id }, data: { alerteExpirationLe: maintenant } });
        bilan.alertesExpiration++;
      }

      const fiche = await recalculer(tid, d.id);
      if (!fiche) continue;
      const signature = fiche.analyse.risque.signaux.map((s) => s.cle).sort().join(",");
      if (signature !== (d.signatureRisque ?? "")) {
        const anciens = new Set((d.signatureRisque ?? "").split(","));
        const nouveaux = fiche.analyse.risque.signaux.filter((s) => !anciens.has(s.cle));
        if (nouveaux.length) {
          await notifierMarchand({ tenantId: tid, type: "fournisseur_risque", titre: `AXSO RISK ALERT — ${d.nom}`, message: nouveaux.map((s) => `${s.libelle} : ${s.explication}`).join(" "), lien: lien(d.id) });
          bilan.alertesRisque++;
        }
        await prisma.fournisseur.update({ where: { id: d.id }, data: { signatureRisque: signature } });
      }
    }

    // Meilleur fournisseur par produit du catalogue (au moins deux offres à comparer)
    const parProduit = new Map<string, number>();
    for (const o of dossiers.flatMap((d) => d.offres)) if (o.produitId && o.disponible) parProduit.set(o.produitId, (parProduit.get(o.produitId) ?? 0) + 1);
    const ids = [...parProduit].filter(([, n]) => n >= 2).map(([id]) => id);
    const produits = ids.length ? await prisma.produit.findMany({ where: { tenantId: tid, id: { in: ids } }, select: { id: true, nom: true, fournisseurId: true } }) : [];
    for (const p of produits) {
      const candidats = construireCandidats(dossiers, (d) => d.offres.filter((o) => o.produitId === p.id && o.disponible), logistique, { comparables: true, tco, maintenant });
      const reco = recommander(candidats, logistique.quantite);
      const gagnant = reco?.ferme ? candidats.find((c) => c.ref === reco.ref) : undefined;
      const actuel = candidats.find((c) => c.fournisseur.id === p.fournisseurId);
      const offres = dossiers.flatMap((d) => d.offres).filter((o) => o.produitId === p.id);
      const dejaSignale = offres.find((o) => o.recommandeDepuis)?.id;
      const aSignaler = gagnant && actuel && gagnant.fournisseur.id !== p.fournisseurId ? gagnant.offre!.id : undefined;
      if (aSignaler === dejaSignale) continue;
      await prisma.produitFournisseur.updateMany({ where: { tenantId: tid, produitId: p.id }, data: { recommandeDepuis: null } });
      if (!aSignaler) continue;
      await prisma.produitFournisseur.update({ where: { id: aSignaler }, data: { recommandeDepuis: maintenant } });
      await notifierMarchand({
        tenantId: tid, type: "fournisseur_meilleur", titre: "Un meilleur fournisseur est maintenant disponible",
        message: `${p.nom} : ${gagnant!.fournisseur.nom} (${gagnant!.analyse.score}/100) passe devant ${actuel!.fournisseur.nom} (${actuel!.analyse.score}/100). ${reco!.explication}`,
        lien: `/dashboard/sourcing/fournisseurs?produitId=${p.id}`,
      });
      bilan.meilleursFournisseurs++;
    }
  }
  return bilan;
}

// ─── Demandes de devis : comparaison des réponses ────────────────────────────

const INCLURE_DEVIS = { reponses: { include: { fournisseur: { select: { id: true, nom: true, email: true, telephone: true } } }, orderBy: { createdAt: "asc" } } } satisfies Prisma.DemandeDevisInclude;

export const chargerDevis = (tenantId: string, id?: string) =>
  prisma.demandeDevis.findMany({ where: { tenantId, ...(id ? { id } : {}) }, include: INCLURE_DEVIS, orderBy: { createdAt: "desc" }, take: 100 });

/**
 * Comparaison automatique des réponses chiffrées d'une demande de devis : le
 * prix répondu remplace le prix catalogue, puis même moteur que la comparaison
 * de fournisseurs (coût réel rendu pour la quantité demandée, score, risque).
 */
export async function comparerReponses(tenantId: string, demande: Awaited<ReturnType<typeof chargerDevis>>[number]) {
  const chiffrees = demande.reponses.filter((r) => r.prixUnitaire);
  if (!chiffrees.length) return { candidats: [], classement: null, recommandation: null };
  const [{ logistique, tco }, dossiers] = await Promise.all([parametresBoutique(tenantId, demande.quantite), chargerDossiers(tenantId, { id: { in: chiffrees.map((r) => r.fournisseurId) } })]);
  const devis = (d: Dossier): ProduitFournisseur[] => chiffrees.filter((r) => r.fournisseurId === d.id).map((r) => {
    // Poids et catégorie viennent de l'offre connue du fournisseur pour ce produit, s'il y en a une.
    const connue = d.offres.find((o) => (demande.produitId && o.produitId === demande.produitId) || norme(o.nomProduit) === norme(demande.nomProduit));
    return {
      id: r.id, tenantId, fournisseurId: d.id, produitId: demande.produitId, nomProduit: demande.nomProduit, categorie: connue?.categorie ?? null, urlOffre: null,
      prixUnitaire: r.prixUnitaire!, devise: r.devise || demande.devise, paliers: [], moq: r.moq, delaiProduction: r.delaiJours, poidsKg: connue?.poidsKg ?? null,
      disponible: true, principal: connue?.principal ?? false, source: "devis", confiance: "declare_fournisseur", scoreQualite: null, scoreCertification: null, scoreLogistique: null, scoreRisque: null,
      scoreFournisseur: null, coutRenduTotal: null, coutRenduDevise: null, derniereVerificationAt: r.recuLe, recommandeDepuis: null, createdAt: r.createdAt, updatedAt: r.updatedAt,
    };
  });
  const candidats = construireCandidats(dossiers, devis, logistique, { comparables: true, tco }).sort((a, b) => b.analyse.score - a.analyse.score);
  return { candidats, classement: classer(candidats), recommandation: recommander(candidats, demande.quantite) };
}

// ── Historique réel des commandes fournisseur ────────────────────────────────
const AVANT_DEPART = ["en_attente", "envoye", "confirme"];
const ORDRE_CF = [...AVANT_DEPART, "expedie", "livre"];

/**
 * Fait avancer une commande fournisseur (jamais en arrière, rien après « livré » ou
 * « annulé ») et tient l'historique du fournisseur : une commande partie de chez lui
 * compte comme honorée, une annulation dont il est la cause comme un échec, les
 * autres annulations ne comptent pas. Renvoie false si la transition est refusée.
 */
export async function avancerCommandeFournisseur(tenantId: string, id: string, statut: string, donnees: { trackingNo?: string; reference?: string; notes?: string; motifAnnulation?: string } = {}): Promise<boolean> {
  const cf = await prisma.commandeFournisseur.findFirst({ where: { id, tenantId }, select: { statut: true, fournisseurId: true } });
  const precedents = statut === "annule" ? AVANT_DEPART : ORDRE_CF.slice(0, Math.max(0, ORDRE_CF.indexOf(statut)));
  if (!cf || !precedents.includes(cf.statut)) return false;
  // Le statut lu fait partie de la condition : deux clics simultanés ne comptent qu'une fois.
  const { count } = await prisma.commandeFournisseur.updateMany({ where: { id, tenantId, statut: cf.statut }, data: { statut, ...donnees } });
  if (!count) return false;
  const honoree = AVANT_DEPART.includes(cf.statut) && (statut === "expedie" || statut === "livre");
  const echec = statut === "annule" && MOTIFS_IMPUTABLES_FOURNISSEUR.includes(donnees.motifAnnulation ?? "");
  if (honoree || echec) {
    await prisma.fournisseur.update({ where: { id: cf.fournisseurId }, data: { livraisonsTotal: { increment: 1 }, ...(honoree ? { livraisonsOk: { increment: 1 } } : {}) } });
  }
  return true;
}
