import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { getAdminSession, getAdminSessionPour, estAdminComplet } from "@/lib/admin-auth";
import { ROLES_ADMIN } from "@/lib/command-center/rbac";
import { journaliser } from "@/lib/command-center/serveur";
import { roleInvitable } from "@/lib/admin-actions";

export async function GET() {
  const session = await getAdminSessionPour("equipe");
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const membres = await prisma.user.findMany({
    where: { role: { in: [...ROLES_ADMIN] } },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ membres });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!estAdminComplet(session)) return NextResponse.json({ error: "Réservé au super-admin" }, { status: 403 });

  const { email, password, name, role = "admin_lecteur" } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ error: "Email valide et mot de passe (6 caractères min.) requis" }, { status: 400 });
  }
  if (!roleInvitable(role)) return NextResponse.json({ error: "Rôle invalide" }, { status: 400 });

  const existant = await prisma.user.findUnique({ where: { email } });
  // Seul un membre d'équipe (hors Super admin) peut être réinvité ; un Super admin ne se rétrograde
  // (ni ne se fait changer son mot de passe) jamais par ici, un compte marchand n'est jamais converti.
  if (existant && !roleInvitable(existant.role)) {
    return NextResponse.json({ error: "Cet email est déjà utilisé par un autre compte" }, { status: 400 });
  }

  const hashed = await hash(password, 10);

  const membre = existant
    ? await prisma.user.update({ where: { email }, data: { password: hashed, role, name: name || existant.name } })
    : await prisma.user.create({ data: { email, name: name || email, password: hashed, role, tenantId: null } });

  await journaliser(session, existant ? "equipe.reinviter" : "equipe.inviter", "User", membre.id, existant ? { role: existant.role } : undefined, { email: membre.email, role: membre.role });
  return NextResponse.json({ success: true, membre: { id: membre.id, email: membre.email, role: membre.role } });
}
