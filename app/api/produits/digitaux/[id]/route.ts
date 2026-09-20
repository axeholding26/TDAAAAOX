import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

type Ctx = { params: Promise<{ id: string }> };

// GET — récupère le produit digital avec son détail
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { id } = await params;

    const produit = await prisma.produit.findFirst({
      where: { id, tenantId },
      include: {
        produitFichier: { include: { fichiers: { orderBy: { ordre: "asc" } } } },
        formation:      { include: { chapitres: { include: { lecons: { orderBy: { ordre: "asc" } } }, orderBy: { ordre: "asc" } } } },
        licenceProduit: { include: { cles: { take: 20, orderBy: { createdAt: "desc" } } } },
        bundleProduit:  { include: { elements: { include: { produitInclus: { select: { id: true, nom: true, prix: true, images: true, type: true } } }, orderBy: { ordre: "asc" } } } },
        variantesPrix:  { orderBy: { createdAt: "asc" } },
      },
    });

    if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

    // Ne pas exposer le mot de passe
    if (produit.produitFichier) {
      (produit.produitFichier as any).motDePasse = produit.produitFichier.motDePasse ? "****" : null;
    }

    return NextResponse.json({ produit });
  } catch (err) {
    console.error("[api/produits/digitaux/[id] GET]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH — met à jour les infos produit + config détail
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { id } = await params;

    const existant = await prisma.produit.findFirst({ where: { id, tenantId } });
    if (!existant) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

    const body = await req.json();

    // Champs produit de base
    const champsProduit: Record<string, any> = {};
    const CHAMPS_BASE = ["nom", "description", "prix", "prixCompare", "images", "categorie", "tags",
      "metaTitle", "metaDesc", "actif", "featured", "slug"] as const;
    for (const c of CHAMPS_BASE) {
      if (c in body) champsProduit[c] = body[c];
    }

    if (Object.keys(champsProduit).length > 0) {
      await prisma.produit.update({ where: { id }, data: champsProduit });
    }

    // Config Formation
    if (existant.type === "formation" && body.config) {
      const c = body.config;
      const cfg: any = {};
      if ("niveau"   in c) cfg.niveau   = c.niveau;
      if ("langue"   in c) cfg.langue   = c.langue;
      if ("dureeMin" in c) cfg.dureeMin = c.dureeMin;
      if ("certif"   in c) cfg.certif   = c.certif;
      if (Object.keys(cfg).length > 0) {
        await prisma.formation.upsert({
          where:  { produitId: id },
          create: { produitId: id, ...cfg },
          update: cfg,
        });
      }
    }

    // Config LicenceProduit
    if (existant.type === "licence" && body.config) {
      const cfg: Record<string, any> = {};
      const c = body.config;
      if ("modeDistrib"    in c) cfg.modeDistrib    = c.modeDistrib;
      if ("formatAuto"     in c) cfg.formatAuto     = c.formatAuto;
      if ("longueur"       in c) cfg.longueur       = c.longueur;
      if ("prefixe"        in c) cfg.prefixe        = c.prefixe;
      if ("maxActivations" in c) cfg.maxActivations = c.maxActivations;
      if ("dureeJours"     in c) cfg.dureeJours     = c.dureeJours;
      if (Object.keys(cfg).length > 0) {
        await prisma.licenceProduit.upsert({
          where:  { produitId: id },
          create: { produitId: id, ...cfg },
          update: cfg,
        });
      }
    }

    // Config ProduitFichier
    if (existant.type === "fichier" && body.config) {
      const cfg: Record<string, any> = {};
      if ("limitAchats"        in body.config) cfg.limitAchats        = body.config.limitAchats;
      if ("filigrane"          in body.config) cfg.filigrane          = body.config.filigrane;
      if ("instructionsAchat"  in body.config) cfg.instructionsAchat  = body.config.instructionsAchat;
      if ("motDePasse"         in body.config) {
        cfg.motDePasse = body.config.motDePasse
          ? await bcrypt.hash(body.config.motDePasse, 10)
          : null;
      }
      if (Object.keys(cfg).length > 0) {
        await prisma.produitFichier.upsert({
          where:  { produitId: id },
          create: { produitId: id, ...cfg },
          update: cfg,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/produits/digitaux/[id] PATCH]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE — supprime le produit digital et tous ses détails (cascade Prisma)
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { id } = await params;

    const existant = await prisma.produit.findFirst({ where: { id, tenantId } });
    if (!existant) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

    if (existant.ventes > 0) {
      return NextResponse.json({ error: "Impossible de supprimer un produit avec des ventes" }, { status: 409 });
    }

    await prisma.produit.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/produits/digitaux/[id] DELETE]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
