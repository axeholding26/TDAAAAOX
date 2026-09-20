// Connecteur SMS — Africa's Talking (couverture pan-africaine)
// Docs : https://developers.africastalking.com/docs/sms/sending

const AT_BASE = "https://api.africastalking.com/version1";

export async function envoyerSMS(params: {
  telephone: string;
  message: string;
  expediteur?: string;
}): Promise<{ succes: boolean; messageId?: string; erreur?: string }> {
  const username = process.env.AFRICASTALKING_USERNAME;
  const apiKey = process.env.AFRICASTALKING_KEY;

  if (!username || !apiKey) return { succes: false, erreur: "AFRICASTALKING_USERNAME ou AFRICASTALKING_KEY manquant" };

  const telephone = params.telephone.startsWith("+") ? params.telephone : `+${params.telephone}`;

  const body = new URLSearchParams({
    username,
    to: telephone,
    message: params.message,
    ...(params.expediteur && { from: params.expediteur }),
  });

  const res = await fetch(`${AT_BASE}/messaging`, {
    method: "POST",
    headers: {
      apiKey,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await res.json();
  const recipient = data.SMSMessageData?.Recipients?.[0];

  if (!res.ok || recipient?.status !== "Success") {
    return { succes: false, erreur: recipient?.status || data.SMSMessageData?.Message || "Erreur SMS" };
  }

  return { succes: true, messageId: recipient.messageId };
}

export async function envoyerSMSMasse(params: {
  telephones: string[];
  message: string;
  expediteur?: string;
}): Promise<{ succes: boolean; envoyes: number; echecs: number; erreur?: string }> {
  const username = process.env.AFRICASTALKING_USERNAME;
  const apiKey = process.env.AFRICASTALKING_KEY;
  if (!username || !apiKey) return { succes: false, envoyes: 0, echecs: 0, erreur: "Africa's Talking non configuré" };

  const numeros = params.telephones
    .map((t) => (t.startsWith("+") ? t : `+${t}`))
    .join(",");

  const body = new URLSearchParams({
    username,
    to: numeros,
    message: params.message,
    ...(params.expediteur && { from: params.expediteur }),
  });

  const res = await fetch(`${AT_BASE}/messaging`, {
    method: "POST",
    headers: { apiKey, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await res.json();
  const recipients = data.SMSMessageData?.Recipients ?? [];
  const envoyes = recipients.filter((r: any) => r.status === "Success").length;
  const echecs = recipients.length - envoyes;

  return { succes: envoyes > 0, envoyes, echecs };
}
