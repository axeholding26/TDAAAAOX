// Webhook Meta — reçoit les événements Facebook/Instagram/Ads en temps réel
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? "axso_meta_2026";

// ── GET : vérification Meta ──────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const p = new URL(req.url).searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === VERIFY_TOKEN) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Token invalide" }, { status: 403 });
}

// ── POST : traitement des événements ────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.object !== "page" && body.object !== "instagram" && body.object !== "ads_management") {
      return NextResponse.json({ received: true });
    }

    for (const entry of (body.entry ?? [])) {
      for (const change of (entry.changes ?? [])) {
        await traiterChangement(entry.id, change.field, change.value).catch(() => {});
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[webhook/meta]", err);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

async function traiterChangement(entryId: string, field: string, value: any) {
  // ── Trouver le tenant via la pageId ────────────────────────────────────────
  const config = await prisma.connecteurConfig.findFirst({
    where: { pageId: entryId, type: "meta" },
    select: { tenantId: true },
  });
  const tenantId = config?.tenantId;

  // ── Mise à jour statut campagne Ads ────────────────────────────────────────
  if (field === "ads" && value?.campaign_id) {
    const metaStatut = (value.status ?? "").toUpperCase();
    const statut = metaStatut === "ACTIVE" ? "active" : metaStatut === "PAUSED" ? "en_pause" : "terminee";
    await prisma.campagne.updateMany({
      where: { externalId: value.campaign_id },
      data: {
        statut,
        ...(value.spend !== undefined && { depense: parseFloat(value.spend) }),
        ...(value.impressions !== undefined && { impressions: parseInt(value.impressions) }),
        ...(value.clicks !== undefined && { clics: parseInt(value.clicks) }),
      },
    });
  }

  // ── Lead form soumis → créer un client ─────────────────────────────────────
  if (field === "leadgen" && tenantId && value?.leadgen_id) {
    const existing = await prisma.client.findFirst({
      where: { tenantId, email: `lead_${value.leadgen_id}@meta.lead` },
    });
    if (!existing) {
      await prisma.client.create({
        data: {
          tenantId,
          nom: value.full_name ?? "Lead Meta",
          email: `lead_${value.leadgen_id}@meta.lead`,
          telephone: value.phone_number ?? "",
        },
      }).catch(() => {});
    }
  }

  // ── Message Instagram DM entrant ───────────────────────────────────────────
  if (field === "messages" && tenantId) {
    const msg = value?.messages?.[0];
    if (msg?.message) {
      await prisma.messageRecu.create({
        data: {
          tenantId,
          source: "instagram_dm",
          de: value.sender?.id ?? "unknown",
          nom: value.sender?.name,
          corps: msg.message,
          payload: value,
        },
      }).catch(() => {});
    }
  }

  // ── Événement page (commentaire, like) → log pixel ─────────────────────────
  if ((field === "feed" || field === "mention") && tenantId) {
    await prisma.pixelEvent.create({
      data: {
        tenantId,
        type: "SocialEngagement",
        source: "meta",
        sessionId: String(value?.post_id ?? value?.comment_id ?? Date.now()),
      },
    }).catch(() => {});
  }
}
