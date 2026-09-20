import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
});

// Route publique (pas de session requise — le membre n'a pas encore de
// compte) : accepte une invitation d'équipe, crée le User correspondant et
// active le membre. Reprend le même flux de connexion standard ensuite
// (Credentials provider) — aucune modif de lib/auth.ts au-delà du check de
// suspension déjà en place.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, password } = schema.parse(body);

    const membre = await prisma.membreEquipe.findUnique({ where: { inviteToken: token } });
    if (!membre || membre.statut !== "invite") {
      return NextResponse.json({ error: "Invitation invalide ou déjà utilisée" }, { status: 400 });
    }
    if (!membre.inviteExpiresAt || membre.inviteExpiresAt < new Date()) {
      return NextResponse.json({ error: "Cette invitation a expiré — demande un nouveau lien au responsable de la boutique" }, { status: 400 });
    }

    const compteExistant = await prisma.user.findUnique({ where: { email: membre.email } });
    if (compteExistant) {
      return NextResponse.json({ error: "Un compte Axso existe déjà avec cet email" }, { status: 400 });
    }

    const passwordHash = await hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: membre.email,
        name: membre.nom,
        password: passwordHash,
        tenantId: membre.tenantId,
        role: "membre_equipe",
      },
    });

    await prisma.membreEquipe.update({
      where: { id: membre.id },
      data: { userId: user.id, statut: "actif", inviteToken: null, inviteExpiresAt: null },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Mot de passe invalide (6 caractères minimum)" }, { status: 400 });
    console.error("[API/EQUIPE/ACCEPTER]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// Vérifie la validité d'un token sans consommer l'invitation — utilisé par
// la page publique pour afficher le nom de la boutique et le rôle proposé
// avant que le futur membre choisisse son mot de passe.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token manquant" }, { status: 400 });

  const membre = await prisma.membreEquipe.findUnique({
    where: { inviteToken: token },
    select: { statut: true, inviteExpiresAt: true, nom: true, role: true, tenantId: true },
  });
  if (!membre || membre.statut !== "invite") {
    return NextResponse.json({ error: "Invitation invalide ou déjà utilisée" }, { status: 400 });
  }
  if (!membre.inviteExpiresAt || membre.inviteExpiresAt < new Date()) {
    return NextResponse.json({ error: "Cette invitation a expiré" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: membre.tenantId }, select: { nomBoutique: true } });
  return NextResponse.json({ nom: membre.nom, role: membre.role, boutique: tenant?.nomBoutique ?? "cette boutique" });
}
