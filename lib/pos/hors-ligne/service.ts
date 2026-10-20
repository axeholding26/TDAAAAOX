// Synchronisation hors ligne, côté SERVEUR : instantané du catalogue pour
// l'appareil, rejeu d'une vente saisie sans réseau, fin de synchronisation.
//
// REJEU D'UNE VENTE (rejouerVente) — deux écritures idempotentes, dans l'ordre :
//   1. la vente elle-même, par enregistrerVente (clé = clé de la caisse, type
//      « vente ») avec autoriserNegatif : une vente qui a eu lieu est enregistrée
//      même si le stock est dépassé ;
//   2. le constat des écarts (clé « <clé>:sync », type « sync.vente ») : relit
//      la vente écrite, détecte les conflits (conflits.ts), les trace dans
//      l'audit, prévient le marchand (notification + `alert.created`) et inscrit
//      le statut « conflit » dans le registre MutationPos.
// Une réponse perdue, un arrêt entre les deux étapes, un double envoi : le rejeu
// reprend là où il en était et rend le même résultat. Jamais deux ventes.
//
// CE QUE LE SERVEUR CROIT DE L'APPAREIL — le prix catalogue connu hors ligne et
// le total encaissé (`local`), DANS UNE LIMITE : lib/pos/vente.ts (OptionsRejeu,
// SEUIL_ECART_REJEU = 20 %). En deçà, la vente est enregistrée AU MONTANT
// ENCAISSÉ sans élever aucun droit du caissier ; tout écart lève une alerte et
// une entrée d'audit, et la vente porte l'audit « vente.remise » des fondations.
// Au-delà, RIEN n'est enregistré (409 « ecart_a_valider ») : la vente reste « à
// traiter » sur la caisse, le marchand est alerté, et un responsable (droits
// « prix_personnalise » et « remise_hors_plafond ») la valide depuis l'écran
// Synchronisation — le rejeu repart alors avec `valider: true`. Un responsable
// connecté sur le poste peut valider la vente d'un autre compte : elle est alors
// enregistrée à son nom, l'audit garde le compte qui l'avait saisie.
//
// SESSION DE CAISSE FERMÉE ENTRE-TEMPS — règle retenue : la vente n'est JAMAIS
// rattachée à une session close (ses comptes sont arrêtés et justifiés). Elle
// suit la session ouverte sur cette caisse au moment de la synchronisation
// (aucune si la boutique ne l'exige pas et que la caisse est fermée) et le
// conflit « session » donne le montant en espèces à rapprocher de l'écart de
// fermeture. Si la boutique exige une session et que la caisse est fermée, la
// vente attend (409 caisse_fermee) : elle partira dès l'ouverture de la caisse.
import { pousserApresTransaction } from "@/lib/push";
import { z } from "zod";
import { prisma } from "../../prisma";
import { formatMontant } from "../../utils";
import { journaliserAudit } from "../audit";
import { categoriesCatalogue, rechercherArticles } from "../catalogue";
import { aDroit, exigerDroit } from "../droits";
import { ErreurPos } from "../erreurs";
import { publierEvenement } from "../evenements";
import { lireReglagesPos } from "../flags";
import { avecIdempotence, mutationConnue } from "../idempotence";
import { entrepotDuMagasin } from "../magasins";
import { promotionsActives } from "../promotions";
import { schemaVente } from "../schemas";
import { stocksDuLieu } from "../stock";
import { arrondir, decimalesDevise } from "../tarification";
import { cleArticle, type ContextePos, type ResultatVente } from "../types";
import { enregistrerVente, preparerPanier, type OptionsRejeu } from "../vente";
import { VERSION_INSTANTANE } from "./catalogue-local";
import { detecterConflits, plafonnerPaiements } from "./conflits";
import { VERSION_MUTATION, type ConflitSync, type ResultatRejeu } from "./file";

const montant = z.number().finite().min(0).max(1e12);

/** Une mutation de la file hors ligne, telle que l'appareil la renvoie. */
export const schemaRejeu = z.object({
  // 190 : la clé du constat (« <clé>:sync ») doit tenir dans les 200 caractères du registre.
  cle: z.string().trim().min(8).max(190),
  type: z.literal("vente", { error: "Ce type d'opération ne peut pas être synchronisé par cette version de la caisse." }),
  payload: z.record(z.string(), z.unknown()),
  appareilId: z.string().trim().max(64),
  userId: z.string().trim().min(1).max(64),
  creeLocalAt: z.string().datetime({ offset: true }),
  version: z.number().int().min(1).max(1000),
  tentatives: z.number().int().min(0).max(1_000_000),
  local: z.object({
    numero: z.string().trim().min(1).max(40),
    total: montant,
    sessionCaisseId: z.string().trim().max(64).nullish(),
    catalogueAt: z.string().max(40).nullish(),
    prix: z.array(montant.nullable()).max(500),
  }),
  /** Un responsable valide une vente dont l'écart dépasse le seuil automatique (voir l'en-tête). */
  valider: z.boolean().optional(),
});
export type MutationRecue = z.infer<typeof schemaRejeu>;

export const schemaFinSync = z.object({
  cle: z.string().trim().min(8).max(200),
  appareilId: z.string().trim().max(64).optional(),
  envoyees: z.number().int().min(0).max(100_000),
  conflits: z.number().int().min(0).max(100_000),
  aTraiter: z.number().int().min(0).max(100_000),
  restantes: z.number().int().min(0).max(100_000),
});

/** Notification du marchand + événement temps réel, même forme que lib/pos/alertes.ts. */
async function alerter(tx: Parameters<typeof journaliserAudit>[0], ctx: ContextePos, a: { cle: string; categorie: "stock" | "finance" | "operationnel"; titre: string; message: string }) {
  const n = await tx.notificationMarchand.create({ data: { tenantId: ctx.tenantId, type: "pos_alerte", titre: a.titre, message: a.message.slice(0, 1000), lien: "/dashboard/pos/audit" } });
  pousserApresTransaction(n.id, ctx.tenantId, { type: "pos_alerte", titre: a.titre, message: a.message, lien: "/dashboard/pos/audit" });
  await publierEvenement(tx, {
    tenantId: ctx.tenantId, magasinId: ctx.magasinId, caisseId: ctx.caisseId, type: "alert.created",
    payload: { cle: a.cle, categorie: a.categorie, gravite: "attention", titre: a.titre, message: a.message, lien: "/dashboard/pos/audit", origine: "hors_ligne" },
  });
}

/**
 * Rejoue une vente saisie hors ligne. Idempotent sur `m.cle`.
 * Lève : 409 autre_utilisateur (file d'un autre compte), 409 conflit_serie
 * (numéro de série déjà vendu : un humain décide), 409 caisse_fermee (attendre
 * l'ouverture), et les refus habituels de la vente (article supprimé, droit retiré…).
 */
export async function rejouerVente(ctx: ContextePos, m: MutationRecue): Promise<ResultatRejeu & { rejoue: boolean }> {
  exigerDroit(ctx, "vendre");
  if (m.version > VERSION_MUTATION) throw new ErreurPos("version_inconnue", 422, "Cette vente a été saisie par une version plus récente de la caisse. Rechargez la page de la caisse puis relancez la synchronisation.");
  // La vente appartient à celui qui l'a encaissée : un autre compte ne la synchronise pas à sa place —
  // sauf le responsable qui valide un écart (il engage alors ses propres droits, vérifiés par vente.ts).
  const valide = m.valider === true && aDroit(ctx, "prix_personnalise") && aDroit(ctx, "remise_hors_plafond");
  if (m.valider && !valide) throw new ErreurPos("non_autorise", 403, "Valider une vente hors ligne dont les prix s'écartent du catalogue demande le droit de modifier un prix et d'accorder une remise au-delà du plafond. Demandez à un responsable.");
  if (m.userId !== ctx.userId && !valide) throw new ErreurPos("autre_utilisateur", 409, "Ces ventes ont été saisies hors ligne par un autre compte. Reconnectez-vous avec ce compte pour les synchroniser.");

  const cleSync = `${m.cle}:sync`;
  const complet = await mutationConnue<ResultatRejeu>(ctx.tenantId, cleSync, "sync.vente");
  if (complet) return { ...complet, rejoue: true };

  const d = schemaVente.parse({ ...m.payload, cle: m.cle, creeLocalAt: m.creeLocalAt });
  // Vente déjà écrite (réponse perdue, ou arrêt avant le constat) : on ne refait que le constat.
  let vente = await mutationConnue<Omit<ResultatVente, "rejoue">>(ctx.tenantId, m.cle, "vente");
  const dejaEcrite = !!vente;
  let remiseSync = 0;

  if (!vente) {
    // Prix et total encaissés hors ligne : acceptés par vente.ts dans la limite de SEUIL_ECART_REJEU, sans élever de droit.
    const rejeu: OptionsRejeu = { prix: m.local.prix, total: m.local.total, valide };
    let prep: Awaited<ReturnType<typeof preparerPanier>>;
    try {
      prep = await preparerPanier(ctx, d, rejeu);
    } catch (e) {
      if (!(e instanceof ErreurPos) || e.code !== "ecart_a_valider") throw e;
      // Écart au-delà du seuil : rien n'est écrit, un responsable décide. Alerte et audit émis une seule fois.
      const message = `Vente hors ligne ${m.local.numero} (${ctx.userNom}) : ${e.message}`;
      await avecIdempotence(ctx.tenantId, `${m.cle}:ecart`, "sync.conflit", async (tx) => {
        await journaliserAudit(tx, ctx, { action: "sync.conflit", entite: "MutationPos", entiteId: m.cle, apres: { type: "ecart", numeroProvisoire: m.local.numero, total: m.local.total, creeLocalAt: m.creeLocalAt, poste: m.appareilId, catalogueAt: m.local.catalogueAt ?? null, details: e.details ?? null }, motif: e.message });
        await alerter(tx, ctx, { cle: `hors_ligne:ecart:${m.cle}`, categorie: "finance", titre: "Vente hors ligne à valider : écart de prix", message });
        return { type: "ecart", message };
      }, { appareilId: m.appareilId, userId: ctx.userId, creeLocalAt: m.creeLocalAt, statut: () => "conflit" });
      throw e;
    }
    remiseSync = prep.rejeu?.ajustement ?? 0;
    const demande = { ...d, paiements: plafonnerPaiements(d.paiements, prep.panier.total, decimalesDevise(prep.devise)) };

    try {
      vente = await enregistrerVente(ctx, demande, { autoriserNegatif: true, rejeu });
    } catch (e) {
      if (!(e instanceof ErreurPos) || e.code !== "serie_indisponible") throw e;
      // Numéro de série déjà vendu ailleurs : rien n'est écrit, un responsable décide. Alerte émise une seule fois.
      const message = `Vente hors ligne ${m.local.numero} (${formatMontant(m.local.total, prep.devise)}, ${ctx.userNom}) : ${e.message} Elle n'a pas été enregistrée et reste sur la caisse qui l'a saisie : vérifiez quelle unité a réellement été vendue.`;
      await avecIdempotence(ctx.tenantId, `${m.cle}:serie`, "sync.conflit", async (tx) => {
        await journaliserAudit(tx, ctx, { action: "sync.conflit", entite: "MutationPos", entiteId: m.cle, apres: { type: "serie", numeroProvisoire: m.local.numero, total: m.local.total, creeLocalAt: m.creeLocalAt, poste: m.appareilId, details: e.details ?? null }, motif: e.message });
        await alerter(tx, ctx, { cle: `hors_ligne:serie:${m.cle}`, categorie: "operationnel", titre: "Vente hors ligne en conflit : numéro de série", message });
        return { type: "serie", message };
      }, { appareilId: m.appareilId, userId: ctx.userId, creeLocalAt: m.creeLocalAt, statut: () => "conflit" });
      throw new ErreurPos("conflit_serie", 409, `${e.message} Cette vente hors ligne n'a pas été enregistrée : un responsable doit vérifier quelle unité a réellement été vendue, puis relancer ou clore cette vente.`, e.details);
    }
  }
  const ecrite = vente;

  // 3 — constat des écarts sur la vente écrite, tracé et signalé une seule fois.
  const { reglages } = await lireReglagesPos(ctx.tenantId);
  const parCaissier = new Set(d.lignes.filter((l) => l.prixPersonnalise !== null && l.prixPersonnalise !== undefined).map((l) => cleArticle(l.produitId, l.varianteId)));
  const { resultat, rejoue } = await avecIdempotence<ResultatRejeu>(ctx.tenantId, cleSync, "sync.vente", async (tx) => {
    const commande = await tx.commande.findFirst({
      where: { id: ecrite.commandeId, tenantId: ctx.tenantId },
      select: {
        id: true, numero: true, montantTotal: true, devise: true, magasinId: true, sessionCaisseId: true,
        lignes: { select: { produitId: true, varianteId: true, nom: true, prix: true, prixOrigine: true, mesure: true } },
        paiements: { select: { mode: true, montant: true } },
      },
    });
    if (!commande) throw new ErreurPos("introuvable", 404, "La vente synchronisée est introuvable dans cette boutique.");

    // Stock après la vente : total de l'article et stock du magasin (le plus bas des deux fait foi).
    const vendus = [...new Map(commande.lignes.map((l) => [cleArticle(l.produitId, l.varianteId), l])).values()];
    const fiches = await tx.produit.findMany({
      where: { tenantId: ctx.tenantId, type: "physique", id: { in: vendus.map((l) => l.produitId) } },
      select: { id: true, stock: true, variantes: { select: { id: true, stock: true } } },
    });
    const totaux = vendus.flatMap((l) => {
      const p = fiches.find((x) => x.id === l.produitId);
      const stock = l.varianteId ? p?.variantes.find((v) => v.id === l.varianteId)?.stock : p?.stock;
      return stock === undefined ? [] : [{ produitId: l.produitId, varianteId: l.varianteId, stock, nom: l.nom }];
    });
    const ici = commande.magasinId ? await stocksDuLieu(tx, ctx.tenantId, await entrepotDuMagasin(tx, ctx.tenantId, commande.magasinId), totaux) : null;

    const conflits: ConflitSync[] = detecterConflits({
      numero: commande.numero, numeroLocal: m.local.numero,
      totalServeur: commande.montantTotal, totalLocal: m.local.total,
      sessionLocale: m.local.sessionCaisseId ?? null, sessionServeur: commande.sessionCaisseId,
      especes: commande.paiements.filter((p) => p.mode === "especes").reduce((s, p) => s + p.montant, 0),
      remiseSync,
      lignes: commande.lignes.map((l) => {
        // Au poids, la ligne est enregistrée au gramme : on reparle au kilo.
        const f = l.mesure !== null ? 1000 : 1;
        return { nom: l.nom, prixEncaisse: arrondir(l.prix * f, 2), prixCatalogue: l.prixOrigine === null ? null : arrondir(l.prixOrigine * f, 2), parCaissier: parCaissier.has(cleArticle(l.produitId, l.varianteId)) };
      }),
      stocks: totaux.map((a) => ({ nom: a.nom, apres: Math.min(a.stock, ici?.get(cleArticle(a.produitId, a.varianteId)) ?? a.stock) })),
      venteSansStock: reglages.stock.venteSansStock,
      fmt: (n) => formatMontant(n, commande.devise),
    });

    if (conflits.length) {
      await journaliserAudit(tx, ctx, {
        action: "sync.conflit", entite: "Commande", entiteId: commande.id,
        apres: { numero: commande.numero, numeroProvisoire: m.local.numero, creeLocalAt: m.creeLocalAt, poste: m.appareilId, catalogueAt: m.local.catalogueAt ?? null, saisiePar: m.userId, valideParResponsable: valide, conflits },
      });
      await alerter(tx, ctx, {
        cle: `hors_ligne:${m.cle}`, categorie: conflits.some((c) => c.type === "survente") ? "stock" : "finance",
        titre: conflits.length > 1 ? `Vente hors ligne ${commande.numero} : ${conflits.length} écarts à vérifier` : `Vente hors ligne ${commande.numero} : écart à vérifier`,
        message: conflits.map((c) => c.message).join(" "),
      });
    }
    return { commandeId: commande.id, numero: commande.numero, total: commande.montantTotal, paye: ecrite.paye, du: ecrite.du, monnaie: ecrite.monnaie, conflits };
  }, { appareilId: m.appareilId, userId: ctx.userId, creeLocalAt: m.creeLocalAt, statut: (r: ResultatRejeu) => (r.conflits.length ? "conflit" : "appliquee") });

  // `rejoue` : la vente existait déjà avant cet appel (aucun doublon créé).
  return { ...resultat, rejoue: rejoue || dejaEcrite };
}

/** Fin d'un passage de synchronisation d'un poste : événement `sync.completed` (une fois par passage). */
export async function terminerSynchronisation(ctx: ContextePos, b: z.infer<typeof schemaFinSync>): Promise<{ ok: true; rejoue: boolean }> {
  exigerDroit(ctx, "vendre");
  const bilan = { envoyees: b.envoyees, conflits: b.conflits, aTraiter: b.aTraiter, restantes: b.restantes, poste: b.appareilId ?? null, par: ctx.userNom };
  const { rejoue } = await avecIdempotence(ctx.tenantId, b.cle, "sync.terminee", async (tx) => {
    await journaliserAudit(tx, ctx, { action: "sync.terminee", entite: "Caisse", entiteId: ctx.caisseId, apres: bilan });
    await publierEvenement(tx, { tenantId: ctx.tenantId, magasinId: ctx.magasinId, caisseId: ctx.caisseId, type: "sync.completed", payload: bilan });
    return bilan;
  }, { appareilId: b.appareilId, userId: ctx.userId });
  return { ok: true, rejoue };
}

/**
 * Une page de l'instantané du catalogue pour l'appareil (100 articles au plus).
 * La première page (sans curseur) porte aussi la fiche de l'instantané :
 * version, date, catégories, promotions en vigueur.
 */
export async function pageInstantane(ctx: ContextePos, p: { curseur?: string | null; limite?: number }) {
  const voirCouts = aDroit(ctx, "voir_couts");
  const { articles, curseurSuivant } = await rechercherArticles(ctx.tenantId, null, { magasinId: ctx.magasinId, curseur: p.curseur || null, limite: p.limite ?? 100 });
  const page = {
    articles: voirCouts ? articles : articles.map((a) => ({ ...a, cout: null, variantes: a.variantes.map((v) => ({ ...v, cout: null })) })),
    curseurSuivant,
  };
  if (p.curseur) return page;
  const [reglages, categories] = await Promise.all([lireReglagesPos(ctx.tenantId), categoriesCatalogue(ctx.tenantId)]);
  return {
    ...page,
    meta: {
      version: VERSION_INSTANTANE, genereAt: new Date().toISOString(), magasinId: ctx.magasinId, caisseId: ctx.caisseId, categories,
      promotions: reglages.flags.smart_promotions ? await promotionsActives(prisma, ctx.tenantId, { magasinId: ctx.magasinId }) : [],
    },
  };
}
