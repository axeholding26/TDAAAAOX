import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const BADGES_CONFIG = [
  { type: "premiere_vente", titre: "Première vente", emoji: "🎉", description: "Tu as réalisé ta toute première vente !" },
  { type: "10_commandes", titre: "10 commandes", emoji: "🔟", description: "10 commandes confirmées — tu es lancé !" },
  { type: "50_commandes", titre: "50 commandes", emoji: "🚀", description: "50 commandes — un vrai e-commerçant !" },
  { type: "100_commandes", titre: "Centenaire", emoji: "💯", description: "100 commandes confirmées !" },
  { type: "1m_xaf", titre: "Premier million", emoji: "💰", description: "Tu as franchi la barre du million de XAF !" },
  { type: "top_vendeur", titre: "Top vendeur", emoji: "🏆", description: "Tu fais partie des meilleurs vendeurs Axso." },
  { type: "avis_parfaits", titre: "5 étoiles", emoji: "⭐", description: "Tous tes avis sont positifs !" },
  { type: "catalogue_riche", titre: "Catalogue riche", emoji: "📦", description: "Tu as publié plus de 10 produits actifs." },
];

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const obtenus = await prisma.badgeMarchand.findMany({
    where: { tenantId },
    orderBy: { obtenueAt: "desc" },
  });

  // Check and auto-award new badges
  const [nbCommandes, caTotal, nbProduits, avisStats] = await Promise.all([
    prisma.commande.count({ where: { tenantId, statut: { notIn: ["annulee", "remboursee"] } } }),
    prisma.commande.aggregate({ where: { tenantId, statut: { notIn: ["annulee", "remboursee"] } }, _sum: { montantTotal: true } }),
    prisma.produit.count({ where: { tenantId, actif: true } }),
    prisma.avis.aggregate({ where: { tenantId, approuve: true }, _avg: { note: true }, _count: true }),
  ]);

  const ca = caTotal._sum.montantTotal ?? 0;
  const moyenneAvis = avisStats._avg.note ?? 0;
  const nbAvis = avisStats._count;
  const obtenuTypes = new Set(obtenus.map((b) => b.type));

  const toAward: Array<{ type: string; titre: string; emoji: string; description: string }> = [];

  if (nbCommandes >= 1 && !obtenuTypes.has("premiere_vente")) toAward.push(BADGES_CONFIG[0]);
  if (nbCommandes >= 10 && !obtenuTypes.has("10_commandes")) toAward.push(BADGES_CONFIG[1]);
  if (nbCommandes >= 50 && !obtenuTypes.has("50_commandes")) toAward.push(BADGES_CONFIG[2]);
  if (nbCommandes >= 100 && !obtenuTypes.has("100_commandes")) toAward.push(BADGES_CONFIG[3]);
  if (ca >= 1_000_000 && !obtenuTypes.has("1m_xaf")) toAward.push(BADGES_CONFIG[4]);
  if (nbProduits >= 10 && !obtenuTypes.has("catalogue_riche")) toAward.push(BADGES_CONFIG[7]);
  if (nbAvis >= 5 && moyenneAvis >= 4.8 && !obtenuTypes.has("avis_parfaits")) toAward.push(BADGES_CONFIG[6]);

  if (toAward.length > 0) {
    await prisma.badgeMarchand.createMany({
      data: toAward.map((b) => ({ tenantId, ...b })),
      skipDuplicates: true,
    });
  }

  const allBadges = await prisma.badgeMarchand.findMany({
    where: { tenantId },
    orderBy: { obtenueAt: "desc" },
  });

  const tous = BADGES_CONFIG.map((b) => ({
    ...b,
    obtenu: allBadges.some((ab) => ab.type === b.type),
    obtenueAt: allBadges.find((ab) => ab.type === b.type)?.obtenueAt ?? null,
  }));

  return NextResponse.json({ badges: tous, nouveaux: toAward });
}
