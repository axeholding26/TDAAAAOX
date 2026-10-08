// API Route — Livraison digitale sécurisée
// Génère et valide des liens de téléchargement avec token UUID, suivi des limites
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { finAcces, metaDigital } from "@/lib/commandes";
import { randomUUID } from "crypto";

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ─── POST /api/livraison-digitale ─────────────────────────────────────────────
// Body: { orderId, productId }
// Retourne: { url, expiresAt, downloadsLeft, token }

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

    const tenantId = (session.user as any)?.tenantId;
    const body = await req.json();
    const { orderId, productId } = body;

    if (!orderId || !productId) {
      return NextResponse.json({ message: "orderId et productId sont requis" }, { status: 400 });
    }

    // Vérifier que la commande appartient au tenant et est payée
    const commande = await prisma.commande.findFirst({
      where: { id: orderId, tenantId },
      select: { id: true, paiementStatut: true, statut: true },
    });

    if (!commande) {
      return NextResponse.json({ message: "Commande introuvable" }, { status: 404 });
    }
    if (commande.paiementStatut !== "completed") {
      return NextResponse.json({ message: "Paiement non confirmé" }, { status: 402 });
    }

    // Vérifier le produit digital
    const produit = await prisma.produit.findFirst({
      where: { id: productId, tenantId, type: "digital", actif: true },
      select: {
        id: true,
        nom: true,
        fichierUrl: true,
        instructionsTelechargement: true,
        tenant: { select: { slug: true } },
      },
    });

    if (!produit) {
      return NextResponse.json({ message: "Produit digital introuvable" }, { status: 404 });
    }
    if (!produit.fichierUrl) {
      return NextResponse.json({ message: "Aucun fichier associé à ce produit" }, { status: 404 });
    }

    const meta = metaDigital(produit.instructionsTelechargement);
    const expirationJours = meta.expirationAcces as number | null ?? null;
    const limiteTelechargement = meta.limiteTelechargement as number | null ?? null;

    const expireAt = finAcces(expirationJours);
    const token = randomUUID();

    await prisma.telechargement.create({
      data: {
        token,
        produitId: productId,
        commandeId: orderId,
        expireAt,
        telecharge: false,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const url = `${baseUrl}/api/telechargements/${token}`;

    return NextResponse.json({
      url,
      expiresAt: expireAt,
      downloadsLeft: limiteTelechargement,
      token,
      message: meta.messagePostAchat || null,
      instructions: meta.instructions || null,
    });
  } catch (err) {
    console.error("[livraison-digitale POST]", err);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

// ─── GET /api/livraison-digitale?token=xxx ────────────────────────────────────
// Valide le token, comptabilise le téléchargement, redirige vers le fichier

export async function GET(req: NextRequest) {
  // Anciens liens : mêmes contrôles que partout (paiement, révocation, limite).
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ message: "Token manquant" }, { status: 400 });
  return NextResponse.redirect(new URL(`/api/telechargements/${encodeURIComponent(token)}`, req.url));
}

// ─── PATCH /api/livraison-digitale ────────────────────────────────────────────
// Actions: "revoke" (révoquer l'accès) | "resend" (régénérer un lien)

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

    const tenantId = (session.user as any)?.tenantId;
    const body = await req.json();
    const { action, token, orderId, productId } = body;

    // ── Action: révoquer le lien ──
    if (action === "revoke" && token) {
      const tel = await prisma.telechargement.findUnique({ where: { token } });
      if (!tel) return NextResponse.json({ message: "Token introuvable" }, { status: 404 });

      // Vérifier que le produit appartient au tenant
      const produit = await prisma.produit.findFirst({
        where: { id: tel.produitId, tenantId },
      });
      if (!produit) return NextResponse.json({ message: "Non autorisé" }, { status: 403 });

      // Expirer immédiatement
      await prisma.telechargement.update({
        where: { token },
        data: { expireAt: new Date(0) }, // epoch = déjà expiré
      });

      return NextResponse.json({ success: true, message: "Accès révoqué avec succès" });
    }

    // ── Action: regénérer un lien de téléchargement ──
    if (action === "resend" && orderId && productId) {
      // Vérifier le produit
      const produit = await prisma.produit.findFirst({
        where: { id: productId, tenantId, type: "digital" },
        select: {
          id: true,
          nom: true,
          fichierUrl: true,
          instructionsTelechargement: true,
          tenant: { select: { slug: true } },
        },
      });
      if (!produit) {
        return NextResponse.json({ message: "Produit introuvable" }, { status: 404 });
      }
      if (!produit.fichierUrl) {
        return NextResponse.json({ message: "Aucun fichier associé" }, { status: 404 });
      }

      const meta = metaDigital(produit.instructionsTelechargement);
      const expirationJours = meta.expirationAcces as number | null ?? null;
      const limiteTelechargement = meta.limiteTelechargement as number | null ?? null;

      const expireAt = finAcces(expirationJours);
      const newToken = randomUUID();

      await prisma.telechargement.create({
        data: {
          token: newToken,
          produitId: productId,
          commandeId: orderId,
          expireAt,
          telecharge: false,
        },
      });

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const url = `${baseUrl}/api/telechargements/${newToken}`;

      return NextResponse.json({
        success: true,
        url,
        token: newToken,
        expiresAt: expireAt,
        downloadsLeft: limiteTelechargement,
      });
    }

    return NextResponse.json({ message: "Action inconnue ou paramètres manquants" }, { status: 400 });
  } catch (err) {
    console.error("[livraison-digitale PATCH]", err);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
