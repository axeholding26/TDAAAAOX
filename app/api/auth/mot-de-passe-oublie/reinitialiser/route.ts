import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";
import { verifierCode } from "@/lib/two-factor";

const schema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  nouveauMotDePasse: z.string().min(6),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Données invalides (mot de passe : 6 caractères min.)" }, { status: 400 });

  const codeOk = await verifierCode(parsed.data.email, parsed.data.code);
  if (!codeOk) return NextResponse.json({ error: "Code invalide ou expiré" }, { status: 400 });

  const hashed = await hash(parsed.data.nouveauMotDePasse, 10);
  try {
    await prisma.user.update({ where: { email: parsed.data.email }, data: { password: hashed } });
  } catch {
    return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
