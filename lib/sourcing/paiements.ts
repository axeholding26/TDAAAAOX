// Moyens d'encaissement par pays derrière une seule interface, PaymentProvider.
// SERVEUR uniquement (l'adapter NotchPay lit les clés d'API de l'environnement ;
// elles ne sortent jamais d'ici — `etatPaiements()` ne renvoie que des statuts).
//
// ÉTAT RÉEL DES INTÉGRATIONS :
// - notchpay : ACTIF si ses clés sont configurées — le seul encaissement en
//   ligne réellement branché (lib/notchpay.ts). C'est lui qu'utilise la vitrine.
// - cod (paiement à la livraison) : ACTIF, sans API — espèces remises au
//   livreur, aucune commission Axso.
// - mtn_momo, orange_money, wave (API directes des opérateurs) : À CONNECTER.
//   Leurs méthodes lèvent PaiementNonBranche ; rien n'est simulé.
import { hasNotchPay, initierPaiementNotchPay, verifierPaiementNotchPay, rembourserPaiementNotchPay, verifierSignatureWebhook } from "../notchpay";
import { configPays, LIBELLES_PAIEMENT, type CodePays, type MoyenPaiement } from "./pays";
import type { StatutIntegration } from "./connecteurs";

export interface DemandePaiement {
  montant: number;
  devise: string;
  /** Référence unique de la commande : la même référence ne s'encaisse jamais deux fois (idempotence). */
  reference: string;
  description: string;
  client: { nom: string; email: string; telephone?: string };
  urlRetour: string;
}

export interface PaymentProvider {
  id: string;
  nom: string;
  statut: StatutIntegration;
  /** Moyens de paiement couverts par cet adapter. */
  moyens: MoyenPaiement[];
  initier(demande: DemandePaiement): Promise<{ reference: string; urlPaiement?: string }>;
  verifier(reference: string): Promise<{ paye: boolean; brut?: unknown }>;
  rembourser(reference: string, raison: string): Promise<void>;
  /** Authenticité d'un webhook (signature) — à appeler avant toute lecture du corps. */
  verifierWebhook(corpsBrut: string, signature: string | null): boolean;
}

export class PaiementNonBranche extends Error {
  status = 501;
  constructor(nom: string) {
    super(`${nom} n'est pas encore branché en direct. Les paiements en ligne passent par NotchPay.`);
  }
}

const notchpay: PaymentProvider = {
  id: "notchpay",
  nom: "NotchPay",
  get statut() { return hasNotchPay() ? "actif" as const : "a_connecter" as const; },
  // Les opérateurs réellement proposés au client dépendent du compte NotchPay et du pays.
  moyens: ["mtn_momo", "orange_money", "carte"],
  initier: async (d) => {
    const r = await initierPaiementNotchPay({
      amount: d.montant, currency: d.devise, email: d.client.email, name: d.client.nom, phone: d.client.telephone,
      description: d.description, reference: d.reference, callback: d.urlRetour,
    });
    return { reference: r.transaction?.reference ?? d.reference, urlPaiement: r.authorizationUrl };
  },
  verifier: async (reference) => {
    const { transaction } = await verifierPaiementNotchPay(reference);
    return { paye: transaction?.status === "complete", brut: transaction };
  },
  rembourser: async (reference, raison) => { await rembourserPaiementNotchPay(reference, raison); },
  verifierWebhook: verifierSignatureWebhook,
};

const cod: PaymentProvider = {
  id: "cod",
  nom: LIBELLES_PAIEMENT.cod,
  statut: "actif",
  moyens: ["cod"],
  // Rien à encaisser en ligne : l'argent est remis au livreur, puis au marchand
  // (marquerEspecesRemises, lib/cycle-livraison.ts).
  initier: async (d) => ({ reference: d.reference }),
  verifier: async () => ({ paye: false }),
  rembourser: async () => { throw new Error("Paiement à la livraison : le remboursement se fait de la main à la main."); },
  verifierWebhook: () => false,
};

function aConnecter(id: MoyenPaiement): PaymentProvider {
  const nom = LIBELLES_PAIEMENT[id];
  const refuser = async (): Promise<never> => { throw new PaiementNonBranche(nom); };
  return { id, nom: `${nom} (API directe)`, statut: "a_connecter", moyens: [id], initier: refuser, verifier: refuser, rembourser: refuser, verifierWebhook: () => false };
}

export const PRESTATAIRES_PAIEMENT: PaymentProvider[] = [notchpay, cod, aConnecter("mtn_momo"), aConnecter("orange_money"), aConnecter("wave")];

export function prestatairePaiement(id: string): PaymentProvider | undefined {
  return PRESTATAIRES_PAIEMENT.find((p) => p.id === id);
}

/**
 * Pour un pays : chaque moyen de paiement courant et l'adapter ACTIF qui
 * l'encaisse aujourd'hui (null = pas encore encaissable sur Axso).
 */
export function etatPaiements(pays: CodePays) {
  return configPays(pays).moyensPaiement.map((moyen) => {
    const actif = PRESTATAIRES_PAIEMENT.find((p) => p.statut === "actif" && p.moyens.includes(moyen));
    return { moyen, libelle: LIBELLES_PAIEMENT[moyen], via: actif?.nom ?? null, statut: (actif ? "actif" : "a_connecter") as StatutIntegration };
  });
}
