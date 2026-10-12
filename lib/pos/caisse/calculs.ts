// Calculs de la caisse, des retours et du rapprochement.
// PUR et CLIENT-SAFE : aucune lecture en base, aucun effet. L'écran s'en sert
// pour afficher (montant d'un retour avant validation, aide au comptage) ; le
// serveur les REFAIT sur les données relues en base — seul son résultat à lui
// est enregistré.
import { ErreurPos } from "../erreurs";
import { arrondir } from "../tarification";

// ─── Aide au comptage du tiroir ───────────────────────────────────────────────

/** Billets et pièces en circulation, du plus grand au plus petit, par devise. */
const COUPURES: Record<string, number[]> = {
  XAF: [10000, 5000, 2000, 1000, 500, 100, 50, 25, 10, 5],
  XOF: [10000, 5000, 2000, 1000, 500, 200, 100, 50, 25, 10, 5],
  EUR: [500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01],
  USD: [100, 50, 20, 10, 5, 2, 1, 0.25, 0.1, 0.05, 0.01],
  NGN: [1000, 500, 200, 100, 50, 20, 10, 5],
  GHS: [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1],
  KES: [1000, 500, 200, 100, 50, 40, 20, 10, 5, 1],
};

/** Coupures d'une devise, ou null si AXSO ne les connaît pas (le montant compté se saisit alors directement). */
export function coupuresPour(devise?: string | null): number[] | null {
  return COUPURES[(devise ?? "").toUpperCase()] ?? null;
}

/** Total d'un comptage par coupures : { "10000": 12, "5000": 3 } → 135 000. */
export function totalComptage(detail: Record<string, number>): number {
  return arrondir(Object.entries(detail).reduce((s, [valeur, nombre]) => s + Number(valeur) * (nombre || 0), 0), 2);
}

// ─── Ventilation d'une vente et valeur d'un retour ────────────────────────────

export type LigneVente = {
  id: string;
  prix: number;
  quantite: number;
  remise?: number | null;
  tauxTVA?: number | null;
  cout?: number | null;
  quantiteRetournee?: number | null;
  offert?: boolean | null;
};

export type LigneVentilee<L extends LigneVente = LigneVente> = L & {
  /** Ce que le client a réellement payé pour la ligne entière, taxes comprises. */
  total: number;
  /** Part de TVA contenue dans `total`. */
  taxe: number;
  /** Quantité encore retournable. */
  restant: number;
};

/**
 * Répartit le total payé d'une vente sur ses lignes, au prorata de leur montant
 * net de remise (la dernière ligne payante absorbe l'arrondi : la somme des
 * lignes vaut toujours le total). Tient pour toutes les ventes : TVA comprise
 * ou ajoutée, remise par ligne (caisse 2.0) ou remise globale (ancienne caisse).
 */
export function ventilerVente<L extends LigneVente>(montantTotal: number, lignes: L[], decimales = 0): LigneVentilee<L>[] {
  const nets = lignes.map((l) => (l.offert ? 0 : Math.max(0, l.prix * l.quantite - (l.remise ?? 0))));
  const somme = nets.reduce((s, n) => s + n, 0);
  let dernier = -1;
  nets.forEach((n, i) => { if (n > 0) dernier = i; });
  let reste = arrondir(Math.max(0, montantTotal), decimales);
  return lignes.map((l, i) => {
    const total = somme <= 0 || nets[i] <= 0 ? 0 : i === dernier ? reste : Math.min(reste, arrondir((montantTotal * nets[i]) / somme, decimales));
    reste = arrondir(reste - total, decimales);
    const taux = Math.max(0, l.tauxTVA ?? 0);
    return { ...l, total, taxe: arrondir(total - total / (1 + taux), decimales), restant: l.quantite - (l.quantiteRetournee ?? 0) };
  });
}

/**
 * Part d'un montant de ligne qui revient à `quantite` unités, sachant que
 * `deja` unités ont déjà été retournées. Calcul par différence de cumuls : les
 * retours partiels successifs d'une ligne totalisent exactement son montant.
 */
export function partRetournee(montantLigne: number, quantiteLigne: number, deja: number, quantite: number, decimales = 0): number {
  if (quantiteLigne <= 0) return 0;
  const cumul = (n: number) => arrondir((montantLigne * n) / quantiteLigne, decimales);
  return arrondir(cumul(deja + quantite) - cumul(deja), decimales);
}

export type DemandeLigneRetour = { ligneCommandeId: string; quantite: number };

export type LigneRetourCalculee<L extends LigneVente = LigneVente> = {
  ligne: LigneVentilee<L>;
  quantite: number;
  /** À rendre au client pour cette ligne, taxes comprises. */
  montant: number;
  taxe: number;
  /** Coût des unités reprises (null : coût inconnu au moment de la vente). */
  cout: number | null;
};

export type RetourCalcule<L extends LigneVente = LigneVente> = {
  lignes: LigneRetourCalculee<L>[];
  montant: number;
  taxes: number;
  /** Marge reprise = montant hors taxes − coût (null si un coût manque). */
  marge: number | null;
  /** Après ce retour, plus rien de la vente n'est retournable. */
  complet: boolean;
};

/** Valeur d'un retour, ligne par ligne. Refuse une ligne inconnue, citée deux fois, ou une quantité au-delà du retournable. */
export function calculerRetour<L extends LigneVente>(lignes: LigneVentilee<L>[], demandes: DemandeLigneRetour[], decimales = 0): RetourCalcule<L> {
  if (!demandes.length) throw new ErreurPos("invalide", 400, "Choisissez au moins un article à retourner.");
  const vues = new Set<string>();
  const calculees = demandes.map((d) => {
    const ligne = lignes.find((l) => l.id === d.ligneCommandeId);
    if (!ligne) throw new ErreurPos("introuvable", 404, "Un article choisi ne fait pas partie de cette vente.");
    if (vues.has(ligne.id)) throw new ErreurPos("invalide", 400, "Un article est cité deux fois dans ce retour.");
    vues.add(ligne.id);
    if (!Number.isInteger(d.quantite) || d.quantite < 1) throw new ErreurPos("invalide", 400, "La quantité retournée doit être un nombre entier supérieur à zéro.");
    if (d.quantite > ligne.restant) {
      throw new ErreurPos("quantite_non_retournable", 409, ligne.restant > 0
        ? "La quantité demandée dépasse ce qu'il reste à retourner sur cet article."
        : "Cet article a déjà été entièrement retourné.", { ligneCommandeId: ligne.id, restant: ligne.restant });
    }
    const deja = ligne.quantite - ligne.restant;
    return {
      ligne, quantite: d.quantite,
      montant: partRetournee(ligne.total, ligne.quantite, deja, d.quantite, decimales),
      taxe: partRetournee(ligne.taxe, ligne.quantite, deja, d.quantite, decimales),
      cout: ligne.cout === null || ligne.cout === undefined ? null : arrondir(ligne.cout * d.quantite, 2),
    };
  });
  const montant = arrondir(calculees.reduce((s, c) => s + c.montant, 0), decimales);
  const taxes = arrondir(calculees.reduce((s, c) => s + c.taxe, 0), decimales);
  return {
    lignes: calculees, montant, taxes,
    marge: calculees.some((c) => c.cout === null) ? null : arrondir(montant - taxes - calculees.reduce((s, c) => s + (c.cout ?? 0), 0), 2),
    complet: lignes.every((l) => l.restant - (calculees.find((c) => c.ligne.id === l.id)?.quantite ?? 0) <= 0),
  };
}

export type PaiementOrigine = { mode: string; montant: number; reference?: string | null; prestataire?: string | null };
export type PartRemboursement = { mode: string; montant: number; reference: string | null; prestataire: string | null };

/**
 * Par quels moyens rendre `montant` au client.
 * « especes » : tout en espèces. « origine » : sur les moyens qui ont réglé la
 * vente, dans leur ordre, chacun plafonné à ce qu'il a encaissé net de ses
 * remboursements ; ce qu'aucun moyen ne couvre est rendu en espèces. Le crédit
 * client n'est jamais ici : il se réduit avant (rien n'a été encaissé).
 */
export function repartirRemboursement(montant: number, paiements: PaiementOrigine[], preference: "origine" | "especes", decimales = 0): PartRemboursement[] {
  let reste = arrondir(montant, decimales);
  if (reste <= 0) return [];
  if (preference === "especes") return [{ mode: "especes", montant: reste, reference: null, prestataire: null }];
  // Net par (moyen, référence), dans l'ordre d'encaissement.
  const groupes = new Map<string, PartRemboursement>();
  for (const p of paiements) {
    if (p.mode === "credit") continue;
    const cle = `${p.mode}|${p.reference ?? ""}`;
    const g = groupes.get(cle) ?? { mode: p.mode, montant: 0, reference: p.reference ?? null, prestataire: p.prestataire ?? null };
    g.montant = arrondir(g.montant + p.montant, decimales);
    groupes.set(cle, g);
  }
  const parts: PartRemboursement[] = [];
  for (const g of groupes.values()) {
    if (reste <= 0) break;
    const pris = Math.min(reste, g.montant);
    if (pris <= 0) continue;
    parts.push({ ...g, montant: pris });
    reste = arrondir(reste - pris, decimales);
  }
  if (reste > 0) {
    const especes = parts.find((p) => p.mode === "especes");
    if (especes) especes.montant = arrondir(especes.montant + reste, decimales);
    else parts.push({ mode: "especes", montant: reste, reference: null, prestataire: null });
  }
  return parts;
}

/** Points de fidélité à reprendre pour un retour partiel : au prorata du montant rendu, sans dépasser ce qui reste acquis. */
export function pointsAReprendre(gagnes: number, acquis: number, montantRetour: number, montantVente: number): number {
  if (gagnes <= 0 || acquis <= 0 || montantVente <= 0) return 0;
  return Math.max(0, Math.min(acquis, Math.round((gagnes * montantRetour) / montantVente)));
}

/** Le délai de retour est-il dépassé ? `delaiJours` = 0 : pas de limite. */
export function delaiDepasse(dateVente: Date | string, delaiJours: number, maintenant: Date = new Date()): boolean {
  return delaiJours > 0 && maintenant.getTime() - new Date(dateVente).getTime() > delaiJours * 86_400_000;
}

// ─── Rapprochement ────────────────────────────────────────────────────────────

/** Moyens dont AXSO tient lui-même la preuve : espèces (comptées à la fermeture), crédit et avoir (tenus en base). */
const MODES_INTERNES = ["especes", "credit", "avoir"];

/**
 * Ce qui prouve un paiement :
 * - prestataire : confirmé par un prestataire relié à AXSO (aucun moyen de la caisse ne l'est aujourd'hui) ;
 * - interne     : tenu par AXSO (espèces comptées, crédit, avoir) ;
 * - pointe      : déclaré par le caissier, puis pointé à la main sur un relevé ;
 * - declare     : déclaré par le caissier, rien d'autre — « Non vérifié ».
 */
export type Preuve = "prestataire" | "interne" | "pointe" | "declare";

export function preuvePaiement(p: { mode: string; declaratif: boolean; rapprochement: string }): Preuve {
  if (p.declaratif) return p.rapprochement === "rapproche" ? "pointe" : "declare";
  return MODES_INTERNES.includes(p.mode) ? "interne" : "prestataire";
}

export type EtapeChaine = { etape: "vente" | "paiement" | "prestataire" | "reglement" | "comptabilite"; etat: "ok" | "declare" | "attente" | "alerte"; texte: string };

/** Chaîne vente → paiement → prestataire → règlement → comptabilité d'un paiement, telle qu'AXSO la connaît vraiment. */
export function chainePaiement(p: { mode: string; declaratif: boolean; rapprochement: string; statut: string; montant: number }): EtapeChaine[] {
  const preuve = preuvePaiement(p);
  const rembourse = p.montant < 0;
  const paiement: EtapeChaine =
    p.statut === "echoue" ? { etape: "paiement", etat: "alerte", texte: "Paiement échoué" }
    : p.statut === "en_attente" ? { etape: "paiement", etat: "attente", texte: "Paiement en attente" }
    : preuve === "declare" || preuve === "pointe" ? { etape: "paiement", etat: "declare", texte: rembourse ? "Remboursement déclaré par le caissier" : "Déclaré par le caissier" }
    : { etape: "paiement", etat: "ok", texte: p.mode === "especes" ? "Espèces, comptées à la fermeture de la caisse" : preuve === "interne" ? "Tenu par AXSO" : "Confirmé par le prestataire" };
  const reglement: EtapeChaine =
    p.rapprochement === "ecart" ? { etape: "reglement", etat: "alerte", texte: "Écart constaté sur le relevé" }
    : p.rapprochement === "inconnu" ? { etape: "reglement", etat: "alerte", texte: "Introuvable sur le relevé" }
    : preuve === "pointe" ? { etape: "reglement", etat: "ok", texte: "Pointé à la main sur le relevé" }
    : preuve === "declare" ? { etape: "reglement", etat: "attente", texte: "À pointer sur le relevé" }
    : preuve === "interne" ? { etape: "reglement", etat: "ok", texte: "Aucun règlement extérieur à attendre" }
    : { etape: "reglement", etat: "attente", texte: "Règlement non suivi" };
  return [
    { etape: "vente", etat: "ok", texte: "Vente enregistrée" },
    paiement,
    preuve === "prestataire" ? { etape: "prestataire", etat: "ok", texte: "Suivi par le prestataire" }
      : preuve === "interne" ? { etape: "prestataire", etat: "ok", texte: "Aucun prestataire concerné" }
      : { etape: "prestataire", etat: "attente", texte: "Aucun prestataire relié — intégration en attente" },
    reglement,
    { etape: "comptabilite", etat: "ok", texte: rembourse ? "Déduit de la comptabilité du magasin" : "Compté dans la comptabilité du magasin" },
  ];
}

export type PaiementCompare = { id: string; mode: string; montant: number; reference?: string | null; createdAt: Date | string };

/**
 * Doublons probables parmi des encaissements : même référence saisie deux fois
 * (« reference »), ou même moyen et même montant à quelques minutes d'écart
 * (« montant » — simple soupçon : deux clients peuvent payer le même prix).
 * Espèces, crédit et avoir sont ignorés (pas de transaction extérieure à doubler).
 * ponytail: comparaison de voisins après tri, sur la page chargée ; passer en SQL si le volume l'exige.
 */
export function detecterDoublons(paiements: PaiementCompare[], fenetreMinutes = 10): Map<string, "reference" | "montant"> {
  const suspects = new Map<string, "reference" | "montant">();
  const candidats = paiements.filter((p) => p.montant > 0 && !MODES_INTERNES.includes(p.mode));
  const parReference = new Map<string, PaiementCompare[]>();
  for (const p of candidats) {
    const ref = p.reference?.replace(/\s+/g, "").toLowerCase();
    if (!ref) continue;
    const cle = `${p.mode}|${ref}`;
    parReference.set(cle, [...(parReference.get(cle) ?? []), p]);
  }
  for (const groupe of parReference.values()) if (groupe.length > 1) for (const p of groupe) suspects.set(p.id, "reference");

  const tries = [...candidats].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  for (let i = 0; i < tries.length; i++) {
    for (let j = i + 1; j < tries.length; j++) {
      if (new Date(tries[j].createdAt).getTime() - new Date(tries[i].createdAt).getTime() > fenetreMinutes * 60_000) break;
      if (tries[i].mode === tries[j].mode && tries[i].montant === tries[j].montant) {
        for (const p of [tries[i], tries[j]]) if (!suspects.has(p.id)) suspects.set(p.id, "montant");
      }
    }
  }
  return suspects;
}
