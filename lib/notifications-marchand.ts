import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { pousserMarchands } from "@/lib/push";

export async function notifierMarchand(params: {
  tenantId: string;
  type: string;
  titre: string;
  message: string;
  lien?: string;
  commandeId?: string;
}) {
  try {
    await prisma.notificationMarchand.create({
      data: {
        tenantId: params.tenantId,
        type: params.type,
        titre: params.titre,
        message: params.message,
        lien: params.lien,
        commandeId: params.commandeId,
      },
    });
    // Aussi sur les appareils abonnés (téléphone, ordinateur), même appli fermée.
    await pousserMarchands([params.tenantId], params);
  } catch (err) {
    console.warn("[notifierMarchand] échec:", (err as any)?.message?.slice(0, 100));
  }
}

/**
 * Après une sortie de stock qui fait passer un article à 0 ou sous son « stock minimum » :
 * prévient le marchand tout de suite (vitrine, caisse, inventaire…). Relu APRÈS la transaction,
 * donc une vente annulée ne prévient pas ; une fois par article et par jour au plus.
 */
export function alerterStockApres(tenantId: string, produitId: string, varianteId: string | null) {
  const travail = () => alerterStock(tenantId, produitId, varianteId).catch((e) => console.warn("[alerte-stock]", String(e?.message).slice(0, 120)));
  // ponytail: hors d'une requête (cron, tests), after() n'existe pas : on attend 2 s que la transaction de
  // l'appelant se termine avant de relire ; une transaction plus longue relirait l'ancien stock (alerte manquée).
  try { after(travail); } catch { setTimeout(travail, 2000); }
}

async function alerterStock(tenantId: string, produitId: string, varianteId: string | null) {
  const p = await prisma.produit.findFirst({ where: { id: produitId, tenantId }, select: { nom: true, stock: true, stockMin: true } });
  const v = varianteId ? await prisma.variante.findFirst({ where: { id: varianteId, produitId }, select: { nom: true, valeur: true, stock: true } }) : null;
  if (!p || (varianteId && !v)) return;
  const stock = v ? v.stock : p.stock;
  const rupture = stock <= 0;
  // Le seuil n'existe que sur le produit : une variante n'alerte qu'à la rupture.
  if (!rupture && (v || !p.stockMin || stock > p.stockMin)) return;
  const nom = v ? `${p.nom} (${v.nom}: ${v.valeur})` : p.nom;
  const titre = rupture ? `Rupture de stock : ${nom}` : `Stock bas : ${nom}`;
  const debutJour = new Date(new Date().toISOString().slice(0, 10));
  if (await prisma.notificationMarchand.findFirst({ where: { tenantId, titre, createdAt: { gte: debutJour } }, select: { id: true } })) return;
  await notifierMarchand({
    tenantId, type: "stock_faible", titre, lien: `/dashboard/produits/${produitId}`,
    message: rupture
      ? `« ${nom} » n'a plus de stock : il ne peut plus être vendu. Réapprovisionne-le.`
      : `Il ne reste que ${stock} « ${nom} » (seuil d'alerte : ${p.stockMin}). Pense à réapprovisionner.`,
  });
}
