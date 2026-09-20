import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash, randomBytes } from "crypto";

function hash(password: string) {
  return createHash("sha256").update(password + process.env.NEXTAUTH_SECRET).digest("hex");
}

function genToken() {
  return randomBytes(32).toString("hex");
}

// POST /api/clients-acheteurs/connexion
// Body: { slug, email, password, action: "connexion"|"inscription" }
export async function POST(req: Request) {
  const body = await req.json();
  const { slug, email, password, action, nom, telephone } = body;

  if (!slug || !email || !password || !action) {
    return NextResponse.json({ error: "Paramètres requis manquants" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
  const tenantId = tenant.id;

  if (action === "inscription") {
    if (!nom) return NextResponse.json({ error: "Nom requis" }, { status: 400 });

    const existing = await prisma.compteAcheteur.findUnique({ where: { tenantId_email: { tenantId, email } } });
    if (existing) return NextResponse.json({ error: "Ce compte existe déjà" }, { status: 409 });

    const token = genToken();
    const tokenExpire = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Cross-canal: lier au Client existant par email
    const clientExistant = await prisma.client.findFirst({ where: { tenantId, email } });

    const compte = await prisma.compteAcheteur.create({
      data: {
        tenantId, email, nom,
        telephone: telephone ?? null,
        passwordHash: hash(password),
        token,
        tokenExpire,
        clientId: clientExistant?.id ?? null,
      },
    });

    return NextResponse.json({
      ok: true,
      token,
      compte: { id: compte.id, email: compte.email, nom: compte.nom, clientLie: !!clientExistant },
    }, { status: 201 });
  }

  if (action === "connexion") {
    const compte = await prisma.compteAcheteur.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });

    if (!compte || compte.passwordHash !== hash(password)) {
      return NextResponse.json({ error: "Email ou mot de passe incorrect" }, { status: 401 });
    }

    const token = genToken();
    const tokenExpire = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Cross-canal: si pas encore lié, essayer de lier maintenant
    let clientId = compte.clientId;
    if (!clientId) {
      const clientExistant = await prisma.client.findFirst({ where: { tenantId, email } });
      if (clientExistant) clientId = clientExistant.id;
    }

    await prisma.compteAcheteur.update({
      where: { id: compte.id },
      data: { token, tokenExpire, clientId: clientId ?? undefined },
    });

    return NextResponse.json({
      ok: true,
      token,
      compte: { id: compte.id, email: compte.email, nom: compte.nom, clientId },
    });
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
