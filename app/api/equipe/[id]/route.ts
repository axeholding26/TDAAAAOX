import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireNiveau } from "@/lib/permissions-server";

const schemaMaj = z.object({
  role: z.enum(["gerant", "caissier", "comptable", "lecture", "personnalise"]).optional(),
  permissions: z.record(z.string(), z.enum(["aucun", "lecture", "ecriture"])).optional(),
  statut: z.enum(["actif", "suspendu"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const refus = await requireNiveau(session, "equipe", "ecriture");
    if (refus) return NextResponse.json({ error: refus.error }, { status: refus.status });

    const tenantId = (session.user as any)?.tenantId;
    const { id } = await params;
    const body = await req.json();
    const data = schemaMaj.parse(body);

    if (data.role === "personnalise" && !data.permissions) {
      return NextResponse.json({ error: "Grille de permissions requise pour un rôle personnalisé" }, { status: 400 });
    }
    // Réactiver un membre qui n'a jamais accepté son invitation (userId
    // vide) n'a pas de sens — il n'a pas encore de compte pour se connecter.
    if (data.statut === "actif") {
      const membre = await prisma.membreEquipe.findFirst({ where: { id, tenantId }, select: { userId: true } });
      if (!membre?.userId) {
        return NextResponse.json({ error: "Ce membre n'a pas encore accepté son invitation" }, { status: 400 });
      }
    }

    const membre = await prisma.membreEquipe.updateMany({ where: { id, tenantId }, data });
    if (membre.count === 0) return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    console.error("[API/EQUIPE/ID]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
