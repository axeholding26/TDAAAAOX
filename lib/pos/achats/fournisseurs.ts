// Fournisseurs d'un produit : principal, alternatifs, comparaison et
// recommandation expliquée. SERVEUR uniquement.
//
// Le classement et la recommandation sont ceux d'AXSO Sourcing
// (lib/sourcing/fournisseurs/classement.ts), appliqués aux offres
// (ProduitFournisseur) rattachées à ce produit. La caisse y ajoute les prix
// RÉELLEMENT payés : LigneReception.coutUnitaire, réception par réception.
// Un critère sans donnée a une note null : l'écran affiche « non renseigné ».
import { prisma } from "../../prisma";
import { classer, construireCandidats, recommander } from "../../sourcing/fournisseurs/classement";
import { chargerDossiers, parametresBoutique } from "../../sourcing/fournisseurs/service";
import { journaliserAudit } from "../audit";
import { exigerDroit } from "../droits";
import { erreurs } from "../erreurs";
import type { ContextePos } from "../types";

/** Les cinq critères du cahier des charges, dans l'ordre d'affichage. */
const CRITERES = [["prix", "Prix"], ["logistique", "Délai"], ["fiabilite", "Fiabilité"], ["moq", "Quantité"], ["qualite", "Qualité"]] as const;
const HISTORIQUE_MAX = 300;

export async function comparerFournisseursProduit(tenantId: string, produitId: string, quantiteVisee?: number) {
  const produit = await prisma.produit.findFirst({ where: { id: produitId, tenantId }, select: { id: true, nom: true, cout: true, uniteVente: true } });
  if (!produit) throw erreurs.introuvable("Ce produit");
  const quantite = Math.max(1, Math.floor(quantiteVisee || 1));

  const [dossiers, parametres, receptions] = await Promise.all([
    chargerDossiers(tenantId, { offres: { some: { produitId } } }),
    parametresBoutique(tenantId, quantite),
    prisma.ligneReception.findMany({
      where: { produitId, reception: { tenantId, statut: "validee" } },
      select: { quantite: true, coutUnitaire: true, reception: { select: { fournisseurId: true, recuAt: true } } },
      orderBy: { reception: { recuAt: "desc" } }, take: HISTORIQUE_MAX,
    }),
  ]);
  const offresDuProduit = (d: (typeof dossiers)[number]) => d.offres.filter((o) => o.produitId === produitId);
  const candidats = construireCandidats(dossiers, offresDuProduit, parametres.logistique, { comparables: true, tco: parametres.tco });
  const principalId = dossiers.flatMap(offresDuProduit).find((o) => o.principal)?.id ?? null;

  /** Prix réellement payés, du plus récent au plus ancien, par fournisseur (clé "" : réception sans fournisseur). */
  const payes = new Map<string, { date: string; cout: number; quantite: number }[]>();
  for (const r of receptions) {
    const cle = r.reception.fournisseurId ?? "";
    payes.set(cle, [...(payes.get(cle) ?? []), { date: r.reception.recuAt.toISOString(), cout: r.coutUnitaire, quantite: r.quantite }]);
  }

  const offres = candidats.map((c) => {
    const historique = payes.get(c.fournisseur.id) ?? [];
    return {
      ref: c.ref, offreId: c.offre!.id, fournisseurId: c.fournisseur.id, nom: c.fournisseur.nom, pays: c.fournisseur.pays,
      principal: c.offre!.id === principalId,
      /** Prix annoncé par le fournisseur pour la quantité visée, dans SA devise. */
      prixAnnonce: c.cout ? { montant: c.cout.prix, devise: c.cout.devisePrix } : null,
      /** Estimation AXSO du coût rendu (transport, droits : réglages de Sourcing), dans la devise de la boutique. */
      coutRendu: c.cout ? { montant: c.cout.total, devise: c.cout.devise } : null,
      moq: c.offre!.moq,
      delaiJours: c.delaiJours,
      delaiConstate: c.analyse.qualite.delaiReelMoyen !== null,
      disponible: c.offre!.disponible,
      score: c.analyse.score,
      couverture: c.analyse.couverture,
      risque: c.analyse.risque.niveau,
      criteres: CRITERES.map(([cle, libelle]) => {
        const critere = c.analyse.criteres.find((x) => x.cle === cle);
        return { cle, libelle, note: critere?.note ?? null, raison: critere?.raison ?? "" };
      }),
      /** Prix réellement payés à ce fournisseur pour ce produit (devise de la boutique). */
      historique: historique.slice(0, 12),
      dernierPrixPaye: historique[0]?.cout ?? null,
      receptions: historique.length,
    };
  });
  const connus = new Set(offres.map((o) => o.fournisseurId));
  return {
    produit: { id: produit.id, nom: produit.nom, uniteVente: produit.uniteVente, coutActuel: produit.cout },
    quantite, devise: parametres.contexte.devise,
    offres,
    /** Réceptions de ce produit hors des offres comparées (autre fournisseur, ou fournisseur non précisé). */
    autresReceptions: [...payes.entries()].filter(([id]) => !connus.has(id)).flatMap(([, h]) => h).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12),
    classement: classer(candidats),
    recommandation: recommander(candidats, quantite),
  };
}
export type ComparaisonFournisseurs = Awaited<ReturnType<typeof comparerFournisseursProduit>>;

/** Désigne l'offre (donc le fournisseur) principale d'un produit : celle que le réapprovisionnement retient. */
export async function definirFournisseurPrincipal(ctx: ContextePos, produitId: string, offreId: string) {
  exigerDroit(ctx, "achat_valider");
  await prisma.$transaction(async (tx) => {
    const offres = await tx.produitFournisseur.findMany({ where: { tenantId: ctx.tenantId, produitId }, select: { id: true, principal: true, fournisseur: { select: { nom: true } } } });
    const choisie = offres.find((o) => o.id === offreId);
    if (!choisie) throw erreurs.introuvable("Cette offre fournisseur");
    const avant = offres.find((o) => o.principal);
    if (avant?.id === offreId) return;
    await tx.produitFournisseur.updateMany({ where: { tenantId: ctx.tenantId, produitId, principal: true }, data: { principal: false } });
    await tx.produitFournisseur.update({ where: { id: offreId }, data: { principal: true } });
    await journaliserAudit(tx, ctx, {
      action: "fournisseur.principal_defini", entite: "Produit", entiteId: produitId,
      avant: { fournisseur: avant?.fournisseur.nom ?? null }, apres: { fournisseur: choisie.fournisseur.nom, offreId },
    });
  });
  return { ok: true, produitId, offreId };
}
