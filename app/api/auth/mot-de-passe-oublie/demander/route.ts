import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { creerCodeVerification } from "@/lib/two-factor";
import { envoyerCodeReinitialisation, hasResend } from "@/lib/email";

const schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Email invalide" }, { status: 400 });

  if (!hasResend()) {
    return NextResponse.json({ error: "L'envoi d'email n'est pas encore configuré — contacte le support" }, { status: 503 });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // Toujours répondre succès, même si le compte n'existe pas, pour ne pas
  // révéler quels emails sont enregistrés (énumération de comptes).
  if (user) {
    const code = await creerCodeVerification(user.email!);
    await envoyerCodeReinitialisation(user.email!, code, user.name ?? undefined).catch(() => {});
  }

  return NextResponse.json({ success: true });
}
