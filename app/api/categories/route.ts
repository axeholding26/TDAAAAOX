import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { requireNiveau } from "@/lib/permissions-server";
import { categoriesDeLaBoutique, nettoyerOptions } from "@/lib/categories-produits";

// Catégories de produits de la boutique active (Catalogue → Catégories).
const schema = z.object({ nom: z.string().trim().min(1, "Nom requis").max(60), options: z.array(z.any()).optional() });

export async function GET() {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const refus = await requireNiveau(session, "produits", "lecture");
  if (refus) return NextResponse.json({ error: refus.error }, { status: refus.status });
  const categories = await categoriesDeLaBoutique(tenantId);
  const comptes = await prisma.produit.groupBy({ by: ["categorie"], where: { tenantId }, _count: true });
  return NextResponse.json({
    categories: categories.map((c) => ({ ...c, nbProduits: comptes.find((x) => x.categorie === c.nom)?._count ?? 0 })),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const refus = await requireNiveau(session, "produits", "ecriture");
  if (refus) return NextResponse.json({ error: refus.error }, { status: refus.status });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const slug = slugify(parsed.data.nom);
  if (!slug) return NextResponse.json({ error: "Nom invalide" }, { status: 400 });
  if (await prisma.categorieProduit.findUnique({ where: { tenantId_slug: { tenantId, slug } } })) {
    return NextResponse.json({ error: `La catégorie « ${parsed.data.nom} » existe déjà` }, { status: 409 });
  }
  const ordre = await prisma.categorieProduit.count({ where: { tenantId } });
  const categorie = await prisma.categorieProduit.create({
    data: { tenantId, nom: parsed.data.nom, slug, ordre, options: nettoyerOptions(parsed.data.options) },
  });
  return NextResponse.json({ categorie: { ...categorie, nbProduits: 0 } }, { status: 201 });
}
