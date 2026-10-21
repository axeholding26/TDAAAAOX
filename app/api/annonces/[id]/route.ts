// Compteur d'une annonce : { type: "affichage" | "clic" }. Appelé sans attendre par la bannière.
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const limite = rateLimit({ windowMs: 60_000, max: 30, keyPrefix: "annonce-stat" });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const l = limite.check(userId);
  if (!l.success) return rateLimitResponse(l.reset);
  const { id } = await params;
  const { type } = (await req.json().catch(() => ({}))) as { type?: string };
  if (type !== "affichage" && type !== "clic") return NextResponse.json({ error: "Type invalide" }, { status: 400 });
  // updateMany : pas d'erreur si l'annonce a été supprimée entre-temps.
  await prisma.annonce.updateMany({ where: { id }, data: type === "clic" ? { clics: { increment: 1 } } : { affichages: { increment: 1 } } });
  return new NextResponse(null, { status: 204 });
}
