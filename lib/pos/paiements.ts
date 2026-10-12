// Moyens d'encaissement de la caisse derrière une seule porte : `ajouterPaiement`.
// CLIENT-SAFE (aucun import de ../prisma : les fonctions qui écrivent reçoivent
// la transaction) — l'écran lit MODES_PAIEMENT et repartirPaiements.
//
// ÉTAT RÉEL DES MOYENS (même vocabulaire que lib/sourcing/paiements.ts) :
// - actif       : AXSO sait ce qui s'est passé. Espèces (comptées à la
//                 fermeture de caisse), crédit client et avoir (tenus en base).
// - declaratif  : le CAISSIER confirme avoir vu le paiement (SMS Mobile Money,
//                 ticket du TPE, virement, QR). AXSO ne vérifie RIEN auprès d'un
//                 prestataire : le paiement est marqué `declaratif`, « à
//                 rapprocher », et doit toujours s'afficher « non vérifié ».
// - a_connecter : aucune intégration. Le moyen est refusé (501), jamais simulé.
import type { Prisma } from "@prisma/client";
import { ErreurPos } from "./erreurs";
import { exigerDroit } from "./droits";
import { engagerCredit } from "./credit";
import { arrondir } from "./tarification";
import type { ContextePos, DemandePaiementPos, ModePaiement } from "./types";

type Tx = Prisma.TransactionClient;

export type StatutModePaiement = "actif" | "declaratif" | "a_connecter";

export type DefinitionModePaiement = {
  id: ModePaiement;
  libelle: string;
  statut: StatutModePaiement;
  /** Le client peut donner plus que le dû : la différence lui est rendue. */
  rendMonnaie: boolean;
  /** Un client doit être associé à la vente. */
  exigeClient: boolean;
  /** Une référence est attendue (n° de transaction, code de l'avoir). */
  reference: "aucune" | "conseillee" | "obligatoire";
  /** Ce que le caissier et le reçu doivent savoir de ce moyen. */
  mention: string;
};

export const MODES_PAIEMENT: Record<ModePaiement, DefinitionModePaiement> = {
  especes: { id: "especes", libelle: "Espèces", statut: "actif", rendMonnaie: true, exigeClient: false, reference: "aucune", mention: "Comptées à la fermeture de la caisse." },
  mobile_money: { id: "mobile_money", libelle: "Mobile Money", statut: "declaratif", rendMonnaie: false, exigeClient: false, reference: "conseillee", mention: "Non vérifié par AXSO : confirmez la réception sur le téléphone du magasin avant de valider." },
  carte: { id: "carte", libelle: "Carte bancaire (TPE externe)", statut: "declaratif", rendMonnaie: false, exigeClient: false, reference: "conseillee", mention: "Non vérifié par AXSO : le paiement se fait sur votre terminal, AXSO n'y est pas relié." },
  virement: { id: "virement", libelle: "Virement", statut: "declaratif", rendMonnaie: false, exigeClient: false, reference: "conseillee", mention: "Non vérifié par AXSO : à rapprocher de votre relevé bancaire." },
  qr: { id: "qr", libelle: "Paiement QR", statut: "declaratif", rendMonnaie: false, exigeClient: false, reference: "conseillee", mention: "Non vérifié par AXSO : confirmez la réception avant de valider." },
  portefeuille: { id: "portefeuille", libelle: "Portefeuille client", statut: "a_connecter", rendMonnaie: false, exigeClient: true, reference: "aucune", mention: "Intégration en attente : ce moyen de paiement n'est pas encore disponible." },
  credit: { id: "credit", libelle: "Crédit client", statut: "actif", rendMonnaie: false, exigeClient: true, reference: "aucune", mention: "Porté au compte du client : à encaisser plus tard." },
  bon: { id: "bon", libelle: "Bon d'achat", statut: "declaratif", rendMonnaie: false, exigeClient: false, reference: "conseillee", mention: "Non vérifié par AXSO : conservez le bon remis par le client." },
  avoir: { id: "avoir", libelle: "Avoir", statut: "actif", rendMonnaie: false, exigeClient: false, reference: "obligatoire", mention: "Débité de l'avoir du client." },
};

/** Paiement prêt à enregistrer : `montant` = part de la vente réglée, monnaie déjà déduite. */
export type PaiementReparti = DemandePaiementPos & { montantRecu: number | null; monnaieRendue: number | null };

export type Repartition = {
  paiements: PaiementReparti[];
  /** Réellement encaissé (tout sauf le crédit). */
  paye: number;
  /** Part portée au compte du client. */
  credit: number;
  /** Monnaie à rendre. */
  monnaie: number;
  /** Ce que les paiements ne couvrent pas encore (0 = vente soldée). */
  reste: number;
};

/**
 * Affecte des paiements à un total. PURE.
 * Les moyens sans monnaie (Mobile Money, carte, crédit…) sont pris d'abord,
 * pour leur montant exact — ils ne peuvent pas dépasser le reste à payer. Les
 * espèces soldent ensuite ; ce qui dépasse est la monnaie à rendre.
 * Ex. 47 500 = Mobile Money 25 000 + carte 12 500 + espèces 10 000 → reste 0.
 */
export function repartirPaiements(total: number, paiements: DemandePaiementPos[], decimales = 0): Repartition {
  let reste = arrondir(total, decimales);
  let paye = 0, credit = 0, monnaie = 0;
  const repartis: PaiementReparti[] = [];
  const ordonnes = [...paiements].sort((a, b) => Number(MODES_PAIEMENT[a.mode]?.rendMonnaie ?? false) - Number(MODES_PAIEMENT[b.mode]?.rendMonnaie ?? false));
  for (const p of ordonnes) {
    const def = MODES_PAIEMENT[p.mode];
    if (!def) throw new ErreurPos("invalide", 400, "Ce moyen de paiement n'existe pas.");
    const donne = arrondir(p.montant, decimales);
    if (!(donne > 0)) throw new ErreurPos("invalide", 400, `Indiquez le montant payé en ${def.libelle.toLowerCase()}.`);
    if (!def.rendMonnaie && donne > reste) {
      throw new ErreurPos("paiement_trop_eleve", 422, `Le montant en ${def.libelle.toLowerCase()} dépasse ce qu'il reste à payer. Aucune monnaie ne peut être rendue sur ce moyen de paiement.`, { reste });
    }
    const affecte = Math.min(donne, reste);
    const rendu = arrondir(donne - affecte, decimales);
    reste = arrondir(reste - affecte, decimales);
    monnaie = arrondir(monnaie + rendu, decimales);
    if (p.mode === "credit") credit = arrondir(credit + affecte, decimales);
    else paye = arrondir(paye + affecte, decimales);
    // Des espèces tendues alors que tout est déjà réglé : entièrement rendues, rien à enregistrer.
    if (affecte > 0) repartis.push({ ...p, montant: affecte, montantRecu: def.rendMonnaie ? donne : null, monnaieRendue: def.rendMonnaie ? rendu : null });
  }
  return { paiements: repartis, paye, credit, monnaie, reste };
}

export type NouveauPaiement = {
  commandeId: string;
  mode: ModePaiement;
  /** Part de la vente réglée (hors monnaie). NÉGATIF = remboursement (statut « rembourse »). */
  montant: number;
  montantRecu?: number | null;
  monnaieRendue?: number | null;
  prestataire?: string | null;
  reference?: string | null;
  /** Client de la vente — obligatoire pour le crédit. */
  clientId?: string | null;
  /** Délai de paiement du crédit, si le client n'a pas le sien (réglage credit.echeanceJours). */
  echeanceJours?: number;
  /** Heure réelle de l'encaissement (vente saisie hors ligne) ; absent = maintenant. */
  encaisseLe?: Date | null;
};

/**
 * Enregistre un règlement d'une vente, dans la transaction de l'appelant :
 * ligne PaiementVente, Commande.montantPaye (sauf crédit), compte du client
 * (crédit) ou solde de l'avoir. Un moyen « a_connecter » est refusé.
 */
export async function ajouterPaiement(tx: Tx, ctx: ContextePos, p: NouveauPaiement) {
  const def = MODES_PAIEMENT[p.mode];
  if (!def) throw new ErreurPos("invalide", 400, "Ce moyen de paiement n'existe pas.");
  if (def.statut === "a_connecter") {
    throw new ErreurPos("integration_en_attente", 501, `${def.libelle} : intégration en attente. Ce moyen de paiement n'est pas encore disponible, choisissez-en un autre.`);
  }
  exigerDroit(ctx, p.montant < 0 ? "rembourser" : "encaisser");
  if (!p.montant) throw new ErreurPos("invalide", 400, "Le montant du paiement est vide.");
  const reference = p.reference?.trim() || null;
  if (def.reference === "obligatoire" && !reference) throw new ErreurPos("invalide", 400, `Indiquez la référence (${def.libelle.toLowerCase()}).`);

  const commande = await tx.commande.findFirst({ where: { id: p.commandeId, tenantId: ctx.tenantId }, select: { id: true, devise: true, clientId: true } });
  if (!commande) throw new ErreurPos("introuvable", 404, "Cette vente est introuvable dans cette boutique.");
  const clientId = p.clientId ?? commande.clientId;
  if (def.exigeClient && !clientId) throw new ErreurPos("client_requis", 422, `Associez un client à la vente pour utiliser « ${def.libelle} ».`);
  if (p.mode === "credit" && p.montant > 0) exigerDroit(ctx, "vente_credit");

  if (p.mode === "avoir" && p.montant > 0) {
    const debite = await tx.avoirClient.updateMany({
      where: { tenantId: ctx.tenantId, code: reference!, statut: "actif", solde: { gte: p.montant }, OR: [{ expireAt: null }, { expireAt: { gt: new Date() } }] },
      data: { solde: { decrement: p.montant } },
    });
    if (debite.count === 0) throw new ErreurPos("avoir_refuse", 409, "Cet avoir est introuvable, expiré, ou son solde ne couvre pas ce montant.");
    await tx.avoirClient.updateMany({ where: { tenantId: ctx.tenantId, code: reference!, solde: { lte: 0 } }, data: { statut: "epuise" } });
  } else if (p.mode === "avoir") {
    // Remboursement d'un paiement par avoir : le montant retourne sur l'avoir.
    await tx.avoirClient.updateMany({ where: { tenantId: ctx.tenantId, code: reference!, statut: { in: ["actif", "epuise"] } }, data: { solde: { increment: -p.montant }, statut: "actif" } });
  }

  const declaratif = def.statut === "declaratif";
  const paiement = await tx.paiementVente.create({
    data: {
      tenantId: ctx.tenantId, commandeId: commande.id, sessionCaisseId: ctx.sessionCaisseId ?? null,
      mode: p.mode, montant: p.montant, devise: commande.devise,
      statut: p.montant < 0 ? "rembourse" : "confirme",
      declaratif, rapprochement: declaratif ? "a_rapprocher" : "rapproche",
      prestataire: p.prestataire?.trim() || null, reference,
      montantRecu: p.montantRecu ?? null, monnaieRendue: p.monnaieRendue ?? null, encaissePar: ctx.userId,
      ...(p.encaisseLe ? { createdAt: p.encaisseLe } : {}),
    },
  });

  if (p.mode === "credit") {
    if (p.montant > 0) await engagerCredit(tx, ctx, { clientId: clientId!, commandeId: commande.id, montant: p.montant, paiementVenteId: paiement.id, echeanceJours: p.echeanceJours });
  } else {
    await tx.commande.update({ where: { id: commande.id }, data: { montantPaye: { increment: p.montant } } });
  }
  return paiement;
}

/** Où en est le règlement d'une vente (paiements confirmés et remboursements). */
export async function soldeVente(tx: Tx, commandeId: string): Promise<{ total: number; paye: number; credit: number; du: number; nonCouvert: number }> {
  const [commande, paiements] = await Promise.all([
    tx.commande.findUniqueOrThrow({ where: { id: commandeId }, select: { montantTotal: true } }),
    tx.paiementVente.findMany({ where: { commandeId, statut: { in: ["confirme", "rembourse"] } }, select: { mode: true, montant: true } }),
  ]);
  const somme = (credit: boolean) => paiements.filter((p) => (p.mode === "credit") === credit).reduce((s, p) => s + p.montant, 0);
  const paye = arrondir(somme(false), 2), credit = arrondir(somme(true), 2);
  return {
    total: commande.montantTotal, paye, credit,
    /** Ce que le client doit encore (crédit compris). */
    du: arrondir(commande.montantTotal - paye, 2),
    /** Ce qu'aucun paiement ne couvre, pas même le crédit. */
    nonCouvert: arrondir(commande.montantTotal - paye - credit, 2),
  };
}
