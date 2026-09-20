import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireNiveau } from "@/lib/permissions-server";
import { envoyerInvitationEquipe } from "@/lib/email";

function genToken() { return randomBytes(20).toString("hex"); }

const grillePermissions = z.record(z.string(), z.enum(["aucun", "lecture", "ecriture"]));

const schemaInvitation = z.object({
  email: z.string().email(),
  nom: z.string().min(1).optional(),
  role: z.enum(["gerant", "caissier", "comptable", "lecture", "personnalise"]),
  permissions: grillePermissions.optional(),
});

const ROLE_LABELS: Record<string, string> = {
  gerant: "Gérant", caissier: "Caissier", comptable: "Comptable",
  lecture: "Lecture seule", personnalise: "Personnalisé",
};

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const refus = await requireNiveau(session, "equipe", "ecriture");
    if (refus) return NextResponse.json({ error: refus.error }, { status: refus.status });

    const tenantId = (session.user as any)?.tenantId;
    if (!tenantId) return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 });

    const body = await req.json();
    const { email, nom, role, permissions } = schemaInvitation.parse(body);

    if (role === "personnalise" && !permissions) {
      return NextResponse.json({ error: "Grille de permissions requise pour un rôle personnalisé" }, { status: 400 });
    }

    // Un email déjà lié à un compte Axso (propriétaire d'une autre boutique,
    // ou déjà membre ailleurs) ne peut pas être ré-utilisé — User.email est
    // unique globalement sur la plateforme. Limitation connue v1.
    const compteExistant = await prisma.user.findUnique({ where: { email } });
    if (compteExistant) {
      return NextResponse.json({ error: "Un compte Axso existe déjà avec cet email — impossible de l'inviter pour le moment." }, { status: 400 });
    }

    const existant = await prisma.membreEquipe.findFirst({ where: { tenantId, email } });
    if (existant && existant.statut === "actif") {
      return NextResponse.json({ error: "Ce membre fait déjà partie de l'équipe" }, { status: 400 });
    }

    const inviteToken = genToken();
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const data = {
      tenantId, email, nom: nom || email.split("@")[0], role,
      permissions: role === "personnalise" ? permissions : undefined,
      statut: "invite", inviteToken, inviteExpiresAt,
    };

    // Réinvitation (ligne existante "invite" ou "suspendu" jamais acceptée) :
    // on met à jour plutôt que de dupliquer.
    const membre = existant
      ? await prisma.membreEquipe.update({ where: { id: existant.id }, data })
      : await prisma.membreEquipe.create({ data });

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { nomBoutique: true } });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://axso.vercel.app";
    const lienInvitation = `${appUrl}/rejoindre-equipe/${inviteToken}`;

    await envoyerInvitationEquipe({
      email, nom: data.nom, boutique: tenant?.nomBoutique ?? "ta boutique",
      role: ROLE_LABELS[role] ?? role, lien: lienInvitation,
    }).catch(() => {}); // l'email est un bonus, jamais bloquant — le lien reste affiché dans l'UI

    return NextResponse.json({ success: true, membre, lienInvitation });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }
    console.error("[API/EQUIPE]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// "Retire" un membre. Une invitation jamais acceptée (userId encore vide)
// peut être supprimée sans risque. Un membre déjà lié à un vrai compte
// (userId défini) est en revanche SUSPENDU plutôt que supprimé : l'absence
// totale de ligne MembreEquipe pour un userId est le signal utilisé partout
// (lib/permissions.ts) pour reconnaître le propriétaire d'origine — supprimer
// la ligne d'un membre réel lui rendrait un accès complet au lieu de le lui
// retirer.
export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const refus = await requireNiveau(session, "equipe", "ecriture");
    if (refus) return NextResponse.json({ error: refus.error }, { status: refus.status });

    const tenantId = (session.user as any)?.tenantId;
    const { searchParams } = new URL(req.url);
    const membreId = searchParams.get("id");
    if (!membreId) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

    const membre = await prisma.membreEquipe.findFirst({ where: { id: membreId, tenantId } });
    if (!membre) return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });

    if (membre.userId) {
      await prisma.membreEquipe.update({ where: { id: membreId }, data: { statut: "suspendu" } });
    } else {
      await prisma.membreEquipe.delete({ where: { id: membreId } });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
