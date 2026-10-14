// Connecteur WhatsApp Business Cloud API (Meta)
// Docs : https://developers.facebook.com/docs/whatsapp/cloud-api

const WA_BASE = "https://graph.facebook.com/v19.0";

// Identifiants passés par l'appelant (numéro de la boutique) ; à défaut, numéro d'Axso.
type Identifiants = { token?: string; phoneId?: string };
function getPhoneId(id?: Identifiants): string {
  return id?.phoneId || process.env.WHATSAPP_PHONE_NUMBER_ID || "";
}
function getToken(id?: Identifiants): string {
  return id?.token || process.env.WHATSAPP_TOKEN || "";
}

// ── Message texte simple ───────────────────────────────────────────────────

export async function envoyerMessageWhatsApp(params: {
  telephone: string;
  message: string;
}, id?: Identifiants): Promise<{ succes: boolean; messageId?: string; erreur?: string }> {
  const phoneId = getPhoneId(id);
  const token = getToken(id);
  if (!phoneId || !token) return { succes: false, erreur: "WHATSAPP_TOKEN ou WHATSAPP_PHONE_NUMBER_ID manquant" };

  const telephone = params.telephone.replace(/\D/g, "");

  const res = await fetch(`${WA_BASE}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: telephone,
      type: "text",
      text: { preview_url: false, body: params.message },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (data.error || !res.ok) return { succes: false, erreur: data.error?.message || "Erreur WhatsApp" };
  return { succes: true, messageId: data.messages?.[0]?.id };
}

// ── Message avec template ──────────────────────────────────────────────────

export async function envoyerTemplateWhatsApp(params: {
  telephone: string;
  templateNom: string;
  variables?: string[];
  langue?: string;
}, id?: Identifiants): Promise<{ succes: boolean; messageId?: string; erreur?: string }> {
  const phoneId = getPhoneId(id);
  const token = getToken(id);
  if (!phoneId || !token) return { succes: false, erreur: "WhatsApp non configuré" };

  const telephone = params.telephone.replace(/\D/g, "");
  const components = params.variables?.length
    ? [{ type: "body", parameters: params.variables.map((v) => ({ type: "text", text: v })) }]
    : [];

  const res = await fetch(`${WA_BASE}/${phoneId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: telephone,
      type: "template",
      template: {
        name: params.templateNom,
        language: { code: params.langue || "fr" },
        components,
      },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (data.error || !res.ok) return { succes: false, erreur: data.error?.message || "Erreur WhatsApp" };
  return { succes: true, messageId: data.messages?.[0]?.id };
}
