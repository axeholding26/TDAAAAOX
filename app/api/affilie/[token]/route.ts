import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TYPES_PRODUIT_DIGITAL } from "@/lib/affiliation";

const PERIODES_VALIDES = new Set([7, 30, 90]);

// GET public — portail self-service d'un affilié, sans compte/login (même
// pattern que les liens GPS livreur : token opaque non devinable dans l'URL).
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { searchParams } = new URL(req.url);
  const jours = PERIODES_VALIDES.has(Number(searchParams.get("periode"))) ? Number(searchParams.get("periode")) : 30;
  const debutPeriode = new Date(Date.now() - jours * 24 * 60 * 60 * 1000);

  const affilie = await prisma.affilie.findUnique({
    where: { portalToken: token },
    include: {
      programme: true,
      tenant: { select: { nomBoutique: true, slug: true, logoUrl: true, devise: true } },
      commissions: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!affilie) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const [paiements, commissionsApprouvees, commissionsPeriode, clicsPeriodeLog] = await Promise.all([
    prisma.paiementCommission.findMany({ where: { affilieurId: affilie.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.commissionAffilie.findMany({ where: { affilieId: affilie.id, statut: "approuvee" }, select: { montantCommission: true } }),
    prisma.commissionAffilie.findMany({
      where: { affilieId: affilie.id, createdAt: { gte: debutPeriode } },
      select: { montantCommission: true, statut: true, createdAt: true, updatedAt: true },
    }),
    prisma.affilieClic.findMany({ where: { affilieId: affilie.id, createdAt: { gte: debutPeriode } }, select: { createdAt: true } }),
  ]);

  // Produits promouvables par cet affilié — un lien traçable par produit,
  // avec le taux de commission effectif (override produit sinon taux du
  // programme/palier). Les produits digitaux bénéficient d'un minimum de 50%
  // s'ils n'ont pas de taux personnalisé — voir calculerCommissionLigne.
  const programme = affilie.programme;
  const produitsBruts = programme
    ? await prisma.produit.findMany({
        where: {
          tenantId: programme.tenantId,
          actif: true,
          affiliationActive: true,
          ...(programme.tousLesProduits ? {} : { id: { in: programme.produitIds } }),
        },
        select: { id: true, nom: true, prix: true, images: true, type: true, tauxCommissionAff: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : [];

  const tauxProgrammeDefaut = programme
    ? (programme.tiersActifs
        ? (affilie.conversions >= programme.tier2Max ? programme.tier3Commission
          : affilie.conversions >= programme.tier1Max ? programme.tier2Commission
          : programme.tier1Commission)
        : programme.valeurCommission)
    : 0;

  const produits = produitsBruts.map(p => ({
    id: p.id,
    nom: p.nom,
    prix: p.prix,
    image: p.images?.[0] ?? null,
    type: p.type,
    tauxCommissionPct: p.tauxCommissionAff != null
      ? Math.round(p.tauxCommissionAff * 1000) / 10
      : TYPES_PRODUIT_DIGITAL.has(p.type) ? 50
      : tauxProgrammeDefaut,
  }));

  // Palier actuel (si programme à paliers actif)
  let palier: { nom: string; tauxActuel: number; prochainPalier: string | null; conversionsRestantes: number | null } | null = null;
  if (affilie.programme?.tiersActifs) {
    const p = affilie.programme;
    if (affilie.conversions >= p.tier2Max) {
      palier = { nom: p.tier3Nom, tauxActuel: p.tier3Commission, prochainPalier: null, conversionsRestantes: null };
    } else if (affilie.conversions >= p.tier1Max) {
      palier = { nom: p.tier2Nom, tauxActuel: p.tier2Commission, prochainPalier: p.tier3Nom, conversionsRestantes: p.tier2Max - affilie.conversions };
    } else {
      palier = { nom: p.tier1Nom, tauxActuel: p.tier1Commission, prochainPalier: p.tier2Nom, conversionsRestantes: p.tier1Max - affilie.conversions };
    }
  }

  const tauxConversion = affilie.clics > 0 ? Math.round((affilie.conversions / affilie.clics) * 1000) / 10 : 0;

  // Solde réellement disponible = commissions approuvées non encore payées
  // (distinct du total lifetime, et distinct des commissions "pending" —
  // encore provisoires tant que la commande n'est pas confirmée).
  const soldeDisponible = Math.round(commissionsApprouvees.reduce((s, c) => s + c.montantCommission, 0) * 100) / 100;

  const commissionsPeriodeTotal = Math.round(commissionsPeriode.reduce((s, c) => s + c.montantCommission, 0) * 100) / 100;
  const commissionsPayeesPeriode = Math.round(
    commissionsPeriode.filter(c => c.statut === "payee").reduce((s, c) => s + c.montantCommission, 0) * 100
  ) / 100;
  const conversionsPeriode = commissionsPeriode.length;
  const clicsPeriodeTotal = clicsPeriodeLog.length;

  // Séries journalières pour les graphiques — clics/conversions/commissions
  const cleJour = (d: Date) => d.toISOString().slice(0, 10);
  const joursMap = new Map<string, { date: string; clics: number; conversions: number; commissions: number }>();
  for (let i = 0; i < jours; i++) {
    const d = new Date(debutPeriode.getTime() + i * 86400000);
    const key = cleJour(d);
    joursMap.set(key, { date: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }), clics: 0, conversions: 0, commissions: 0 });
  }
  const ordreCles = [...joursMap.keys()];
  for (const c of clicsPeriodeLog) {
    const key = cleJour(new Date(c.createdAt));
    const entry = joursMap.get(key);
    if (entry) entry.clics += 1;
  }
  for (const c of commissionsPeriode) {
    const key = cleJour(new Date(c.createdAt));
    const entry = joursMap.get(key);
    if (entry) { entry.conversions += 1; entry.commissions += c.montantCommission; }
  }
  const seriesJour = ordreCles.map(k => joursMap.get(k)!);

  return NextResponse.json({
    affilie: {
      nom: affilie.nom,
      email: affilie.email,
      telephone: affilie.telephone,
      codeParrainage: affilie.codeParrainage,
      statut: affilie.statut,
      clics: affilie.clics,
      conversions: affilie.conversions,
      tauxConversion,
      commissionTotal: affilie.commissionTotal,
      commissionPending: affilie.commissionPending,
    },
    periode: {
      jours,
      soldeDisponible,
      seuilPaiement: programme?.seuilPaiement ?? 0,
      commissionsPeriode: commissionsPeriodeTotal,
      commissionsPayeesPeriode,
      conversionsPeriode,
      clicsPeriode: clicsPeriodeTotal,
      seriesJour,
    },
    programme: affilie.programme,
    palier,
    tenant: affilie.tenant,
    commissions: affilie.commissions,
    produits,
    paiements,
  });
}
