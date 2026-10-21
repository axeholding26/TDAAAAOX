// Command Center › Annonces : modifier (contenu, ordre, activer/désactiver) ou supprimer une annonce.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionPour } from "@/lib/admin-auth";
import { peutAgir } from "@/lib/command-center/rbac";
import { journaliser } from "@/lib/command-center/serveur";
import { schemaAnnonce } from "@/lib/annonces";

const refus = () => NextResponse.json({ erreur: "Votre rôle ne permet pas de gérer les annonces" }, { status: 403 });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSessionPour("annonces");
  if (!session || !peutAgir(session.role)) return refus();
  const { id } = await params;
  const p = schemaAnnonce.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ erreur: p.error.issues[0]?.message ?? "Annonce invalide" }, { status: 400 });
  const avant = await prisma.annonce.findUnique({ where: { id } });
  if (!avant) return NextResponse.json({ erreur: "Annonce introuvable" }, { status: 404 });
  await prisma.annonce.update({ where: { id }, data: p.data });
  await journaliser(session, "annonce.modifiee", "Annonce", id, avant, p.data);
  return NextResponse.json({ message: "Annonce enregistrée" });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSessionPour("annonces");
  if (!session || !peutAgir(session.role)) return refus();
  const { id } = await params;
  const avant = await prisma.annonce.findUnique({ where: { id } });
  if (!avant) return NextResponse.json({ erreur: "Annonce introuvable" }, { status: 404 });
  await prisma.annonce.delete({ where: { id } });
  await journaliser(session, "annonce.supprimee", "Annonce", id, avant, null);
  return NextResponse.json({ message: "Annonce supprimée" });
}
