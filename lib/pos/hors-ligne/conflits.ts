// Règles de conflit de la synchronisation hors ligne — LOGIQUE PURE.
//
// Jamais « le dernier appareil gagne » :
// - Une vente et ses paiements sont des FAITS : la marchandise est partie,
//   l'argent est dans le tiroir. Le serveur les enregistre toujours ; ce qui ne
//   colle pas avec son état est SIGNALÉ (alerte + audit), pas corrigé en silence.
// - Stock : la vente retire sa quantité (delta), même si le stock passe sous
//   zéro → conflit « survente ».
// - Prix : le prix encaissé est conservé (imposé par lib/pos/vente.ts, option
//   `rejeu`) tant qu'il s'écarte d'au plus 20 % du prix courant → conflit « prix ».
//   Au-delà, la vente n'est PAS enregistrée seule : un responsable la valide.
// - Total : si, prix figés, le serveur n'arrive toujours pas au montant encaissé
//   (promotion commencée ou terminée entre-temps, TVA modifiée) → la vente est
//   enregistrée au montant encaissé quand c'est possible, et l'écart est signalé.
// - Session de caisse fermée entre-temps → jamais rattachée à une session close
//   (ses comptes sont arrêtés) ; rattachée à la session ouverte au moment de la
//   synchronisation, conflit « session » avec le montant à rapprocher.
// - Numéro de série déjà vendu ailleurs → la vente n'est PAS enregistrée : un
//   humain décide (voir service.ts).
import { MODES_PAIEMENT } from "../paiements";
import { arrondir } from "../tarification";
import type { DemandePaiementPos } from "../types";
import type { ConflitSync } from "./file";

/**
 * Ramène les paiements sans rendu de monnaie (Mobile Money, carte…) au total
 * que le serveur enregistre : le serveur refuse qu'ils le dépassent. Les
 * espèces ne sont pas touchées (l'excédent devient de la monnaie rendue).
 */
export function plafonnerPaiements(paiements: DemandePaiementPos[], total: number, decimales = 0): DemandePaiementPos[] {
  let reste = arrondir(total, decimales);
  const garde: DemandePaiementPos[] = [];
  for (const p of paiements) {
    if (MODES_PAIEMENT[p.mode]?.rendMonnaie) { garde.push(p); continue; }
    const montant = Math.min(arrondir(p.montant, decimales), reste);
    reste = arrondir(reste - montant, decimales);
    if (montant > 0) garde.push({ ...p, montant });
  }
  return garde;
}

export type EntreeConflits = {
  /** Numéro définitif (serveur) et numéro provisoire (reçu remis au client). */
  numero: string;
  numeroLocal: string;
  totalServeur: number;
  totalLocal: number;
  /** Session ouverte quand la vente a été faite / session à laquelle le serveur l'a rattachée. */
  sessionLocale: string | null;
  sessionServeur: string | null;
  /** Espèces de la vente (pour rapprocher l'écart de fermeture). */
  especes: number;
  /** Remise ajoutée par la synchronisation pour que la vente soit enregistrée au montant encaissé (0 = aucune). */
  remiseSync: number;
  lignes: {
    nom: string;
    /** Prix enregistré (encaissé), à la pièce ou au kilo. */
    prixEncaisse: number;
    /** Prix du catalogue au moment de la synchronisation, s'il diffère ; null sinon. */
    prixCatalogue: number | null;
    /** Le caissier avait lui-même changé ce prix (geste commercial tracé à part). */
    parCaissier: boolean;
  }[];
  /** Stock du magasin APRÈS la vente, par article vendu. */
  stocks: { nom: string; apres: number }[];
  /** Réglage « vente sans stock » : un stock négatif est alors voulu par la boutique. */
  venteSansStock: boolean;
  fmt: (montant: number) => string;
};

/** Écarts d'une vente hors ligne une fois enregistrée. Calculé sur l'état APRÈS écriture : rejouer donne la même liste. */
export function detecterConflits(e: EntreeConflits): ConflitSync[] {
  const conflits: ConflitSync[] = [];
  const survendus = e.venteSansStock ? [] : e.stocks.filter((s) => s.apres < 0);
  if (survendus.length) {
    conflits.push({
      type: "survente",
      message: `Vente ${e.numero} : stock dépassé pour ${survendus.map((s) => `« ${s.nom} » (${s.apres})`).join(", ")}. La vente a eu lieu hors ligne, elle est enregistrée ; vérifiez le stock réel de ces articles.`,
      details: { articles: survendus },
    });
  }
  const prix = e.lignes.filter((l) => !l.parCaissier && l.prixCatalogue !== null && l.prixCatalogue !== l.prixEncaisse);
  if (prix.length) {
    conflits.push({
      type: "prix",
      message: `Vente ${e.numero} : prix modifié depuis la vente hors ligne — ${prix.map((l) => `« ${l.nom} » encaissé ${e.fmt(l.prixEncaisse)}, catalogue ${e.fmt(l.prixCatalogue as number)}`).join(" ; ")}. Le prix encaissé est conservé.`,
      details: { lignes: prix.map((l) => ({ nom: l.nom, prixEncaisse: l.prixEncaisse, prixCatalogue: l.prixCatalogue })) },
    });
  }
  if (e.totalServeur !== e.totalLocal) {
    const ecart = e.totalLocal - e.totalServeur;
    conflits.push({
      type: "total",
      message: `Vente ${e.numero} : ${e.fmt(e.totalLocal)} encaissés hors ligne, ${e.fmt(e.totalServeur)} enregistrés (promotion ou taxe modifiée entre-temps). Écart de ${e.fmt(Math.abs(ecart))} ${ecart > 0 ? "encaissé en trop : à rendre au client ou à régulariser en caisse" : "manquant : à régulariser"}.`,
      details: { totalLocal: e.totalLocal, totalServeur: e.totalServeur, ecart },
    });
  }
  if (e.remiseSync > 0) {
    conflits.push({
      type: "total",
      message: `Vente ${e.numero} : au moment de la synchronisation, le total recalculé dépassait de ${e.fmt(e.remiseSync)} le montant encaissé hors ligne (promotion terminée ou taxe modifiée entre-temps). Le montant encaissé est conservé ; l'écart est enregistré comme une remise.`,
      details: { remise: e.remiseSync },
    });
  }
  if (e.sessionLocale && e.sessionLocale !== e.sessionServeur) {
    conflits.push({
      type: "session",
      message: `Vente ${e.numero} : la session de caisse ouverte au moment de la vente a été fermée avant la synchronisation. ${e.sessionServeur ? "La vente est rattachée à la session ouverte aujourd'hui" : "La vente n'est rattachée à aucune session"}${e.especes > 0 ? ` ; ${e.fmt(e.especes)} en espèces sont à rapprocher de l'écart constaté à la fermeture` : ""}.`,
      details: { sessionLocale: e.sessionLocale, sessionServeur: e.sessionServeur, especes: e.especes },
    });
  }
  return conflits.map((c) => ({ ...c, details: { ...c.details, numeroProvisoire: e.numeroLocal } }));
}
