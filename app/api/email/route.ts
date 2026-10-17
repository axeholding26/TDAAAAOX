// API — Email marketing via Resend + Gmail, avec historique CampagneEmail
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { lireConnexion } from "@/lib/connect";
import { AVEC_EMAIL_REEL, envoyerCampagneEmail } from "@/lib/email";
import { integrationActive } from "@/lib/integrations";
import { envoyerGmail, rafraichirTokenGoogle } from "@/lib/mcp/connectors/gmail";
import { lienDesinscription } from "@/lib/relances";

export const maxDuration = 60;

const JOUR = 86_400_000;
// ponytail: plafond par campagne (Vercel coupe à 60 s) ; au-delà, envoi en tâche de fond par lots.
const MAX_RESEND = 2000, MAX_GMAIL = 200; // Gmail : un message à la fois, et quota d'environ 500/jour

/** Clients d'un segment, avec un vrai e-mail et pas désinscrits. Mêmes règles pour le compteur et l'envoi.
 *  VIP : au moins deux fois la dépense moyenne de la boutique (un seuil fixe ne valait rien hors XAF/XOF). */
async function filtreSegment(tenantId: string, segment?: string) {
  const where: Record<string, any> = { tenantId, ...AVEC_EMAIL_REEL, relancesRefuseesLe: null };
  if (segment === "vip") {
    const { _avg } = await prisma.client.aggregate({ where: { tenantId, totalDepense: { gt: 0 } }, _avg: { totalDepense: true } });
    where.totalDepense = { gte: Math.max(1, (_avg.totalDepense ?? 0) * 2) };
  }
  if (segment === "nouveaux") where.totalCommandes = { lte: 1 };
  // Inactifs : client depuis plus de 30 jours, aucune commande ces 30 derniers jours.
  if (segment === "inactifs") Object.assign(where, { createdAt: { lte: new Date(Date.now() - 30 * JOUR) }, commandes: { none: { createdAt: { gte: new Date(Date.now() - 30 * JOUR) } } } });
  return where;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });

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
    const [nbClients, nbVip, nbNouveaux, nbInactifs] = await Promise.all(
      ["tous", "vip", "nouveaux", "inactifs"].map(async (seg) => prisma.client.count({ where: await filtreSegment(tenantId, seg) })),
    );

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

  if (!tenantId) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { nomBoutique: true, email: true } });
  if (!tenant) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });

  const { sujet, corps, segment, provider = "resend" } = await req.json().catch(() => ({}));
  if (typeof sujet !== "string" || typeof corps !== "string" || !sujet.trim() || !corps.trim()) {
    return NextResponse.json({ error: "Sujet et corps requis" }, { status: 400 });
  }

  const clients = await prisma.client.findMany({
    where: await filtreSegment(tenantId, segment),
    select: { id: true, email: true, nom: true },
    orderBy: { createdAt: "desc" },
    take: MAX_RESEND,
  });
  const message = async (c: (typeof clients)[number]) => {
    const desinscription = await lienDesinscription(c.id);
    return { a: c.email!, desinscription, html: construireHtml(corps, c.nom, tenant.nomBoutique, desinscription) };
  };

  let envoyes = 0;
  let source = "aucun";
  let cible = clients.length;

  // ── Envoi via Gmail OAuth ─────────────────────────────────────────────────
  if (provider === "gmail" && integrationActive("gmail")) {
    const gmailCfg = await lireConnexion(tenantId, "gmail");
    const cfg = gmailCfg?.config as any;
    // Jeton d'accès Google valable une heure : rafraîchi à chaque campagne quand c'est possible.
    const accessToken = (cfg?.refresh_token ? await rafraichirTokenGoogle(cfg.refresh_token).catch(() => null) : null) ?? cfg?.access_token ?? null;

    if (accessToken) {
      source = "gmail";
      cible = Math.min(clients.length, MAX_GMAIL);
      for (const client of clients.slice(0, MAX_GMAIL)) {
        const m = await message(client);
        // Compté seulement si Gmail accepte l'envoi (avant : compté même en cas d'échec).
        const r = await envoyerGmail({ accessToken, a: m.a, sujet, corpsHtml: m.html }).catch(() => ({ succes: false }));
        if (r.succes) envoyes++;
        await pause(150);
      }
    }
  }

  // ── Envoi via Resend (par lots de 100 : avant, 50 au plus et le reste jamais envoyé) ──
  if ((provider === "resend" || envoyes === 0) && process.env.RESEND_API_KEY) {
    source = "resend";
    cible = clients.length;
    envoyes = await envoyerCampagneEmail({ boutique: tenant.nomBoutique, repondreA: tenant.email, sujet, messages: await Promise.all(clients.map(message)) });
  }

  // ── Historique DB ─────────────────────────────────────────────────────────
  await prisma.campagneEmail.create({
    data: { tenantId, sujet, corps, segment: segment ?? "tous", nbEnvoyes: envoyes, statut: envoyes > 0 ? "envoye" : "echec", source },
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    envoyes,
    total: cible,
    source,
    ...(envoyes === 0 && { error: "Aucun e-mail n'a pu être envoyé." }),
  });
}

const echapper = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function construireHtml(corps: string, nom: string | null, boutique: string, desinscription: string) {
  // « Abonné newsletter » : inscrit sans nom (app/api/storefront/[slug]/newsletter).
  const prenom = (nom === "Abonné newsletter" ? "" : (nom ?? "").split(" ")[0]) || "Client";
  // Tout est échappé : le nom vient du formulaire de la boutique, le texte du marchand est du texte simple.
  boutique = echapper(boutique);
  const text = echapper(corps)
    .replace(/\{prenom\}/g, echapper(prenom))
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
    <a href="${echapper(desinscription)}" style="color:#9ca3af">Se désinscrire</a> · Propulsé par <a href="https://axsoafrica.com" style="color:#F5A623;text-decoration:none">Axso</a>
  </div>
</div>
</body></html>`;
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
