// API Pixel Tracking — Capture les événements marketing (Meta Pixel compatible)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { apiLimiter, getClientIp } from "@/lib/rate-limit";

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
    // Route publique : limite par IP pour qu'on ne puisse pas gonfler les stats d'une boutique.
    if (!apiLimiter.check(getClientIp(req)).success) return NextResponse.json({ ok: true });
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

    // Les stats du tableau de bord (visites, conversion) lisent Analytics "page_view".
    if (data.type === "PageView") {
      await prisma.analytics.create({ data: { tenantId: tenant.id, type: "page_view" } });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // Always return 200 to not break storefront
  }
}
