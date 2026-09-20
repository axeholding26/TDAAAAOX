// API — Email marketing via Resend + Gmail, avec historique CampagneEmail
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  if (action === "historique") {
    const campagnes = await prisma.campagneEmail.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json(campagnes);
  }

  if (action === "stats") {
    const [nbClients, nbVip, nbNouveaux, nbInactifs] = await Promise.all([
      prisma.client.count({ where: { tenantId } }),
      prisma.client.count({ where: { tenantId, totalDepense: { gte: 50000 } } }),
      prisma.client.count({ where: { tenantId, totalCommandes: { lte: 1 } } }),
      prisma.client.count({ where: { tenantId, createdAt: { lte: new Date(Date.now() - 30 * 86400000) }, totalCommandes: { lte: 0 } } }),
    ]);

    // Check connected providers
    const [gmail, resend] = await Promise.all([
      prisma.connecteurConfig.findUnique({ where: { tenantId_type: { tenantId, type: "gmail" } }, select: { statut: true } }),
      Promise.resolve(!!process.env.RESEND_API_KEY),
    ]);

    return NextResponse.json({
      segments: { tous: nbClients, vip: nbVip, nouveaux: nbNouveaux, inactifs: nbInactifs },
      providers: { gmail: gmail?.statut === "actif", resend },
    });
  }

  return NextResponse.json({ error: "action invalide" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });

  const { sujet, corps, segment, provider = "resend" } = await req.json();
  if (!sujet?.trim() || !corps?.trim()) {
    return NextResponse.json({ error: "Sujet et corps requis" }, { status: 400 });
  }

  // Construire le filtre segment
  const whereClients: any = { tenantId, email: { not: "" } };
  if (segment === "vip") whereClients.totalDepense = { gte: 50000 };
  if (segment === "inactifs") {
    whereClients.createdAt = { lte: new Date(Date.now() - 30 * 86400000) };
    whereClients.totalCommandes = { lte: 0 };
  }
  if (segment === "nouveaux") whereClients.totalCommandes = { lte: 1 };

  const clients = await prisma.client.findMany({
    where: whereClients,
    select: { email: true, nom: true },
    take: 100,
  });

  let envoyes = 0;
  let source = "simulation";

  // ── Envoi via Gmail OAuth ─────────────────────────────────────────────────
  if (provider === "gmail") {
    const gmailCfg = await prisma.connecteurConfig.findUnique({
      where: { tenantId_type: { tenantId, type: "gmail" } },
    });
    const cfg = gmailCfg?.config as any;
    const accessToken = cfg?.access_token ?? cfg?.refresh_token ? await rafraichirGmail(cfg.refresh_token) : null;

    if (accessToken) {
      source = "gmail";
      for (const client of clients) {
        if (!client.email) continue;
        const html = construireHtml(corps, client.nom, tenant.nomBoutique);
        await envoyerGmailOAuth(accessToken, client.email, sujet, html).catch(() => {});
        envoyes++;
        await pause(150);
      }
    }
  }

  // ── Envoi via Resend ──────────────────────────────────────────────────────
  if (provider === "resend" || envoyes === 0) {
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      source = "resend";
      for (const client of clients.slice(0, 50)) {
        if (!client.email) continue;
        const html = construireHtml(corps, client.nom, tenant.nomBoutique);
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: `${tenant.nomBoutique} <noreply@axso.com>`,
              to: [client.email!],
              subject: sujet,
              html,
            }),
          });
          if (res.ok) envoyes++;
        } catch {}
      }
    }
  }

  // ── Historique DB ─────────────────────────────────────────────────────────
  await prisma.campagneEmail.create({
    data: { tenantId, sujet, corps, segment: segment ?? "tous", nbEnvoyes: envoyes, statut: envoyes > 0 ? "envoye" : "echec", source },
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    envoyes,
    total: clients.length,
    source,
    mode: envoyes === 0 ? "simulation" : undefined,
  });
}

function construireHtml(corps: string, nom: string | null, boutique: string) {
  const prenom = (nom ?? "").split(" ")[0] || "Client";
  const text = corps
    .replace(/\{prenom\}/g, prenom)
    .replace(/\{boutique\}/g, boutique)
    .replace(/\n/g, "<br>");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07)">
  <div style="background:linear-gradient(135deg,#F5A623,#e8950f);padding:32px 40px">
    <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700">${boutique}</h1>
  </div>
  <div style="padding:32px 40px;color:#374151;font-size:15px;line-height:1.7">${text}</div>
  <div style="padding:20px 40px 32px;border-top:1px solid #f3f4f6;color:#9ca3af;font-size:12px">
    Vous recevez cet email car vous êtes client de <strong>${boutique}</strong>.<br>
    Propulsé par <a href="https://axso.africa" style="color:#F5A623;text-decoration:none">Axso</a>
  </div>
</div>
</body></html>`;
}

async function envoyerGmailOAuth(accessToken: string, to: string, subject: string, html: string) {
  const message = [`To: ${to}`, `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`, "MIME-Version: 1.0", 'Content-Type: text/html; charset="UTF-8"', "", html].join("\r\n");
  const encoded = Buffer.from(message).toString("base64url");
  await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: encoded }),
  });
}

async function rafraichirGmail(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const data = await res.json();
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
