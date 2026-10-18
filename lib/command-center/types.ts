// Jeu de données normalisé du Command Center. Deux sources le produisent
// (lib/command-center/reel.ts depuis la base Axso, lib/command-center/demo.ts
// en données fictives) ; tout le reste (moteur, insights, pages) ne lit que ce
// format — remplacer la démo par du réel ne touche donc aucune page.
// Dates en millisecondes epoch, montants en XAF.

export type Source = "reel" | "demo";
export type PlanId = "palier0" | "palier1" | "palier2";

export const PLANS: { id: PlanId; nom: string; prix: number }[] = [
  { id: "palier0", nom: "Essentiel", prix: 0 },
  { id: "palier1", nom: "Pro", prix: 6000 },
  { id: "palier2", nom: "Illimité", prix: 20000 },
];
export const NOM_PLAN: Record<PlanId, string> = { palier0: "Essentiel", palier1: "Pro", palier2: "Illimité" };
export const PRIX_PLAN: Record<PlanId, number> = { palier0: 0, palier1: 6000, palier2: 20000 };

export const FONCTIONS = ["pos", "axia", "livraison", "constructeur", "marketing", "stock", "commandes", "paiements"] as const;
export type Fonction = (typeof FONCTIONS)[number];
export const NOM_FONCTION: Record<Fonction, string> = {
  pos: "Caisse (POS)", axia: "Axia IA", livraison: "Suivi livraison", constructeur: "Constructeur de boutique",
  marketing: "Marketing", stock: "Stock", commandes: "Commandes", paiements: "Paiements en ligne",
};

export const TYPES_IA = ["description", "image", "pub", "boutique", "conversation", "agent"] as const;
export type TypeIA = (typeof TYPES_IA)[number];
export const NOM_TYPE_IA: Record<TypeIA, string> = {
  description: "Descriptions", image: "Images", pub: "Publicités", boutique: "Génération de boutique", conversation: "Conversations", agent: "Agents IA",
};

export interface Marchand {
  id: string;
  nom: string;
  pays: string; // ISO2
  plan: PlanId; // plan actuel
  industrie: string;
  source: string; // canal d'acquisition : organique | ads_meta | ads_google | parrainage | partenaire | inconnu
  creeLe: number;
  derniereActivite: number | null;
  actif: boolean; // boutique non suspendue
  /** Étapes d'activation (date de première occurrence). */
  etapes: { boutique: number | null; produit: number | null; commande: number | null; paiement: number | null };
  nbProduits: number;
  produitsStockFaible: number;
}

export type StatutCommande = "payee" | "en_attente" | "annulee" | "remboursee" | "echouee";

export interface Commande {
  id: string;
  marchandId: string;
  clientId: string | null;
  date: number;
  montant: number; // XAF
  statut: StatutCommande;
  methode: string; // mobile_money | carte | cod | wave | especes…
  canal: "en_ligne" | "pos";
  livraison: "non_expediee" | "expediee" | "livree" | "echec" | "sans_objet";
  delaiLivraisonH: number | null;
  commission: number; // revenu Axso sur la commande (XAF)
}

/** Paiement d'abonnement : chaque paiement couvre 30 jours. Le MRR se déduit de ces paiements. */
export interface PaiementAbonnement {
  marchandId: string;
  date: number;
  plan: PlanId;
  montant: number;
}

/** `nombre` : requêtes regroupées (la base réelle stocke l'usage IA par mois). */
export interface EvtIA { marchandId: string; date: number; type: TypeIA; nombre: number; tokens: number; cout: number }
export interface EvtFonction { marchandId: string; date: number; fonction: Fonction }
export interface Visites { date: number; source: string; visiteurs: number }
export interface DepenseMarketing { canal: string; campagne: string; date: number; montant: number }
export interface Experience {
  id: string; nom: string; type: string; hypothese: string; statut: "en_cours" | "terminee" | "brouillon";
  debut: number; fin: number | null;
  variantes: { nom: string; population: number; conversions: number }[];
}
export interface Incident { id: string; date: number; titre: string; gravite: "critique" | "majeur" | "mineur"; resoluLe: number | null }
export interface Ticket { id: string; marchandId: string; date: number; resoluLe: number | null; sujet: string }

export interface Dataset {
  source: Source;
  genereA: number;
  /** Domaines sans données dans cette source (ex. "marketing" en réel) : les pages affichent un état vide expliqué. */
  manques: string[];
  marchands: Marchand[];
  commandes: Commande[]; // triées par date croissante
  abonnements: PaiementAbonnement[]; // triés par date croissante
  ia: EvtIA[];
  fonctions: EvtFonction[];
  visites: Visites[];
  depenses: DepenseMarketing[];
  experiences: Experience[];
  incidents: Incident[];
  tickets: Ticket[];
}

export const PAYS: Record<string, string> = {
  CM: "Cameroun", CI: "Côte d'Ivoire", SN: "Sénégal", GA: "Gabon", CD: "RD Congo", TG: "Togo", BJ: "Bénin",
  BF: "Burkina Faso", ML: "Mali", NE: "Niger", CG: "Congo", TD: "Tchad", GN: "Guinée", NG: "Nigeria", GH: "Ghana",
  MA: "Maroc", KE: "Kenya", RW: "Rwanda", CF: "Centrafrique", GQ: "Guinée équatoriale", FR: "France",
};
export const nomPays = (iso: string) => PAYS[iso] ?? iso;

export const SOURCES_ACQ: Record<string, string> = {
  organique: "Organique", ads_meta: "Meta Ads", ads_google: "Google Ads", parrainage: "Parrainage",
  partenaire: "Partenaires", tiktok: "TikTok", inconnu: "Inconnu",
};
