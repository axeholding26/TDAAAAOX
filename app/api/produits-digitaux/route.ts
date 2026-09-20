// API Route — Produits digitaux
// Extended digital product management with metadata stored as JSON in instructionsTelechargement
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { z } from "zod";

// ─── Schema ──────────────────────────────────────────────────────────────────

const schemaDigital = z.object({
  nom: z.string().min(2, "Minimum 2 caractères").max(120),
  slug: z.string().optional(),
  description: z.string().optional(),
  prix: z.number().positive("Prix requis"),
  prixCompare: z.number().positive().optional(),
  categorie: z.string().optional(),
  tags: z.array(z.string()).default([]),
  images: z.array(z.string()).default([]),
  actif: z.boolean().default(true),
  metaTitle: z.string().max(60).optional(),
  metaDesc: z.string().max(155).optional(),
  // Fichier principal
  fichierUrl: z.string().optional(),
  fichierNom: z.string().optional(),
  fichierTaille: z.number().int().optional(),
  // Métadonnées digitales étendues (stockées en JSON dans instructionsTelechargement)
  typeDigital: z.enum(["ebook", "cours", "logiciel", "template", "audio", "video", "autre"]).default("autre"),
  limiteTelechargement: z.number().int().min(1).nullable().default(null),
  expirationAcces: z.union([z.literal(7), z.literal(30), z.literal(90), z.literal(365), z.null()]).default(null),
  typeLienTelechargement: z.enum(["instant", "compte"]).default("instant"),
  typeLicence: z.enum(["personnel", "commercial", "commercial_etendu", "abonnement"]).default("personnel"),
  filigrane: z.boolean().default(false),
  liensUniques: z.boolean().default(true),
  produitUpsellId: z.string().nullable().optional(),
  messagePostAchat: z.string().default(""),
  instructions: z.string().default(""),
  previewUrl: z.string().nullable().optional(),
});

const schemaUpdate = schemaDigital.partial().extend({ id: z.string() });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseMeta(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    if (raw.startsWith("{")) return JSON.parse(raw);
  } catch {}
  return {};
}

function buildMeta(data: z.infer<typeof schemaDigital>) {
  return {
    typeDigital: data.typeDigital,
    limiteTelechargement: data.limiteTelechargement,
    expirationAcces: data.expirationAcces,
    typeLienTelechargement: data.typeLienTelechargement,
    typeLicence: data.typeLicence,
    filigrane: data.filigrane,
    liensUniques: data.liensUniques,
    produitUpsellId: data.produitUpsellId ?? null,
    messagePostAchat: data.messagePostAchat,
    instructions: data.instructions,
    previewUrl: data.previewUrl ?? null,
  };
}

// ─── GET /api/produits-digitaux ───────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

    const tenantId = (session.user as any)?.tenantId;
    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get("type") || "tous";
    const statutFilter = searchParams.get("statut") || "tous";
    const productId = searchParams.get("productId");
    const action = searchParams.get("action");

    // ── Customers list for a specific product ──
    if (productId && action === "customers") {
      const lignes = await prisma.ligneCommande.findMany({
        where: {
          produitId: productId,
          commande: { tenantId },
        },
        include: {
          commande: {
            select: {
              id: true,
              numero: true,
              clientNom: true,
              clientEmail: true,
              paiementStatut: true,
              createdAt: true,
            },
          },
        },
        orderBy: { commande: { createdAt: "desc" } },
        take: 50,
      });

      // Get download tokens for those orders
      const commandeIds = lignes.map((l) => l.commande.id);
      const telechargements = await prisma.telechargement.findMany({
        where: { produitId: productId, commandeId: { in: commandeIds } },
        select: { commandeId: true, token: true, telecharge: true, expireAt: true, createdAt: true },
      });

      const clients = lignes.map((l) => {
        const dl = telechargements.filter((t) => t.commandeId === l.commande.id);
        return {
          commandeId: l.commande.id,
          commandeNumero: l.commande.numero,
          clientNom: l.commande.clientNom,
          clientEmail: l.commande.clientEmail,
          paiementStatut: l.commande.paiementStatut,
          achatDate: l.commande.createdAt,
          telechargements: dl,
        };
      });

      return NextResponse.json({ clients });
    }

    // ── Download analytics last 30 days for a product ──
    if (productId && action === "analytics") {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const analytics = await prisma.analytics.findMany({
        where: {
          tenantId,
          type: "telechargement",
          date: { gte: since },
        },
        select: { date: true, metadata: true },
        orderBy: { date: "asc" },
      });

      // Filter by productId from metadata
      const filtered = analytics.filter((a) => {
        const m = a.metadata as Record<string, unknown>;
        return m.produitId === productId;
      });

      // Group by day (YYYY-MM-DD)
      const byDay: Record<string, number> = {};
      // Pre-fill 30 days with 0
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        byDay[d.toISOString().slice(0, 10)] = 0;
      }
      filtered.forEach((a) => {
        const day = new Date(a.date).toISOString().slice(0, 10);
        if (byDay[day] !== undefined) byDay[day]++;
      });

      const graphData = Object.entries(byDay).map(([date, count]) => ({ date, count }));
      return NextResponse.json({ graphData, total: filtered.length });
    }

    // ── Main product listing ──
    const where: any = { tenantId, type: "digital" };
    if (statutFilter === "actif") where.actif = true;
    if (statutFilter === "archive") where.actif = false;

    // Query simple sans relations optionnelles pour éviter les blocages
    const produits = await prisma.produit.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    // Parse metadata and apply type filter
    let result = produits.map((p: any) => {
      const meta = parseMeta(p.instructionsTelechargement);
      return {
        ...p,
        meta,
        downloadCount: p.ventes ?? 0,
        _count: { telechargements: 0, lignesCommande: p.ventes ?? 0 },
      };
    });

    if (typeFilter !== "tous") {
      result = result.filter((p: any) => p.meta.typeDigital === typeFilter);
    }

    // ── Stats ──
    const revenuTotal = produits.reduce((s: number, p: any) => s + (p.prix ?? 0) * (p.ventes ?? 0), 0);
    const licencesActives = produits.filter((p: any) => p.actif).length;

    return NextResponse.json({
      produits: result,
      stats: {
        totalTelechargements: 0,
        revenuTotal,
        licencesActives,
        totalProduits: produits.length,
      },
    });
  } catch (err) {
    console.error("[produits-digitaux GET]", err);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

// ─── POST /api/produits-digitaux ─────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

    const tenantId = (session.user as any)?.tenantId;
    const body = await request.json();
    const data = schemaDigital.parse(body);

    const slug = data.slug || slugify(data.nom);

    // Check slug uniqueness
    const existing = await prisma.produit.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
    });
    if (existing) {
      // Add a suffix to make unique
      const uniqueSlug = `${slug}-${Date.now().toString(36)}`;
      const meta = buildMeta(data);
      const produit = await prisma.produit.create({
        data: {
          tenantId,
          nom: data.nom,
          slug: uniqueSlug,
          description: data.description,
          prix: data.prix,
          prixCompare: data.prixCompare,
          stock: 99999,
          categorie: data.categorie,
          tags: data.tags,
          images: data.images,
          videos: [],
          actif: data.actif,
          featured: false,
          type: "digital",
          fichierUrl: data.fichierUrl,
          fichierNom: data.fichierNom,
          fichierTaille: data.fichierTaille,
          instructionsTelechargement: JSON.stringify(meta),
          metaTitle: data.metaTitle,
          metaDesc: data.metaDesc,
        },
      });
      return NextResponse.json({ produit }, { status: 201 });
    }

    const meta = buildMeta(data);
    const produit = await prisma.produit.create({
      data: {
        tenantId,
        nom: data.nom,
        slug,
        description: data.description,
        prix: data.prix,
        prixCompare: data.prixCompare,
        stock: 99999,
        categorie: data.categorie,
        tags: data.tags,
        images: data.images,
        videos: [],
        actif: data.actif,
        featured: false,
        type: "digital",
        fichierUrl: data.fichierUrl,
        fichierNom: data.fichierNom,
        fichierTaille: data.fichierTaille,
        instructionsTelechargement: JSON.stringify(meta),
        metaTitle: data.metaTitle,
        metaDesc: data.metaDesc,
      },
    });

    return NextResponse.json({ produit }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: "Données invalides", erreurs: err.issues }, { status: 400 });
    }
    console.error("[produits-digitaux POST]", err);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

// ─── PATCH /api/produits-digitaux ────────────────────────────────────────────

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

    const tenantId = (session.user as any)?.tenantId;
    const body = await request.json();
    const { id, ...rest } = schemaUpdate.parse(body);

    if (!id) return NextResponse.json({ message: "id requis" }, { status: 400 });

    // Verify ownership
    const existing = await prisma.produit.findFirst({
      where: { id, tenantId, type: "digital" },
    });
    if (!existing) return NextResponse.json({ message: "Produit introuvable" }, { status: 404 });

    // Build update payload
    const update: any = {};
    if (rest.nom !== undefined) { update.nom = rest.nom; }
    if (rest.description !== undefined) { update.description = rest.description; }
    if (rest.prix !== undefined) { update.prix = rest.prix; }
    if (rest.prixCompare !== undefined) { update.prixCompare = rest.prixCompare; }
    if (rest.actif !== undefined) { update.actif = rest.actif; }
    if (rest.categorie !== undefined) { update.categorie = rest.categorie; }
    if (rest.tags !== undefined) { update.tags = rest.tags; }
    if (rest.images !== undefined) { update.images = rest.images; }
    if (rest.fichierUrl !== undefined) { update.fichierUrl = rest.fichierUrl; }
    if (rest.fichierNom !== undefined) { update.fichierNom = rest.fichierNom; }
    if (rest.fichierTaille !== undefined) { update.fichierTaille = rest.fichierTaille; }
    if (rest.metaTitle !== undefined) { update.metaTitle = rest.metaTitle; }
    if (rest.metaDesc !== undefined) { update.metaDesc = rest.metaDesc; }

    // Update metadata if any meta field changed
    const metaKeys = [
      "typeDigital", "limiteTelechargement", "expirationAcces", "typeLienTelechargement",
      "typeLicence", "filigrane", "liensUniques", "produitUpsellId",
      "messagePostAchat", "instructions", "previewUrl",
    ] as const;
    const hasMetaChange = metaKeys.some((k) => k in rest);
    if (hasMetaChange) {
      const currentMeta = parseMeta(existing.instructionsTelechargement);
      const newMeta: any = { ...currentMeta };
      for (const k of metaKeys) {
        if (k in rest) newMeta[k] = (rest as any)[k];
      }
      update.instructionsTelechargement = JSON.stringify(newMeta);
    }

    const produit = await prisma.produit.update({ where: { id }, data: update });
    return NextResponse.json({ produit });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: "Données invalides", erreurs: err.issues }, { status: 400 });
    }
    console.error("[produits-digitaux PATCH]", err);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

// ─── DELETE /api/produits-digitaux ───────────────────────────────────────────

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

    const tenantId = (session.user as any)?.tenantId;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ message: "id requis" }, { status: 400 });

    const existing = await prisma.produit.findFirst({ where: { id, tenantId, type: "digital" } });
    if (!existing) return NextResponse.json({ message: "Produit introuvable" }, { status: 404 });

    await prisma.produit.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[produits-digitaux DELETE]", err);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
