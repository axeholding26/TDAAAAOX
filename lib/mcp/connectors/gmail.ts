// Connecteur Gmail — envoi d'emails via Gmail API OAuth2
// Docs : https://developers.google.com/gmail/api

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const OAUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export function getGmailOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/mcp/oauth/google/callback`,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${OAUTH_URL}?${params}`;
}

export async function rafraichirTokenGoogle(refreshToken: string): Promise<string | null> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  return data.access_token || null;
}

function construireRaw(params: {
  de: string;
  a: string;
  sujet: string;
  corps: string;
  cc?: string;
}): string {
  const headers = [
    `From: ${params.de}`,
    `To: ${params.a}`,
    ...(params.cc ? [`Cc: ${params.cc}`] : []),
    `Subject: =?UTF-8?B?${Buffer.from(params.sujet).toString("base64")}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "",
    params.corps,
  ].join("\r\n");

  return Buffer.from(headers)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function envoyerGmail(params: {
  accessToken: string;
  a: string;
  sujet: string;
  corpsHtml: string;
  de?: string;
  cc?: string;
}): Promise<{ succes: boolean; messageId?: string; erreur?: string }> {
  if (!params.accessToken) return { succes: false, erreur: "Token Gmail manquant — connectez votre Gmail" };

  // Récupérer l'email de l'expéditeur
  const profileRes = await fetch(`${GMAIL_BASE}/profile`, {
    headers: { Authorization: `Bearer ${params.accessToken}` },
  });
  const profile = await profileRes.json();
  const expediteur = params.de || profile.emailAddress || "moi";

  const raw = construireRaw({
    de: expediteur,
    a: params.a,
    sujet: params.sujet,
    corps: params.corpsHtml,
    cc: params.cc,
  });

  const res = await fetch(`${GMAIL_BASE}/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  const data = await res.json();
  if (data.error) return { succes: false, erreur: data.error.message };
  return { succes: true, messageId: data.id };
}
