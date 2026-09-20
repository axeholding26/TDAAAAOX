// Tracker de clics + fenêtre d'attribution cookieJours
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!code) return NextResponse.json({ ok: false });

    const lien = await (prisma as any).affiliationLien.findFirst({
      where: { code, actif: true },
    });
    if (!lien) return NextResponse.json({ ok: false });

    const cookieJours = lien.cookieJours ?? 30;
    const now = new Date();

    await (prisma as any).affiliationLien.update({
      where: { id: lien.id },
      data: { clics: { increment: 1 }, derniereConversion: now },
    });

    // Retourner la fenêtre pour que le front puisse poser un cookie de durée appropriée
    return NextResponse.json({ ok: true, cookieJours, lienId: lien.id });
  } catch {
    return NextResponse.json({ ok: false });
  }
}

// Attribution : vérifie si un acheteur est dans la fenêtre d'attribution
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const clickedAt = searchParams.get("clickedAt"); // ISO date du clic stocké en cookie

    if (!code || !clickedAt) return NextResponse.json({ attribuable: false });

    const lien = await (prisma as any).affiliationLien.findFirst({
      where: { code, actif: true },
    });
    if (!lien) return NextResponse.json({ attribuable: false });

    const cookieJours = lien.cookieJours ?? 30;
    const clickDate = new Date(clickedAt);
    const diffMs = Date.now() - clickDate.getTime();
    const diffJours = diffMs / (1000 * 60 * 60 * 24);

    const attribuable = diffJours <= cookieJours;
    return NextResponse.json({ attribuable, cookieJours, lienId: lien.id, affilieId: lien.affilieId });
  } catch {
    return NextResponse.json({ attribuable: false });
  }
}
