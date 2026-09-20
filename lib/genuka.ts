// Client Genuka — WhatsApp Business simplifié (Proxy API), évite la
// vérification Meta Business Manager complète requise par l'intégration
// directe (WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID dans lib/whatsapp.ts,
// conservée comme fallback historique).
// Docs : https://docs.genuka.com/merchant-api/13-whatsapp.md
import crypto from "crypto";

const GENUKA_API_URL = process.env.GENUKA_API_URL ?? "https://api.genuka.com";

export function hasGenuka(): boolean {
  return !!process.env.GENUKA_PROXY_TOKEN;
}

// Envoi via le Proxy API Genuka — le proxy token (préfixe gwa_) est créé une
// fois côté dashboard Genuka (Admin API POST /whatsapp/proxy-tokens) et scopé
// send_text/send_template/send_media ; c'est le seul secret nécessaire ici.
// `tokenTenant` : chaque boutique peut connecter son propre numéro WhatsApp
// (stocké dans ConnecteurConfig) — prioritaire sur le token plateforme partagé.
export async function envoyerMessageGenuka(telephone: string, message: string, tokenTenant?: string | null): Promise<boolean> {
  const token = tokenTenant || process.env.GENUKA_PROXY_TOKEN;
  if (!token) return false;

  const numero = telephone.replace(/\D/g, "");
  if (!numero || numero.length < 8) return false;

  try {
    const res = await fetch(`${GENUKA_API_URL}/2023-11/whatsapp-proxy/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: numero,
        type: "text",
        text: { body: message, preview_url: true },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Vérification de signature du webhook générique Genuka (événements
// message.received / message.status_updated / conversation.*).
// Header X-Genuka-Signature, HMAC-SHA256 du corps brut. `secret` : chaque
// boutique a son propre compte Genuka donc son propre secret de webhook
// (stocké dans ConnecteurConfig.config.webhookSecret) — pas de secret global.
export function verifierSignatureGenukaWebhook(rawBody: string, signatureHeader: string | null, secret: string | null | undefined): boolean {
  if (!secret || !signatureHeader) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const recu = signatureHeader.replace(/^sha256=/, "");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(recu, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
