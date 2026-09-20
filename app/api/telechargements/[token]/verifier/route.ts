import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

type Ctx = { params: Promise<{ token: string }> };

// POST public — vérifie le mot de passe d'un fichier protégé sans le servir.
// Utilisé par la page de confirmation pour révéler les liens de téléchargement
// réels (qui doivent eux-mêmes porter ?pw= pour passer le contrôle du GET).
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { token } = await params;
    const { password } = await req.json();

    const dl = await prisma.telechargement.findUnique({ where: { token } });
    if (!dl) return NextResponse.json({ ok: false, error: "Lien invalide ou expiré" }, { status: 404 });
    if (dl.expireAt < new Date()) return NextResponse.json({ ok: false, error: "Lien expiré" }, { status: 410 });

    const produit = await prisma.produit.findUnique({
      where: { id: dl.produitId },
      include: { produitFichier: { include: { fichiers: { orderBy: { ordre: "asc" } } } } },
    });
    if (!produit?.produitFichier) return NextResponse.json({ ok: false, error: "Produit introuvable" }, { status: 404 });

    const hash = produit.produitFichier.motDePasse;
    if (hash && !(await bcrypt.compare(password || "", hash))) {
      return NextResponse.json({ ok: false, error: "Mot de passe incorrect" }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      fichiers: produit.produitFichier.fichiers.map((f) => ({ id: f.id, nom: f.nom })),
    });
  } catch (err) {
    console.error("[telechargements/[token]/verifier POST]", err);
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 });
  }
}
