import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, unstable_update } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Compte de l'utilisateur connecté (page « Mon profil ») : lecture, et
// modification du nom et de la photo. L'email n'est pas modifiable ici — il
// sert d'identifiant de connexion.
const schema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(80).optional(),
  image: z.string().max(2_000_000).nullable().optional(), // URL ou petite image importée
});

export async function GET() {
  const session = await auth();
  const id = (session?.user as any)?.id;
  if (!id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id },
    select: { name: true, email: true, image: true, role: true, createdAt: true, password: true },
  });
  if (!user) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
  const { password, ...compte } = user;
  return NextResponse.json({ ...compte, aMotDePasse: !!password });
}

export async function PATCH(req: Request) {
  const session = await auth();
  const id = (session?.user as any)?.id;
  if (!id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  const user = await prisma.user.update({ where: { id }, data: parsed.data, select: { name: true, image: true } });
  // Session (cookie) mise à jour : le nom et la photo du header changent sans reconnexion.
  if (parsed.data.name) await unstable_update({ name: user.name } as any);
  return NextResponse.json(user);
}
