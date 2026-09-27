import { NextResponse } from "next/server";
import { z } from "zod";
import { compare, hash } from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Changement de mot de passe depuis « Mon profil » : le mot de passe actuel
// est toujours exigé (une session laissée ouverte ne suffit pas).
const schema = z.object({
  actuel: z.string().min(1, "Mot de passe actuel requis"),
  nouveau: z.string().min(8, "8 caractères minimum").max(128),
});

export async function POST(req: Request) {
  const session = await auth();
  const id = (session?.user as any)?.id;
  if (!id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { id }, select: { password: true } });
  if (!user?.password || !(await compare(parsed.data.actuel, user.password))) {
    return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 400 });
  }
  if (parsed.data.actuel === parsed.data.nouveau) return NextResponse.json({ error: "Le nouveau mot de passe doit être différent" }, { status: 400 });
  await prisma.user.update({ where: { id }, data: { password: await hash(parsed.data.nouveau, 10) } });
  return NextResponse.json({ ok: true });
}
