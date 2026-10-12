// Rapprochement des paiements de caisse. SERVEUR uniquement.
//
// Chaîne suivie : vente → paiement → prestataire → règlement → comptabilité.
// CE QU'AXSO SAIT VRAIMENT (lib/pos/caisse/calculs.ts → preuvePaiement) :
// - espèces, crédit client, avoir : tenus par AXSO, rapprochés d'office ;
// - Mobile Money, carte (TPE externe), virement, QR, bon : DÉCLARÉS par le
//   caissier. Aucun prestataire n'est relié à la caisse : ces paiements ne sont
//   jamais « confirmés ». Ils se pointent à la main, relevé en main, avec la
//   référence lue sur le relevé — c'est le seul rapprochement possible
//   aujourd'hui, et l'écran le dit.
// Un paiement ne passerait « confirmé par le prestataire » que le jour où un
// moyen devient réellement suivi (MODES_PAIEMENT[mode].statut = "actif" hors
// espèces / crédit / avoir) ; rien ici ne le simule.
import { z } from "zod";
import { prisma } from "../prisma";
import { ErreurPos } from "./erreurs";
import { exigerDroit } from "./droits";
import { journaliserAudit } from "./audit";
import { publierEvenement } from "./evenements";
import { avecIdempotence } from "./idempotence";
import { MODES_PAIEMENT } from "./paiements";
import { chainePaiement, detecterDoublons, preuvePaiement } from "./caisse/calculs";
import { nomsUtilisateurs } from "./caisse/mouvements";
import type { ContextePos, ModePaiement } from "./types";

export const STATUTS_RAPPROCHEMENT = ["a_rapprocher", "rapproche", "ecart", "inconnu"] as const;
export const VUES_RAPPROCHEMENT = ["tous", "remboursements", "attente", "doublons"] as const;

/** Lignes chargées au plus pour une période (les doublons se cherchent dans cet ensemble). */
const PLAFOND = 1000;

export type FiltresPaiements = {
  debut?: Date; fin?: Date; mode?: string | null; sessionCaisseId?: string | null;
  rapprochement?: string | null; vue?: (typeof VUES_RAPPROCHEMENT)[number];
};

const libelleMode = (mode: string) => MODES_PAIEMENT[mode as ModePaiement]?.libelle ?? mode;

/** Paiements d'une période (7 derniers jours par défaut), leur preuve, leur chaîne, les doublons probables et les totaux par moyen. */
export async function listerPaiements(ctx: ContextePos, f: FiltresPaiements = {}) {
  exigerDroit(ctx, "rapprochement");
  const fin = f.fin ?? new Date();
  const debut = f.debut ?? new Date(fin.getTime() - 7 * 86_400_000);
  const brut = await prisma.paiementVente.findMany({
    where: {
      tenantId: ctx.tenantId, createdAt: { gte: debut, lte: fin },
      ...(f.mode ? { mode: f.mode } : {}),
      ...(f.sessionCaisseId ? { sessionCaisseId: f.sessionCaisseId } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: PLAFOND,
    include: { commande: { select: { numero: true, clientNom: true, statut: true, caisseId: true } } },
  });
  const [doublons, noms, caisses, sessions] = await Promise.all([
    detecterDoublons(brut),
    nomsUtilisateurs(ctx.tenantId, brut.map((p) => p.encaissePar)),
    prisma.caisse.findMany({ where: { tenantId: ctx.tenantId }, select: { id: true, nom: true, magasin: { select: { nom: true } } } }),
    prisma.sessionCaisse.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { ouverteAt: "desc" }, take: 30, select: { id: true, caisseId: true, ouverteAt: true, fermeeAt: true, statut: true } }),
  ]);
  const nomCaisse = (id: string | null) => { const c = caisses.find((x) => x.id === id); return c ? `${c.magasin.nom} — ${c.nom}` : null; };

  const tous = brut.map((p) => ({
    id: p.id, createdAt: p.createdAt.toISOString(), commandeId: p.commandeId, numero: p.commande.numero, clientNom: p.commande.clientNom,
    venteAnnulee: p.commande.statut === "annulee", sessionCaisseId: p.sessionCaisseId, caisse: nomCaisse(p.commande.caisseId),
    mode: p.mode, libelle: libelleMode(p.mode), montant: p.montant, devise: p.devise, statut: p.statut, declaratif: p.declaratif,
    prestataire: p.prestataire, reference: p.reference, rapprochement: p.rapprochement, rapprocheAt: p.rapprocheAt?.toISOString() ?? null,
    encaissePar: noms[p.encaissePar] ?? null,
    preuve: preuvePaiement(p), chaine: chainePaiement(p), doublon: doublons.get(p.id) ?? null,
  }));

  // Totaux de la période, avant les filtres d'affichage (statut, vue).
  const parMode = new Map<string, { mode: string; libelle: string; statut: string; encaisse: number; rembourse: number; nombre: number; aRapprocher: number }>();
  for (const p of tous) {
    if (p.statut !== "confirme" && p.statut !== "rembourse") continue;
    const t = parMode.get(p.mode) ?? { mode: p.mode, libelle: p.libelle, statut: MODES_PAIEMENT[p.mode as ModePaiement]?.statut ?? "declaratif", encaisse: 0, rembourse: 0, nombre: 0, aRapprocher: 0 };
    if (p.montant >= 0) t.encaisse += p.montant; else t.rembourse -= p.montant;
    t.nombre += 1;
    if (p.rapprochement !== "rapproche") t.aRapprocher += p.montant;
    parMode.set(p.mode, t);
  }

  const vue = f.vue ?? "tous";
  const paiements = tous.filter((p) =>
    (!f.rapprochement || p.rapprochement === f.rapprochement) &&
    (vue === "tous" || (vue === "remboursements" && p.montant < 0) || (vue === "attente" && (p.statut === "en_attente" || p.statut === "echoue")) || (vue === "doublons" && p.doublon !== null)));
  return {
    periode: { debut: debut.toISOString(), fin: fin.toISOString() },
    /** La période contient plus de lignes que ce qui est chargé : resserrer les dates. */
    tronque: brut.length >= PLAFOND,
    paiements,
    parMode: [...parMode.values()],
    compteurs: {
      aRapprocher: tous.filter((p) => p.rapprochement === "a_rapprocher").length,
      ecarts: tous.filter((p) => p.rapprochement === "ecart").length,
      inconnus: tous.filter((p) => p.rapprochement === "inconnu").length,
      doublons: tous.filter((p) => p.doublon !== null).length,
      remboursements: tous.filter((p) => p.montant < 0).length,
      attente: tous.filter((p) => p.statut === "en_attente" || p.statut === "echoue").length,
    },
    sessions: sessions.map((s) => ({ id: s.id, caisse: nomCaisse(s.caisseId), ouverteAt: s.ouverteAt.toISOString(), fermeeAt: s.fermeeAt?.toISOString() ?? null, statut: s.statut })),
  };
}

export type LignePaiement = Awaited<ReturnType<typeof listerPaiements>>["paiements"][number];

const LIBELLES_PREUVE = { prestataire: "Confirmé par le prestataire", interne: "Tenu par AXSO", pointe: "Déclaré, pointé à la main", declare: "Déclaré — non vérifié" } as const;
const LIBELLES_RAPPROCHEMENT: Record<string, string> = { a_rapprocher: "À rapprocher", rapproche: "Rapproché", ecart: "Écart", inconnu: "Inconnu" };

/** Export CSV (séparateur « ; », BOM UTF-8 : s'ouvre tel quel dans Excel). */
export function csvPaiements(lignes: LignePaiement[]): string {
  const champ = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    // Une cellule qui commence par = + - @ serait lue comme une formule par le tableur.
    const sur = /^[=+\-@]/.test(s) && typeof v !== "number" ? `'${s}` : s;
    return /[";\n\r]/.test(sur) ? `"${sur.replace(/"/g, '""')}"` : sur;
  };
  const entete = ["Date", "Vente", "Client", "Caisse", "Session", "Moyen", "Montant", "Devise", "Statut du paiement", "Preuve", "Rapprochement", "Référence", "Prestataire (saisi)", "Pointé le", "Encaissé par", "Doublon probable"];
  const corps = lignes.map((p) => [
    p.createdAt, p.numero, p.clientNom, p.caisse, p.sessionCaisseId, p.libelle, p.montant, p.devise, p.statut,
    LIBELLES_PREUVE[p.preuve], LIBELLES_RAPPROCHEMENT[p.rapprochement] ?? p.rapprochement, p.reference, p.prestataire, p.rapprocheAt, p.encaissePar,
    p.doublon === "reference" ? "Même référence" : p.doublon === "montant" ? "Même montant, même moment" : "",
  ]);
  return "﻿" + [entete, ...corps].map((l) => l.map(champ).join(";")).join("\r\n");
}

export const schemaPointage = z.object({
  cle: z.string().trim().min(8).max(200),
  ids: z.array(z.string().trim().min(1).max(64)).min(1).max(100),
  statut: z.enum(STATUTS_RAPPROCHEMENT),
  /** Référence lue sur le relevé (pointage d'un seul paiement). */
  reference: z.string().trim().max(120).nullish(),
  note: z.string().trim().max(300).nullish(),
  /** Écart : montant réellement vu sur le relevé. */
  montantConstate: z.number().finite().min(-1e12).max(1e12).nullish(),
});
export type DemandePointage = z.infer<typeof schemaPointage>;

/**
 * Pointe à la main des paiements déclaratifs : « rapproche » (référence du
 * relevé obligatoire), « ecart » (montant constaté ou note obligatoire),
 * « inconnu » (introuvable sur le relevé), ou retour à « a_rapprocher ».
 * Idempotent, audité paiement par paiement, diffusé (« payment.updated »).
 */
export async function pointerPaiements(ctx: ContextePos, d: DemandePointage): Promise<{ pointes: number; statut: string; rejoue: boolean }> {
  exigerDroit(ctx, "rapprochement");
  const ids = [...new Set(d.ids)];
  const reference = d.reference?.trim() || null;
  const note = d.note?.trim() || null;
  if (reference && ids.length > 1) throw new ErreurPos("invalide", 400, "Une référence de relevé ne peut être saisie que pour un seul paiement à la fois.");
  if (d.statut === "ecart" && !note && (d.montantConstate === null || d.montantConstate === undefined)) {
    throw new ErreurPos("motif_requis", 422, "Indiquez le montant vu sur le relevé, ou expliquez l'écart.");
  }

  const { resultat, rejoue } = await avecIdempotence(ctx.tenantId, d.cle, "paiement.pointer", async (tx) => {
    const paiements = await tx.paiementVente.findMany({ where: { id: { in: ids }, tenantId: ctx.tenantId }, include: { commande: { select: { numero: true, caisseId: true, magasinId: true } } } });
    if (paiements.length !== ids.length) throw new ErreurPos("introuvable", 404, "Un des paiements choisis est introuvable dans cette boutique.");
    const internes = paiements.filter((p) => !p.declaratif);
    if (internes.length) throw new ErreurPos("conflit", 409, "Les espèces, le crédit client et les avoirs sont tenus par AXSO : il n'y a rien à pointer sur ces paiements.");
    if (d.statut === "rapproche" && paiements.some((p) => !(reference ?? p.reference))) {
      throw new ErreurPos("reference_requise", 422, ids.length > 1
        ? "Certains de ces paiements n'ont pas de référence. Pointez-les un par un en saisissant la référence lue sur le relevé."
        : "Saisissez la référence lue sur le relevé pour pointer ce paiement.");
    }
    for (const p of paiements) {
      const apres = { rapprochement: d.statut, reference: reference ?? p.reference, rapprocheAt: d.statut === "a_rapprocher" ? null : new Date() };
      await tx.paiementVente.update({ where: { id: p.id }, data: apres });
      await journaliserAudit(tx, ctx, {
        action: "paiement.rapproche", entite: "PaiementVente", entiteId: p.id, motif: note,
        avant: { rapprochement: p.rapprochement, reference: p.reference },
        apres: { rapprochement: d.statut, reference: apres.reference, vente: p.commande.numero, mode: p.mode, montant: p.montant, montantConstate: d.montantConstate ?? null },
      });
    }
    await publierEvenement(tx, { tenantId: ctx.tenantId, magasinId: ctx.magasinId, caisseId: null, type: "payment.updated", payload: { paiementIds: ids, rapprochement: d.statut, par: ctx.userNom } });
    return { pointes: paiements.length, statut: d.statut as string };
  }, { appareilId: ctx.appareilId, userId: ctx.userId });
  return { ...resultat, rejoue };
}
