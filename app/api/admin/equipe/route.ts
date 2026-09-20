import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { getAdminSession, estAdminComplet } from "@/lib/admin-auth";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const membres = await prisma.user.findMany({
    where: { role: { in: ["admin", "admin_lecteur"] } },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ membres });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!estAdminComplet(session)) return NextResponse.json({ error: "Réservé au super-admin" }, { status: 403 });

  const { email, password, name } = await req.json();
  if (!email?.trim() || !password || password.length < 6) {
    return NextResponse.json({ error: "Email valide et mot de passe (6 caractères min.) requis" }, { status: 400 });
  }

  const existant = await prisma.user.findUnique({ where: { email } });
  if (existant && existant.role !== "admin_lecteur" && existant.role !== "admin") {
    return NextResponse.json({ error: "Cet email est déjà utilisé par un autre compte" }, { status: 400 });
  }

  const hashed = await hash(password, 10);

  const membre = existant
    ? await prisma.user.update({ where: { email }, data: { password: hashed, role: "admin_lecteur", name: name || existant.name } })
    : await prisma.user.create({ data: { email, name: name || email, password: hashed, role: "admin_lecteur", tenantId: null } });

  return NextResponse.json({ success: true, membre: { id: membre.id, email: membre.email, role: membre.role } });
}
