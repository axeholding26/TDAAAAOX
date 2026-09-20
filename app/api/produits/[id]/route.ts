import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { z } from "zod";

const schemaUpdate = z.object({
  nom: z.string().min(2).optional(),
  slug: z.string().optional(),
  description: z.string().optional().nullable(),
  prix: z.number().positive().optional(),
  prixCompare: z.number().positive().optional().nullable(),
  cout: z.number().optional().nullable(),
  stock: z.number().int().min(0).optional(),
  sku: z.string().optional().nullable(),
  codeBarres: z.string().optional().nullable(),
  images: z.array(z.string()).optional(),
  videos: z.array(z.string()).optional(),
  categorie: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  actif: z.boolean().optional(),
  featured: z.boolean().optional(),
  poids: z.number().optional().nullable(),
  metaTitle: z.string().optional().nullable(),
  metaDesc: z.string().optional().nullable(),
  type: z.enum(["physique", "digital", "dropshipping"]).optional(),
  fichierUrl: z.string().optional().nullable(),
  fichierNom: z.string().optional().nullable(),
  fichierTaille: z.number().optional().nullable(),
  instructionsTelechargement: z.string().optional().nullable(),
  prixFournisseur: z.number().optional().nullable(),
  urlFournisseur: z.string().optional().nullable(),
  nomFournisseur: z.string().optional().nullable(),
  affiliationActive: z.boolean().optional(),
  tauxCommissionAff: z.number().min(0).max(1).optional().nullable(),
  ogImage: z.string().optional().nullable(),
  masquerVentes: z.boolean().optional(),
  visibleListage: z.boolean().optional(),
  texteBoutonAchat: z.string().optional().nullable(),
  faq: z.array(z.object({ question: z.string(), reponse: z.string() })).optional().nullable(),
  champsCommande: z.array(z.object({
    label: z.string(), type: z.string(), requis: z.boolean(),
    options: z.array(z.string()).optional(),
  })).optional().nullable(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const tenantId = (session.user as any)?.tenantId;
  const { id } = await params;

  const produit = await prisma.produit.findFirst({
    where: { id, tenantId },
    include: { variantes: true, _count: { select: { avis: true, lignesCommande: true } } },
  });

  if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  return NextResponse.json({ produit });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const tenantId = (session.user as any)?.tenantId;
  const role = (session.user as any)?.role;
  if (role !== "owner" && role !== "editeur") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  try {
    const data = schemaUpdate.parse(body);

    const produit = await prisma.produit.findFirst({ where: { id, tenantId } });
    if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

    const updateData: any = { ...data };

    // Champs non couverts par le spread Zod — appliqués directement depuis le body
    const CHAMPS_DIRECTS = [
      "type", "slug", "videos", "fichierUrl", "fichierNom", "fichierTaille",
      "instructionsTelechargement", "prixFournisseur", "urlFournisseur", "nomFournisseur",
      "ogImage", "masquerVentes", "visibleListage", "texteBoutonAchat", "faq", "champsCommande",
    ] as const;
    for (const champ of CHAMPS_DIRECTS) {
      if (champ in body) updateData[champ] = body[champ];
    }

    // Régénérer slug si le nom change (sans écraser le slug envoyé explicitement)
    if (data.nom && data.nom !== produit.nom && !("slug" in body)) {
      const newSlug = slugify(data.nom);
      const slugExiste = await prisma.produit.findFirst({
        where: { tenantId, slug: newSlug, id: { not: id } },
      });
      if (!slugExiste) updateData.slug = newSlug;
    }

    const updated = await prisma.produit.update({ where: { id }, data: updateData });
    return NextResponse.json({ produit: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides", details: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH — mise à jour rapide d'un seul champ (type, actif, featured…)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  const { id } = await params;

  const body = await req.json();

  const produit = await prisma.produit.findFirst({ where: { id, tenantId } });
  if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

  // Champs autorisés pour le PATCH rapide
  const data: Record<string, any> = {};
  if (body.type !== undefined && ["physique", "digital", "dropshipping"].includes(body.type)) {
    data.type = body.type;
  }
  if (body.actif !== undefined) data.actif = Boolean(body.actif);
  if (body.featured !== undefined) data.featured = Boolean(body.featured);
  if (body.stock !== undefined) data.stock = Number(body.stock);
  if (body.masquerVentes !== undefined) data.masquerVentes = Boolean(body.masquerVentes);
  if (body.visibleListage !== undefined) data.visibleListage = Boolean(body.visibleListage);
  if (body.faq !== undefined) data.faq = body.faq;
  if (body.champsCommande !== undefined) data.champsCommande = body.champsCommande;
  if ("texteBoutonAchat" in body) data.texteBoutonAchat = body.texteBoutonAchat ?? null;
  if ("ogImage" in body) data.ogImage = body.ogImage ?? null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucun champ valide à mettre à jour" }, { status: 400 });
  }

  const updated = await prisma.produit.update({ where: { id }, data });
  return NextResponse.json({ produit: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const tenantId = (session.user as any)?.tenantId;
  const role = (session.user as any)?.role;
  if (role !== "owner") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;

  const produit = await prisma.produit.findFirst({ where: { id, tenantId } });
  if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

  await prisma.produit.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
