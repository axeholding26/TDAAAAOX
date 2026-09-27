import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { requireNiveau } from "@/lib/permissions-server";
import { nettoyerOptions } from "@/lib/categories-produits";

// Modifier / supprimer une catégorie. Produit.categorie contient le NOM de la
// catégorie : un renommage est répercuté sur ses produits, une suppression
// les laisse sans catégorie (jamais supprimés).
const schema = z.object({
  nom: z.string().trim().min(1).max(60).optional(),
  options: z.array(z.any()).optional(),
  ordre: z.number().int().min(0).max(10_000).optional(),
});

async function contexte(params: Promise<{ id: string }>) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return { erreur: NextResponse.json({ error: "Non autorisé" }, { status: 401 }) };
  const refus = await requireNiveau(session, "produits", "ecriture");
  if (refus) return { erreur: NextResponse.json({ error: refus.error }, { status: refus.status }) };
  const { id } = await params;
  const categorie = await prisma.categorieProduit.findFirst({ where: { id, tenantId } });
  if (!categorie) return { erreur: NextResponse.json({ error: "Catégorie introuvable" }, { status: 404 }) };
  return { tenantId, categorie };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await contexte(params);
  if ("erreur" in c) return c.erreur;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  const { nom, options, ordre } = parsed.data;
  const data: Record<string, unknown> = {};
  if (options) data.options = nettoyerOptions(options);
  if (ordre !== undefined) data.ordre = ordre;
  if (nom && nom !== c.categorie.nom) {
    const slug = slugify(nom);
    const doublon = await prisma.categorieProduit.findFirst({ where: { tenantId: c.tenantId, slug, id: { not: c.categorie.id } } });
    if (!slug || doublon) return NextResponse.json({ error: `La catégorie « ${nom} » existe déjà` }, { status: 409 });
    data.nom = nom; data.slug = slug;
  }
  const [categorie] = await prisma.$transaction([
    prisma.categorieProduit.update({ where: { id: c.categorie.id }, data }),
    ...(data.nom ? [prisma.produit.updateMany({ where: { tenantId: c.tenantId, categorie: c.categorie.nom }, data: { categorie: nom } })] : []),
  ]);
  return NextResponse.json({ categorie });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await contexte(params);
  if ("erreur" in c) return c.erreur;
  await prisma.$transaction([
    prisma.produit.updateMany({ where: { tenantId: c.tenantId, categorie: c.categorie.nom }, data: { categorie: null } }),
    prisma.categorieProduit.delete({ where: { id: c.categorie.id } }),
  ]);
  return NextResponse.json({ ok: true });
}
