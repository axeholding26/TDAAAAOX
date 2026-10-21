// Gains des livreurs — rémunération choisie par le marchand pour chaque livreur
// (le sien ou un livreur plateforme) :
//   frais_livraison : le livreur touche les frais de livraison payés par le client ;
//   fixe            : un montant fixe par course ;
//   hors_axso       : payé en dehors d'Axso (salarié), rien n'est calculé.
// Course livrée en ligne : gain crédité au solde du livreur, débité du wallet du marchand
// (qui a reçu les frais de livraison). En espèces (COD) : le livreur garde sa part sur
// l'argent encaissé, il remet le reste ; le gain n'est qu'inscrit à son historique.
// Retraits : même circuit manuel que les marchands (lib/wallet.ts initierRetrait) —
// débit atomique, alerte Command Center + e-mail, Payé/Refusé dans Admin › Finances.
import { prisma } from "./prisma";
import { pousserAdmins, pousserLivreur } from "./push";
import { envoyerAlerteRetrait } from "./email";
import { normaliserTelephone } from "./devise-convert";

export const MODES_GAIN = ["frais_livraison", "fixe", "hors_axso"] as const;
export type ModeGain = (typeof MODES_GAIN)[number];

const COD = ["whatsapp_cod", "direct_cod"];
export const estCOD = (methodePaiement: string) => COD.includes(methodePaiement);

const arrondi = (n: number) => Math.round(n * 100) / 100;

/** Sans réglage du marchand : livreur plateforme → frais de livraison ; son propre livreur → rien ne change (hors Axso). */
export const modeParDefaut = (livreurTenantId: string | null, tenantId: string): ModeGain =>
  livreurTenantId === tenantId ? "hors_axso" : "frais_livraison";

/** Gain d'une course (0 = rien à enregistrer). En espèces, jamais plus que ce que le livreur a encaissé. */
export function calculerGain(p: { mode: string; montantFixe?: number | null; montantLivraison: number; montantTotal: number; especes: boolean }): number {
  const brut = p.mode === "frais_livraison" ? p.montantLivraison : p.mode === "fixe" ? Number(p.montantFixe ?? 0) : 0;
  const gain = Number.isFinite(brut) ? Math.max(0, arrondi(brut)) : 0;
  return p.especes ? Math.min(gain, Math.max(0, p.montantTotal)) : gain;
}

/** Espèces à remettre au marchand : encaissé − part du livreur. */
export const aRemettre = (encaisse: number, gain: number) => Math.max(0, arrondi(encaisse - gain));

/** Minimum de retrait par devise (même ordre de grandeur que les retraits marchands : 1 000 FCFA). */
const MINIMUMS: Record<string, number> = { XAF: 1000, XOF: 1000, GNF: 10000, CDF: 5000, NGN: 1000, GHS: 20, KES: 200, UGX: 5000, TZS: 5000, RWF: 2000, MAD: 20, TND: 5, EUR: 2, USD: 2 };
export const minimumRetrait = (devise: string) => MINIMUMS[devise] ?? 1000;

// ─── Gain d'une course, au passage « livree » ────────────────────────────────
// Appelé DANS la transaction de changerStatutCommande (lib/cycle-livraison.ts) : le gain,
// le solde et le débit du marchand sont validés ou annulés avec la livraison. Idempotent :
// une seule ligne par commande (commandeId unique, contrôlé avant l'écriture).
export async function enregistrerGainCourse(tx: any, c: {
  id: string; numero: string; tenantId: string; livreurId: string | null;
  montantLivraison: number; montantTotal: number; devise: string; methodePaiement: string;
}) {
  if (!c.livreurId) return null; // livreur externe (lien sans compte) : rien à suivre
  if (await tx.gainLivreur.findUnique({ where: { commandeId: c.id }, select: { id: true } })) return null;
  const livreur = await tx.livreur.findUnique({ where: { id: c.livreurId }, select: { tenantId: true, nom: true } });
  if (!livreur) return null;
  const reglage = await tx.reglageLivreur.findUnique({ where: { tenantId_livreurId: { tenantId: c.tenantId, livreurId: c.livreurId } } });
  const mode: string = reglage?.mode ?? modeParDefaut(livreur.tenantId, c.tenantId);
  const especes = estCOD(c.methodePaiement);
  const montant = calculerGain({ mode, montantFixe: reglage?.montantFixe, montantLivraison: c.montantLivraison, montantTotal: c.montantTotal, especes });
  if (!montant) return null;

  const gain = await tx.gainLivreur.create({
    data: { livreurId: c.livreurId, tenantId: c.tenantId, commandeId: c.id, numero: c.numero, mode, montant, devise: c.devise, paiement: especes ? "especes" : "en_ligne" },
  });
  if (especes) return gain;

  await tx.soldeLivreur.upsert({
    where: { livreurId_devise: { livreurId: c.livreurId, devise: c.devise } },
    create: { livreurId: c.livreurId, devise: c.devise, solde: montant },
    update: { solde: { increment: montant } },
  });
  // Débit atomique (décrément SQL) ; le solde peut passer négatif comme pour un
  // remboursement, plutôt que bloquer la livraison — les retraits sont alors bloqués.
  const wallet = await tx.wallet.upsert({ where: { tenantId: c.tenantId }, create: { tenantId: c.tenantId, devise: c.devise }, update: {} });
  await tx.wallet.update({ where: { id: wallet.id }, data: { solde: { decrement: montant } } });
  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id, type: "LIVREUR", montant: -montant, devise: wallet.devise,
      description: `Livreur ${livreur.nom} · course #${c.numero}`,
      reference: `LIV-${gain.id}`, commandeId: c.id, statut: "completed",
    },
  });
  return gain;
}

// ─── Réglage du marchand ─────────────────────────────────────────────────────

/** Le marchand peut régler ses propres livreurs et les livreurs plateforme. */
export async function livreurReglable(tenantId: string, livreurId: string) {
  return prisma.livreur.findFirst({ where: { id: livreurId, OR: [{ tenantId }, { tenantId: null }] }, select: { id: true, nom: true, tenantId: true } });
}

/** Réglage effectif + ce que le marchand a payé (wallet) ou laissé sur les espèces, par devise. */
export async function resumePourMarchand(tenantId: string, livreur: { id: string; tenantId: string | null }) {
  const [reglage, totaux] = await Promise.all([
    prisma.reglageLivreur.findUnique({ where: { tenantId_livreurId: { tenantId, livreurId: livreur.id } } }),
    prisma.gainLivreur.groupBy({ by: ["paiement", "devise"], where: { tenantId, livreurId: livreur.id }, _sum: { montant: true }, _count: true }),
  ]);
  return {
    mode: (reglage?.mode ?? modeParDefaut(livreur.tenantId, tenantId)) as ModeGain,
    montantFixe: reglage?.montantFixe ?? 0,
    totaux: totaux.map((t) => ({ paiement: t.paiement, devise: t.devise, montant: t._sum.montant ?? 0, courses: t._count })),
  };
}

// ─── Retraits du livreur ─────────────────────────────────────────────────────

export async function demanderRetraitLivreur(p: { livreurId: string; montant: number; devise: string; telephone: string; operateur?: string | null }) {
  const livreur = await prisma.livreur.findUnique({ where: { id: p.livreurId }, select: { nom: true, telephone: true, tenant: { select: { pays: true, nomBoutique: true, slug: true } } } });
  if (!livreur) throw new Error("Livreur introuvable");
  const destinataire = normaliserTelephone(p.telephone, livreur.tenant?.pays);
  if (!destinataire) throw new Error("Numéro Mobile Money invalide : vérifie-le, avec l'indicatif de ton pays.");
  const montant = arrondi(Number(p.montant));
  const minimum = minimumRetrait(p.devise);
  if (!Number.isFinite(montant) || montant < minimum) throw new Error(`Montant minimum de retrait : ${minimum} ${p.devise}`);
  const operateur = p.operateur?.trim().slice(0, 30) || null;

  const retrait = await prisma.$transaction(async (tx) => {
    // Un retrait à la fois : le suivant attend la décision d'Axso.
    if (await tx.retraitLivreur.count({ where: { livreurId: p.livreurId, statut: "en_attente" } })) throw new Error("Un retrait est déjà en attente de validation");
    // Débit conditionnel atomique : jamais sous 0, deux demandes simultanées ne passent pas toutes les deux.
    const { count } = await tx.soldeLivreur.updateMany({
      where: { livreurId: p.livreurId, devise: p.devise, solde: { gte: montant } },
      data: { solde: { decrement: montant } },
    });
    if (!count) throw new Error("Solde insuffisant");
    return tx.retraitLivreur.create({ data: { livreurId: p.livreurId, montant, devise: p.devise, destinataire, operateur } });
  });

  // Jamais bloquant : le retrait reste visible dans Admin › Finances même si l'alerte échoue.
  const solde = await prisma.soldeLivreur.findUnique({ where: { livreurId_devise: { livreurId: p.livreurId, devise: p.devise } }, select: { solde: true } });
  const dejaPayes = await prisma.retraitLivreur.count({ where: { livreurId: p.livreurId, destinataire, statut: "complete" } });
  const somme = `${montant.toLocaleString("fr-FR")} ${p.devise}`;
  await Promise.allSettled([
    pousserAdmins({ titre: "🛵 Retrait livreur à valider", message: `${livreur.nom} · ${somme} → ${operateur ?? "Mobile Money"}`, lien: "/admin/finances", type: "retrait_a_valider" }),
    envoyerAlerteRetrait({
      a: "axedigital00@gmail.com", // même destinataire que EMAIL_RETRAITS (lib/wallet.ts)
      retraitId: retrait.id, reference: `AXSO-LIV-${retrait.id}`, creeLe: retrait.createdAt,
      montant, devise: p.devise, methode: "mobile_money", operateur, destinataire, canal: null,
      notes: `Livreur ${livreur.tenant ? `de la boutique ${livreur.tenant.nomBoutique}` : "de la plateforme"} · tél. ${livreur.telephone}`,
      boutique: `Livreur ${livreur.nom}`, slug: livreur.tenant?.slug ?? "plateforme", proprietaire: { name: livreur.nom, email: null },
      emailBoutique: null, whatsappBoutique: livreur.telephone, soldeApres: solde?.solde ?? null, premierRetraitVersCeNumero: dejaPayes === 0,
    }),
  ]);
  return retrait;
}

/** Payé / Refusé par Axso. Refusé : le solde est rendu une seule fois (passage conditionnel du statut). */
export async function cloturerRetraitLivreur(retraitId: string, paye: boolean) {
  const retrait = await prisma.$transaction(async (tx) => {
    const { count } = await tx.retraitLivreur.updateMany({ where: { id: retraitId, statut: "en_attente" }, data: { statut: paye ? "complete" : "echoue" } });
    if (!count) throw new Error("Ce retrait est déjà traité ou introuvable");
    const r = await tx.retraitLivreur.findUniqueOrThrow({ where: { id: retraitId } });
    if (!paye) {
      await tx.soldeLivreur.upsert({
        where: { livreurId_devise: { livreurId: r.livreurId, devise: r.devise } },
        create: { livreurId: r.livreurId, devise: r.devise, solde: r.montant },
        update: { solde: { increment: r.montant } },
      });
    }
    return r;
  });
  const somme = `${retrait.montant.toLocaleString("fr-FR")} ${retrait.devise}`;
  await prisma.notification.create({
    data: {
      livreurId: retrait.livreurId, type: paye ? "retrait_paye" : "retrait_refuse",
      titre: paye ? `Retrait de ${somme} envoyé` : `Retrait de ${somme} refusé`,
      message: paye ? `Axso a envoyé ${somme} à ${retrait.destinataire}.` : `Le retrait vers ${retrait.destinataire} n'a pas pu être fait : ${somme} ont été remis sur ton solde.`,
    },
  }).then((n) => pousserLivreur(retrait.livreurId, { ...n, lien: "/livreur", type: n.type })).catch(() => {});
  return retrait;
}
