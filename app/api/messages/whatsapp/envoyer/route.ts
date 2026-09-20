// WhatsApp Business Cloud API v22.0 — envoi messages texte, template, interactif
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const WA_API = "https://graph.facebook.com/v22.0";

function toE164(numero: string): string {
  const digits = numero.replace(/\D/g, "");
  if (numero.startsWith("+")) return "+" + digits;
  if (digits.startsWith("00")) return "+" + digits.slice(2);
  return digits.length >= 10 ? "+" + digits : digits;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const body = await req.json();
  const { contact, message, type = "text", buttons, header, footer } = body;

  if (!contact || (!message?.trim())) {
    return NextResponse.json({ error: "contact et message requis" }, { status: 400 });
  }

  // Config WhatsApp du tenant
  const waConfig = await prisma.connecteurConfig.findFirst({
    where: { tenantId, type: "whatsapp" },
  });
  const token  = waConfig?.accessToken ?? process.env.WHATSAPP_TOKEN;
  const phoneId = (waConfig?.config as any)?.phone_number_id ?? process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    return NextResponse.json({ error: "WhatsApp Business non configuré — connectez votre compte dans les paramètres" }, { status: 503 });
  }

  const to = toE164(contact);

  // ── Construction du payload Meta ──────────────────────────────────────────
  let payload: any = { messaging_product: "whatsapp", recipient_type: "individual", to };

  if (type === "interactive" && buttons?.length) {
    // Message interactif avec boutons (max 3)
    payload.type = "interactive";
    payload.interactive = {
      type: "button",
      ...(header ? { header: { type: "text", text: header } } : {}),
      body: { text: message },
      ...(footer ? { footer: { text: footer } } : {}),
      action: {
        buttons: buttons.slice(0, 3).map((b: string, i: number) => ({
          type: "reply",
          reply: { id: `btn_${i}`, title: b.slice(0, 20) },
        })),
      },
    };
  } else if (type === "list" && buttons?.length) {
    // Message liste (max 10 items)
    payload.type = "interactive";
    payload.interactive = {
      type: "list",
      body: { text: message },
      ...(footer ? { footer: { text: footer } } : {}),
      action: {
        button: header ?? "Choisir",
        sections: [{
          title: header ?? "Options",
          rows: buttons.slice(0, 10).map((b: string, i: number) => ({
            id: `row_${i}`, title: b.slice(0, 24),
          })),
        }],
      },
    };
  } else {
    // Message texte simple
    payload.type = "text";
    payload.text = { body: message, preview_url: message.includes("http") };
  }

  // ── Envoi vers Meta ───────────────────────────────────────────────────────
  const res = await fetch(`${WA_API}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    const metaErr = data.error;
    // Codes d'erreur Meta courants
    const errMsg = metaErr?.error_user_msg
      ?? metaErr?.message
      ?? "Erreur envoi WhatsApp";

    // 131047 = message hors fenêtre 24h sans template approuvé
    if (metaErr?.code === 131047) {
      return NextResponse.json({
        error: "Ce client n'a pas envoyé de message depuis plus de 24h. Utilisez un template approuvé Meta pour le recontacter.",
        code: "OUTSIDE_WINDOW",
      }, { status: 422 });
    }

    return NextResponse.json({ error: errMsg, meta_error: metaErr }, { status: 502 });
  }

  const waMessageId = data.messages?.[0]?.id ?? null;

  // Sauvegarder en DB
  await prisma.messageRecu.create({
    data: {
      tenantId, source: "whatsapp", de: contact,
      corps: message, direction: "sortant", lu: true, repondu: true,
      waMessageId, payload: data,
    },
  }).catch(() => {});

  // Marquer les entrants de ce contact comme répondus
  await prisma.messageRecu.updateMany({
    where: { tenantId, source: "whatsapp", de: contact, direction: "entrant", repondu: false },
    data: { repondu: true },
  }).catch(() => {});

  return NextResponse.json({ success: true, waMessageId });
}
