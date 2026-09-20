import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import { z } from "zod";
import { creerCodeVerification } from "@/lib/two-factor";
import { envoyerCodeVerification, hasResend } from "@/lib/email";

const schema = z.object({ email: z.string().email(), password: z.string().min(6) });

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Email ou mot de passe invalide" }, { status: 400 });

  // Resend non configuré : la 2FA est désactivée globalement, on laisse le
  // flux de connexion classique (mot de passe seul) prendre le relais.
  if (!hasResend()) return NextResponse.json({ success: true, skip2fa: true });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !user.password) return NextResponse.json({ error: "Email ou mot de passe incorrect" }, { status: 401 });

  const ok = await compare(parsed.data.password, user.password);
  if (!ok) return NextResponse.json({ error: "Email ou mot de passe incorrect" }, { status: 401 });

  const code = await creerCodeVerification(user.email!);
  await envoyerCodeVerification(user.email!, code, user.name ?? undefined).catch((err) => {
    console.error("[2fa/demander] envoi email échoué:", err);
  });

  return NextResponse.json({ success: true, skip2fa: false });
}
