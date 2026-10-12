// Réception de marchandise (ReceptionAchat), rattachée ou non à un bon de
// commande. SERVEUR uniquement.
//
// UNE réception validée = UNE transaction idempotente qui, pour chaque ligne :
// 1. crée le lot (code, expiration, coût, fournisseur, entrepôt) si un code
//    ou une date d'expiration est saisi ;
// 2. entre la quantité en stock par mouvementStock, type « reception », avec
//    refs.lotId et refs.receptionId ;
// 3. met à jour le coût de l'article au COÛT MOYEN PONDÉRÉ (./regles.ts →
//    coutApresReception) ; un coût saisi à 0 (non renseigné) n'y touche pas ;
// 4. enregistre les numéros de série des produits suivis (un par unité) ;
// 5. incrémente `quantiteRecue` de la ligne du bon.
// Puis le bon passe à « partiellement reçu » ou « reçu », l'audit est écrit et
// l'événement inventory.updated publié.
//
// Recevoir plus que commandé est accepté (le fournisseur livre parfois plus) :
// la ligne du bon l'affiche. Un produit absent du bon est accepté aussi et
// entre en stock sans toucher au bon.
import { z } from "zod";
import { prisma } from "../../prisma";
import { genererNumeroCommande } from "../../utils";
import { journaliserAudit } from "../audit";
import { exigerDroit, exigerLieu } from "../droits";
import { ErreurPos, erreurs } from "../erreurs";
import { publierEvenement } from "../evenements";
import { avecIdempotence, avecRepriseCollision } from "../idempotence";
import { entrepotDuMagasin } from "../magasins";
import { mouvementStock, resoudreLieu } from "../stock";
import { decimalesDevise } from "../tarification";
import { normaliserSerie, type ContextePos } from "../types";
import { LIBELLES_STATUT_BON, STATUTS_RECEVABLES, coutApresReception, statutApresReception, type StatutBon } from "./regles";

export const MAX_LIGNES_RECEPTION = 200;

const dateOptionnelle = z.string().nullish().refine((d) => !d || !Number.isNaN(Date.parse(d)), "La date d'expiration est illisible.");

export const schemaReception = z.object({
  bonCommandeId: z.string().min(1).nullish(),
  /** Sans bon : fournisseur et entrepôt de la réception (défaut : entrepôt du magasin de la caisse). */
  fournisseurId: z.string().min(1).nullish(),
  entrepotId: z.string().min(1).nullish(),
  /** Numéro du bon de livraison du fournisseur. */
  reference: z.string().trim().max(120).nullish(),
  lignes: z.array(z.object({
    produitId: z.string().min(1),
    varianteId: z.string().min(1).nullish(),
    quantite: z.number().int("La quantité reçue doit être un nombre entier.").positive("La quantité reçue doit être supérieure à zéro.").max(10_000_000),
    /** Coût réel payé : à la pièce, au kilo pour un produit au poids. 0 = non renseigné. */
    coutUnitaire: z.number().min(0, "Le coût ne peut pas être négatif.").max(1e12),
    lot: z.object({ code: z.string().trim().max(80).nullish(), expiration: dateOptionnelle }).nullish(),
    numerosSerie: z.array(z.string().trim().min(1).max(120).transform(normaliserSerie)).max(5000).default([]),
  })).min(1, "Ajoutez au moins un produit reçu.").max(MAX_LIGNES_RECEPTION, `Une réception contient ${MAX_LIGNES_RECEPTION} lignes au plus : validez-la en plusieurs fois.`),
});
export type DemandeReception = z.infer<typeof schemaReception>;

export type ResultatReception = {
  receptionId: string;
  lignes: number;
  unites: number;
  bon: { id: string; numero: string; statut: string } | null;
  /** Coût de chaque article avant et après, avec la règle appliquée. */
  couts: { produitId: string; varianteId: string | null; nom: string; avant: number | null; apres: number | null; regle: "moyen_pondere" | "dernier_cout" | "inchange" }[];
};

const codeLotAuto = () => genererNumeroCommande().replace(/^AX-/, "LOT-");

export async function enregistrerReception(ctx: ContextePos, d: DemandeReception, cle: string | undefined): Promise<ResultatReception & { rejoue: boolean }> {
  exigerDroit(ctx, "reception");

  // ── Vérifications en lecture, avant d'ouvrir la transaction (messages précis).
  const [tenant, produits, fournisseur] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { devise: true } }),
    prisma.produit.findMany({
      where: { tenantId: ctx.tenantId, id: { in: [...new Set(d.lignes.map((l) => l.produitId))] } },
      select: { id: true, nom: true, type: true, suiviSerie: true, variantes: { select: { id: true, nom: true, valeur: true } } },
    }),
    d.fournisseurId ? prisma.fournisseur.findFirst({ where: { id: d.fournisseurId, tenantId: ctx.tenantId }, select: { id: true, nom: true } }) : null,
  ]);
  if (d.fournisseurId && !fournisseur) throw erreurs.introuvable("Ce fournisseur");
  const fiche = new Map(produits.map((p) => [p.id, p]));
  const nomLigne = (l: DemandeReception["lignes"][number]) => {
    const p = fiche.get(l.produitId)!;
    const v = p.variantes.find((x) => x.id === l.varianteId);
    return v ? `${p.nom} (${v.nom}: ${v.valeur})` : p.nom;
  };
  for (const l of d.lignes) {
    const p = fiche.get(l.produitId);
    if (!p) throw erreurs.introuvable("Un des produits reçus");
    if (p.type !== "physique") throw erreurs.invalide(`« ${p.nom} » n'a pas de stock suivi : il ne peut pas être réceptionné.`);
    if (p.variantes.length && !l.varianteId) throw new ErreurPos("variante_requise", 400, `« ${p.nom} » existe en plusieurs variantes : précisez laquelle a été reçue.`);
    if (l.varianteId && !p.variantes.some((v) => v.id === l.varianteId)) throw erreurs.introuvable(`La variante choisie pour « ${p.nom} »`);
    if (p.suiviSerie && l.numerosSerie.length !== l.quantite) {
      throw new ErreurPos("serie_requise", 400, `« ${p.nom} » est suivi par numéro de série : saisissez ${l.quantite} numéro(s), ${l.numerosSerie.length} reçu(s).`);
    }
    if (!p.suiviSerie && l.numerosSerie.length) throw erreurs.invalide(`« ${p.nom} » n'est pas suivi par numéro de série. Retirez les numéros saisis.`);
  }
  const series = d.lignes.flatMap((l) => l.numerosSerie);
  const doublonSerie = series.find((n, i) => series.indexOf(n) !== i);
  if (doublonSerie) throw erreurs.invalide(`Le numéro de série « ${doublonSerie} » est saisi deux fois.`);
  const codesLot = d.lignes.flatMap((l) => (l.lot?.code ? [l.lot.code] : []));
  const doublonLot = codesLot.find((c, i) => codesLot.indexOf(c) !== i);
  if (doublonLot) throw erreurs.invalide(`Le lot « ${doublonLot} » est saisi sur deux lignes. Un code de lot désigne un seul arrivage d'un seul produit.`);
  const [seriesConnues, lotsConnus] = await Promise.all([
    series.length ? prisma.numeroSerie.findMany({ where: { tenantId: ctx.tenantId, numero: { in: series } }, select: { numero: true }, take: 3 }) : [],
    codesLot.length ? prisma.lotTracabilite.findMany({ where: { tenantId: ctx.tenantId, codeLot: { in: codesLot } }, select: { codeLot: true }, take: 3 }) : [],
  ]);
  if (seriesConnues.length) throw new ErreurPos("serie_existante", 409, `Ce numéro de série est déjà enregistré dans la boutique : ${seriesConnues.map((s) => s.numero).join(", ")}.`);
  if (lotsConnus.length) throw new ErreurPos("lot_existant", 409, `Ce code de lot existe déjà : ${lotsConnus.map((l) => l.codeLot).join(", ")}. Donnez un autre code à ce nouvel arrivage.`);
  const decimales = decimalesDevise(tenant.devise);

  try {
    // Reprise : un code de lot généré peut tomber sur un code existant, on en retire un autre.
    const { resultat, rejoue } = await avecRepriseCollision(() => avecIdempotence<ResultatReception>(ctx.tenantId, cle ?? "", "reception", async (tx) => {
      // ── Bon de commande : la mise à jour conditionnelle le verrouille (deux réceptions du même bon se suivent).
      let bon: { id: string; numero: string; fournisseurId: string; entrepotId: string; fournisseur: { nom: string } } | null = null;
      if (d.bonCommandeId) {
        const touche = await tx.bonCommande.updateMany({ where: { id: d.bonCommandeId, tenantId: ctx.tenantId, statut: { in: STATUTS_RECEVABLES } }, data: { statut: "partiellement_recu" } });
        const lu = await tx.bonCommande.findFirst({ where: { id: d.bonCommandeId, tenantId: ctx.tenantId }, select: { id: true, numero: true, statut: true, fournisseurId: true, entrepotId: true, fournisseur: { select: { nom: true } } } });
        if (!lu) throw erreurs.introuvable("Ce bon de commande");
        if (!touche.count) {
          throw new ErreurPos("bon_non_recevable", 409, lu.statut === "brouillon"
            ? `Le bon ${lu.numero} est encore un brouillon : marquez-le comme envoyé avant de réceptionner.`
            : `Le bon ${lu.numero} est « ${LIBELLES_STATUT_BON[lu.statut as StatutBon] ?? lu.statut} » : il ne peut plus recevoir de marchandise.`);
        }
        bon = lu;
      }
      const lieu = await resoudreLieu(tx, ctx.tenantId, bon?.entrepotId ?? d.entrepotId ?? (await entrepotDuMagasin(tx, ctx.tenantId, ctx.magasinId)));
      await exigerLieu(tx, ctx, lieu?.entrepotId);
      const fournisseurId = bon?.fournisseurId ?? fournisseur?.id ?? null;
      const fournisseurNom = bon?.fournisseur.nom ?? fournisseur?.nom ?? null;
      const reception = await tx.receptionAchat.create({
        data: { tenantId: ctx.tenantId, bonCommandeId: bon?.id ?? null, fournisseurId, entrepotId: lieu!.entrepotId, statut: "validee", reference: d.reference || null, recuPar: ctx.userId },
        select: { id: true },
      });
      const motif = `Réception ${bon ? `du bon ${bon.numero}` : fournisseurNom ? `de ${fournisseurNom}` : "fournisseur"}${d.reference ? ` (BL ${d.reference})` : ""}`;

      const couts: ResultatReception["couts"] = [];
      for (const l of d.lignes) {
        const varianteId = l.varianteId ?? null;
        let lotId: string | null = null;
        if (l.lot?.code || l.lot?.expiration) {
          const lot = await tx.lotTracabilite.create({
            data: {
              tenantId: ctx.tenantId, produitId: l.produitId, codeLot: l.lot.code || codeLotAuto(), quantiteInitiale: l.quantite, quantiteRestante: l.quantite,
              dateExpiration: l.lot.expiration ? new Date(l.lot.expiration) : null, cout: l.coutUnitaire > 0 ? l.coutUnitaire : null,
              fournisseurId, fournisseurNom, fournisseurRef: d.reference || null, entrepotId: lieu!.entrepotId,
            },
            select: { id: true },
          });
          lotId = lot.id;
        }
        // Le lot vient d'être créé avec sa quantité : refs.lotId rattache le mouvement sans le recréditer.
        const mouvement = await mouvementStock(tx, {
          tenantId: ctx.tenantId, produitId: l.produitId, varianteId, type: "reception", quantite: l.quantite, motif,
          refs: { lotId, receptionId: reception.id }, creePar: ctx.userId, lieu,
        });

        // Coût : lu APRÈS le mouvement, qui a verrouillé l'article (deux réceptions simultanées se suivent).
        const produit = await tx.produit.findUniqueOrThrow({ where: { id: l.produitId }, select: { cout: true } });
        const variante = varianteId ? await tx.variante.findUniqueOrThrow({ where: { id: varianteId }, select: { cout: true } }) : null;
        const avant = variante ? variante.cout ?? produit.cout : produit.cout;
        if (l.coutUnitaire > 0) {
          const { cout, regle } = coutApresReception({ stockAvant: mouvement.stockAvant, coutAvant: avant, quantite: l.quantite, coutRecu: l.coutUnitaire, decimales });
          if (varianteId) await tx.variante.update({ where: { id: varianteId }, data: { cout } });
          else await tx.produit.update({ where: { id: l.produitId }, data: { cout } });
          couts.push({ produitId: l.produitId, varianteId, nom: nomLigne(l), avant, apres: cout, regle });
        } else couts.push({ produitId: l.produitId, varianteId, nom: nomLigne(l), avant, apres: avant, regle: "inchange" });

        await tx.ligneReception.create({ data: { receptionId: reception.id, produitId: l.produitId, varianteId, quantite: l.quantite, coutUnitaire: l.coutUnitaire, lotId, numerosSerie: l.numerosSerie } });
        if (l.numerosSerie.length) {
          await tx.numeroSerie.createMany({
            data: l.numerosSerie.map((numero) => ({ tenantId: ctx.tenantId, produitId: l.produitId, varianteId, numero, statut: "en_stock", entrepotId: lieu!.entrepotId, lotId, coutAchat: l.coutUnitaire > 0 ? l.coutUnitaire : null })),
          });
        }
        if (bon) {
          // Ligne du bon : la variante exacte, sinon la ligne « toutes variantes » du produit.
          const lignesBon = await tx.ligneBonCommande.findMany({ where: { bonCommandeId: bon.id, produitId: l.produitId }, select: { id: true, varianteId: true } });
          const cible = lignesBon.find((x) => x.varianteId === varianteId) ?? lignesBon.find((x) => x.varianteId === null);
          if (cible) await tx.ligneBonCommande.update({ where: { id: cible.id }, data: { quantiteRecue: { increment: l.quantite } } });
        }
      }

      let statutBon: string | null = null;
      if (bon) {
        statutBon = statutApresReception(await tx.ligneBonCommande.findMany({ where: { bonCommandeId: bon.id }, select: { quantite: true, quantiteRecue: true } }));
        await tx.bonCommande.update({ where: { id: bon.id }, data: { statut: statutBon } });
      }
      const unites = d.lignes.reduce((s, l) => s + l.quantite, 0);
      const produitIds = [...new Set(d.lignes.map((l) => l.produitId))];
      await journaliserAudit(tx, ctx, {
        action: "reception.validee", entite: "ReceptionAchat", entiteId: reception.id,
        apres: { bon: bon?.numero ?? null, statutBon, fournisseur: fournisseurNom, reference: d.reference || null, entrepotId: lieu!.entrepotId, lignes: d.lignes.length, unites, couts },
      });
      await publierEvenement(tx, { tenantId: ctx.tenantId, magasinId: ctx.magasinId, type: "inventory.updated", payload: { origine: "reception", receptionId: reception.id, produitIds } });
      return { receptionId: reception.id, lignes: d.lignes.length, unites, bon: bon && { id: bon.id, numero: bon.numero, statut: statutBon! }, couts };
    }, { userId: ctx.userId, appareilId: ctx.appareilId }));
    return { ...resultat, rejoue };
  } catch (e) {
    // Lot ou numéro de série enregistré par une autre personne entre la vérification et l'écriture.
    if ((e as any)?.code === "P2002") throw erreurs.conflit("Un lot ou un numéro de série de cette réception vient d'être enregistré par quelqu'un d'autre. Rien n'a été enregistré : rechargez puis vérifiez.");
    throw e;
  }
}

/** Dernières réceptions de la boutique (ou celles d'un bon), avec leurs lignes. */
export async function listerReceptions(tenantId: string, p: { bonCommandeId?: string | null; limite?: number } = {}) {
  const receptions = await prisma.receptionAchat.findMany({
    where: { tenantId, ...(p.bonCommandeId ? { bonCommandeId: p.bonCommandeId } : {}) },
    orderBy: { recuAt: "desc" }, take: Math.min(Math.max(p.limite ?? 30, 1), 100),
    include: { lignes: { include: { produit: { select: { nom: true, uniteVente: true } } } } },
  });
  const [fournisseurs, bons, entrepots] = await Promise.all([
    prisma.fournisseur.findMany({ where: { tenantId, id: { in: receptions.flatMap((r) => (r.fournisseurId ? [r.fournisseurId] : [])) } }, select: { id: true, nom: true } }),
    prisma.bonCommande.findMany({ where: { tenantId, id: { in: receptions.flatMap((r) => (r.bonCommandeId ? [r.bonCommandeId] : [])) } }, select: { id: true, numero: true } }),
    prisma.entrepot.findMany({ where: { tenantId }, select: { id: true, nom: true } }),
  ]);
  const nom = <T extends { id: string }>(liste: T[], id: string | null) => liste.find((x) => x.id === id) ?? null;
  return receptions.map((r) => ({
    id: r.id, recuAt: r.recuAt.toISOString(), reference: r.reference, statut: r.statut,
    fournisseur: nom(fournisseurs, r.fournisseurId)?.nom ?? null, bon: nom(bons, r.bonCommandeId)?.numero ?? null, entrepot: nom(entrepots, r.entrepotId)?.nom ?? null,
    lignes: r.lignes.map((l) => ({ id: l.id, nom: l.produit.nom, uniteVente: l.produit.uniteVente, quantite: l.quantite, coutUnitaire: l.coutUnitaire, lot: !!l.lotId, series: l.numerosSerie.length })),
  }));
}
