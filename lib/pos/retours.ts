// Retours et remboursements en caisse : complet, partiel ligne par ligne,
// avoir, échange. SERVEUR uniquement.
//
// À CÔTÉ de lib/remboursement.ts (remboursement d'une commande ENTIÈRE, vitrine
// et NotchPay), que ce fichier ne modifie pas. Ici un retour porte sur des
// lignes et des quantités, et tout ce qu'il engage est recalculé dans UNE
// transaction idempotente (`cle`) :
// - stock : mouvement « retour » dans l'entrepôt du magasin + quantiteRetournee
//   (une annulation totale ultérieure ne rendra que le reste) ; un article
//   abîmé revient mais est compté « endommagé », donc invendable ;
// - numéro de série : repasse « en_stock » ou devient « defectueux » ;
// - argent : le crédit client encore dû sur la vente est réduit d'abord (rien
//   n'avait été encaissé) ; le reste est rendu par des lignes PaiementVente
//   NÉGATIVES (statut « rembourse »), comptées dans la session de caisse ouverte
//   quand ce sont des espèces — ou porté sur un avoir (AvoirClient) ;
// - fidélité : points repris au prorata du montant rendu ;
// - taxes et marge reprises : calculées et gardées sur le retour (RetourRMA.lignes).
//
// HONNÊTETÉ — rembourser « dans le moyen d'origine » un paiement Mobile Money
// ou carte reste DÉCLARATIF : AXSO n'envoie pas l'argent, le caissier le rend
// lui-même ; la ligne s'affiche « Non vérifié » et part au rapprochement.
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { CANAL, PAIEMENT } from "../commandes";
import { formatMontant } from "../utils";
import { ErreurPos } from "./erreurs";
import { exigerDroit, exigerMagasin } from "./droits";
import { enregistrerReglagesPos, lireReglagesPos, sessionObligatoire } from "./flags";
import { journaliserAudit } from "./audit";
import { publierEvenement } from "./evenements";
import { avecIdempotence, avecRepriseCollision, mutationConnue } from "./idempotence";
import { mouvementStock, resoudreLieu } from "./stock";
import { deplacerEtat } from "./operations/fiche";
import { decimalesDevise, arrondir } from "./tarification";
import { MODES_PAIEMENT, ajouterPaiement } from "./paiements";
import { niveauPour, reprendrePoints } from "./fidelite";
import { schemaLigne, schemaPaiement, schemaRemise } from "./schemas";
import { enregistrerVente, preparerPanier } from "./vente";
import { calculerRetour, delaiDepasse, pointsAReprendre, repartirRemboursement, ventilerVente } from "./caisse/calculs";
import type { ContextePos, DemandePaiementPos, ModePaiement, ResultatVente } from "./types";

type Tx = Prisma.TransactionClient;

const id = z.string().trim().min(1).max(64);

export const schemaRetour = z.object({
  cle: z.string().trim().min(8).max(200),
  commandeId: id,
  lignes: z.array(z.object({
    ligneCommandeId: id,
    /** Pièces, ou grammes pour un produit au poids. */
    quantite: z.number().int().min(1).max(10_000_000),
    /** « stock » : l'article est revendable ; « endommage » : il revient mais reste invendable. */
    etat: z.enum(["stock", "endommage"]).default("stock"),
  })).min(1).max(500),
  type: z.enum(["remboursement", "avoir", "echange"]),
  /** Remboursement : sur les moyens qui ont réglé la vente (défaut), ou tout en espèces. */
  modeRemboursement: z.enum(["origine", "especes"]).optional(),
  raison: z.enum(["defaut", "erreur_commande", "change_avis", "endommage", "autre"]),
  description: z.string().trim().max(500).nullish(),
  /** Le client n'a pas son reçu (la vente a été retrouvée autrement). Soumis au réglage retours.sansRecu. */
  sansRecu: z.boolean().optional(),
  /** Échange : la nouvelle vente. La valeur du retour la règle (avoir) ; `paiements` couvre le complément. */
  echange: z.object({
    lignes: z.array(schemaLigne).min(1).max(500),
    paiements: z.array(schemaPaiement).max(10).default([]),
    remise: schemaRemise.nullish(),
    codePromo: z.string().trim().max(60).nullish(),
  }).optional(),
});
export type DemandeRetour = z.infer<typeof schemaRetour>;

export type ResultatRetour = {
  retourId: string; commandeId: string; numero: string; type: string;
  /** Valeur des articles repris, taxes comprises. */
  montant: number; taxes: number;
  /** Part déduite de ce que le client devait encore (vente à crédit). */
  creditRepris: number;
  /** Argent rendu, par moyen. `nonVerifie` : rendu par le caissier, AXSO ne le vérifie pas. */
  remboursements: { mode: string; libelle: string; montant: number; nonVerifie: boolean }[];
  avoir: { id: string; code: string; montant: number } | null;
  pointsRepris: number;
  /** La vente est entièrement retournée. */
  complet: boolean;
};

/** Code d'avoir lisible et dicté sans ambiguïté (ni 0/O, ni 1/I) : AV-7KQ2M9XA. */
function genererCodeAvoir(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  return "AV-" + [...randomBytes(8)].map((o) => alphabet[o % alphabet.length]).join("");
}

const estModePaiement = (m: string): m is ModePaiement => m in MODES_PAIEMENT;

/**
 * Enregistre un retour (remboursement ou avoir). Voir l'en-tête du fichier.
 * Droits : « retour », plus « rembourser » quand de l'argent est rendu.
 */
export async function enregistrerRetour(ctx: ContextePos, d: DemandeRetour): Promise<ResultatRetour & { rejoue: boolean }> {
  exigerDroit(ctx, "retour");
  if (d.type === "remboursement") exigerDroit(ctx, "rembourser");

  // Rejeu : le retour d'origine est rendu avant toute relecture.
  const connu = await mutationConnue<ResultatRetour>(ctx.tenantId, d.cle, "retour");
  if (connu) return { ...connu, rejoue: true };

  const [reglages, tenant, magasin] = await Promise.all([
    lireReglagesPos(ctx.tenantId),
    prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { devise: true } }),
    prisma.magasin.findFirst({ where: { id: ctx.magasinId, tenantId: ctx.tenantId }, select: { entrepotId: true } }),
  ]);
  if (!magasin) throw new ErreurPos("introuvable", 404, "Ce magasin est introuvable dans cette boutique.");
  const politique = reglages.reglages.retours;
  if (d.sansRecu && !politique.sansRecu) {
    throw new ErreurPos("retour_sans_recu", 422, "Les retours sans reçu ne sont pas acceptés dans cette boutique. Un responsable peut les autoriser dans les réglages de la caisse.");
  }
  const dec = decimalesDevise(tenant.devise);
  const motif = `Retour — ${d.raison}${d.description ? ` : ${d.description}` : ""}`;

  const ecrire = async (tx: Tx): Promise<ResultatRetour> => {
    // Verrou de la vente : deux retours simultanés sur la même vente se suivent.
    const verrou = await tx.commande.updateMany({ where: { id: d.commandeId, tenantId: ctx.tenantId, canal: CANAL.POS }, data: { montantPaye: { increment: 0 } } });
    if (verrou.count === 0) throw new ErreurPos("introuvable", 404, "Cette vente en caisse est introuvable dans cette boutique.");
    const commande = await tx.commande.findUniqueOrThrow({
      where: { id: d.commandeId },
      include: { paiements: { orderBy: { createdAt: "asc" } }, lignes: { include: { produit: { select: { type: true } } } } },
    });
    exigerMagasin(ctx, commande.magasinId);
    if (commande.statut === "annulee") throw new ErreurPos("deja_annulee", 409, "Cette vente a été annulée : il n'y a plus rien à retourner.");
    if (delaiDepasse(commande.createdAt, politique.delaiJours)) {
      throw new ErreurPos("retour_hors_delai", 422, `Cette vente date de plus de ${politique.delaiJours} jours : le délai de retour de la boutique est dépassé.`, { delaiJours: politique.delaiJours });
    }

    const ventilees = ventilerVente(commande.montantTotal, commande.lignes, dec);
    const calcul = calculerRetour(ventilees, d.lignes, dec);

    // Vente de l'ancienne caisse : aucun PaiementVente, montantPaye jamais tenu — elle avait été payée en entier.
    if (!commande.paiements.length && commande.montantPaye === 0 && commande.paiementStatut === PAIEMENT.PAYE) {
      await tx.commande.update({ where: { id: commande.id }, data: { montantPaye: commande.montantTotal } });
    }

    // Session de caisse : les espèces rendues sortent de la session OUVERTE (jamais d'une session close).
    const sessionOuverte = ctx.sessionCaisseId
      ? (await tx.sessionCaisse.updateMany({ where: { id: ctx.sessionCaisseId, tenantId: ctx.tenantId, statut: "ouverte" }, data: { nbVentes: { increment: 0 } } })).count > 0
      : false;
    // Les droits ont été vérifiés plus haut selon le type de retour ; l'émission d'un avoir passe aussi par une ligne négative.
    const quiRend: ContextePos = { ...ctx, sessionCaisseId: sessionOuverte ? ctx.sessionCaisseId : undefined, droits: { ...ctx.droits, rembourser: true } };

    // 1. Articles : quantité retournée, stock, numéro de série, compteur de ventes.
    const lieu = await resoudreLieu(tx, ctx.tenantId, magasin.entrepotId);
    const journal = await tx.stockMouvement.findMany({ where: { commandeId: commande.id, type: { in: ["vente", "retour"] }, lotId: { not: null } }, select: { type: true, produitId: true, lotId: true, quantite: true } });
    const resteLot = new Map<string, number>();
    for (const m of journal) resteLot.set(m.lotId!, (resteLot.get(m.lotId!) ?? 0) + (m.type === "vente" ? m.quantite : -m.quantite));
    const produitsTouches = new Set<string>();

    for (const c of calcul.lignes) {
      const l = c.ligne;
      const etat = d.lignes.find((x) => x.ligneCommandeId === l.id)!.etat;
      const pris = await tx.ligneCommande.updateMany({ where: { id: l.id, commandeId: commande.id, quantiteRetournee: l.quantiteRetournee }, data: { quantiteRetournee: { increment: c.quantite } } });
      if (pris.count === 0) throw new ErreurPos("conflit", 409, "Cette vente vient d'être modifiée par une autre caisse. Rechargez-la puis réessayez.");

      if (l.produit.type === "physique") {
        const commun = { tenantId: ctx.tenantId, produitId: l.produitId, varianteId: l.varianteId, type: "retour" as const, motif: `${motif} (#${commande.numero})`, creePar: ctx.userId, lieu };
        let aRendre = c.quantite;
        // Article revendable : il regagne d'abord les lots d'où il était sorti. Abîmé : il ne rentre dans aucun lot.
        if (etat === "stock") {
          for (const m of journal) {
            if (aRendre <= 0) break;
            if (m.type !== "vente" || m.produitId !== l.produitId) continue;
            const q = Math.min(aRendre, resteLot.get(m.lotId!) ?? 0);
            if (q <= 0) continue;
            await mouvementStock(tx, { ...commun, quantite: q, refs: { commandeId: commande.id, lotId: m.lotId } });
            resteLot.set(m.lotId!, (resteLot.get(m.lotId!) ?? 0) - q);
            aRendre -= q;
          }
        }
        const rendu = aRendre > 0 ? await mouvementStock(tx, { ...commun, quantite: aRendre, refs: { commandeId: commande.id } }) : null;
        // Abîmé : compté « endommagé » dans le lieu (deplacerEtat crée la ligne de stock du lieu si elle manque).
        // L'article vient d'être verrouillé par le mouvement de stock ci-dessus.
        if (etat === "endommage" && lieu && rendu) {
          await deplacerEtat(tx, { tenantId: ctx.tenantId, entrepotId: lieu.entrepotId, produitId: l.produitId, varianteId: l.varianteId, stock: rendu.stockApres, champ: "endommage", delta: c.quantite, souple: true, nom: l.nom });
        }
        produitsTouches.add(l.produitId);
      }
      if (l.numeroSerieId) {
        await tx.numeroSerie.updateMany({
          where: { id: l.numeroSerieId, tenantId: ctx.tenantId },
          data: etat === "stock"
            ? { statut: "en_stock", entrepotId: magasin.entrepotId, commandeId: null, ligneCommandeId: null, clientId: null, venduAt: null, garantieFinAt: null }
            : { statut: "defectueux", entrepotId: magasin.entrepotId },
        });
      }
      // Compteur Produit.ventes : pièces rendues ; une ligne au poids compte pour 1, reprise quand elle est rendue en entier.
      const ventes = l.mesure !== null ? (c.quantite >= l.restant ? 1 : 0) : c.quantite;
      if (ventes) await tx.produit.update({ where: { id: l.produitId }, data: { ventes: { decrement: ventes } } });
    }

    // 2. Crédit client : ce que le client devait encore sur cette vente est réduit d'abord.
    let creditRepris = 0;
    if (commande.clientId) {
      const du = (await tx.mouvementCredit.aggregate({ where: { tenantId: ctx.tenantId, commandeId: commande.id, clientId: commande.clientId }, _sum: { montant: true } }))._sum.montant ?? 0;
      creditRepris = arrondir(Math.min(calcul.montant, Math.max(0, du)), dec);
      if (creditRepris > 0) {
        const { creditUtilise } = await tx.client.update({ where: { id: commande.clientId }, data: { creditUtilise: { decrement: creditRepris } }, select: { creditUtilise: true } });
        await tx.mouvementCredit.create({ data: { tenantId: ctx.tenantId, clientId: commande.clientId, type: "ajustement", montant: -creditRepris, soldeApres: creditUtilise, commandeId: commande.id, creePar: ctx.userId } });
        await ajouterPaiement(tx, quiRend, { commandeId: commande.id, mode: "credit", montant: -creditRepris, clientId: commande.clientId });
      }
    }

    // 3. Reste : rendu en argent, ou porté sur un avoir.
    const aRendre = arrondir(calcul.montant - creditRepris, dec);
    const retour = await tx.retourRMA.create({
      data: {
        tenantId: ctx.tenantId, commandeId: commande.id, clientNom: commande.clientNom, clientEmail: commande.clientEmail,
        raison: d.raison, description: d.description?.trim() || null, type: d.type, statut: "accepte", montant: calcul.montant,
        lignes: calcul.lignes.map((c) => ({
          ligneCommandeId: c.ligne.id, produitId: c.ligne.produitId, nom: c.ligne.nom, quantite: c.quantite,
          remisEnStock: d.lignes.find((x) => x.ligneCommandeId === c.ligne.id)!.etat === "stock", montant: c.montant, taxe: c.taxe, cout: c.cout,
        })),
        modeRemboursement: d.type === "remboursement" ? d.modeRemboursement ?? "origine" : d.type,
        sessionCaisseId: quiRend.sessionCaisseId ?? null, sansRecu: !!d.sansRecu, traitePar: ctx.userId,
      },
      select: { id: true },
    });

    const remboursements: ResultatRetour["remboursements"] = [];
    let avoir: ResultatRetour["avoir"] = null;
    if (aRendre > 0 && d.type === "remboursement") {
      // Ancienne caisse (aucun PaiementVente) : le moyen d'origine est celui inscrit sur la vente.
      const origine = commande.paiements.length ? commande.paiements
        : [{ mode: estModePaiement(commande.methodePaiement) && MODES_PAIEMENT[commande.methodePaiement].statut !== "a_connecter" ? commande.methodePaiement : "especes", montant: commande.montantTotal, reference: null, prestataire: null }];
      const parts = repartirRemboursement(aRendre, origine, d.modeRemboursement ?? "origine", dec);
      if (parts.some((p) => p.mode === "especes") && !quiRend.sessionCaisseId && sessionObligatoire(reglages)) {
        throw new ErreurPos("caisse_fermee", 409, "La caisse est fermée. Ouvrez-la pour rendre des espèces au client.");
      }
      for (const p of parts) {
        const mode = estModePaiement(p.mode) ? p.mode : "especes";
        await ajouterPaiement(tx, quiRend, { commandeId: commande.id, mode, montant: -p.montant, reference: p.reference, prestataire: p.prestataire, clientId: commande.clientId });
        remboursements.push({ mode, libelle: MODES_PAIEMENT[mode].libelle, montant: p.montant, nonVerifie: MODES_PAIEMENT[mode].statut === "declaratif" });
      }
    } else if (aRendre > 0) {
      // Avoir (ou échange : l'avoir règle la nouvelle vente). Créé à zéro, puis crédité par la ligne négative
      // « avoir » de la vente d'origine : son montant encaissé baisse d'autant, sans mouvement d'espèces.
      const cree = await tx.avoirClient.create({ data: { tenantId: ctx.tenantId, clientId: commande.clientId, code: genererCodeAvoir(), montantInitial: aRendre, solde: 0, retourId: retour.id } });
      await ajouterPaiement(tx, quiRend, { commandeId: commande.id, mode: "avoir", montant: -aRendre, reference: cree.code, clientId: commande.clientId });
      await tx.retourRMA.update({ where: { id: retour.id }, data: { avoirId: cree.id } });
      avoir = { id: cree.id, code: cree.code, montant: aRendre };
      // L'avoir doit pouvoir servir de moyen de paiement : la vente refuse un moyen absent des réglages.
      if (!reglages.reglages.paiements.modes.includes("avoir")) {
        const r = await enregistrerReglagesPos(ctx.tenantId, { reglages: { paiements: { modes: [...reglages.reglages.paiements.modes, "avoir"] } } }, tx);
        await journaliserAudit(tx, ctx, { action: "reglages.modifies", entite: "ReglagesPos", entiteId: ctx.tenantId, avant: { modes: r.avant.reglages.paiements.modes }, apres: { modes: r.apres.reglages.paiements.modes }, motif: "Premier avoir émis : le moyen de paiement « Avoir » est activé." });
      }
    }

    // 4. Client : dépense et points de fidélité.
    let pointsRepris = 0;
    if (commande.clientId) {
      await tx.client.update({ where: { id: commande.clientId }, data: { totalDepense: { decrement: calcul.montant } } });
      if (calcul.complet) {
        pointsRepris = await reprendrePoints(tx, ctx, { commandeId: commande.id, motif, reglages: reglages.reglages.fidelite });
      } else {
        // reprendrePoints reprend TOUT ce qui reste acquis : pour un retour partiel, la reprise est faite ici, au prorata.
        const mouvements = await tx.mouvementFidelite.findMany({ where: { tenantId: ctx.tenantId, commandeId: commande.id, clientId: commande.clientId }, select: { type: true, points: true } });
        const gagnes = mouvements.filter((m) => m.type === "gain").reduce((s, m) => s + m.points, 0);
        pointsRepris = pointsAReprendre(gagnes, mouvements.reduce((s, m) => s + m.points, 0), calcul.montant, commande.montantTotal);
        // Jamais sous zéro : des points déjà dépensés ne se reprennent pas (la ligne du client est verrouillée par la mise à jour ci-dessus).
        if (pointsRepris > 0) pointsRepris = Math.min(pointsRepris, Math.max(0, (await tx.client.findUniqueOrThrow({ where: { id: commande.clientId }, select: { pointsFidelite: true } })).pointsFidelite));
        if (pointsRepris > 0) {
          const { pointsFidelite } = await tx.client.update({ where: { id: commande.clientId }, data: { pointsFidelite: { decrement: pointsRepris } }, select: { pointsFidelite: true } });
          await tx.client.update({ where: { id: commande.clientId }, data: { niveauFidelite: niveauPour(pointsFidelite, reglages.reglages.fidelite.seuils) } });
          await tx.mouvementFidelite.create({ data: { tenantId: ctx.tenantId, clientId: commande.clientId, type: "annulation", points: -pointsRepris, commandeId: commande.id, motif } });
        }
      }
    }

    // 5. Vente entièrement retournée : elle sort du chiffre d'affaires, sa facture est annulée.
    if (calcul.complet) {
      await tx.commande.update({ where: { id: commande.id }, data: { paiementStatut: PAIEMENT.REMBOURSE } });
      await tx.facture.updateMany({ where: { commandeId: commande.id }, data: { statut: "annulee" } });
    }

    const resultat: ResultatRetour = {
      retourId: retour.id, commandeId: commande.id, numero: commande.numero, type: d.type,
      montant: calcul.montant, taxes: calcul.taxes, creditRepris, remboursements, avoir, pointsRepris, complet: calcul.complet,
    };
    await journaliserAudit(tx, quiRend, {
      action: "retour.cree", entite: "Commande", entiteId: commande.id, motif,
      avant: { montantPaye: commande.montantPaye, lignes: calcul.lignes.map((c) => ({ article: c.ligne.nom, dejaRetourne: c.ligne.quantiteRetournee })) },
      apres: {
        ...resultat, marge: calcul.marge, sansRecu: !!d.sansRecu,
        lignes: calcul.lignes.map((c) => ({ article: c.ligne.nom, quantite: c.quantite, montant: c.montant, etat: d.lignes.find((x) => x.ligneCommandeId === c.ligne.id)!.etat })),
      },
    });
    await publierEvenement(tx, {
      tenantId: ctx.tenantId, magasinId: ctx.magasinId, caisseId: ctx.caisseId, type: "return.created",
      payload: { retourId: retour.id, commandeId: commande.id, numero: commande.numero, type: d.type, montant: calcul.montant, complet: calcul.complet, par: ctx.userNom },
    });
    if (produitsTouches.size) {
      await publierEvenement(tx, { tenantId: ctx.tenantId, magasinId: ctx.magasinId, caisseId: null, type: "inventory.updated", payload: { origine: "retour", commandeId: commande.id, produitIds: [...produitsTouches] } });
    }
    return resultat;
  };

  // Collision du code d'avoir (tiré au hasard) : la transaction est rejouée avec un autre code.
  const { resultat, rejoue } = await avecRepriseCollision(() => avecIdempotence(ctx.tenantId, d.cle, "retour", ecrire, { appareilId: ctx.appareilId, userId: ctx.userId }));
  return { ...resultat, rejoue };
}

export type ResultatEchange = ResultatRetour & {
  rejoue: boolean;
  /** La nouvelle vente, liée à la vente d'origine (Commande.commandeOrigineId). */
  vente: ResultatVente | null;
  /** La nouvelle vente n'a pas pu être enregistrée : le retour est fait, l'avoir reste utilisable. */
  erreurVente: { code: string; message: string } | null;
};

/**
 * Échange : retour des articles repris, puis nouvelle vente réglée par l'avoir
 * du retour (et par `echange.paiements` pour le complément).
 * Deux étapes, chacune idempotente (`cle`, puis `cle` + « :vente ») : rejouer la
 * demande ne refait ni le retour ni la vente. Si la nouvelle vente est refusée
 * (stock, paiement incomplet…), le retour reste acquis et le client garde son
 * avoir — rien n'est perdu, et le message le dit.
 */
export async function enregistrerEchange(ctx: ContextePos, d: DemandeRetour): Promise<ResultatEchange> {
  if (!d.echange) throw new ErreurPos("invalide", 400, "Choisissez les articles que le client emporte en échange.");
  exigerDroit(ctx, "vendre");
  const retour = await enregistrerRetour(ctx, { ...d, type: "echange" });

  const cleVente = `${d.cle}:vente`;
  let vente: ResultatVente | null = null;
  let erreurVente: ResultatEchange["erreurVente"] = null;
  try {
    const connue = await mutationConnue<Omit<ResultatVente, "rejoue">>(ctx.tenantId, cleVente, "vente");
    if (connue) vente = { ...connue, rejoue: true };
    else {
      const panier = { lignes: d.echange.lignes, clientId: (await prisma.commande.findFirst({ where: { id: d.commandeId, tenantId: ctx.tenantId }, select: { clientId: true } }))?.clientId ?? null, remise: d.echange.remise, codePromo: d.echange.codePromo };
      const { panier: calcule } = await preparerPanier(ctx, panier);
      const parAvoir = retour.avoir ? Math.min(retour.avoir.montant, calcule.total) : 0;
      const paiements: DemandePaiementPos[] = [
        ...(parAvoir > 0 ? [{ mode: "avoir" as const, montant: parAvoir, reference: retour.avoir!.code }] : []),
        ...d.echange.paiements.map((p) => ({ mode: p.mode, montant: p.montant, prestataire: p.prestataire ?? undefined, reference: p.reference ?? undefined })),
      ];
      vente = await enregistrerVente(ctx, { ...panier, cle: cleVente, paiements, note: `Échange — vente d'origine #${retour.numero}` });
    }
  } catch (e) {
    const x = e as { code?: unknown; status?: unknown; message?: unknown };
    if (typeof x?.status !== "number") console.error("[pos/retours] échange", e);
    erreurVente = {
      code: typeof x?.code === "string" ? x.code : "erreur_serveur",
      message: typeof x?.status === "number" && typeof x.message === "string" ? x.message : "La nouvelle vente n'a pas pu être enregistrée. Réessayez dans un instant.",
    };
  }

  if (vente && !vente.rejoue) {
    const venteId = vente.commandeId;
    await prisma.$transaction(async (tx) => {
      await tx.commande.updateMany({ where: { id: venteId, tenantId: ctx.tenantId }, data: { commandeOrigineId: d.commandeId } });
      await journaliserAudit(tx, ctx, { action: "retour.echange", entite: "Commande", entiteId: venteId, apres: { retourId: retour.retourId, venteOrigine: retour.numero, nouvelleVente: vente!.numero, valeurReprise: retour.montant, total: vente!.total } });
    });
  }
  return { ...retour, vente, erreurVente };
}

// ─── Lectures ─────────────────────────────────────────────────────────────────

/**
 * Ventes en caisse sur lesquelles un retour peut porter, retrouvées par numéro
 * de vente ou de facture (scan du reçu), client, numéro de série ou article.
 * Sans recherche : les dernières ventes de la caisse.
 */
export async function rechercherVentesRetour(ctx: ContextePos, recherche: string | null) {
  exigerDroit(ctx, "retour");
  // Un reçu peut porter une adresse : on garde son dernier segment.
  const q = (recherche ?? "").trim().replace(/[?#].*$/, "").split("/").filter(Boolean).pop()?.trim() ?? "";
  const [reglages, tenant, series] = await Promise.all([
    lireReglagesPos(ctx.tenantId),
    prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { devise: true } }),
    q ? prisma.numeroSerie.findMany({ where: { tenantId: ctx.tenantId, numero: { equals: q, mode: "insensitive" }, commandeId: { not: null } }, select: { commandeId: true }, take: 5 }) : [],
  ]);
  const contient = { contains: q, mode: "insensitive" as const };
  const ventes = await prisma.commande.findMany({
    where: {
      tenantId: ctx.tenantId, canal: CANAL.POS, statut: { not: "annulee" },
      // Membre limité à certains magasins : leurs ventes, et celles de l'ancienne caisse (sans magasin).
      ...(ctx.magasinIds?.length ? { AND: [{ OR: [{ magasinId: { in: ctx.magasinIds } }, { magasinId: null }] }] } : {}),
      ...(q
        ? { OR: [
            { numero: contient }, { id: q }, { clientNom: contient }, { clientTelephone: contient },
            { facture: { numero: { equals: q, mode: "insensitive" } } },
            { id: { in: series.map((s) => s.commandeId!) } },
            ...(q.length >= 3 ? [{ lignes: { some: { nom: contient } } }] : []),
          ] }
        : { caisseId: ctx.caisseId }),
    },
    orderBy: { createdAt: "desc" }, take: 15,
    include: { lignes: true, paiements: { orderBy: { createdAt: "asc" } }, facture: { select: { numero: true } } },
  });
  const [numeros, dus] = await Promise.all([
    prisma.numeroSerie.findMany({ where: { tenantId: ctx.tenantId, id: { in: ventes.flatMap((v) => v.lignes.flatMap((l) => (l.numeroSerieId ? [l.numeroSerieId] : []))) } }, select: { id: true, numero: true } }),
    prisma.mouvementCredit.groupBy({ by: ["commandeId"], where: { tenantId: ctx.tenantId, commandeId: { in: ventes.map((v) => v.id) } }, _sum: { montant: true } }),
  ]);
  const dec = decimalesDevise(tenant.devise);
  const politique = reglages.reglages.retours;
  return {
    devise: tenant.devise, politique,
    ventes: ventes.map((v) => ({
      id: v.id, numero: v.numero, facture: v.facture?.numero ?? null, createdAt: v.createdAt.toISOString(),
      clientId: v.clientId, clientNom: v.clientNom, montantTotal: v.montantTotal, montantPaye: v.montantPaye,
      horsDelai: delaiDepasse(v.createdAt, politique.delaiJours),
      /** Ce que le client doit encore sur cette vente (crédit) : déduit du retour avant tout remboursement. */
      creditDu: Math.max(0, dus.find((x) => x.commandeId === v.id)?._sum.montant ?? 0),
      // Le coût ne sort pas : seul ce qu'il faut pour choisir les lignes et prévoir le montant.
      lignes: ventilerVente(v.montantTotal, v.lignes, dec).map((l) => ({
        id: l.id, produitId: l.produitId, nom: l.nom, variante: l.variante, prix: l.prix, quantite: l.quantite, quantiteRetournee: l.quantiteRetournee,
        restant: l.restant, total: l.total, taxe: l.taxe, auPoids: l.mesure !== null, offert: l.offert,
        numeroSerie: numeros.find((n) => n.id === l.numeroSerieId)?.numero ?? null,
      })),
      paiements: v.paiements.map((p) => ({ mode: p.mode, libelle: estModePaiement(p.mode) ? MODES_PAIEMENT[p.mode].libelle : p.mode, montant: p.montant, nonVerifie: p.declaratif, reference: p.reference })),
    })),
  };
}

/** Derniers retours traités en caisse, avec le code de leur avoir. */
export async function listerRetours(ctx: ContextePos, limite = 30) {
  const retours = await prisma.retourRMA.findMany({
    where: { tenantId: ctx.tenantId, traitePar: { not: null } },
    orderBy: { createdAt: "desc" }, take: Math.min(Math.max(limite, 1), 100),
    include: { commande: { select: { numero: true, devise: true } } },
  });
  const avoirs = await prisma.avoirClient.findMany({ where: { tenantId: ctx.tenantId, id: { in: retours.flatMap((r) => (r.avoirId ? [r.avoirId] : [])) } }, select: { id: true, code: true, solde: true, statut: true } });
  return retours.map((r) => ({
    id: r.id, createdAt: r.createdAt.toISOString(), commandeId: r.commandeId, numero: r.commande.numero, clientNom: r.clientNom,
    type: r.type, raison: r.raison, description: r.description, montant: r.montant ?? 0, modeRemboursement: r.modeRemboursement,
    sansRecu: r.sansRecu, lignes: r.lignes, avoir: avoirs.find((a) => a.id === r.avoirId) ?? null,
  }));
}

/** Message d'un retour enregistré, prêt à afficher. */
export function messageRetour(r: ResultatRetour, devise: string): string {
  const morceaux = [`Retour enregistré sur la vente #${r.numero} : ${formatMontant(r.montant, devise)}.`];
  if (r.creditRepris > 0) morceaux.push(`${formatMontant(r.creditRepris, devise)} déduits de ce que le client devait.`);
  for (const p of r.remboursements) morceaux.push(`${formatMontant(p.montant, devise)} à rendre en ${p.libelle.toLowerCase()}${p.nonVerifie ? " (à faire vous-même : AXSO ne l'envoie pas)" : ""}.`);
  if (r.avoir) morceaux.push(`Avoir ${r.avoir.code} de ${formatMontant(r.avoir.montant, devise)}.`);
  return morceaux.join(" ");
}
