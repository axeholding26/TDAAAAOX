// API Pixel Tracking — Capture les événements marketing (Meta Pixel compatible)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schemaEvent = z.object({
  tenantSlug: z.string(),
  type: z.enum(["PageView", "AddToCart", "Purchase", "Lead", "ViewContent", "InitiateCheckout"]),
  valeur: z.number().optional(),
  devise: z.string().optional(),
  produitId: z.string().optional(),
  commandeId: z.string().optional(),
  source: z.string().optional(),
  campagneId: z.string().optional(),
  sessionId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schemaEvent.parse(body);

    // Résoudre le tenantId depuis le slug
    const tenant = await prisma.tenant.findUnique({
      where: { slug: data.tenantSlug },
      select: { id: true },
    });
    if (!tenant) return NextResponse.json({ ok: true }); // Silently ignore

    await prisma.pixelEvent.create({
      data: {
        tenantId: tenant.id,
        type: data.type,
        valeur: data.valeur,
        devise: data.devise,
        produitId: data.produitId,
        commandeId: data.commandeId,
        source: data.source || req.headers.get("referer") || "direct",
        campagneId: data.campagneId,
        sessionId: data.sessionId,
        userAgent: req.headers.get("user-agent") || undefined,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // Always return 200 to not break storefront
  }
}

// GET — Stats attribution par source
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenantId");
    const jours = parseInt(searchParams.get("jours") || "30");
    if (!tenantId) return NextResponse.json({ message: "tenantId requis" }, { status: 400 });

    const depuis = new Date(Date.now() - jours * 86400000);

    const [events, parSource, purchases] = await Promise.all([
      prisma.pixelEvent.count({ where: { tenantId, createdAt: { gte: depuis } } }),
      prisma.pixelEvent.groupBy({
        by: ["source"],
        where: { tenantId, createdAt: { gte: depuis } },
        _count: true,
      }),
      prisma.pixelEvent.findMany({
        where: { tenantId, type: "Purchase", createdAt: { gte: depuis } },
        select: { valeur: true, source: true, devise: true },
      }),
    ]);

    const revenusParSource: Record<string, number> = {};
    purchases.forEach(p => {
      const src = p.source || "direct";
      revenusParSource[src] = (revenusParSource[src] || 0) + (p.valeur || 0);
    });

    return NextResponse.json({
      totalEvents: events,
      parSource: parSource.map(s => ({ source: s.source || "direct", count: s._count })),
      revenusParSource,
    });
  } catch {
    return NextResponse.json({ message: "Erreur" }, { status: 500 });
  }
}
