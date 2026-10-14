// Webhook WhatsApp Business Cloud API v22.0
// Conforme aux exigences Meta: vérification de signature, statuts, fenêtre 24h
import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { lireConnexion, lireConnexionPar } from "@/lib/connect";
import { createHmac, timingSafeEqual } from "crypto";
import { quotaCommandesAtteint } from "@/lib/abonnement";
import { decrireRegle } from "@/lib/livraison";

// Sans variable configurée, aucune vérification d'abonnement ne passe (pas de jeton par défaut public).
const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN;
const APP_SECRET   = process.env.META_APP_SECRET ?? "";

// ── GET : vérification du webhook Meta ──────────────────────────────────────
export async function GET(req: NextRequest) {
  const p = new URL(req.url).searchParams;
  if (
    p.get("hub.mode") === "subscribe" &&
    !!VERIFY_TOKEN && p.get("hub.verify_token") === VERIFY_TOKEN
  ) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Token invalide" }, { status: 403 });
}

// ── POST : traitement des événements ────────────────────────────────────────
export async function POST(req: NextRequest) {
  // 1. Vérification de signature HMAC-SHA256 (exigée par Meta)
  const rawBody = await req.text();
  // Sans secret configuré on refuse tout : une signature non vérifiable n'est pas une signature valide.
  const sigHeader = req.headers.get("x-hub-signature-256") ?? "";
  const expected = "sha256=" + createHmac("sha256", APP_SECRET || "-").update(rawBody).digest("hex");
  if (!APP_SECRET || sigHeader.length !== expected.length || !timingSafeEqual(Buffer.from(sigHeader), Buffer.from(expected))) {
    console.warn("[webhook/whatsapp] Signature invalide — requête rejetée");
    return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  }

  let body: any;
  try { body = JSON.parse(rawBody); }
  catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  if (body.object !== "whatsapp_business_account") {
    return NextResponse.json({ received: true });
  }

  // Toujours retourner 200 rapidement à Meta (< 20s SLA)
  // after() : la fonction reste en vie jusqu'à la fin du traitement (sur Vercel,
  // une promesse lancée puis abandonnée est coupée dès la réponse envoyée).
  after(() => traiterEvenements(body).catch(err => console.error("[webhook/whatsapp] Erreur traitement:", err)));

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
        ? await lireConnexionPar({ type: "whatsapp", config: { path: ["phone_number_id"], equals: phoneId } })
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

            await detecterEtConfirmerCommande(tenantId, de, corps, commandeLiee).catch(() => {});
            await autoRepondre(tenantId, de, corps, phoneId).catch(() => {});
          }
        }

        // Marquer comme lu côté Meta
        await marquerLu(phoneId, msg.id, config?.accessToken ?? null).catch(() => {});
      }

      // ── Statuts de livraison (sent/delivered/read/failed) ─────────────────
      for (const status of (val.statuses ?? [])) {
        if (!tenantId || !status.id) continue;

        // Mettre à jour le statut dans la DB
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

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }, select: { nomBoutique: true, pays: true, devise: true, parametresLivraison: true },
  }).catch(() => null);
  if (!tenant) return;

  // Horaires comparés dans le fuseau du pays de la boutique (le serveur tourne en UTC).
  if (cfg.horaires?.actif) {
    const [hDeb, mDeb] = (cfg.horaires.debut ?? "08:00").split(":").map(Number);
    const [hFin, mFin] = (cfg.horaires.fin ?? "20:00").split(":").map(Number);
    const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: fuseauPays(tenant.pays), hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .format(new Date()).split(":").map(Number);
    const totalNow = h * 60 + m;
    if (totalNow < hDeb * 60 + mDeb || totalNow > hFin * 60 + mFin) return;
  }

  const delai = (cfg.delaiReponse ?? 0) * 1000;
  if (delai > 0) await new Promise(r => setTimeout(r, delai));

  // Contexte réel : le bot ne répond que sur ces données, jamais de prix ni de stock inventés.
  const [produits, regles, nbMessages] = await Promise.all([
    prisma.produit.findMany({
      where: { tenantId, actif: true }, orderBy: { ventes: "desc" }, take: 60,
      select: { nom: true, prix: true, stock: true, type: true },
    }),
    prisma.reglePort.findMany({ where: { tenantId, actif: true }, orderBy: { frais: "asc" }, take: 15 }),
    prisma.messageRecu.count({ where: { tenantId, source: "whatsapp", de } }),
  ]);
  const devise = tenant.devise ?? "";
  const catalogue = produits.map(p => `- ${p.nom} : ${p.prix} ${devise} — ${p.type === "digital" ? "disponible (produit digital)" : p.stock > 0 ? `en stock (${p.stock})` : "en rupture"}`).join("\n");
  const pl = (tenant.parametresLivraison ?? {}) as { frais?: number; minimum?: number; gratuite?: boolean };
  const livraison = regles.length
    ? regles.map(r => `- ${r.nom} (${decrireRegle(r)}) : ${r.gratuit ? "gratuit" : `${r.frais} ${devise}`}, délai ${r.delai}`).join("\n")
    : pl.gratuite ? "Livraison offerte."
    : pl.frais != null ? `Frais de livraison : ${pl.frais} ${devise}${pl.minimum ? `, offerte dès ${pl.minimum} ${devise}` : ""}.`
    : "Non renseignée.";

  const systeme = `Tu es l'assistant automatique WhatsApp de la boutique "${tenant.nomBoutique}". Style : ${cfg.personnalite ?? "professionnel"}. Langue : ${cfg.langue ?? "fr"}. Réponds naturellement en 2-3 phrases.
Si on te demande si tu es un robot, dis honnêtement que tu es l'assistant automatique de la boutique et que l'équipe peut prendre le relais.
RÈGLE ABSOLUE : ne donne un prix, une disponibilité, un délai ou des frais de livraison QUE s'ils figurent ci-dessous. Sinon, dis que tu transmets la question à l'équipe de la boutique. N'invente jamais de promotion, de code promo, de garantie ni de politique de retour.
${nbMessages <= 1 && cfg.messageAccueil ? `Premier message de ce client : commence par ce message d'accueil (adapté si besoin) : « ${cfg.messageAccueil} »\n` : ""}${cfg.instructionsSupp ? `Consignes du marchand : ${cfg.instructionsSupp}\n` : ""}
─── PRODUITS EN VENTE (${devise}) ───
${catalogue || "Aucun produit en vente pour le moment."}

─── LIVRAISON ───
${livraison}`;

  const { completionAuto } = await import("@/lib/llm-client");
  const result = await completionAuto([{ role: "system", content: systeme }, { role: "user", content: messageRecu }], 400)
    .catch(() => null);
  if (!result?.text) return;

  const waConfig = await lireConnexion(tenantId, "whatsapp");
  const token = waConfig?.accessToken ?? process.env.WHATSAPP_TOKEN;
  if (!token || !phoneId) return;

  await envoyerTexteWA(phoneId, token, toE164(de), result.text);
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

// Fuseau IANA du pays de la boutique (code ISO2) ; UTC si inconnu.
function fuseauPays(pays?: string | null): string {
  try {
    const l: any = new Intl.Locale(`und-${(pays ?? "").toUpperCase()}`);
    return (l.getTimeZones?.() ?? l.timeZones)?.[0] ?? "UTC";
  } catch {
    return "UTC";
  }
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
