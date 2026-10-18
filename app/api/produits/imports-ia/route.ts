// Suivi des imports IA → boutique (page Produits → Imports IA). Droits : module Produits
// (lecture pour la liste, écriture pour reprendre ou publier), appliqués aussi par proxy.ts.
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireNiveau } from "@/lib/permissions-server";
import { publier, reprendreEchus, resume, traiter } from "@/lib/import-creations/pipeline";
import type { MetaProduit } from "@/lib/import-creations/pipeline";

async function boutique(niveau: "lecture" | "ecriture") {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId as string | undefined;
  if (!tenantId) return { refus: NextResponse.json({ error: "Non autorisé" }, { status: 401 }) };
  const r = await requireNiveau(session, "produits", niveau);
  return r ? { refus: NextResponse.json({ error: r.error }, { status: r.status }) } : { tenantId };
}

export async function GET() {
  const b = await boutique("lecture");
  if (!b.tenantId) return b.refus;
  await reprendreEchus(b.tenantId);
  const imports = await prisma.importCreation.findMany({ where: { tenantId: b.tenantId }, include: { fichiers: true }, orderBy: { createdAt: "desc" }, take: 100 });
  const produits = await prisma.produit.findMany({ where: { tenantId: b.tenantId, id: { in: imports.flatMap((i) => (i.produitId ? [i.produitId] : [])) } }, select: { id: true, nom: true, actif: true, images: true } });
  return NextResponse.json({
    imports: imports.map((i) => ({
      ...resume(i), source: i.source, provider: i.fournisseur, name: (i.metadonnees as MetaProduit).nom ?? null, created_at: i.createdAt.toISOString(),
      product: produits.find((p) => p.id === i.produitId) ?? null,
    })),
  });
}

const Action = z.object({ id: z.string().min(1).max(64), action: z.enum(["reprendre", "publier"]) });

export async function POST(req: Request) {
  const b = await boutique("ecriture");
  if (!b.tenantId) return b.refus;
  const p = Action.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  const imp = await prisma.importCreation.findFirst({ where: { id: p.data.id, tenantId: b.tenantId }, select: { id: true, statut: true } });
  if (!imp) return NextResponse.json({ error: "Import introuvable" }, { status: 404 });
  if (p.data.action === "publier") {
    const manque = await publier(b.tenantId, imp.id);
    if (manque.length) return NextResponse.json({ error: `Il manque : ${manque.join(", ")}` }, { status: 422 });
    return NextResponse.json({ ok: true });
  }
  if (imp.statut === "published") return NextResponse.json({ error: "Déjà publié" }, { status: 409 });
  // Reprise manuelle : le compteur repart pour laisser à nouveau toutes les tentatives.
  await prisma.importCreation.update({ where: { id: imp.id }, data: { tentatives: 0 } });
  return NextResponse.json(resume(await traiter(imp.id)));
}
