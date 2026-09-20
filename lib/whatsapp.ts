// WhatsApp Business notifications — Genuka (simplifié, si configuré), sinon
// Cloud API Meta directe (historique), sinon lien wa.me fallback.
// Chaque boutique peut connecter son propre numéro WhatsApp via Genuka
// (ConnecteurConfig type "whatsapp_genuka") — prioritaire sur le token
// plateforme partagé GENUKA_PROXY_TOKEN, lui-même utilisé si la boutique n'a
// rien connecté (comportement inchangé pour les boutiques existantes).
import { hasGenuka, envoyerMessageGenuka } from "./genuka";
import { prisma } from "./prisma";
import { quotaCommandesAtteint } from "./abonnement";

async function tokenGenukaTenant(tenantId?: string): Promise<string | null> {
  if (!tenantId) return null;
  const cfg = await prisma.connecteurConfig.findFirst({
    where: { tenantId, type: "whatsapp_genuka", statut: "actif" },
    select: { config: true },
  }).catch(() => null);
  const token = (cfg?.config as any)?.proxyToken;
  return typeof token === "string" && token ? token : null;
}

const MESSAGES: Record<string, (params: { numero: string; boutique: string; lien: string }) => string> = {
  confirmee: ({ numero, boutique, lien }) =>
    `✅ *Bonne nouvelle !*\n\nVotre commande *#${numero}* a bien été confirmée par *${boutique}*.\n\nNous préparons vos articles avec soin.\n\n🔍 Suivre ma commande : ${lien}`,

  en_preparation: ({ numero, boutique }) =>
    `📦 *Votre commande est en cours de préparation !*\n\nCommande *#${numero}* — *${boutique}*\n\nNos équipes s'occupent de vos articles. Vous serez notifié dès l'expédition.`,

  expediee: ({ numero, boutique, lien }) =>
    `🚚 *Votre commande est en route !*\n\nCommande *#${numero}* — *${boutique}*\n\nVotre colis a été expédié et est en chemin.\n\n🔍 Suivre ma commande : ${lien}`,

  livree: ({ numero, boutique, lien }) =>
    `🎉 *Votre commande est arrivée !*\n\nCommande *#${numero}* — *${boutique}*\n\nVotre colis a été livré. Confirmez la réception pour finaliser la transaction.\n\n✅ Confirmer : ${lien}`,

  tentative_echouee: ({ numero, boutique, lien }) =>
    `⚠️ *Tentative de livraison manquée*\n\nNotre livreur n'a pas pu vous joindre pour la commande *#${numero}* — *${boutique}*.\n\nUne nouvelle tentative sera planifiée. Vous pouvez aussi contacter la boutique pour convenir d'un horaire.\n\n🔍 Suivre ma commande : ${lien}`,

  annulee: ({ numero, boutique }) =>
    `❌ *Commande annulée*\n\nVotre commande *#${numero}* — *${boutique}* a été annulée.\n\nContactez la boutique pour plus d'informations.`,
};

export function buildWhatsAppMessage(params: {
  statut: string;
  numero: string;
  boutique: string;
  lien: string;
}): string | null {
  const template = MESSAGES[params.statut];
  if (!template) return null;
  return template(params);
}

// Envoie via WhatsApp Business Cloud API (Meta direct — legacy)
async function envoyerViaCloudAPI(telephone: string, message: string): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return false;

  const numero = telephone.replace(/\D/g, "");
  if (!numero || numero.length < 8) return false;

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: numero,
          type: "text",
          text: { body: message, preview_url: true },
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

// Point d'envoi unique : token Genuka de la boutique en priorité, sinon
// token plateforme partagé, sinon Meta direct (legacy).
async function envoyerMessage(telephone: string, message: string, tenantId?: string): Promise<boolean> {
  const tokenTenant = await tokenGenukaTenant(tenantId);
  if (tokenTenant || hasGenuka()) {
    const ok = await envoyerMessageGenuka(telephone, message, tokenTenant);
    if (ok) return true;
    // Si Genuka échoue (panne ponctuelle...), on retente via Meta direct s'il
    // est configuré, plutôt que d'abandonner tout de suite sur l'auto-envoi.
  }
  return envoyerViaCloudAPI(telephone, message);
}

// Construit un lien wa.me cliquable pour le marchand (fallback sans API)
export function buildWhatsAppLink(telephone: string, message: string): string | null {
  const numero = telephone.replace(/\D/g, "");
  if (!numero || numero.length < 8) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(message)}`;
}

// Point d'entrée principal — tente Cloud API, retourne lien fallback si échec
export async function notifierClientWhatsApp(params: {
  telephone: string | null | undefined;
  statut: string;
  numero: string;
  boutique: string;
  slug: string;
  trackingToken: string | null;
  tenantId?: string;
}): Promise<{ envoyeAuto: boolean; whatsappUrl: string | null }> {
  if (!params.telephone) return { envoyeAuto: false, whatsappUrl: null };
  // WhatsApp fait partie des fonctionnalités verrouillées au quota Palier 0 —
  // aucun envoi auto, aucun lien wa.me de secours, le module est inaccessible
  // jusqu'à upgrade (voir lib/abonnement.ts::quotaCommandesAtteint).
  if (params.tenantId && await quotaCommandesAtteint(params.tenantId)) {
    return { envoyeAuto: false, whatsappUrl: null };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://axso.vercel.app";
  // Suivi live (position GPS, étapes) — consolidé sur /tracking/[token], le lien
  // /suivi/[orderId] legacy (sans géoloc, id de commande exposé) est retiré.
  const lien = params.trackingToken ? `${appUrl}/${params.slug}/tracking/${params.trackingToken}` : `${appUrl}/${params.slug}`;
  const message = buildWhatsAppMessage({ statut: params.statut, numero: params.numero, boutique: params.boutique, lien });
  if (!message) return { envoyeAuto: false, whatsappUrl: null };

  // Tente envoi automatique (Genuka de la boutique, puis plateforme, puis Meta direct)
  const envoyeAuto = await envoyerMessage(params.telephone, message, params.tenantId);
  if (envoyeAuto) return { envoyeAuto: true, whatsappUrl: null };

  // Fallback : lien wa.me que le marchand peut cliquer
  const whatsappUrl = buildWhatsAppLink(params.telephone, message);
  return { envoyeAuto: false, whatsappUrl };
}

// Notification "livreur assigné" — déclenchée depuis /api/commandes/[id]/assigner,
// distincte du cycle de statut (aucun changement de Commande.statut ici).
export async function notifierLivreurAssigneWhatsApp(params: {
  telephone: string | null | undefined;
  numero: string;
  boutique: string;
  slug: string;
  trackingToken: string | null;
  livreurNom: string;
  tenantId?: string;
}): Promise<{ envoyeAuto: boolean; whatsappUrl: string | null }> {
  if (!params.telephone) return { envoyeAuto: false, whatsappUrl: null };
  if (params.tenantId && await quotaCommandesAtteint(params.tenantId)) {
    return { envoyeAuto: false, whatsappUrl: null };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://axso.vercel.app";
  const lien = params.trackingToken ? `${appUrl}/${params.slug}/tracking/${params.trackingToken}` : `${appUrl}/${params.slug}`;
  const message = `🏍️ *Un livreur a été assigné à votre commande !*\n\nCommande *#${params.numero}* — *${params.boutique}*\n\n👤 Livreur : ${params.livreurNom}\n\n🔍 Suivre sa position en temps réel : ${lien}`;

  const envoyeAuto = await envoyerMessage(params.telephone, message, params.tenantId);
  if (envoyeAuto) return { envoyeAuto: true, whatsappUrl: null };

  const whatsappUrl = buildWhatsAppLink(params.telephone, message);
  return { envoyeAuto: false, whatsappUrl };
}
