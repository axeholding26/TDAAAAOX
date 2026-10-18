// Parcours d'un apprenant, chargé à partir de son jeton d'accès (AccesFormation, créé
// uniquement par lib/livraison-numerique.ts après paiement confirmé). Toute route
// apprenant passe par chargerParcours : jeton valide + commande payée non annulée +
// accès non révoqué, et seules les leçons visibles de CE produit sont exposées.
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { controlerJeton } from "@/lib/livraison-numerique";
import {
  calculerDeblocage, cleApprenant, eligibiliteCertificat, estVisible, genererCodeCertificat,
  type Verrou,
} from "./regles";

// Jetons actuels : 64 hex ; anciens accès (prod) : UUID. Même filtre que /api/telechargements.
export const JETON_VALIDE = /^[A-Za-z0-9-]{32,128}$/;

export async function chargerParcours(token: string) {
  if (!JETON_VALIDE.test(token)) return null;
  const acces = await prisma.accesFormation.findUnique({
    where: { token },
    select: {
      id: true, token: true, commandeId: true, produitId: true, clientEmail: true, createdAt: true, revoqueAt: true, derniereLeconId: true,
      produit: {
        select: {
          nom: true, tenantId: true,
          tenant: { select: { slug: true, nomBoutique: true } },
          formation: {
            select: {
              id: true, niveau: true, certif: true, certifLeconsPct: true, certifQuizRequis: true, certifDevoirsRequis: true,
              chapitres: {
                orderBy: { ordre: "asc" },
                select: {
                  id: true, titre: true, actif: true, statut: true, prerequis: true, dripJours: true, dripDate: true,
                  lecons: {
                    orderBy: { ordre: "asc" },
                    select: {
                      id: true, titre: true, type: true, duree: true, gratuite: true, actif: true, statut: true,
                      prerequis: true, dripJours: true, dripDate: true, quiz: { select: { id: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!acces?.produit.formation) return null;
  const commande = await prisma.commande.findUnique({ where: { id: acces.commandeId }, select: { paiementStatut: true, statut: true, clientNom: true } });
  if (controlerJeton({ dl: { expireAt: null, revoqueAt: acces.revoqueAt }, commande })) return null;

  const apprenant = cleApprenant(acces);
  const formation = acces.produit.formation;
  const chapitres = formation.chapitres.filter(estVisible).map((c) => ({ ...c, lecons: c.lecons.filter(estVisible) }));
  const leconIds = chapitres.flatMap((c) => c.lecons.map((l) => l.id));
  const quizIds = chapitres.flatMap((c) => c.lecons.filter((l) => l.type === "quiz" && l.quiz).map((l) => l.id));
  const devoirIds = chapitres.flatMap((c) => c.lecons.filter((l) => l.type === "devoir").map((l) => l.id));

  const [progressions, reussites, devoirs, inscription] = await Promise.all([
    leconIds.length ? prisma.progressionLecon.findMany({ where: { leconId: { in: leconIds }, clientEmail: apprenant }, select: { leconId: true, complete: true, favori: true } }) : [],
    quizIds.length ? prisma.tentativeQuiz.findMany({ where: { leconId: { in: quizIds }, apprenant, reussi: true }, select: { leconId: true }, distinct: ["leconId"] }) : [],
    devoirIds.length ? prisma.renduDevoir.findMany({ where: { leconId: { in: devoirIds }, apprenant }, select: { leconId: true, statut: true } }) : [],
    // Le drip part de la PREMIÈRE inscription à ce produit (un second achat ne le relance pas).
    prisma.accesFormation.findFirst({ where: { produitId: acces.produitId, clientEmail: acces.clientEmail, revoqueAt: null }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);
  const completes = new Set(progressions.filter((p) => p.complete).map((p) => p.leconId));
  const inscritLe = acces.clientEmail ? inscription?.createdAt ?? acces.createdAt : acces.createdAt;
  const verrous = calculerDeblocage(chapitres, { inscritLe, completes });

  return {
    acces, apprenant, inscritLe,
    nomApprenant: commande?.clientNom ?? "",
    tenantId: acces.produit.tenantId,
    slug: acces.produit.tenant.slug,
    boutiqueNom: acces.produit.tenant.nomBoutique,
    produitNom: acces.produit.nom,
    formation, chapitres, leconIds, quizIds, devoirIds, completes, verrous,
    favoris: new Set(progressions.filter((p) => p.favori).map((p) => p.leconId)),
    quizReussis: new Set(reussites.map((r) => r.leconId)),
    devoirs: new Map(devoirs.map((d) => [d.leconId, d.statut])),
  };
}
export type Parcours = NonNullable<Awaited<ReturnType<typeof chargerParcours>>>;

/** La leçon fait partie de CE parcours et est ouverte. */
export function leconOuverte(p: Parcours, leconId: string): { lecon: Parcours["chapitres"][number]["lecons"][number]; verrou: Verrou } | null {
  const lecon = p.chapitres.flatMap((c) => c.lecons).find((l) => l.id === leconId);
  if (!lecon) return null;
  return { lecon, verrou: p.verrous.get(leconId) ?? { ouvert: false, raison: "prerequis", manque: [] } };
}

export function eligibilite(p: Parcours) {
  return eligibiliteCertificat(p.formation, {
    lecons: p.leconIds, completes: p.completes, quiz: p.quizIds, quizReussis: p.quizReussis,
    devoirs: p.devoirIds, devoirsValides: new Set([...p.devoirs].filter(([, s]) => s === "valide").map(([id]) => id)),
  });
}

export async function noterActivite(p: Parcours, leconId?: string) {
  await prisma.accesFormation.update({ where: { id: p.acces.id }, data: { derniereActiviteAt: new Date(), ...(leconId ? { derniereLeconId: leconId } : {}) } });
}

export async function marquerTerminee(p: Parcours, leconId: string) {
  await prisma.progressionLecon.upsert({
    where: { leconId_clientEmail: { leconId, clientEmail: p.apprenant } },
    create: { leconId, commandeId: p.acces.commandeId, clientEmail: p.apprenant, complete: true, completedAt: new Date() },
    update: { complete: true, completedAt: new Date() },
  });
  p.completes.add(leconId);
}

/**
 * Délivrance automatique : si la formation délivre un certificat et que les critères sont remplis.
 * Un certificat révoqué par le formateur ne revient pas tout seul ; un certificat coupé par un
 * remboursement revient si l'apprenant a de nouveau un accès payé (rachat).
 */
export async function delivrerCertificatSiEligible(p: Parcours) {
  if (!p.formation.certif) return null;
  const where = { produitId_apprenant: { produitId: p.acces.produitId, apprenant: p.apprenant } };
  const existant = await prisma.certificat.findUnique({ where });
  if (existant && (!existant.revoqueAt || existant.revoquePar !== "remboursement")) return existant;
  if (!eligibilite(p).eligible) return existant;
  if (existant) return prisma.certificat.update({ where: { id: existant.id }, data: { revoqueAt: null, revoqueMotif: null, revoquePar: null } });
  try {
    return await prisma.certificat.create({
      data: {
        code: genererCodeCertificat(), produitId: p.acces.produitId, tenantId: p.tenantId, apprenant: p.apprenant,
        nom: p.nomApprenant || "Apprenant", formationTitre: p.produitNom, boutiqueNom: p.boutiqueNom,
      },
    });
  } catch (e) {
    // Deux événements simultanés : l'autre a créé le certificat.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return prisma.certificat.findUnique({ where });
    throw e;
  }
}

// ─── Préambule commun des routes apprenant ───────────────────────────────────

const limiteApprenant = rateLimit({ windowMs: 60_000, max: 120, keyPrefix: "apprenant" });

/** Limite de débit puis contrôle du jeton : renvoie le parcours, ou la réponse de refus (404 identique pour tout jeton invalide). */
export async function parcoursOuRefus(req: Request, token: string): Promise<Parcours | NextResponse> {
  const rl = limiteApprenant.check(getClientIp(req));
  if (!rl.success) return rateLimitResponse(rl.reset);
  const p = await chargerParcours(token);
  return p ?? NextResponse.json({ error: "Accès invalide, expiré ou remboursé" }, { status: 404 });
}

export function refusVerrou(v: Verrou) {
  if (v.ouvert) return null;
  const message = v.raison === "drip"
    ? `Cette leçon s'ouvre le ${v.disponibleLe.toLocaleDateString("fr-FR")}`
    : `Termine d'abord : ${v.manque.join(", ")}`;
  return NextResponse.json({ error: message, verrou: v }, { status: 403 });
}

/** « Mes formations » du compte acheteur : une entrée par formation (l'accès le plus récent), avec progression et reprise. */
export async function mesFormations(commandesPayees: string[]) {
  if (!commandesPayees.length) return [];
  const acces = await prisma.accesFormation.findMany({
    where: { commandeId: { in: commandesPayees }, revoqueAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      token: true, produitId: true, clientEmail: true, commandeId: true, derniereActiviteAt: true, derniereLeconId: true,
      produit: { select: { nom: true, images: true, formation: { select: { certif: true, chapitres: { select: { actif: true, statut: true, lecons: { select: { id: true, actif: true, statut: true } } } } } } } },
    },
  });
  const uniques = [...new Map(acces.map((a) => [a.produitId, a])).values()].reverse();
  return Promise.all(uniques.filter((a) => a.produit.formation).map(async (a) => {
    const apprenant = cleApprenant(a);
    const ids = a.produit.formation!.chapitres.filter(estVisible).flatMap((c) => c.lecons.filter(estVisible).map((l) => l.id));
    const [faites, certificat] = await Promise.all([
      ids.length ? prisma.progressionLecon.count({ where: { leconId: { in: ids }, clientEmail: apprenant, complete: true } }) : 0,
      prisma.certificat.findUnique({ where: { produitId_apprenant: { produitId: a.produitId, apprenant } }, select: { code: true, revoqueAt: true } }),
    ]);
    return {
      produitId: a.produitId, nom: a.produit.nom, image: a.produit.images[0] ?? null, token: a.token,
      pct: ids.length ? Math.round((faites / ids.length) * 100) : 0, total: ids.length, terminees: faites,
      derniereActiviteAt: a.derniereActiviteAt, demarree: !!a.derniereLeconId,
      certificat: certificat && !certificat.revoqueAt ? certificat.code : null,
    };
  }));
}
