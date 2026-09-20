// Webhook WhatsApp Business Cloud API v22.0
// Conforme aux exigences Meta: vérification de signature, statuts, fenêtre 24h
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHmac } from "crypto";
import { quotaCommandesAtteint } from "@/lib/abonnement";

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? "axso_meta_2026";
const APP_SECRET   = process.env.META_APP_SECRET ?? "";

// ── GET : vérification du webhook Meta ──────────────────────────────────────
export async function GET(req: NextRequest) {
  const p = new URL(req.url).searchParams;
  if (
    p.get("hub.mode") === "subscribe" &&
    p.get("hub.verify_token") === VERIFY_TOKEN
  ) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Token invalide" }, { status: 403 });
}

// ── POST : traitement des événements ────────────────────────────────────────
export async function POST(req: NextRequest) {
  // 1. Vérification de signature HMAC-SHA256 (exigée par Meta)
  const rawBody = await req.text();
  if (APP_SECRET) {
    const sigHeader = req.headers.get("x-hub-signature-256") ?? "";
    const expected = "sha256=" + createHmac("sha256", APP_SECRET).update(rawBody).digest("hex");
    if (sigHeader !== expected) {
      console.warn("[webhook/whatsapp] Signature invalide — requête rejetée");
      return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
    }
  }

  let body: any;
  try { body = JSON.parse(rawBody); }
  catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  if (body.object !== "whatsapp_business_account") {
    return NextResponse.json({ received: true });
  }

  // Toujours retourner 200 rapidement à Meta (< 20s SLA)
  const processPromise = traiterEvenements(body);
  processPromise.catch(err => console.error("[webhook/whatsapp] Erreur traitement:", err));

  return NextResponse.json({ received: true });
}

// ── Traitement asynchrone ────────────────────────────────────────────────────
async function traiterEvenements(body: any) {
  for (const entry of (body.entry ?? [])) {
    for (const change of (entry.changes ?? [])) {
      if (change.field !== "messages") continue;
      const val = change.value;

      const phoneId = val?.metadata?.phone_number_id;
      const config = phoneId
        ? await prisma.connecteurConfig.findFirst({
            where: { type: "whatsapp", config: { path: ["phone_number_id"], equals: phoneId } },
            select: { tenantId: true, accessToken: true },
          })
        : null;
      const tenantId = config?.tenantId;
      // Quota Palier 0 atteint : WhatsApp est verrouillé, on n'enregistre ni ne
      // traite plus les messages entrants pour ce tenant tant qu'il n'upgrade pas.
      const locked = tenantId ? await quotaCommandesAtteint(tenantId) : false;

      // ── Messages entrants ──────────────────────────────────────────────────
      for (const msg of (val.messages ?? [])) {
        const de = msg.from;
        const corps = extraireCorps(msg);
        if (!corps) continue;

        const nom = val.contacts?.find((c: any) => c.wa_id === de)?.profile?.name ?? undefined;

        if (tenantId && !locked) {
          const existant = msg.id
            ? await prisma.messageRecu.findFirst({ where: { waMessageId: msg.id } })
            : null;

          if (!existant) {
            const telephone = de.replace(/\D/g, "").slice(-8);
            const commandeLiee = await prisma.commande.findFirst({
              where: { tenantId, clientTelephone: { contains: telephone } },
              orderBy: { createdAt: "desc" },
              select: { id: true, numero: true, statut: true, trackingToken: true },
            }).catch(() => null);

            await prisma.messageRecu.create({
              data: {
                tenantId, source: "whatsapp", de, nom, corps,
                waMessageId: msg.id ?? null,
                commandeId: commandeLiee?.id ?? null,
                payload: msg,
              },
            }).catch(() => {});

            await detecterEtConfirmerCommande(tenantId, de, corps, commandeLiee, phoneId).catch(() => {});
            autoRepondre(tenantId, de, corps, phoneId).catch(() => {});
          }
        }

        // Marquer comme lu côté Meta
        marquerLu(phoneId, msg.id, config?.accessToken ?? null).catch(() => {});
      }

      // ── Statuts de livraison (sent/delivered/read/failed) ─────────────────
      for (const status of (val.statuses ?? [])) {
        if (!tenantId || !status.id) continue;

        // Mettre à jour le statut dans la DB
        const statutMap: Record<string, boolean> = { read: true, delivered: false };
        if (status.status === "read" || status.status === "delivered") {
          await prisma.messageRecu.updateMany({
            where: { waMessageId: status.id, tenantId },
            data: { lu: status.status === "read" },
          }).catch(() => {});
        }

        if (status.status === "failed") {
          const erreurs = status.errors?.map((e: any) => e.message).join(", ") ?? "inconnu";
          console.warn(`[webhook/whatsapp] Message ${status.id} FAILED — tenant ${tenantId}: ${erreurs}`);
          // Marquer le message comme échoué
          await prisma.messageRecu.updateMany({
            where: { waMessageId: status.id, tenantId },
            data: { payload: { error: erreurs, status: "failed" } as any },
          }).catch(() => {});
        }
      }
    }
  }
}

// ── Auto-confirmation par mots-clés ─────────────────────────────────────────
const MOTS_CONFIRMATION = [
  "oui", "confirmer", "confirme", "ok", "1", "yes",
  "valider", "valide", "d'accord", "accord", "c'est bon", "cest bon"
];

async function detecterEtConfirmerCommande(
  tenantId: string,
  de: string,
  message: string,
  commande: { id: string; numero: string; statut: string; trackingToken: string | null } | null,
  phoneId: string
) {
  if (!commande || commande.statut !== "en_attente") return;
  const texte = message.toLowerCase().trim();
  const estConfirmation = MOTS_CONFIRMATION.some(
    m => texte === m || texte.startsWith(m + " ") || texte.endsWith(" " + m)
  );
  if (!estConfirmation) return;

  await prisma.commande.update({ where: { id: commande.id }, data: { statut: "confirmee" } });

  const { notifierClientWhatsApp } = await import("@/lib/whatsapp");
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }, select: { nomBoutique: true, slug: true }
  });
  if (tenant) {
    const numero = toE164(de);
    await notifierClientWhatsApp({
      telephone: numero, statut: "confirmee", numero: commande.numero,
      boutique: tenant.nomBoutique, slug: tenant.slug, trackingToken: commande.trackingToken,
      tenantId,
    });
  }
}

// ── Chatbot IA (best-effort) ─────────────────────────────────────────────────
async function autoRepondre(tenantId: string, de: string, messageRecu: string, phoneId: string) {
  const chatbotConfig = await prisma.connecteurConfig.findFirst({
    where: { tenantId, type: "chatbot_whatsapp", statut: "actif" },
  });
  if (!chatbotConfig) return;

  const cfg = chatbotConfig.config as any;
  const exclure = (cfg.motsClesExclus ?? []) as string[];
  if (exclure.some((mc: string) => messageRecu.toLowerCase().includes(mc.toLowerCase()))) return;

  if (cfg.horaires?.actif) {
    const now = new Date();
    const [hDeb, mDeb] = (cfg.horaires.debut ?? "08:00").split(":").map(Number);
    const [hFin, mFin] = (cfg.horaires.fin ?? "20:00").split(":").map(Number);
    const totalNow = now.getHours() * 60 + now.getMinutes();
    if (totalNow < hDeb * 60 + mDeb || totalNow > hFin * 60 + mFin) return;
  }

  const delai = (cfg.delaiReponse ?? 0) * 1000;
  if (delai > 0) await new Promise(r => setTimeout(r, delai));

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }, select: { nomBoutique: true }
  }).catch(() => null);

  const { executerOutilMcp } = await import("@/lib/mcp/executor");
  const systeme = `Tu es AXIA, l'assistante IA de "${tenant?.nomBoutique ?? "cette boutique"}". Style: ${cfg.personnalite ?? "professionnel"}. Langue: ${cfg.langue ?? "fr"}. Réponds naturellement en 2-3 phrases. Ne mentionne jamais que tu es un bot.`;

  const result = await executerOutilMcp("gemini_generer_texte", { instruction: systeme, contenu: messageRecu }, tenantId);
  if (!result.succes || !result.resultat) return;

  const waConfig = await prisma.connecteurConfig.findFirst({ where: { tenantId, type: "whatsapp" } });
  const token = waConfig?.accessToken ?? process.env.WHATSAPP_TOKEN;
  if (!token || !phoneId) return;

  await envoyerTexteWA(phoneId, token, toE164(de), result.resultat);
}

// ── Helpers Meta API ─────────────────────────────────────────────────────────
async function marquerLu(phoneNumberId: string, messageId: string, token: string | null) {
  const accessToken = token ?? process.env.WHATSAPP_TOKEN;
  if (!accessToken || !phoneNumberId || !messageId) return;
  await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId }),
  });
}

async function envoyerTexteWA(phoneId: string, token: string, to: string, body: string) {
  return fetch(`https://graph.facebook.com/v22.0/${phoneId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body, preview_url: true } }),
  });
}

// E.164 : s'assure que le numéro commence par + et indicatif pays
function toE164(numero: string): string {
  const digits = numero.replace(/\D/g, "");
  if (numero.startsWith("+")) return "+" + digits;
  // Si commence par 00 → remplacer par +
  if (digits.startsWith("00")) return "+" + digits.slice(2);
  // Sinon on préfixe + (Meta accepte les numéros sans + dans to:)
  return digits.length >= 10 ? "+" + digits : digits;
}

function extraireCorps(msg: any): string {
  if (msg.type === "text")      return msg.text?.body ?? "";
  if (msg.type === "image")     return `[Image] ${msg.image?.caption ?? ""}`;
  if (msg.type === "audio")     return "[Message vocal]";
  if (msg.type === "video")     return `[Vidéo] ${msg.video?.caption ?? ""}`;
  if (msg.type === "document")  return `[Document] ${msg.document?.filename ?? ""}`;
  if (msg.type === "location")  return `[Position] lat:${msg.location?.latitude} lng:${msg.location?.longitude}`;
  if (msg.type === "button")    return `[Bouton] ${msg.button?.text ?? ""}`;
  if (msg.type === "interactive") return msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? "[Interaction]";
  if (msg.type === "sticker")   return "[Sticker]";
  if (msg.type === "contacts")  return "[Contact partagé]";
  if (msg.type === "reaction")  return `[Réaction] ${msg.reaction?.emoji ?? ""}`;
  return "";
}
