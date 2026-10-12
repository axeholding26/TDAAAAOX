// Caisse sans réseau — LOGIQUE PURE sur l'instantané local du catalogue :
// recherche, résolution d'un code lu, calcul du panier, vente hors ligne,
// stock local. Aucun navigateur ici : moteur.ts lit et écrit IndexedDB autour.
//
// Le calcul est celui du serveur (calculerPanier, repartirPaiements) appliqué
// aux prix, taxes, promotions et réglages de l'instantané. Ce que le serveur
// ne peut pas confirmer sans réseau est refusé ici, avec la raison : crédit,
// avoir, code promo.
import type { Demarrage } from "@/components/pos/caisse/api";
import { ErreurPos } from "../erreurs";
import { MODES_PAIEMENT, repartirPaiements } from "../paiements";
import type { PromotionActive } from "../promotions";
import { calculerPanier, decimalesDevise, libelleQuantite } from "../tarification";
import { cleArticle, type ArticleResolu, type DemandePaiementPos, type LigneDemande, type LignePanier, type PanierCalcule, type Remise, type ResultatVente } from "../types";
import { VERSION_MUTATION, numeroProvisoire, type Mutation, type VenteLocale } from "./file";

/** Version du format de l'instantané : la changer force un nouveau téléchargement. */
export const VERSION_INSTANTANE = 1;

/** Article de l'instantané (magasin IndexedDB « catalogue », clé `id` = produitId). */
export type ArticleLocal = ArticleResolu & { id: string };

/** Client gardé sur l'appareil : le strict nécessaire pour le retrouver et calculer ses prix. Ni e-mail, ni crédit, ni historique. */
export type ClientLocal = { id: string; nom: string; telephone: string | null; codeClient: string | null; segment: string | null; niveau: string | null; vuAt: number };

/** Fiche d'accompagnement de l'instantané (même magasin, clé `__meta`). */
export type MetaLocale = {
  id: "__meta";
  version: number;
  /** Date de l'instantané du catalogue (horloge du serveur) ; null = jamais téléchargé. */
  genereAt: string | null;
  /** Réponse de GET /api/pos/reglages au dernier démarrage en ligne : réglages, droits, caisse, session, moyens de paiement. */
  demarrage: Demarrage | null;
  caisses: unknown[];
  categories: { nom: string; articles: number }[];
  promotions: PromotionActive[];
  userId: string | null;
  derniereSynchroAt: string | null;
};

export const META_VIDE: MetaLocale = { id: "__meta", version: VERSION_INSTANTANE, genereAt: null, demarrage: null, caisses: [], categories: [], promotions: [], userId: null, derniereSynchroAt: null };

export function trierArticles<T extends ArticleResolu>(articles: T[]): T[] {
  return [...articles].sort((a, b) => a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" }) || a.produitId.localeCompare(b.produitId));
}

/** Même recherche que rechercherArticles (serveur) : nom, référence, marque, début du code-barres — variantes comprises. `articles` déjà triés. */
export function rechercherLocal<T extends ArticleResolu>(articles: T[], o: { q?: string | null; categorie?: string | null; curseur?: string | null; limite?: number }): { articles: T[]; curseurSuivant: string | null } {
  const limite = Math.min(Math.max(Math.floor(o.limite ?? 40), 1), 100);
  const terme = (o.q ?? "").trim().toLowerCase();
  const contient = (v: string | null | undefined) => !!v && v.toLowerCase().includes(terme);
  const commence = (v: string | null | undefined) => !!v && v.startsWith((o.q ?? "").trim());
  const trouves = articles.filter((a) =>
    a.actif && (!o.categorie || a.categorie === o.categorie) &&
    (!terme || contient(a.nom) || contient(a.sku) || contient(a.marque) || commence(a.codeBarres) || a.variantes.some((v) => contient(v.sku) || commence(v.codeBarres))));
  const debut = o.curseur ? trouves.findIndex((a) => a.produitId === o.curseur) + 1 : 0;
  const page = trouves.slice(debut, debut + limite);
  return { articles: page, curseurSuivant: debut + limite < trouves.length && page.length ? page[page.length - 1].produitId : null };
}

/** L'article vu comme l'une de ses variantes (même forme que le serveur quand le code lu est celui d'une variante). */
function commeVariante<T extends ArticleResolu>(a: T, varianteId: string): T {
  const v = a.variantes.find((x) => x.id === varianteId);
  if (!v) return a;
  return { ...a, varianteId: v.id, variante: `${v.nom}: ${v.valeur}`, prix: v.prix, cout: v.cout, image: v.image ?? a.image, sku: v.sku ?? a.sku, codeBarres: v.codeBarres ?? a.codeBarres, stock: v.stock, stockMagasin: v.stockMagasin };
}

/**
 * Article désigné par un code lu, dans l'instantané. Même ordre que le serveur
 * (resoudreCode) : code-barres de variante, de produit, référence de variante,
 * de produit, puis étiquette de balance « PP AAAAA GGGGG C ».
 * Les numéros de série ne sont pas dans l'instantané : un IMEI scanné hors
 * ligne n'est pas reconnu (scanner l'article, puis saisir le numéro).
 */
export function resoudreLocal<T extends ArticleResolu>(articles: T[], codeLu: string, prefixesPoids: string[]): T | null {
  const code = codeLu.trim();
  if (!code) return null;
  const parVariante = (champ: "codeBarres" | "sku") => {
    for (const a of articles) { const v = a.variantes.find((x) => x[champ] === code); if (v) return commeVariante(a, v.id); }
    return null;
  };
  const trouve = parVariante("codeBarres") ?? articles.find((a) => a.codeBarres === code) ?? parVariante("sku") ?? articles.find((a) => a.sku === code) ?? null;
  if (trouve) return trouve;
  // Étiquette de balance (même règle que decoderEanPoids de lib/pos/catalogue.ts, qui est un fichier serveur).
  if (/^\d{13}$/.test(code) && prefixesPoids.includes(code.slice(0, 2))) {
    const grammes = Number(code.slice(7, 12));
    const pese = grammes > 0 ? articles.find((a) => a.codeBarres === code.slice(0, 7) && a.uniteVente === "kg") : null;
    if (pese) return { ...pese, poidsGrammes: grammes };
  }
  return null;
}

/** Lignes d'une demande → lignes de calcul, aux prix de l'instantané. Mêmes refus que le serveur (preparerPanier). */
export function lignesLocales(articles: ArticleResolu[], lignes: LigneDemande[]): LignePanier[] {
  if (!lignes?.length) throw new ErreurPos("panier_vide", 400, "Le panier est vide. Ajoutez au moins un article.");
  const parId = new Map(articles.map((a) => [a.produitId, a]));
  return lignes.map((l) => {
    const a = parId.get(l.produitId);
    if (!a) throw new ErreurPos("introuvable", 404, "Un article du panier n'est pas dans le catalogue enregistré sur cet appareil. Retirez-le, ou attendez le retour du réseau.", { produitId: l.produitId });
    if (!a.actif) throw new ErreurPos("article_inactif", 409, `« ${a.nom} » a été désactivé et ne peut plus être vendu.`, { produitId: a.produitId });
    const v = l.varianteId ? a.variantes.find((x) => x.id === l.varianteId) : null;
    if (l.varianteId && !v) throw new ErreurPos("introuvable", 404, `Cette variante de « ${a.nom} » n'est pas dans le catalogue enregistré sur cet appareil.`, { produitId: a.produitId });
    if (!v && a.variantes.length) throw new ErreurPos("variante_requise", 422, `Choisissez une variante de « ${a.nom} ».`, { produitId: a.produitId });
    if (a.suiviSerie && l.quantite !== 1) throw new ErreurPos("serie_requise", 422, `« ${a.nom} » se vend à l'unité : un numéro de série par ligne.`, { produitId: a.produitId });
    if (a.suiviSerie && !l.numeroSerie?.trim() && !l.numeroSerieId) throw new ErreurPos("serie_requise", 422, `Scannez ou saisissez le numéro de série de « ${a.nom} ».`, { produitId: a.produitId });
    const variante = v ? `${v.nom}: ${v.valeur}` : null;
    return {
      ...l, varianteId: v?.id ?? null, nom: a.nom + (variante ? ` — ${variante}` : ""), variante,
      prixUnitaire: v?.prix ?? a.prix, uniteVente: a.uniteVente, tauxTVA: a.tauxTVA, cout: v?.cout ?? a.cout, categorie: a.categorie, image: null,
    };
  });
}

type DemandeLocale = { lignes: LigneDemande[]; clientId?: string | null; remise?: Remise | null; codePromo?: string | null };

/** Panier calculé sur l'appareil, avec les réglages et promotions de l'instantané. Lève ErreurPos comme le serveur. */
export function calculerLocal(articles: ArticleResolu[], meta: MetaLocale, d: DemandeLocale, client?: ClientLocal | null): PanierCalcule {
  const dem = meta.demarrage;
  if (!dem) throw new ErreurPos("hors_ligne", 0, "Cette caisse n'a pas encore été ouverte en ligne sur cet appareil : le mode hors ligne n'est pas prêt.");
  if (d.codePromo?.trim()) throw new ErreurPos("code_promo_hors_ligne", 422, "Un code promo ne peut pas être vérifié hors ligne. Retirez-le pour continuer, ou attendez le retour du réseau.");
  return calculerPanier(lignesLocales(articles, d.lignes), {
    tauxTVA: dem.boutique.tauxTVA, droits: dem.droits, devise: dem.boutique.devise,
    client: d.clientId ? { id: d.clientId, segment: client?.segment ?? null, niveauFidelite: client?.niveau ?? null } : null,
    promotions: dem.flags.smart_promotions ? meta.promotions : [],
    prixTTC: dem.reglages.taxes.prixTTC, plafondRemisePct: dem.reglages.remises.plafondPct, remise: d.remise ?? null, magasinId: dem.magasin?.id ?? null,
  });
}

/** Stock connu de l'appareil pour un article (ou une de ses variantes) : celui du magasin s'il est connu. */
export function stockLocal(a: ArticleResolu, varianteId?: string | null): number {
  const v = varianteId ? a.variantes.find((x) => x.id === varianteId) : null;
  return v ? v.stockMagasin ?? v.stock : a.stockMagasin ?? a.stock;
}

/**
 * Retire des quantités du stock local (ventes hors ligne). Rend les articles
 * modifiés (copies) : c'est aussi ce qu'on réapplique sur un instantané
 * fraîchement téléchargé tant que des ventes ne sont pas synchronisées.
 */
export function appliquerSorties<T extends ArticleResolu>(articles: T[], sorties: VenteLocale["sorties"]): T[] {
  const modifies = new Map<string, T>();
  for (const s of sorties) {
    const a = modifies.get(s.produitId) ?? articles.find((x) => x.produitId === s.produitId);
    if (!a) continue;
    const moins = (n: number | null) => (n === null ? null : n - s.quantite);
    modifies.set(s.produitId, {
      ...a, stock: a.stock - s.quantite, stockMagasin: moins(a.stockMagasin),
      variantes: a.variantes.map((v) => (v.id === s.varianteId ? { ...v, stock: v.stock - s.quantite, stockMagasin: moins(v.stockMagasin) } : v)),
    });
  }
  return [...modifies.values()];
}

/** Pourquoi un moyen de paiement ne peut pas servir hors ligne ; null s'il le peut. */
export function refusPaiementHorsLigne(mode: DemandePaiementPos["mode"]): string | null {
  if (mode === "credit") return "La vente à crédit est indisponible hors ligne : le plafond et l'encours du client ne peuvent être vérifiés que par le serveur.";
  if (mode === "avoir") return "Un avoir ne peut pas être utilisé hors ligne : son solde ne peut être vérifié et débité que par le serveur.";
  if (MODES_PAIEMENT[mode]?.statut === "a_connecter") return `${MODES_PAIEMENT[mode].libelle} : intégration en attente.`;
  return null;
}

export type EntreeVenteLocale = {
  articles: ArticleLocal[];
  meta: MetaLocale;
  /** Corps de la vente tel que l'écran l'envoie (sans la clé). */
  payload: Record<string, unknown>;
  cle: string;
  appareilId: string;
  caisseId: string | null;
  client?: ClientLocal | null;
  maintenant: Date;
};

export type VentePreparee =
  | { ok: false; code: string; message: string; status: number }
  | { ok: true; mutation: Mutation; resultat: ResultatVente & { provisoire: true }; articlesModifies: ArticleLocal[]; panier: PanierCalcule };

/**
 * Vente saisie sans réseau : calcul local, contrôle des paiements et du stock
 * connu, numéro provisoire, mutation à mettre en file. N'écrit rien.
 */
export function preparerVenteLocale(e: EntreeVenteLocale): VentePreparee {
  try {
    const dem = e.meta.demarrage;
    if (!dem) throw new ErreurPos("hors_ligne", 0, "Cette caisse n'a pas encore été ouverte en ligne sur cet appareil : le mode hors ligne n'est pas prêt.");
    if (!dem.droits.vendre || !dem.droits.encaisser) throw new ErreurPos("non_autorise", 403, "Votre compte n'a pas le droit d'encaisser une vente.");
    if (dem.sessionObligatoire && !dem.session) throw new ErreurPos("caisse_fermee", 409, "La caisse est fermée, et elle ne peut être ouverte qu'avec le réseau.");
    const d = e.payload as DemandeLocale & { paiements?: DemandePaiementPos[] };
    const paiements = d.paiements ?? [];
    for (const p of paiements) {
      const def = MODES_PAIEMENT[p.mode];
      if (!def || !dem.reglages.paiements.modes.includes(p.mode)) throw new ErreurPos("mode_desactive", 422, `Le moyen de paiement « ${def?.libelle ?? p.mode} » n'est pas activé dans les réglages de la caisse.`);
      const refus = refusPaiementHorsLigne(p.mode);
      if (refus) throw new ErreurPos("paiement_hors_ligne", 422, refus);
      if (def.reference === "obligatoire" && !p.reference?.trim()) throw new ErreurPos("invalide", 400, `Indiquez la référence (${def.libelle.toLowerCase()}).`);
    }

    const panier = calculerLocal(e.articles, e.meta, d, e.client);
    const refus = panier.alertes.find((a) => a.bloquant);
    if (refus) throw new ErreurPos(refus.code, 403, refus.message);
    const repartition = repartirPaiements(panier.total, paiements, decimalesDevise(dem.boutique.devise));
    if (repartition.reste > 0) throw new ErreurPos("paiement_incomplet", 422, "Le paiement ne couvre pas le total de la vente.", { reste: repartition.reste });

    // Stock connu de l'appareil : même règle stricte qu'en ligne, sauf si la boutique vend sans stock.
    const quantites = new Map<string, VenteLocale["sorties"][number]>();
    for (const l of panier.lignes) {
      const cle = cleArticle(l.produitId, l.varianteId);
      const cumul = quantites.get(cle) ?? { produitId: l.produitId, varianteId: l.varianteId ?? null, quantite: 0 };
      quantites.set(cle, { ...cumul, quantite: cumul.quantite + l.quantite });
    }
    const sorties = [...quantites.values()];
    if (!dem.reglages.stock.venteSansStock) {
      for (const s of sorties) {
        const a = e.articles.find((x) => x.produitId === s.produitId)!;
        const connu = stockLocal(a, s.varianteId);
        if (connu < s.quantite) {
          throw new ErreurPos("stock_insuffisant", 409, `Stock insuffisant pour « ${a.nom} » d'après le dernier stock connu de cet appareil (${libelleQuantite(Math.max(0, connu), a.uniteVente)}). La vente n'a pas été enregistrée.`, { produitId: s.produitId });
        }
      }
    }

    const numero = numeroProvisoire(e.cle, e.maintenant);
    const local: VenteLocale = {
      numero, total: panier.total, paye: repartition.paye, monnaie: repartition.monnaie,
      sessionCaisseId: dem.session?.id ?? null, catalogueAt: e.meta.genereAt,
      prix: panier.lignes.map((l) => l.prixUnitaire), sorties,
    };
    const mutation: Mutation = {
      cle: e.cle, type: "vente", payload: e.payload, appareilId: e.appareilId, userId: dem.utilisateur.id, caisseId: e.caisseId,
      creeLocalAt: e.maintenant.toISOString(), version: VERSION_MUTATION, tentatives: 0, statut: "en_attente", local,
    };
    return {
      ok: true, mutation, panier, articlesModifies: appliquerSorties(e.articles, sorties),
      resultat: { commandeId: `local:${e.cle}`, numero, total: panier.total, paye: repartition.paye, du: 0, monnaie: repartition.monnaie, rejoue: false, provisoire: true },
    };
  } catch (err) {
    if (err instanceof ErreurPos) return { ok: false, code: err.code, message: err.message, status: err.status };
    throw err;
  }
}
