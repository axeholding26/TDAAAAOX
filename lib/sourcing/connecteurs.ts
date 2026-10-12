// Connecteurs fournisseurs — le cœur d'Axso ne connaît QUE l'interface
// SupplierConnector. Brancher Alibaba, 1688, AliExpress ou CJdropshipping =
// écrire les méthodes de l'adapter correspondant ci-dessous et passer son
// statut à « actif » ; rien d'autre à modifier.
//
// Module pur (zod seulement), importable côté client pour afficher la liste.
//
// ÉTAT RÉEL DES INTÉGRATIONS (ne rien présenter d'autre au marchand) :
// - « manuel »  : ACTIF. Le marchand saisit la fiche (ou colle le lien du
//   produit) ; aucune donnée n'est inventée.
// - « sandbox » : produit de démonstration, clairement marqué, pour essayer le
//   parcours. Jamais publiable en boutique.
// - alibaba, 1688, aliexpress, cjdropshipping : À CONNECTER. Aucune API n'est
//   appelée ; leurs méthodes lèvent ConnecteurNonBranche.
import { z } from "zod";
import { schemaDevise } from "./cout-rendu";

export type StatutIntegration = "actif" | "sandbox" | "a_connecter";

export const LIBELLE_STATUT: Record<StatutIntegration, string> = {
  actif: "Actif",
  sandbox: "Sandbox — démonstration",
  a_connecter: "À connecter",
};

/** Fiche produit telle qu'un fournisseur la fournit — tout sauf nom et prix est optionnel (« lorsque disponible »). */
export const schemaProduitSource = z.object({
  refExterne: z.string().max(200).optional(),
  url: z.string().url().max(2000).optional(),
  nom: z.string().trim().min(2).max(200),
  description: z.string().max(20000).optional(),
  images: z.array(z.string().url().max(2000)).max(30).default([]),
  videos: z.array(z.string().url().max(2000)).max(10).default([]),
  variantes: z.array(z.object({
    nom: z.string().max(60), valeur: z.string().max(120),
    prix: z.number().nonnegative().optional(), sku: z.string().max(120).optional(), stock: z.number().int().nonnegative().optional(),
  })).max(200).default([]),
  prixFournisseur: z.number().positive(),
  deviseFournisseur: schemaDevise.default("USD"),
  moq: z.number().int().positive().default(1),
  poidsKg: z.number().positive().optional(),
  dimensions: z.object({ longueurCm: z.number().positive(), largeurCm: z.number().positive(), hauteurCm: z.number().positive() }).optional(),
  logistique: z.object({ delaiJours: z.number().int().positive().optional(), modes: z.array(z.string().max(40)).max(10).optional(), origine: z.string().max(80).optional() }).optional(),
  sku: z.string().max(120).optional(),
  disponibilite: z.number().int().nonnegative().optional(),
  fournisseurNom: z.string().max(200).optional(),
});
export type ProduitSourceBrut = z.infer<typeof schemaProduitSource>;

/** Commande à transmettre à un fournisseur. */
export interface CommandeAFournir {
  numero: string;
  lignes: { nom: string; quantite: number; variante?: string | null; sku?: string | null }[];
  destinataire: { nom: string; telephone: string; adresse: string; ville: string; pays: string };
}

export interface SupplierConnector {
  id: string;
  nom: string;
  statut: StatutIntegration;
  description: string;
  /** Site où le marchand cherche lui-même ses produits. */
  urlSite?: string;
  /** Recherche dans le catalogue du fournisseur. */
  rechercher(requete: string): Promise<ProduitSourceBrut[]>;
  /** Fiche complète d'un produit, depuis son lien ou des données saisies. */
  importer(entree: { url?: string; donnees?: unknown }): Promise<ProduitSourceBrut>;
  /** Transmet une commande ; renvoie la référence fournisseur, ou un message à envoyer soi-même. */
  passerCommande(commande: CommandeAFournir): Promise<{ reference?: string; messageAEnvoyer?: string }>;
  /** Suivi d'une commande fournisseur. */
  suivre(reference: string): Promise<{ statut: string; trackingNo?: string }>;
}

export class ConnecteurNonBranche extends Error {
  status = 501;
  constructor(nom: string) {
    super(`Le connecteur ${nom} n'est pas encore branché à l'API du fournisseur. Importez le produit manuellement en attendant.`);
  }
}

/** Adapter déclaré mais non branché : chaque appel échoue explicitement, rien n'est simulé. */
function aConnecter(id: string, nom: string, description: string, urlSite: string): SupplierConnector {
  const refuser = async (): Promise<never> => { throw new ConnecteurNonBranche(nom); };
  return { id, nom, statut: "a_connecter", description, urlSite, rechercher: refuser, importer: refuser, passerCommande: refuser, suivre: refuser };
}

/** Texte de commande que le marchand envoie lui-même au fournisseur (WhatsApp, e-mail, messagerie de la plateforme). */
export function messageCommandeFournisseur(c: CommandeAFournir): string {
  return [
    `Bonjour, je souhaite passer la commande ${c.numero} :`,
    ...c.lignes.map((l) => `- ${l.quantite} × ${l.nom}${l.variante ? ` (${l.variante})` : ""}${l.sku ? ` — réf. ${l.sku}` : ""}`),
    "",
    "Adresse de livraison :",
    `${c.destinataire.nom} — ${c.destinataire.telephone}`,
    `${c.destinataire.adresse}, ${c.destinataire.ville}, ${c.destinataire.pays}`,
    "",
    "Merci de me confirmer le montant, le délai et le numéro de suivi.",
  ].join("\n");
}

const manuel: SupplierConnector = {
  id: "manuel",
  nom: "Saisie manuelle",
  statut: "actif",
  description: "Vous copiez les informations du produit depuis le site du fournisseur. Fonctionne avec n'importe quel fournisseur.",
  rechercher: async () => [],
  importer: async ({ url, donnees }) => schemaProduitSource.parse({ ...(donnees as object), ...(url ? { url } : {}) }),
  passerCommande: async (commande) => ({ messageAEnvoyer: messageCommandeFournisseur(commande) }),
  suivre: async () => { throw new Error("Suivi manuel : saisissez le numéro de suivi reçu du fournisseur."); },
};

/** Produit FICTIF de démonstration — sert uniquement à essayer le parcours. */
const PRODUIT_SANDBOX: ProduitSourceBrut = {
  refExterne: "sandbox-demo-1",
  nom: "[DÉMO] Produit d'essai — données fictives",
  description: "Produit de démonstration du mode sandbox. Ses prix, son poids et son stock sont fictifs : il sert à essayer le calculateur et le parcours, il ne peut pas être publié.",
  images: [], videos: [],
  variantes: [{ nom: "Couleur", valeur: "Noir" }, { nom: "Couleur", valeur: "Blanc" }],
  prixFournisseur: 4.5, deviseFournisseur: "USD", moq: 1, poidsKg: 0.25,
  logistique: { delaiJours: 15, modes: ["aerien"], origine: "Sandbox" },
  sku: "SANDBOX-001", disponibilite: 500, fournisseurNom: "Fournisseur sandbox (fictif)",
};

const sandbox: SupplierConnector = {
  id: "sandbox",
  nom: "Sandbox",
  statut: "sandbox",
  description: "Produit de démonstration aux données fictives, pour essayer le parcours sans fournisseur. Non publiable.",
  rechercher: async () => [PRODUIT_SANDBOX],
  importer: async () => PRODUIT_SANDBOX,
  passerCommande: async (c) => ({ reference: `SANDBOX-${c.numero}` }),
  suivre: async () => ({ statut: "sandbox" }),
};

export const CONNECTEURS: SupplierConnector[] = [
  manuel,
  aConnecter("alibaba", "Alibaba", "Grossistes et fabricants, commandes en volume.", "https://www.alibaba.com"),
  aConnecter("1688", "1688", "Marché intérieur chinois, prix d'usine (site en chinois, agent d'achat conseillé).", "https://www.1688.com"),
  aConnecter("aliexpress", "AliExpress", "Achat à l'unité, adapté au test de produit.", "https://www.aliexpress.com"),
  aConnecter("cjdropshipping", "CJdropshipping", "Dropshipping avec préparation et expédition des commandes.", "https://cjdropshipping.com"),
  sandbox,
];

export function connecteur(id: string): SupplierConnector {
  return CONNECTEURS.find((c) => c.id === id) ?? manuel;
}
