// Service d'envoi d'emails avec Resend
import { Resend } from "resend";

export function hasResend(): boolean {
  return !!process.env.RESEND_API_KEY;
}

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

// Code de double authentification (connexion)
export async function envoyerCodeVerification(email: string, code: string, nom?: string) {
  const resend = getResendClient();
  if (!resend) {
    console.warn("Resend non configuré — code 2FA non envoyé");
    return;
  }
  await resend.emails.send({
    from: "Axso <noreply@axso.com>",
    to: email,
    subject: `${code} — Ton code de connexion Axso`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Code de connexion</h2>
        <p>Bonjour ${nom || ""},</p>
        <p>Voici ton code de vérification pour te connecter à Axso :</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 16px; background: #f5f5f5; border-radius: 12px;">${code}</p>
        <p style="color: #666; font-size: 13px;">Ce code expire dans 10 minutes. Si tu n'es pas à l'origine de cette tentative de connexion, ignore cet email.</p>
      </div>
    `,
  });
}

// Code de réinitialisation de mot de passe
export async function envoyerCodeReinitialisation(email: string, code: string, nom?: string) {
  const resend = getResendClient();
  if (!resend) {
    console.warn("Resend non configuré — code de réinitialisation non envoyé");
    return;
  }
  await resend.emails.send({
    from: "Axso <noreply@axso.com>",
    to: email,
    subject: `${code} — Réinitialisation de ton mot de passe Axso`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Réinitialisation de mot de passe</h2>
        <p>Bonjour ${nom || ""},</p>
        <p>Voici ton code pour réinitialiser ton mot de passe Axso :</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 16px; background: #f5f5f5; border-radius: 12px;">${code}</p>
        <p style="color: #666; font-size: 13px;">Ce code expire dans 10 minutes. Si tu n'es pas à l'origine de cette demande, ignore cet email — ton mot de passe actuel reste inchangé.</p>
      </div>
    `,
  });
}

// Alerte nouvelle commande envoyée au marchand
export async function envoyerAlerteNouvelleCommande(params: {
  email: string;
  numeroCommande: string;
  montantTotal: number;
  devise: string;
  clientNom: string;
  boutique: string;
  lien: string;
}) {
  const resend = getResendClient();
  if (!resend) return;
  await resend.emails.send({
    from: "Axso <noreply@axso.com>",
    to: params.email,
    subject: `Nouvelle commande ${params.numeroCommande} — ${params.montantTotal} ${params.devise}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Nouvelle commande reçue 🎉</h2>
        <p>Bonjour,</p>
        <p><strong>${params.clientNom}</strong> vient de passer une commande sur <strong>${params.boutique}</strong>.</p>
        <p>Commande <strong>${params.numeroCommande}</strong> — <strong>${params.montantTotal} ${params.devise}</strong></p>
        <p><a href="${params.lien}" style="display:inline-block;padding:10px 20px;background:#F5A623;color:#111;border-radius:8px;text-decoration:none;font-weight:bold;">Voir la commande</a></p>
      </div>
    `,
  });
}

// Email de confirmation de commande
export async function envoyerConfirmationCommande(params: {
  email: string;
  nom: string;
  numeroCommande: string;
  montantTotal: number;
  devise: string;
  produits: Array<{ nom: string; quantite: number; prix: number }>;
  boutique: string;
}) {
  const resend = getResendClient();
  if (!resend) {
    console.warn("Resend non configuré — email non envoyé");
    return;
  }

  const lignesProduits = params.produits
    .map((p) => `- ${p.nom} x${p.quantite} : ${p.prix * p.quantite} ${params.devise}`)
    .join("\n");

  await resend.emails.send({
    from: "Axso <noreply@axso.com>",
    to: params.email,
    subject: `Confirmation commande ${params.numeroCommande} — ${params.boutique}`,
    html: `
      <h2>Merci pour votre commande !</h2>
      <p>Bonjour ${params.nom},</p>
      <p>Votre commande <strong>${params.numeroCommande}</strong> a bien été reçue.</p>
      <h3>Récapitulatif :</h3>
      <pre>${lignesProduits}</pre>
      <p><strong>Total : ${params.montantTotal} ${params.devise}</strong></p>
      <p>Vous recevrez une notification dès que votre commande est expédiée.</p>
      <br/>
      <p>L'équipe ${params.boutique} via Axso</p>
    `,
  });
}

// Invitation à rejoindre l'équipe d'une boutique
export async function envoyerInvitationEquipe(params: {
  email: string;
  nom: string;
  boutique: string;
  role: string;
  lien: string;
}) {
  const resend = getResendClient();
  if (!resend) {
    console.warn("Resend non configuré — invitation équipe non envoyée par email (lien affiché dans l'UI)");
    return;
  }
  await resend.emails.send({
    from: "Axso <noreply@axso.com>",
    to: params.email,
    subject: `Tu es invité·e à rejoindre l'équipe de ${params.boutique}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Invitation à rejoindre l'équipe</h2>
        <p>Bonjour ${params.nom},</p>
        <p><strong>${params.boutique}</strong> t'invite à rejoindre son équipe sur Axso, avec le rôle <strong>${params.role}</strong>.</p>
        <p><a href="${params.lien}" style="display:inline-block;padding:10px 20px;background:#F5A623;color:#111;border-radius:8px;text-decoration:none;font-weight:bold;">Rejoindre l'équipe</a></p>
        <p style="color: #666; font-size: 13px;">Ce lien expire dans 7 jours. Si tu ne t'attendais pas à cette invitation, ignore cet email.</p>
      </div>
    `,
  });
}

// Message envoyé depuis le formulaire de contact d'une boutique — transmis
// au marchand par email. Le client final n'a pas de compte, donc aucune
// authentification ici (route publique) — voir le honeypot anti-spam côté route.
export async function envoyerMessageContact(params: {
  emailMarchand: string;
  boutique: string;
  nom: string;
  emailClient: string;
  message: string;
}) {
  const resend = getResendClient();
  if (!resend) {
    console.warn("Resend non configuré — message de contact non transmis par email");
    return;
  }
  await resend.emails.send({
    from: "Axso <noreply@axso.com>",
    to: params.emailMarchand,
    replyTo: params.emailClient,
    subject: `Nouveau message via la page Contact — ${params.boutique}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Nouveau message client</h2>
        <p><strong>${params.nom}</strong> (${params.emailClient}) a écrit depuis la page Contact de <strong>${params.boutique}</strong> :</p>
        <p style="background:#f5f5f5;border-radius:8px;padding:14px;white-space:pre-wrap;">${params.message}</p>
        <p style="color:#666;font-size:13px;">Tu peux répondre directement à cet email — la réponse ira à ${params.emailClient}.</p>
      </div>
    `,
  });
}

// Email de newsletter marketing
export async function envoyerNewsletter(params: {
  emails: string[];
  sujet: string;
  contenu: string;
  boutique: string;
}) {
  const resend = getResendClient();
  if (!resend) return;

  // Envoi par lots de 50 (limite Resend)
  const lots = [];
  for (let i = 0; i < params.emails.length; i += 50) {
    lots.push(params.emails.slice(i, i + 50));
  }

  for (const lot of lots) {
    await resend.emails.send({
      from: `${params.boutique} <noreply@axso.com>`,
      to: lot,
      subject: params.sujet,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          ${params.contenu}
          <hr/>
          <p style="font-size:12px;color:#666;">
            Envoyé par ${params.boutique} via Axso.
            <a href="#">Se désabonner</a>
          </p>
        </div>
      `,
    });
  }
}
