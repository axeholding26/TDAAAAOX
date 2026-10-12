// Moteur de promotions de la caisse — PUR et CLIENT-SAFE (aucun accès base,
// aucun import serveur). `appliquerPromotions` (index.ts) en rend les remises ;
// `expliquerPromotions` rend en plus, pour chaque promotion, si elle a été
// appliquée ou écartée et pourquoi (écran de caisse, aperçu de la page Promotions).
//
// ─── FORMAT DE Promotion.regles ───────────────────────────────────────────────
// Conditions COMMUNES à tous les types (toutes facultatives) :
//   produitIds: string[]   articles concernés (vide ou absent = tous)
//   varianteIds: string[]  variantes concernées
//   categories: string[]   catégories concernées (nom, sans tenir compte de la casse)
//   segments: string[]     segments de clients admis (nouveau | regulier | fidele | inactif | grossiste)
//   clientIds: string[]    clients admis nommément
//   minPanier: number      montant minimal du panier (lignes non offertes, avant promotions)
// La période (dateDebut, dateFin), les magasins (magasinIds) et le coupon
// (codePromoId) sont des colonnes de Promotion, pas des règles.
//
// Par TYPE (`valeur` = colonne Promotion.valeur) :
//   pourcentage         valeur = % de remise sur chaque ligne concernée.
//   montant_fixe        valeur = montant ; regles.par = "unite" (défaut : par pièce ou par kilo,
//                       sur chaque ligne concernée) | "panier" (une fois, réparti sur les lignes concernées).
//   seuil_panier        regles.minPanier obligatoire ; regles.mode = "pourcentage" (défaut) | "montant" ;
//                       valeur = % ou montant, appliqué aux lignes concernées dès que le seuil est atteint.
//   x_pour_y            regles.x, regles.y (ex. 3 et 2 = « 3 pour le prix de 2 », le 2+1) : par groupe de x
//                       pièces, les (x − y) moins chères sont offertes. regles.memeArticle = true : les
//                       groupes se forment article par article, sinon sur l'ensemble des lignes concernées.
//   lot                 regles.composants = [{ produitId, varianteId?, quantite }] ; valeur = prix du lot.
//                       La remise est l'écart entre le prix normal des composants et le prix du lot.
//   achete_x_obtiens_y  regles.acheter = { produitIds?, categories?, quantite } ;
//                       regles.obtenir = { produitIds?, categories?, quantite } (absent = mêmes articles) ;
//                       valeur = % de remise sur les pièces obtenues (défaut 100 = offertes).
//   produit_offert      produitIds / categories = le cadeau ; regles.quantite (défaut 1) ;
//                       regles.declencheur = { produitIds?, categories?, quantite } facultatif ; minPanier facultatif.
//   prix_membre         regles.niveaux = { bronze?, silver?, gold?, vip? } : % de remise selon le niveau de
//                       fidélité du client (un client doit être associé à la vente).
//   prix_grossiste      regles.paliers = [{ minQuantite, prix? | pct? }] : à partir de minQuantite (pièces ou
//                       kilos) sur une ligne, prix unitaire `prix` ou remise `pct` %. regles.segments absent =
//                       ["grossiste"] ; [] = tout client, la quantité seule décide.
//
// Le moteur ne modifie jamais le contenu du panier : un article « offert » ou
// « obtenu » doit être dans le panier pour que sa remise s'applique.
// Les promotions à la pièce (x_pour_y, lot, achete_x_obtiens_y, produit_offert)
// ignorent les articles vendus au poids.
//
// ─── RÈGLES DE CUMUL ──────────────────────────────────────────────────────────
// 1. Une ligne offerte ou sans montant ne reçoit rien et ne compte dans aucun seuil.
// 2. Les promotions sont classées : priorité la plus haute, puis, à priorité
//    égale, la plus avantageuse pour le client, puis l'identifiant (départage stable).
// 3. La première promotion applicable est retenue. Une suivante n'est retenue
//    que si ELLE est cumulable ET que toutes celles déjà retenues le sont : une
//    promotion non cumulable exclut donc toutes les autres du panier.
// 4. Une ligne ne reçoit qu'UNE réduction : une promotion cumulable retenue
//    ensuite est recalculée sur les seules lignes encore libres.
// 5. Chaque réduction est bornée au montant net de sa ligne, arrondie à la devise.
import type { ContextePromotion, LignePromotion, PromotionActive, ReductionPromotion } from "./index";

export const TYPES_PROMOTION = ["pourcentage", "montant_fixe", "x_pour_y", "lot", "achete_x_obtiens_y", "seuil_panier", "produit_offert", "prix_membre", "prix_grossiste"] as const;
export type TypePromotion = (typeof TYPES_PROMOTION)[number];

export type DecisionPromotion = { promotionId: string; nom: string; statut: "appliquee" | "ecartee"; raison: string; montant: number };
export type ExplicationPromotions = { reductions: ReductionPromotion[]; decisions: DecisionPromotion[] };

type Regles = Record<string, unknown>;
/** Résultat d'une promotion : remise par index de ligne, ou la raison pour laquelle elle ne s'applique pas. */
type Effet = Map<number, number> | string;

const liste = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : []);
const nombre = (v: unknown, defaut = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : defaut);
const objet = (v: unknown): Regles => (v && typeof v === "object" && !Array.isArray(v) ? (v as Regles) : {});
const arr = (m: number, dec: number) => { const f = 10 ** dec; return Math.round((m + Number.EPSILON) * f) / f; };
const somme = (lignes: LignePromotion[]) => lignes.reduce((s, l) => s + l.net, 0);

/**
 * Ligne vendue au poids ? LignePromotion ne porte pas l'unité : on la déduit du
 * montant (grammes × prix au kilo / 1000). Seule confusion possible : une ligne
 * à la pièce remisée à plus de 99,9 % à la main.
 */
const auPoids = (l: LignePromotion, dec: number) => l.net <= (l.prixApplique * l.quantite) / 1000 + 0.5 / 10 ** dec;
/** Quantité en unités de vente : pièces, ou kilos. */
const unites = (l: LignePromotion, dec: number) => (auPoids(l, dec) ? l.quantite / 1000 : l.quantite);
const prixNet = (l: LignePromotion) => l.net / l.quantite;

function concerne(l: LignePromotion, cible: Regles): boolean {
  const produits = liste(cible.produitIds), variantes = liste(cible.varianteIds), categories = liste(cible.categories).map((c) => c.trim().toLowerCase());
  if (produits.length && !produits.includes(l.produitId)) return false;
  if (variantes.length && !(l.varianteId && variantes.includes(l.varianteId))) return false;
  if (categories.length && !categories.includes((l.categorie ?? "").trim().toLowerCase())) return false;
  return true;
}

/** Répartit un montant sur des lignes au prorata de leur net ; la dernière absorbe l'arrondi. */
function repartir(total: number, lignes: LignePromotion[], dec: number, poids: (l: LignePromotion) => number = (l) => l.net): Map<number, number> {
  const effet = new Map<number, number>();
  const base = lignes.reduce((s, l) => s + poids(l), 0);
  let reste = arr(Math.min(total, somme(lignes)), dec);
  const aRepartir = reste;
  lignes.forEach((l, i) => {
    const part = Math.min(l.net, i === lignes.length - 1 ? reste : arr((aRepartir * poids(l)) / base, dec));
    if (part > 0) effet.set(l.index, part);
    reste = arr(reste - part, dec);
  });
  return effet;
}

/** Offre `n` pièces (à `pct` %) en commençant par les moins chères. `dispo` = pièces encore utilisables par ligne. */
function offrirPieces(lignes: LignePromotion[], dispo: Map<number, number>, n: number, pct: number, dec: number): Map<number, number> {
  const effet = new Map<number, number>();
  for (const l of [...lignes].sort((a, b) => prixNet(a) - prixNet(b) || a.index - b.index)) {
    if (n <= 0) break;
    const pris = Math.min(n, dispo.get(l.index) ?? l.quantite);
    if (pris <= 0) continue;
    n -= pris;
    const montant = arr((prixNet(l) * pris * pct) / 100, dec);
    if (montant > 0) effet.set(l.index, (effet.get(l.index) ?? 0) + montant);
  }
  return effet;
}

/**
 * Effet d'UNE promotion sur les lignes `libres` (non offertes, montant > 0, pas
 * encore remisées par une autre promotion). `toutes` = toutes les lignes payantes
 * du panier (seuils et déclencheurs se jugent sur le panier entier).
 */
function evaluer(p: PromotionActive, libres: LignePromotion[], toutes: LignePromotion[], ctx: ContextePromotion): Effet {
  const r = objet(p.regles), dec = ctx.decimales, valeur = nombre(p.valeur);
  const client = ctx.client ?? null;

  if (!(TYPES_PROMOTION as readonly string[]).includes(p.type)) return "Type de promotion inconnu.";
  if (p.codePromoId && !(ctx.codePromoIds ?? []).includes(p.codePromoId)) return "Le code promo lié à cette promotion n'a pas été saisi.";
  const clients = liste(r.clientIds);
  if (clients.length && !(client && clients.includes(client.id))) return "Réservée à certains clients.";
  const segments = "segments" in r ? liste(r.segments) : p.type === "prix_grossiste" ? ["grossiste"] : [];
  if (segments.length && !(client?.segment && segments.includes(client.segment))) {
    return client ? "Le segment de ce client ne donne pas droit à cette promotion." : "Associez un client à la vente pour en bénéficier.";
  }
  const minPanier = nombre(r.minPanier);
  const panier = somme(toutes);
  if (minPanier > 0 && panier < minPanier) return `Le panier n'atteint pas le minimum requis (${minPanier}).`;

  const cibles = libres.filter((l) => concerne(l, r));
  const pieces = cibles.filter((l) => !auPoids(l, dec));
  const aucune = "Aucun article du panier n'est concerné.";

  switch (p.type as TypePromotion) {
    case "pourcentage":
    case "prix_membre": {
      let pct = valeur;
      if (p.type === "prix_membre") {
        if (!client) return "Prix membre : associez un client à la vente.";
        pct = nombre(objet(r.niveaux)[client.niveauFidelite ?? "bronze"]);
        if (!(pct > 0)) return "Le niveau de fidélité de ce client ne donne pas de prix membre.";
      }
      if (!(pct > 0)) return "Le pourcentage de remise n'est pas défini.";
      if (!cibles.length) return aucune;
      return new Map(cibles.map((l) => [l.index, arr((l.net * Math.min(pct, 100)) / 100, dec)]));
    }
    case "montant_fixe": {
      if (!(valeur > 0)) return "Le montant de la remise n'est pas défini.";
      if (!cibles.length) return aucune;
      if (r.par === "panier") return repartir(valeur, cibles, dec);
      return new Map(cibles.map((l) => [l.index, arr(valeur * unites(l, dec), dec)]));
    }
    case "seuil_panier": {
      if (!(minPanier > 0)) return "Le seuil du panier n'est pas défini.";
      if (!(valeur > 0)) return "La valeur de la remise n'est pas définie.";
      if (!cibles.length) return aucune;
      if (r.mode === "montant") return repartir(valeur, cibles, dec);
      return new Map(cibles.map((l) => [l.index, arr((l.net * Math.min(valeur, 100)) / 100, dec)]));
    }
    case "x_pour_y": {
      const x = Math.floor(nombre(r.x)), y = Math.floor(nombre(r.y));
      if (!(y >= 1 && x > y)) return "La règle « X pour le prix de Y » n'est pas définie.";
      const effet = new Map<number, number>();
      for (const groupe of r.memeArticle === true ? pieces.map((l) => [l]) : [pieces]) {
        const offertes = Math.floor(groupe.reduce((s, l) => s + l.quantite, 0) / x) * (x - y);
        for (const [i, m] of offrirPieces(groupe, new Map(), offertes, 100, dec)) effet.set(i, m);
      }
      return effet.size ? effet : `Il faut au moins ${x} articles concernés pour en bénéficier.`;
    }
    case "lot": {
      const composants = (Array.isArray(r.composants) ? r.composants : []).map(objet)
        .map((c) => ({ produitId: String(c.produitId ?? ""), varianteId: typeof c.varianteId === "string" && c.varianteId ? c.varianteId : null, quantite: Math.floor(nombre(c.quantite, 1)) }))
        .filter((c) => c.produitId && c.quantite >= 1);
      if (!composants.length || !(valeur >= 0) || p.valeur === null) return "La composition ou le prix du lot n'est pas défini.";
      const lignesDe = (c: (typeof composants)[number]) => pieces
        .filter((l) => l.produitId === c.produitId && (!c.varianteId || l.varianteId === c.varianteId))
        .sort((a, b) => prixNet(b) - prixNet(a) || a.index - b.index);
      /** Pièces prises par ligne pour `k` lots, ou null si le panier n'en contient pas assez. */
      const composer = (k: number): Map<number, number> | null => {
        const prises = new Map<number, number>();
        for (const c of composants) {
          let besoin = c.quantite * k;
          for (const l of lignesDe(c)) {
            const pris = Math.min(besoin, l.quantite - (prises.get(l.index) ?? 0));
            if (pris > 0) { prises.set(l.index, (prises.get(l.index) ?? 0) + pris); besoin -= pris; }
          }
          if (besoin > 0) return null;
        }
        return prises;
      };
      let k = Math.min(...composants.map((c) => Math.floor(lignesDe(c).reduce((s, l) => s + l.quantite, 0) / c.quantite)));
      let prises = k > 0 ? composer(k) : null;
      while (k > 1 && !prises) prises = composer(--k); // deux composants qui se disputent les mêmes lignes
      if (!prises) return "Le panier ne contient pas tous les articles du lot.";
      const dansLot = pieces.filter((l) => prises!.has(l.index));
      const valeurLot = (l: LignePromotion) => prixNet(l) * prises!.get(l.index)!;
      const remise = arr(dansLot.reduce((s, l) => s + valeurLot(l), 0) - valeur * k, dec);
      if (!(remise > 0)) return "Le prix du lot n'est pas inférieur au prix des articles.";
      return repartir(remise, dansLot, dec, valeurLot);
    }
    case "achete_x_obtiens_y": {
      const acheter = objet(r.acheter), obtenir = "obtenir" in r ? objet(r.obtenir) : acheter;
      const x = Math.floor(nombre(acheter.quantite)), y = Math.floor(nombre(obtenir.quantite, 1));
      const pct = p.valeur === null ? 100 : Math.min(valeur, 100);
      if (!(x >= 1 && y >= 1 && pct > 0)) return "La règle « achetez X, obtenez Y » n'est pas définie.";
      const libresPieces = libres.filter((l) => !auPoids(l, dec));
      const A = libresPieces.filter((l) => concerne(l, acheter)), G = libresPieces.filter((l) => concerne(l, obtenir));
      const communes = A.filter((l) => G.includes(l));
      const q = (ls: LignePromotion[]) => ls.reduce((s, l) => s + l.quantite, 0);
      const a = q(A) - q(communes), b = q(communes), g = q(G) - q(communes);
      // k applications : k·x pièces achetées (hors lignes communes d'abord), le reste peut être obtenu.
      const obtenues = (k: number) => (k * x > a + b ? -1 : Math.min(k * y, g + b - Math.max(0, k * x - a)));
      const kMax = Math.floor((a + b) / x);
      let k = 0;
      for (const essai of [Math.floor(a / x), Math.floor((a + b + g) / (x + y)), Math.floor((a + b + g) / (x + y)) + 1, Math.ceil((g + b) / y), kMax]) {
        const e = Math.max(0, Math.min(kMax, essai));
        if (obtenues(e) > obtenues(k) || (obtenues(e) === obtenues(k) && e < k)) k = e;
      }
      if (obtenues(k) <= 0) return `Il faut ${x} article(s) acheté(s) et ${y} article(s) à obtenir dans le panier.`;
      // Les pièces « achetées » sont prises sur les lignes communes les plus chères : les moins chères restent à offrir.
      const dispo = new Map<number, number>();
      let besoin = Math.max(0, k * x - a);
      for (const l of [...communes].sort((u, v) => prixNet(v) - prixNet(u) || u.index - v.index)) {
        const pris = Math.min(besoin, l.quantite);
        dispo.set(l.index, l.quantite - pris); besoin -= pris;
      }
      return offrirPieces(G, dispo, obtenues(k), pct, dec);
    }
    case "produit_offert": {
      if (!liste(r.produitIds).length && !liste(r.varianteIds).length && !liste(r.categories).length) return "L'article offert n'est pas défini.";
      const d = objet(r.declencheur);
      const requis = Math.floor(nombre(d.quantite, 1));
      if ("declencheur" in r && toutes.filter((l) => concerne(l, d)).reduce((s, l) => s + unites(l, dec), 0) < requis) {
        return "Le panier ne contient pas les articles qui déclenchent le cadeau.";
      }
      if (!pieces.length) return "Ajoutez l'article offert au panier pour en bénéficier.";
      return offrirPieces(pieces, new Map(), Math.max(1, Math.floor(nombre(r.quantite, 1))), 100, dec);
    }
    case "prix_grossiste": {
      const paliers = (Array.isArray(r.paliers) ? r.paliers : []).map(objet)
        .map((x) => ({ min: nombre(x.minQuantite), prix: typeof x.prix === "number" ? x.prix : null, pct: nombre(x.pct) }))
        .filter((x) => x.min > 0 && (x.prix !== null || x.pct > 0))
        .sort((u, v) => v.min - u.min);
      if (!paliers.length) return "Les paliers de prix de gros ne sont pas définis.";
      if (!cibles.length) return aucune;
      const effet = new Map<number, number>();
      for (const l of cibles) {
        const palier = paliers.find((x) => unites(l, dec) >= x.min);
        if (!palier) continue;
        const m = palier.prix !== null ? arr(l.net - palier.prix * unites(l, dec), dec) : arr((l.net * Math.min(palier.pct, 100)) / 100, dec);
        if (m > 0) effet.set(l.index, m);
      }
      return effet.size ? effet : `Quantité insuffisante : le prix de gros commence à ${paliers[paliers.length - 1].min}.`;
    }
  }
}

/** Borne l'effet au net de chaque ligne et retire les montants nuls. */
function borner(effet: Effet, lignes: LignePromotion[], dec: number): Effet {
  if (typeof effet === "string") return effet;
  const net = new Map(lignes.map((l) => [l.index, l.net]));
  const propre = new Map<number, number>();
  for (const [i, m] of effet) {
    const montant = Math.min(net.get(i) ?? 0, arr(m, dec));
    if (montant > 0) propre.set(i, montant);
  }
  return propre.size ? propre : "Aucune remise à appliquer sur ce panier.";
}

const total = (e: Effet) => (typeof e === "string" ? 0 : [...e.values()].reduce((s, m) => s + m, 0));

/** Remises des promotions sur un panier, avec la décision prise pour chacune. PURE. */
export function expliquerPromotions(lignes: LignePromotion[], promotions: PromotionActive[], contexte: ContextePromotion): ExplicationPromotions {
  const dec = contexte.decimales;
  const payantes = lignes.filter((l) => !l.offert && l.net > 0 && l.quantite > 0);
  const classees = promotions
    .map((p) => ({ p, apercu: borner(evaluer(p, payantes, payantes, contexte), payantes, dec) }))
    .sort((a, b) => b.p.priorite - a.p.priorite || total(b.apercu) - total(a.apercu) || (a.p.id < b.p.id ? -1 : a.p.id > b.p.id ? 1 : 0));

  const retenues: PromotionActive[] = [];
  const prises = new Set<number>();
  const reductions: ReductionPromotion[] = [];
  const decisions: DecisionPromotion[] = [];
  const ecarter = (p: PromotionActive, raison: string) => decisions.push({ promotionId: p.id, nom: p.nom, statut: "ecartee", raison, montant: 0 });

  for (const { p, apercu } of classees) {
    if (typeof apercu === "string") { ecarter(p, apercu); continue; }
    const bloquante = retenues.find((x) => !x.cumulable);
    if (bloquante) { ecarter(p, `« ${bloquante.nom} » passe avant (priorité ${bloquante.priorite}) et ne se cumule avec aucune autre promotion.`); continue; }
    if (retenues.length && !p.cumulable) { ecarter(p, `Non cumulable : « ${retenues[0].nom} » passe avant (priorité ${retenues[0].priorite}).`); continue; }

    const libres = payantes.filter((l) => !prises.has(l.index));
    const effet = retenues.length ? borner(evaluer(p, libres, payantes, contexte), libres, dec) : apercu;
    if (typeof effet === "string") { ecarter(p, "Les articles concernés bénéficient déjà d'une promotion plus prioritaire (une seule réduction par article)."); continue; }

    const devancee = classees.find((c) => c.p !== p && typeof c.apercu !== "string" && c.p.priorite === p.priorite && !retenues.includes(c.p));
    for (const [index, montant] of effet) { prises.add(index); reductions.push({ index, promotionId: p.id, nom: p.nom, montant }); }
    decisions.push({
      promotionId: p.id, nom: p.nom, statut: "appliquee", montant: arr(total(effet), dec),
      raison: retenues.length ? "Cumulable : appliquée sur les articles sans autre promotion."
        : classees.filter((c) => typeof c.apercu !== "string").length === 1 ? "Seule promotion applicable à ce panier."
        : devancee ? `Priorité ${p.priorite} ; à priorité égale, c'est la plus avantageuse pour le client.`
        : `Priorité la plus haute (${p.priorite}).`,
    });
    retenues.push(p);
  }
  return { reductions: reductions.sort((a, b) => a.index - b.index), decisions };
}
