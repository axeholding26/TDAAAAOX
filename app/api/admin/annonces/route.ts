// Command Center › Annonces : créer une annonce de la bannière « Ma boutique ».
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionPour } from "@/lib/admin-auth";
import { peutAgir } from "@/lib/command-center/rbac";
import { journaliser } from "@/lib/command-center/serveur";
import { schemaAnnonce } from "@/lib/annonces";

export async function POST(req: NextRequest) {
  const session = await getAdminSessionPour("annonces");
  if (!session || !peutAgir(session.role)) return NextResponse.json({ erreur: "Votre rôle ne permet pas de gérer les annonces" }, { status: 403 });
  const p = schemaAnnonce.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ erreur: p.error.issues[0]?.message ?? "Annonce invalide" }, { status: 400 });
  const annonce = await prisma.annonce.create({ data: p.data });
  await journaliser(session, "annonce.creee", "Annonce", annonce.id, null, p.data);
  return NextResponse.json({ message: "Annonce ajoutée", id: annonce.id });
}
