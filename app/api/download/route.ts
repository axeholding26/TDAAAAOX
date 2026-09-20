// API de téléchargement sécurisé pour produits digitaux
// Token = base64(commandeId:produitId:timestamp) signé avec NEXTAUTH_SECRET
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHmac } from "crypto";

function signerToken(commandeId: string, produitId: string): string {
  const payload = `${commandeId}:${produitId}`;
  const secret = process.env.NEXTAUTH_SECRET || "axso-secret";
  const sig = createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

function verifierToken(token: string): { commandeId: string; produitId: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return null;
    const [commandeId, produitId, sig] = parts;
    const secret = process.env.NEXTAUTH_SECRET || "axso-secret";
    const sigAttendu = createHmac("sha256", secret).update(`${commandeId}:${produitId}`).digest("hex").slice(0, 16);
    if (sig !== sigAttendu) return null;
    return { commandeId, produitId };
  } catch {
    return null;
  }
}

// GET /api/download?token=xxx — télécharger le fichier
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ message: "Token manquant" }, { status: 400 });

  const payload = verifierToken(token);
  if (!payload) return NextResponse.json({ message: "Token invalide ou expiré" }, { status: 403 });

  const { commandeId, produitId } = payload;

  // Vérifier que la commande est bien payée
  const commande = await prisma.commande.findUnique({
    where: { id: commandeId },
    select: { paiementStatut: true, statut: true },
  });
  if (!commande || commande.paiementStatut !== "completed") {
    return NextResponse.json({ message: "Paiement non confirmé" }, { status: 403 });
  }

  // Récupérer le produit
  const produit = await prisma.produit.findUnique({
    where: { id: produitId },
    select: { fichierUrl: true, fichierNom: true, nom: true, type: true, instructionsTelechargement: true },
  });

  if (!produit || produit.type !== "digital" || !produit.fichierUrl) {
    return NextResponse.json({ message: "Fichier introuvable" }, { status: 404 });
  }

  // Enregistrer le téléchargement
  await prisma.telechargement.upsert({
    where: { token },
    create: {
      token,
      produitId,
      commandeId,
      expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours
      telecharge: true,
    },
    update: { telecharge: true },
  });

  // Rediriger vers le fichier
  return NextResponse.redirect(produit.fichierUrl);
}

// POST /api/download/generer — générer un token de téléchargement
export async function POST(req: NextRequest) {
  try {
    const { commandeId, produitId } = await req.json();
    if (!commandeId || !produitId) {
      return NextResponse.json({ message: "commandeId et produitId requis" }, { status: 400 });
    }
    const token = signerToken(commandeId, produitId);
    const url = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/download?token=${token}`;
    return NextResponse.json({ token, url });
  } catch {
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
