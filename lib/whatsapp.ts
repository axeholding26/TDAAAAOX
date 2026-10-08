// WhatsApp Business notifications — Genuka (simplifié, si configuré), sinon
// Cloud API Meta directe (historique), sinon lien wa.me fallback.
// Chaque boutique peut connecter son propre numéro WhatsApp via Genuka
// (ConnecteurConfig type "whatsapp_genuka") — prioritaire sur le token
// plateforme partagé GENUKA_PROXY_TOKEN, lui-même utilisé si la boutique n'a
// rien connecté (comportement inchangé pour les boutiques existantes).
import { lienBoutique } from "./origine-site";
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

const MESSAGES: Record<string, (params: { numero: string; boutique: string; lien: string; code?: string | null }) => string> = {
  confirmee: ({ numero, boutique, lien }) =>
    `✅ *Bonne nouvelle !*\n\nVotre commande *#${numero}* a bien été confirmée par *${boutique}*.\n\nNous préparons vos articles avec soin.\n\n🔍 Suivre ma commande : ${lien}`,

  en_preparation: ({ numero, boutique }) =>
    `📦 *Votre commande est en cours de préparation !*\n\nCommande *#${numero}* — *${boutique}*\n\nNos équipes s'occupent de vos articles. Vous serez notifié dès l'expédition.`,

  expediee: ({ numero, boutique, lien, code }) =>
    `🚚 *Votre commande est en route !*\n\nCommande *#${numero}* — *${boutique}*\n\nVotre colis a été expédié et est en chemin.${code ? `\n\n🔑 Code de livraison : *${code}*\nDonnez-le au livreur uniquement quand vous avez reçu votre colis.` : ""}\n\n🔍 Suivre ma commande : ${lien}`,

  livree: ({ numero, boutique, lien }) =>
    `🎉 *Votre commande est arrivée !*\n\nCommande *#${numero}* — *${boutique}*\n\nVotre colis a été livré. Merci pour votre confiance !\n\n🔍 Détail de la commande : ${lien}`,

  tentative_echouee: ({ numero, boutique, lien }) =>
    `⚠️ *Tentative de livraison manquée*\n\nNotre livreur n'a pas pu vous joindre pour la commande *#${numero}* — *${boutique}*.\n\nUne nouvelle tentative sera planifiée. Vous pouvez aussi contacter la boutique pour convenir d'un horaire.\n\n🔍 Suivre ma commande : ${lien}`,

  annulee: ({ numero, boutique }) =>
    `❌ *Commande annulée*\n\nVotre commande *#${numero}* — *${boutique}* a été annulée.\n\nContactez la boutique pour plus d'informations.`,

  rembourse_en_ligne: ({ numero, boutique }) =>
    `💸 *Remboursement effectué*\n\nVotre commande *#${numero}* — *${boutique}* a été remboursée sur le moyen de paiement utilisé (Mobile Money ou carte). Le délai d'arrivée dépend de votre opérateur.`,

  rembourse_especes: ({ numero, boutique }) =>
    `💸 *Remboursement accordé*\n\nLa boutique *${boutique}* rembourse votre commande *#${numero}*. Elle vous rend la somme directement.`,
};

export function buildWhatsAppMessage(params: {
  statut: string;
  numero: string;
  boutique: string;
  lien: string;
  code?: string | null;
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
  codeLivraison?: string | null;
}): Promise<{ envoyeAuto: boolean; whatsappUrl: string | null }> {
  if (!params.telephone) return { envoyeAuto: false, whatsappUrl: null };
  // WhatsApp fait partie des fonctionnalités verrouillées au quota Palier 0 —
  // aucun envoi auto, aucun lien wa.me de secours, le module est inaccessible
  // jusqu'à upgrade (voir lib/abonnement.ts::quotaCommandesAtteint).
  if (params.tenantId && await quotaCommandesAtteint(params.tenantId)) {
    return { envoyeAuto: false, whatsappUrl: null };
  }

  const lien = await lienBoutique(params.slug, params.trackingToken ? `/tracking/${params.trackingToken}` : "");
  const message = buildWhatsAppMessage({ statut: params.statut, numero: params.numero, boutique: params.boutique, lien, code: params.codeLivraison });
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

  const lien = await lienBoutique(params.slug, params.trackingToken ? `/tracking/${params.trackingToken}` : "");
  const message = `🏍️ *Un livreur a été assigné à votre commande !*\n\nCommande *#${params.numero}* — *${params.boutique}*\n\n👤 Livreur : ${params.livreurNom}\n\n🔍 Suivre sa position en temps réel : ${lien}`;

  const envoyeAuto = await envoyerMessage(params.telephone, message, params.tenantId);
  if (envoyeAuto) return { envoyeAuto: true, whatsappUrl: null };

  const whatsappUrl = buildWhatsAppLink(params.telephone, message);
  return { envoyeAuto: false, whatsappUrl };
}

// Prévient le livreur d'une nouvelle course : la notification dans l'appli ne
// suffit pas, il ne la voit que s'il a l'appli ouverte. Lien direct vers la fiche.
export async function notifierLivreurNouvelleCourse(params: {
  telephone: string;
  numero: string;
  boutique: string;
  adresse: string;
  ville: string;
  commandeId: string;
  tenantId: string;
}): Promise<{ envoyeAuto: boolean; whatsappUrl: string | null }> {
  if (await quotaCommandesAtteint(params.tenantId)) return { envoyeAuto: false, whatsappUrl: null };
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://axso.vercel.app";
  const message = `🛵 *Nouvelle livraison assignée*\n\nCommande *#${params.numero}* — *${params.boutique}*\n📍 ${params.adresse}, ${params.ville}\n\n👉 Ouvrir la course : ${appUrl}/livreur/commande/${params.commandeId}`;
  if (await envoyerMessage(params.telephone, message, params.tenantId)) return { envoyeAuto: true, whatsappUrl: null };
  return { envoyeAuto: false, whatsappUrl: buildWhatsAppLink(params.telephone, message) };
}
