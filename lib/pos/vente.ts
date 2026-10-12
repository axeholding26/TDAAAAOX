// Vente en caisse — enregistrement et annulation. SERVEUR uniquement.
//
// Une vente en caisse est une `Commande` (canal = "pos", statut « livree ») :
// elle hérite ainsi du stock, des retours, des factures, des analytics et
// d'AXIA sans rien dupliquer. Autour d'elle : PaiementVente (un ou plusieurs
// règlements), SessionCaisse, JournalAudit, EvenementPos.
//
// CE QUE LE SERVEUR FAIT FOI
// - Prix, coûts, TVA, promotions, remises, total : relus en base et recalculés
//   ici (calculerPanier). Du panier reçu, on ne garde que : quel article,
//   quelle quantité, et les gestes commerciaux saisis — eux-mêmes soumis aux
//   droits du caissier (remise, plafond, prix personnalisé, produit offert).
// - Idempotence : `DemandeVente.cle`. La même clé ne crée jamais deux ventes ;
//   rejouée, elle rend la vente d'origine (`rejoue: true`).
// - Tout ou rien : commande, lignes, stock, paiements, crédit, fidélité,
//   facture, audit et événements sont écrits dans UNE transaction.
//
// CHIFFRE D'AFFAIRES ET CRÉDIT — une vente à crédit compte dans le CA dès la
// vente (paiementStatut = payé, comme toute vente de caisse). Ce qui est
// réellement encaissé est suivi à part : Commande.montantPaye ; le reste est au
// compte du client (Client.creditUtilise, MouvementCredit).
//
// CLIENT — une vente peut se faire sans client (clientId = null, « Client
// comptoir »). Avec un client, elle est rattachée au VRAI Client de la boutique
// (historique, fidélité, crédit) — plus de client fictif « pos@local ».
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { CANAL, PAIEMENT } from "../commandes";
import { RuptureStock, sortirStock } from "../stock";
import { libererCommande } from "../remboursement";
import { formatMontant, genererNumeroCommande, genererNumeroFacture } from "../utils";
import { ErreurPos } from "./erreurs";
import { exigerDroit, exigerMagasin } from "./droits";
import { lireReglagesPos, sessionObligatoire } from "./flags";
import { journaliserAudit } from "./audit";
import { publierEvenement } from "./evenements";
import { avecIdempotence, avecRepriseCollision, mutationConnue } from "./idempotence";
import { arrondir, calculerPanier, decimalesDevise, libelleQuantite, prixLigneCommande } from "./tarification";
import { MODES_PAIEMENT, ajouterPaiement, repartirPaiements } from "./paiements";
import { compterUtilisations, promotionsActives } from "./promotions";
import { derniersAchats, segmentClient } from "./promotions/segments";
import { libererCredit } from "./credit";
import { crediterPoints, reprendrePoints } from "./fidelite";
import { normaliserSerie } from "./types";
import type { ContextePos, DemandeVente, LigneDemande, LignePanier, PanierCalcule, Remise, ReglagesPosComplets, ResultatVente } from "./types";

type Tx = Prisma.TransactionClient;

export type DemandePanier = Pick<DemandeVente, "lignes" | "clientId" | "remise" | "codePromo">;

/**
 * REJEU D'UNE VENTE SAISIE HORS LIGNE — ce que le serveur accepte de l'appareil.
 * La vente a eu lieu : la marchandise est partie au prix que la caisse connaissait.
 * `prix[i]` = prix catalogue connu de l'appareil pour la ligne i ; `total` = montant
 * encaissé. Le serveur enregistre à ces montants SANS élever les droits du caissier
 * (ses propres gestes — remise, prix modifié, article offert — restent soumis à ses
 * droits), mais seulement si l'écart avec l'état actuel du serveur reste dans
 * SEUIL_ECART_REJEU. Au-delà, rien n'est enregistré (409 « ecart_a_valider ») tant
 * qu'un responsable n'a pas validé (`valide` : il lui faut les droits
 * « prix_personnalise » et « remise_hors_plafond »).
 */
export type OptionsRejeu = { prix: (number | null | undefined)[]; total: number; valide?: boolean };

/**
 * Écart maximal accepté automatiquement entre un montant annoncé par un appareil
 * hors ligne et celui du serveur : 20 %, par ligne (prix catalogue) et sur le total.
 * Assez large pour une hausse de prix ou une promotion terminée pendant la coupure,
 * assez étroit pour qu'un appareil trafiqué ne brade pas le magasin sans validation.
 */
export const SEUIL_ECART_REJEU = 0.2;

const SELECTION_PRODUIT = {
  id: true, nom: true, prix: true, cout: true, type: true, actif: true, images: true, categorie: true,
  uniteVente: true, tauxTVA: true, suiviSerie: true, garantieMois: true,
  variantes: { select: { id: true, nom: true, valeur: true, prix: true, cout: true, actif: true, image: true } },
} satisfies Prisma.ProduitSelect;
type ProduitVente = Prisma.ProduitGetPayload<{ select: typeof SELECTION_PRODUIT }>;

export type PanierPrepare = {
  panier: PanierCalcule;
  reglages: ReglagesPosComplets;
  devise: string;
  tauxTVA: number;
  pays: string;
  client: { id: string; nom: string; email: string | null; telephone: string | null; segment: string | null; niveauFidelite: string } | null;
  codePromoId: string | null;
  produits: Map<string, ProduitVente>;
  /** Rejeu hors ligne : lignes au prix imposé par l'appareil, et écart de total absorbé (0 = aucun). */
  rejeu: { figees: number; ajustement: number } | null;
};

/**
 * Relit en base tout ce qu'un panier engage (articles, client, code promo,
 * promotions, réglages) et le calcule. Ne modifie rien : sert à l'aperçu
 * (POST /api/pos/ventes/calculer) comme à la vente.
 */
export async function preparerPanier(ctx: ContextePos, d: DemandePanier, rejeu?: OptionsRejeu): Promise<PanierPrepare> {
  if (!d.lignes?.length) throw new ErreurPos("panier_vide", 400, "Le panier est vide. Ajoutez au moins un article.");
  const ids = [...new Set(d.lignes.map((l) => l.produitId))];
  const [reglages, tenant, produits, client, codePromo] = await Promise.all([
    lireReglagesPos(ctx.tenantId),
    prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { devise: true, tauxTVA: true, pays: true } }),
    prisma.produit.findMany({ where: { id: { in: ids }, tenantId: ctx.tenantId }, select: SELECTION_PRODUIT }),
    d.clientId
      ? prisma.client.findFirst({ where: { id: d.clientId, tenantId: ctx.tenantId }, select: { id: true, nom: true, email: true, telephone: true, segment: true, niveauFidelite: true, totalCommandes: true } })
      : null,
    d.codePromo?.trim()
      ? prisma.codePromo.findFirst({ where: { tenantId: ctx.tenantId, code: { equals: d.codePromo.trim(), mode: "insensitive" }, actif: true } })
      : null,
  ]);
  if (d.clientId && !client) throw new ErreurPos("introuvable", 404, "Ce client est introuvable dans cette boutique.");
  if (d.codePromo?.trim() && !codePromo) throw new ErreurPos("code_promo_invalide", 422, "Ce code promo n'existe pas ou n'est plus actif.");

  const parId = new Map(produits.map((p) => [p.id, p]));
  const lignes: LignePanier[] = d.lignes.map((l) => {
    const p = parId.get(l.produitId);
    if (!p) throw new ErreurPos("introuvable", 404, "Un article du panier n'existe plus dans cette boutique. Retirez-le puis réessayez.", { produitId: l.produitId });
    if (!p.actif) throw new ErreurPos("article_inactif", 409, `« ${p.nom} » a été désactivé et ne peut plus être vendu.`, { produitId: p.id });
    const actives = p.variantes.filter((v) => v.actif);
    const v = l.varianteId ? p.variantes.find((x) => x.id === l.varianteId) : null;
    if (l.varianteId && !v) throw new ErreurPos("introuvable", 404, `Cette variante de « ${p.nom} » n'existe plus.`, { produitId: p.id });
    if (!v && actives.length) throw new ErreurPos("variante_requise", 422, `Choisissez une variante de « ${p.nom} ».`, { produitId: p.id });
    if (p.suiviSerie && l.quantite !== 1) throw new ErreurPos("serie_requise", 422, `« ${p.nom} » se vend à l'unité : un numéro de série par ligne.`, { produitId: p.id });
    if (p.suiviSerie && !l.numeroSerie?.trim() && !l.numeroSerieId) throw new ErreurPos("serie_requise", 422, `Scannez ou saisissez le numéro de série de « ${p.nom} ».`, { produitId: p.id });
    const variante = v ? `${v.nom}: ${v.valeur}` : null;
    return {
      ...l, varianteId: v?.id ?? null,
      nom: p.nom + (variante ? ` — ${variante}` : ""), variante,
      prixUnitaire: v?.prix ?? p.prix, uniteVente: p.uniteVente === "kg" ? "kg" : "piece",
      tauxTVA: p.tauxTVA, cout: v?.cout ?? p.cout, categorie: p.categorie, image: v?.image ?? p.images[0] ?? null,
    };
  });

  const promotions = reglages.flags.smart_promotions ? await promotionsActives(prisma, ctx.tenantId, { magasinId: ctx.magasinId }) : [];
  // Les promotions ciblent le segment EFFECTIF du client (fixé à la main, sinon déduit de ses achats).
  const segment = client && promotions.length
    ? segmentClient(client, (await derniersAchats(prisma, ctx.tenantId, [client.id])).get(client.id) ?? null).segment
    : client?.segment ?? null;
  const options = {
    tauxTVA: tenant.tauxTVA, droits: ctx.droits, client: client && { ...client, segment }, promotions, devise: tenant.devise,
    prixTTC: reglages.reglages.taxes.prixTTC, plafondRemisePct: reglages.reglages.remises.plafondPct,
    remise: d.remise as Remise | null | undefined, codePromo, magasinId: ctx.magasinId,
  };
  const commun = { reglages, devise: tenant.devise, tauxTVA: tenant.tauxTVA, pays: tenant.pays, client, codePromoId: codePromo?.id ?? null, produits: parId };
  if (!rejeu) return { ...commun, panier: calculerPanier(lignes, options), rejeu: null };

  // Rejeu hors ligne : prix de l'appareil imposé là où le catalogue a changé (sauf geste du caissier, jugé sur ses droits).
  const dec = decimalesDevise(tenant.devise);
  const lignesFigees = new Set<number>();
  const ecarts: { article: string; prixLocal: number; prixServeur: number }[] = [];
  let horsSeuil = false;
  lignes.forEach((l, i) => {
    const local = rejeu.prix[i];
    if (local === null || local === undefined || local === l.prixUnitaire || l.offert || (l.prixPersonnalise !== null && l.prixPersonnalise !== undefined)) return;
    lignesFigees.add(i);
    ecarts.push({ article: l.nom, prixLocal: local, prixServeur: l.prixUnitaire });
    if (Math.abs(local - l.prixUnitaire) > SEUIL_ECART_REJEU * l.prixUnitaire) horsSeuil = true;
    l.prixPersonnalise = local;
  });
  // Total : si le serveur calcule davantage que le montant encaissé, l'écart est retiré comme une remise
  // (tracée à part) ; s'il calcule moins, la vente est écrite à son total et l'écart est signalé par l'appelant.
  let panier = calculerPanier(lignes, { ...options, rejeu: { lignesFigees, ajustement: 0 } });
  const totalServeur = panier.total;
  const ajustement = Math.max(0, arrondir(totalServeur - rejeu.total, dec));
  if (ajustement > SEUIL_ECART_REJEU * totalServeur) horsSeuil = true;
  if (horsSeuil) {
    if (!rejeu.valide) {
      const pct = Math.round(SEUIL_ECART_REJEU * 100);
      const detail = ecarts.filter((e) => Math.abs(e.prixLocal - e.prixServeur) > SEUIL_ECART_REJEU * e.prixServeur)
        .map((e) => `« ${e.article} » encaissé ${formatMontant(e.prixLocal, tenant.devise)}, prix actuel ${formatMontant(e.prixServeur, tenant.devise)}`).join(" ; ");
      throw new ErreurPos("ecart_a_valider", 409,
        `Cette vente hors ligne s'écarte de plus de ${pct} % des prix actuels${detail ? ` (${detail})` : ` (${formatMontant(rejeu.total, tenant.devise)} encaissés, ${formatMontant(totalServeur, tenant.devise)} attendus)`}. Elle n'a pas été enregistrée : un responsable doit la valider depuis l'écran Synchronisation de cette caisse.`,
        { ecarts, totalLocal: rejeu.total, totalServeur, seuilPct: pct });
    }
    exigerDroit(ctx, "prix_personnalise");
    exigerDroit(ctx, "remise_hors_plafond");
  }
  if (ajustement > 0) panier = calculerPanier(lignes, { ...options, rejeu: { lignesFigees, ajustement } });
  return { ...commun, panier, rejeu: { figees: lignesFigees.size, ajustement } };
}

/** Âge maximal d'une heure de vente annoncée par un appareil : au-delà (horloge déréglée), la vente est datée de sa réception. */
const AGE_MAX_VENTE_LOCALE_MS = 30 * 24 * 3600_000;

/**
 * Heure réelle d'une vente saisie sur l'appareil (hors ligne), ou null pour « maintenant ».
 * L'horloge d'un appareil n'est pas fiable : jamais dans le futur (2 min de tolérance), jamais
 * plus vieille que AGE_MAX_VENTE_LOCALE_MS. Une vente en ligne (écart < 2 min) garde l'heure du serveur.
 */
export function dateVente(creeLocalAt: string | null | undefined, maintenant: number = Date.now()): Date | null {
  const t = creeLocalAt ? new Date(creeLocalAt).getTime() : NaN;
  if (!Number.isFinite(t) || t > maintenant - 120_000 || maintenant - t > AGE_MAX_VENTE_LOCALE_MS) return null;
  return new Date(t);
}

/** Compteur Produit.ventes : +quantité par ligne, +1 pour une ligne au poids (des grammes n'ont pas de sens ici). */
async function compterVentesCaisse(tx: Tx, lignes: { produitId: string; quantite: number; mesure: number | null }[], sens: 1 | -1) {
  const parProduit = new Map<string, number>();
  for (const l of lignes) parProduit.set(l.produitId, (parProduit.get(l.produitId) ?? 0) + (l.mesure !== null ? 1 : l.quantite));
  for (const [id, n] of parProduit) await tx.produit.update({ where: { id }, data: { ventes: { increment: sens * n } } });
}

/** Même jour N mois plus tard, ramené au dernier jour du mois quand il n'existe pas (31 janvier + 1 mois = 28 ou 29 février). */
function ajouterMois(date: Date, mois: number): Date {
  const d = new Date(date);
  const jour = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + mois);
  d.setDate(Math.min(jour, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return d;
}

/**
 * Marque « vendu » le numéro de série d'une ligne. Refuse un numéro déjà vendu,
 * d'un autre article ou d'une autre variante. Un numéro jamais enregistré est
 * créé à la volée, sauf réglage « numéros enregistrés uniquement ».
 */
async function vendreNumeroSerie(tx: Tx, ctx: ContextePos, p: { ligne: LigneDemande; produit: ProduitVente; varianteId: string | null; commandeId: string; ligneCommandeId: string; clientId: string | null; enregistresUniquement: boolean }): Promise<string> {
  const numero = normaliserSerie(p.ligne.numeroSerie);
  const existant = await tx.numeroSerie.findFirst({
    where: { tenantId: ctx.tenantId, ...(p.ligne.numeroSerieId ? { id: p.ligne.numeroSerieId } : { numero: { equals: numero, mode: "insensitive" } }) },
    select: { id: true, numero: true, produitId: true, varianteId: true },
  });
  const maintenant = new Date();
  const vente = {
    statut: "vendu", commandeId: p.commandeId, ligneCommandeId: p.ligneCommandeId, clientId: p.clientId, venduAt: maintenant,
    garantieFinAt: p.produit.garantieMois ? ajouterMois(maintenant, p.produit.garantieMois) : null,
  };
  if (!existant) {
    if (!numero) throw new ErreurPos("serie_requise", 422, `Le numéro de série de « ${p.produit.nom} » est introuvable.`);
    if (p.enregistresUniquement) {
      throw new ErreurPos("serie_inconnue", 422, `Le numéro de série ${numero} n'est pas enregistré pour « ${p.produit.nom} ». Vérifiez la saisie, ou enregistrez ce numéro dans le stock avant de le vendre.`, { numero });
    }
    try {
      return (await tx.numeroSerie.create({ data: { tenantId: ctx.tenantId, produitId: p.produit.id, varianteId: p.varianteId, numero, ...vente }, select: { id: true } })).id;
    } catch (e) {
      // Une autre caisse vient de vendre ce même numéro inconnu (unicité boutique + numéro).
      if ((e as { code?: string })?.code === "P2002") throw new ErreurPos("serie_indisponible", 409, `Le numéro de série ${numero} vient d'être vendu par une autre caisse. La vente n'a pas été enregistrée.`, { numero });
      throw e;
    }
  }
  if (existant.produitId !== p.produit.id) throw new ErreurPos("serie_indisponible", 409, `Le numéro de série ${existant.numero} appartient à un autre article.`, { numero: existant.numero });
  if (existant.varianteId && existant.varianteId !== p.varianteId) {
    throw new ErreurPos("serie_indisponible", 409, `Le numéro de série ${existant.numero} est enregistré pour une autre variante de « ${p.produit.nom} ». Choisissez la bonne variante.`, { numero: existant.numero });
  }
  const pris = await tx.numeroSerie.updateMany({ where: { id: existant.id, statut: { in: ["en_stock", "retourne"] } }, data: vente });
  if (pris.count === 0) throw new ErreurPos("serie_indisponible", 409, `Le numéro de série ${existant.numero} a déjà été vendu ou n'est pas disponible à la vente.`, { numero: existant.numero });
  return existant.id;
}

/**
 * Enregistre une vente en caisse. Voir l'en-tête du fichier pour les garanties.
 * `options.autoriserNegatif` : réservé au rejeu des ventes saisies hors ligne
 * (la vente a eu lieu : elle est enregistrée même si le stock est dépassé).
 * `options.rejeu` : prix et total encaissés hors ligne (voir OptionsRejeu).
 */
export async function enregistrerVente(ctx: ContextePos, d: DemandeVente, options: { autoriserNegatif?: boolean; rejeu?: OptionsRejeu } = {}): Promise<ResultatVente> {
  exigerDroit(ctx, "vendre");

  // Rejeu : la vente d'origine est rendue avant toute relecture (un article a pu changer depuis).
  const connue = await mutationConnue<Omit<ResultatVente, "rejoue">>(ctx.tenantId, d.cle, "vente");
  if (connue) return { ...connue, rejoue: true };

  const prep = await preparerPanier(ctx, d, options.rejeu);
  const { panier, reglages, devise, client } = prep;
  const refus = panier.alertes.find((a) => a.bloquant);
  if (refus) throw new ErreurPos(refus.code, refus.code === "quantite_invalide" ? 422 : 403, refus.message, { ligne: refus.ligne });

  // Paiements : moyens proposés par la boutique, total couvert, crédit autorisé.
  const dec = decimalesDevise(devise);
  for (const p of d.paiements) {
    if (!reglages.reglages.paiements.modes.includes(p.mode)) {
      throw new ErreurPos("mode_desactive", 422, `Le moyen de paiement « ${MODES_PAIEMENT[p.mode]?.libelle ?? p.mode} » n'est pas activé dans les réglages de la caisse.`);
    }
  }
  const repartition = repartirPaiements(panier.total, d.paiements, dec);
  if (repartition.reste > 0) {
    throw new ErreurPos("paiement_incomplet", 422, `Il manque ${formatMontant(repartition.reste, devise)} pour régler cette vente.`, { reste: repartition.reste, total: panier.total });
  }
  if (repartition.credit > 0) {
    if (!reglages.reglages.credit.actif) throw new ErreurPos("credit_desactive", 422, "La vente à crédit n'est pas activée dans les réglages de la caisse.");
    if (!client) throw new ErreurPos("client_requis", 422, "Associez un client à la vente pour vendre à crédit.");
  }
  if (sessionObligatoire(reglages) && !ctx.sessionCaisseId) {
    throw new ErreurPos("caisse_fermee", 409, "La caisse est fermée. Ouvrez-la pour commencer à vendre.");
  }

  const magasin = await prisma.magasin.findFirst({ where: { id: ctx.magasinId, tenantId: ctx.tenantId }, select: { nom: true, ville: true, entrepotId: true } });
  if (!magasin) throw new ErreurPos("introuvable", 404, "Ce magasin est introuvable dans cette boutique.");
  const autoriserNegatif = !!options.autoriserNegatif || reglages.reglages.stock.venteSansStock;
  const gestes = panier.lignes
    .filter((l) => l.remiseLigne > 0 || l.offert || l.prixApplique !== l.prixUnitaire)
    .map((l) => ({ article: l.nom, prixCatalogue: l.prixUnitaire, prixApplique: l.prixApplique, remise: l.remiseLigne, offert: !!l.offert }));

  const venduLe = dateVente(d.creeLocalAt);

  const ecrire = async (tx: Tx): Promise<Omit<ResultatVente, "rejoue">> => {
    // Verrou de la session : la fermeture de caisse attend cette vente, et une session fermée entre-temps la refuse.
    if (ctx.sessionCaisseId) {
      const ouverte = await tx.sessionCaisse.updateMany({ where: { id: ctx.sessionCaisseId, statut: "ouverte" }, data: { nbVentes: { increment: 1 } } });
      if (ouverte.count === 0) throw new ErreurPos("caisse_fermee", 409, "La session de caisse vient d'être fermée. Ouvrez-la de nouveau pour vendre.");
    }

    const commande = await tx.commande.create({
      data: {
        tenantId: ctx.tenantId, numero: genererNumeroCommande(), canal: CANAL.POS,
        clientId: client?.id ?? null, clientNom: client?.nom ?? "Client comptoir", clientEmail: client?.email ?? null, clientTelephone: client?.telephone ?? "",
        adresseLivraison: `Vente en magasin — ${magasin.nom}`, ville: magasin.ville ?? "", pays: prep.pays,
        montantSousTotal: panier.sousTotal, montantLivraison: 0, montantReduction: panier.totalRemises,
        montantTaxes: panier.montantTaxes, montantTotal: panier.total, devise,
        statut: "livree", livraisonStatut: "livree", livreeAt: venduLe ?? new Date(),
        // Vente saisie hors ligne : datée de l'heure où elle a eu lieu, pas de sa synchronisation
        // (chiffre du jour, ventes par heure). La session reste celle ouverte à la synchronisation.
        ...(venduLe ? { createdAt: venduLe } : {}),
        paiementStatut: PAIEMENT.PAYE,
        methodePaiement: repartition.paiements.length === 1 ? repartition.paiements[0].mode : repartition.paiements.length ? "mixte" : "offert",
        codePromoId: panier.remiseCodePromo > 0 ? prep.codePromoId : null,
        noteClient: d.note?.trim() || null,
        magasinId: ctx.magasinId, caisseId: ctx.caisseId, sessionCaisseId: ctx.sessionCaisseId ?? null,
        vendeurId: ctx.userId, appareilId: ctx.appareilId ?? null,
        creeLocalAt: d.creeLocalAt ? new Date(d.creeLocalAt) : null,
      },
    });

    // Lignes — au poids : quantite en grammes, prix et coût au gramme, mesure en kilos (voir tarification.ts).
    const lignesCreees: { produitId: string; quantite: number; mesure: number | null }[] = [];
    for (let i = 0; i < panier.lignes.length; i++) {
      const l = panier.lignes[i];
      const auPoids = l.uniteVente === "kg";
      const ligne = await tx.ligneCommande.create({
        data: {
          commandeId: commande.id, produitId: l.produitId, nom: l.nom, prix: prixLigneCommande(l), quantite: l.quantite,
          imageUrl: l.image ?? null, variante: l.variante ?? null, varianteId: l.varianteId ?? null,
          cout: l.cout === null || l.cout === undefined ? null : auPoids ? l.cout / 1000 : l.cout,
          remise: l.remiseTotale, tauxTVA: l.taux,
          prixOrigine: l.prixApplique !== l.prixUnitaire ? (auPoids ? l.prixUnitaire / 1000 : l.prixUnitaire) : null,
          offert: !!l.offert, commentaire: l.commentaire?.trim() || null, promotionId: l.promotionId,
          mesure: auPoids ? l.quantite / 1000 : null,
        },
        select: { id: true },
      });
      lignesCreees.push({ produitId: l.produitId, quantite: l.quantite, mesure: auPoids ? l.quantite / 1000 : null });
      const produit = prep.produits.get(l.produitId)!;
      if (produit.suiviSerie) {
        const numeroSerieId = await vendreNumeroSerie(tx, ctx, { ligne: d.lignes[i], produit, varianteId: l.varianteId ?? null, commandeId: commande.id, ligneCommandeId: ligne.id, clientId: client?.id ?? null, enregistresUniquement: reglages.reglages.series.enregistresUniquement });
        await tx.ligneCommande.update({ where: { id: ligne.id }, data: { numeroSerieId } });
      }
    }

    // Stock : sort de l'entrepôt du magasin (total + ventilation + lots FEFO + journal).
    try {
      await sortirStock(tx, { tenantId: ctx.tenantId, commandeId: commande.id, motif: `Vente caisse #${commande.numero}`, creePar: ctx.userId, entrepotId: magasin.entrepotId, autoriserNegatif });
    } catch (e) {
      if (e instanceof RuptureStock) throw new ErreurPos("stock_insuffisant", 409, `${e.message}. La vente n'a pas été enregistrée.`);
      throw e;
    }
    await compterVentesCaisse(tx, lignesCreees, 1);

    for (const p of repartition.paiements) {
      await ajouterPaiement(tx, ctx, {
        commandeId: commande.id, mode: p.mode, montant: p.montant, montantRecu: p.montantRecu, monnaieRendue: p.monnaieRendue,
        prestataire: p.prestataire, reference: p.reference, clientId: client?.id ?? null, echeanceJours: reglages.reglages.credit.echeanceJours,
        encaisseLe: venduLe,
      });
    }

    if (commande.codePromoId) await tx.codePromo.update({ where: { id: commande.codePromoId }, data: { utilisations: { increment: 1 } } });
    await compterUtilisations(tx, ctx.tenantId, panier.promotionsAppliquees.map((p) => p.promotionId), 1);

    let points = 0;
    if (client) {
      await tx.client.update({ where: { id: client.id }, data: { totalCommandes: { increment: 1 }, totalDepense: { increment: panier.total } } });
      points = await crediterPoints(tx, ctx, { clientId: client.id, commandeId: commande.id, montant: panier.total, reglages: reglages.reglages.fidelite });
    }

    // Facture de la vente (numéro unique sur la plateforme : voir genererNumeroFacture).
    await tx.facture.create({
      data: {
        tenantId: ctx.tenantId, commandeId: commande.id,
        numero: genererNumeroFacture((await tx.facture.count({ where: { tenantId: ctx.tenantId } })) + 1),
        clientNom: commande.clientNom, clientEmail: client?.email ?? "", clientAdresse: commande.adresseLivraison,
        montantHT: panier.totalHT, tauxTVA: prep.tauxTVA, montantTVA: panier.montantTaxes, montantTTC: panier.total, devise,
        lignes: panier.lignes.map((l) => {
          const auPoids = l.uniteVente === "kg";
          const quantite = auPoids ? 1 : l.quantite;
          return { nom: auPoids ? `${l.nom} — ${libelleQuantite(l.quantite, "kg")}` : l.nom, quantite, prixHT: l.ht / quantite, tauxTVA: l.taux, prixTTC: l.total / quantite, variante: l.variante ?? null };
        }),
        statut: repartition.credit > 0 ? "emise" : "payee",
      },
    });

    // Trace et diffusion, en fin de transaction (le verrou de boutique est tenu le moins longtemps possible).
    await journaliserAudit(tx, ctx, {
      action: "vente.creee", entite: "Commande", entiteId: commande.id,
      apres: {
        numero: commande.numero, total: panier.total, sousTotal: panier.sousTotal, remises: panier.totalRemises, taxes: panier.montantTaxes,
        articles: panier.articles, clientId: client?.id ?? null, paye: repartition.paye, credit: repartition.credit,
        paiements: repartition.paiements.map((p) => ({ mode: p.mode, montant: p.montant, declaratif: MODES_PAIEMENT[p.mode].statut === "declaratif" })),
      },
    });
    if (gestes.length || panier.remiseGlobale > 0) {
      await journaliserAudit(tx, ctx, {
        action: "vente.remise", entite: "Commande", entiteId: commande.id,
        apres: { numero: commande.numero, remiseGlobale: panier.remiseGlobale, lignes: gestes, ...(prep.rejeu ? { horsLigne: { ...prep.rejeu, valideParResponsable: !!options.rejeu?.valide } } : {}) },
      });
    }
    await publierEvenement(tx, {
      tenantId: ctx.tenantId, magasinId: ctx.magasinId, caisseId: ctx.caisseId, type: "sale.created",
      payload: { commandeId: commande.id, numero: commande.numero, total: panier.total, paye: repartition.paye, du: repartition.credit, articles: panier.articles, devise, vendeur: ctx.userNom, clientId: client?.id ?? null, points },
    });
    await publierEvenement(tx, {
      tenantId: ctx.tenantId, magasinId: ctx.magasinId, caisseId: null, type: "inventory.updated",
      payload: { origine: "vente", commandeId: commande.id, produitIds: [...new Set(panier.lignes.map((l) => l.produitId))] },
    });

    return { commandeId: commande.id, numero: commande.numero, total: panier.total, paye: repartition.paye, du: repartition.credit, monnaie: repartition.monnaie };
  };

  // Collision de numéro (vente, facture, série) : la transaction est rejouée avec de nouveaux numéros.
  const { resultat, rejoue } = await avecRepriseCollision(() =>
    avecIdempotence(ctx.tenantId, d.cle, "vente", ecrire, { appareilId: ctx.appareilId, userId: ctx.userId, creeLocalAt: d.creeLocalAt }),
  );
  return { ...resultat, rejoue };
}

/**
 * Annule une vente en caisse : la marchandise revient en stock (dans l'entrepôt
 * d'où elle était sortie), les paiements sont contre-passés (les espèces
 * sortent de la session de caisse en cours), le crédit et les points sont
 * repris, la vente sort du chiffre d'affaires. Un motif est obligatoire.
 * Sans danger si elle est demandée deux fois : la seconde est refusée (409).
 */
export async function annulerVente(ctx: ContextePos, commandeId: string, motif: string): Promise<{ commandeId: string; numero: string; rembourse: number }> {
  exigerDroit(ctx, "annuler_vente");
  const raison = motif?.trim() ?? "";
  if (raison.length < 3) throw new ErreurPos("motif_requis", 422, "Indiquez pourquoi cette vente est annulée.");
  const complets = await lireReglagesPos(ctx.tenantId);
  const { reglages } = complets;

  return prisma.$transaction(async (tx) => {
    const commande = await tx.commande.findFirst({
      where: { id: commandeId, tenantId: ctx.tenantId, canal: CANAL.POS },
      include: { paiements: true, lignes: { select: { produitId: true, quantite: true, mesure: true, promotionId: true, quantiteRetournee: true } } },
    });
    if (!commande) throw new ErreurPos("introuvable", 404, "Cette vente est introuvable dans cette boutique.");
    exigerMagasin(ctx, commande.magasinId);
    // Vente déjà retournée, même en partie : de l'argent a été rendu, du stock et des points repris.
    // Tout contre-passer ici rembourserait deux fois — le reste se retourne depuis l'écran Retours.
    if (commande.statut !== "annulee" && (commande.lignes.some((l) => l.quantiteRetournee > 0) || commande.paiements.some((x) => x.montant < 0))) {
      throw new ErreurPos("deja_retournee", 409, "Cette vente a déjà fait l'objet d'un retour : elle ne peut plus être annulée en entier. Pour reprendre les articles restants, passez par l'écran Retours.", { lien: "/dashboard/pos/retours" });
    }
    const bascule = await tx.commande.updateMany({ where: { id: commande.id, statut: { not: "annulee" } }, data: { statut: "annulee", paiementStatut: PAIEMENT.REMBOURSE } });
    if (bascule.count === 0) throw new ErreurPos("deja_annulee", 409, "Cette vente a déjà été annulée. Rien n'a été modifié.");

    // Stock, code promo, commissions : mêmes règles que toute commande annulée.
    await libererCommande(tx, { commandeId: commande.id, motif: `Annulation vente caisse #${commande.numero}`, restock: true });
    await compterVentesCaisse(tx, commande.lignes, -1);
    await compterUtilisations(tx, ctx.tenantId, commande.lignes.flatMap((l) => (l.promotionId ? [l.promotionId] : [])), -1);
    await tx.numeroSerie.updateMany({
      where: { tenantId: ctx.tenantId, commandeId: commande.id },
      data: { statut: "en_stock", commandeId: null, ligneCommandeId: null, clientId: null, venduAt: null, garantieFinAt: null },
    });

    // Contre-passation des paiements : annuler une vente, c'est rendre l'argent.
    // Les espèces sortent de la session ouverte du caissier (jamais d'une session close).
    // Caisse fermée alors que la session est exigée : refus, comme pour un retour —
    // sinon l'argent sortirait du tiroir sans qu'aucun comptage ne le voie.
    const sessionOuverte = ctx.sessionCaisseId
      ? (await tx.sessionCaisse.updateMany({ where: { id: ctx.sessionCaisseId, statut: "ouverte" }, data: { nbVentes: { increment: 0 } } })).count > 0
      : false;
    if (!sessionOuverte && sessionObligatoire(complets) && commande.paiements.some((x) => x.statut === "confirme" && x.montant > 0 && x.mode === "especes")) {
      throw new ErreurPos("caisse_fermee", 409, "La caisse est fermée. Ouvrez-la pour annuler cette vente et rendre les espèces au client.");
    }
    const quiRembourse: ContextePos = { ...ctx, sessionCaisseId: sessionOuverte ? ctx.sessionCaisseId : undefined, droits: { ...ctx.droits, rembourser: true } };
    let rembourse = 0;
    for (const p of commande.paiements.filter((x) => x.statut === "confirme" && x.montant > 0)) {
      await ajouterPaiement(tx, quiRembourse, { commandeId: commande.id, mode: p.mode as keyof typeof MODES_PAIEMENT, montant: -p.montant, prestataire: p.prestataire, reference: p.reference, clientId: commande.clientId });
      if (p.mode !== "credit") rembourse += p.montant;
    }
    await libererCredit(tx, ctx, { commandeId: commande.id });
    await reprendrePoints(tx, ctx, { commandeId: commande.id, motif: raison, reglages: reglages.fidelite });
    if (commande.clientId) {
      await tx.client.update({ where: { id: commande.clientId }, data: { totalCommandes: { decrement: 1 }, totalDepense: { decrement: commande.montantTotal } } });
    }
    await tx.facture.updateMany({ where: { commandeId: commande.id }, data: { statut: "annulee" } });

    await journaliserAudit(tx, ctx, {
      action: "vente.annulee", entite: "Commande", entiteId: commande.id, motif: raison,
      avant: { statut: commande.statut, total: commande.montantTotal, paye: commande.montantPaye },
      apres: { statut: "annulee", rembourse },
    });
    await publierEvenement(tx, {
      tenantId: ctx.tenantId, magasinId: commande.magasinId, caisseId: commande.caisseId, type: "sale.cancelled",
      payload: { commandeId: commande.id, numero: commande.numero, total: commande.montantTotal, rembourse, par: ctx.userNom, motif: raison },
    });
    await publierEvenement(tx, {
      tenantId: ctx.tenantId, magasinId: commande.magasinId, caisseId: null, type: "inventory.updated",
      payload: { origine: "annulation", commandeId: commande.id, produitIds: [...new Set(commande.lignes.map((l) => l.produitId))] },
    });
    return { commandeId: commande.id, numero: commande.numero, rembourse };
  }, { maxWait: 10_000, timeout: 30_000 });
}
