import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const depuis = searchParams.get("depuis");
  const statut = searchParams.get("statut");

  const where: any = { tenantId };
  if (depuis)  where.createdAt = { gte: new Date(depuis) };
  if (statut)  where.statut = statut;

  const commandes = await prisma.commande.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      client: true,
      lignes: { include: { produit: { select: { nom: true, type: true } } } },
    },
    take: 2000,
  });

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { nomBoutique: true, devise: true },
  });

  // ── Feuille 1 : Commandes ───────────────────────────────────────────────
  const rowsCommandes = commandes.map(c => ({
    "N° Commande":      c.numero,
    "Date":             new Date(c.createdAt).toLocaleString("fr-FR"),
    "Client":           c.client?.nom ?? "—",
    "Téléphone":        c.client?.telephone ?? "—",
    "Email":            c.client?.email ?? "—",
    "Ville":            c.client?.ville ?? "—",
    "Statut":           c.statut,
    "Paiement":         c.paiementStatut,
    "Méthode":          c.methodePaiement ?? "—",
    "Montant Total":    c.montantTotal,
    "Devise":           c.devise ?? tenant?.devise ?? "XAF",
    "Nb Articles":      c.lignes.reduce((s, l) => s + l.quantite, 0),
    "Produits":         c.lignes.map(l => `${l.produit?.nom ?? "?"} ×${l.quantite}`).join(" | "),
    "Créée le":         c.createdAt.toISOString(),
  }));

  // ── Feuille 2 : Lignes détaillées ───────────────────────────────────────
  const rowsLignes: any[] = [];
  for (const c of commandes) {
    for (const l of c.lignes) {
      rowsLignes.push({
        "N° Commande":   c.numero,
        "Date":          new Date(c.createdAt).toLocaleDateString("fr-FR"),
        "Client":        c.client?.nom ?? "—",
        "Produit":       l.produit?.nom ?? "—",
        "Type":          l.produit?.type ?? "physique",
        "Quantité":      l.quantite,
        "Prix Unitaire": l.prix,
        "Sous-Total":    l.quantite * l.prix,
        "Devise":        c.devise ?? "XAF",
      });
    }
  }

  // ── Workbook ─────────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();

  const wsCommandes = XLSX.utils.json_to_sheet(rowsCommandes);
  wsCommandes["!cols"] = [
    { wch: 18 }, { wch: 20 }, { wch: 22 }, { wch: 16 }, { wch: 25 },
    { wch: 15 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
    { wch: 8 },  { wch: 10 }, { wch: 40 }, { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, wsCommandes, "Commandes");

  const wsLignes = XLSX.utils.json_to_sheet(rowsLignes);
  wsLignes["!cols"] = [
    { wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 28 }, { wch: 12 },
    { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 8 },
  ];
  XLSX.utils.book_append_sheet(wb, wsLignes, "Lignes articles");

  // ── Feuille résumé ───────────────────────────────────────────────────────
  const totalVentes = commandes.filter(c => c.paiementStatut === "completed").reduce((s, c) => s + c.montantTotal, 0);
  const rowsResume = [
    { "Métrique": "Total commandes exportées",      "Valeur": commandes.length },
    { "Métrique": "Commandes payées",               "Valeur": commandes.filter(c => c.paiementStatut === "completed").length },
    { "Métrique": "Commandes en attente",           "Valeur": commandes.filter(c => c.statut === "en_attente").length },
    { "Métrique": "Commandes livrées",              "Valeur": commandes.filter(c => c.statut === "livree").length },
    { "Métrique": "Chiffre d'affaires total",       "Valeur": `${totalVentes.toLocaleString("fr-FR")} ${tenant?.devise ?? "XAF"}` },
    { "Métrique": "Panier moyen",                   "Valeur": commandes.length ? `${Math.round(totalVentes / commandes.filter(c => c.paiementStatut === "completed").length || 0).toLocaleString("fr-FR")} ${tenant?.devise ?? "XAF"}` : "0" },
    { "Métrique": "Boutique",                       "Valeur": tenant?.nomBoutique ?? "—" },
    { "Métrique": "Export généré le",               "Valeur": new Date().toLocaleString("fr-FR") },
  ];
  const wsResume = XLSX.utils.json_to_sheet(rowsResume);
  wsResume["!cols"] = [{ wch: 30 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsResume, "Résumé");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const filename = `commandes-axso-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
