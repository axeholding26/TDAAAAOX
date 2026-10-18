// Service d'envoi d'emails avec Resend
import { Resend } from "resend";
import type { Prisma } from "@prisma/client";

// Client joignable par email. Exclus : pas d'email (commande par téléphone) et les
// adresses générées qui n'existent pas — anciennes « <téléphone>@axso.com », leads Meta,
// clients de démonstration. Y écrire faisait rebondir les campagnes et abîmait la
// réputation d'envoi (jusqu'au Gmail du marchand).
const FAUSSES = ["@axso.com", "@meta.lead", "@axso-avis.local"];
export const emailReel = (e?: string | null): e is string => !!e && e.includes("@") && !FAUSSES.some((f) => e.endsWith(f));
export const AVEC_EMAIL_REEL = {
  email: { contains: "@" },
  NOT: FAUSSES.map((f) => ({ email: { endsWith: f } })),
} satisfies Prisma.ClientWhereInput;

export function hasResend(): boolean {
  return !!process.env.RESEND_API_KEY;
}

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

// Resend ne lève pas d'exception quand il refuse un envoi (domaine non vérifié, quota…) :
// il renvoie { error }. Ici le refus est journalisé et signalé par false.
async function envoyer(resend: Resend, message: Parameters<Resend["emails"]["send"]>[0]): Promise<boolean> {
  const { error } = await resend.emails.send(message);
  if (error) console.error("[email] envoi refusé par Resend :", error.message); // pas le sujet : il peut contenir un code
  return !error;
}

// Code de double authentification (connexion)
export async function envoyerCodeVerification(email: string, code: string, nom?: string) {
  const resend = getResendClient();
  if (!resend) {
    console.warn("Resend non configuré — code 2FA non envoyé");
    return;
  }
  const ok = await envoyer(resend, {
    from: "Axso <noreply@axsoafrica.com>",
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
  if (!ok) throw new Error("Code non envoyé : Resend a refusé l'email");
}

// Code de connexion à l'espace client d'une boutique (acheteur, sans mot de passe).
export async function envoyerCodeAcheteur(email: string, code: string, boutique: string) {
  const resend = getResendClient();
  if (!resend) {
    console.warn("Resend non configuré — code acheteur non envoyé");
    return;
  }
  const nom = boutique.replace(/[&<>"]/g, "");
  const ok = await envoyer(resend, {
    from: "Axso <noreply@axsoafrica.com>",
    to: email,
    subject: `${code} — Votre code d'accès ${nom}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Accédez à vos achats</h2>
        <p>Voici votre code pour ouvrir votre espace client sur ${nom} :</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 16px; background: #f5f5f5; border-radius: 12px;">${code}</p>
        <p style="color: #666; font-size: 13px;">Ce code expire dans 10 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
      </div>
    `,
  });
  if (!ok) throw new Error("Code non envoyé : Resend a refusé l'email");
}

// Code de réinitialisation de mot de passe
export async function envoyerCodeReinitialisation(email: string, code: string, nom?: string) {
  const resend = getResendClient();
  if (!resend) {
    console.warn("Resend non configuré — code de réinitialisation non envoyé");
    return;
  }
  const ok = await envoyer(resend, {
    from: "Axso <noreply@axsoafrica.com>",
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
  if (!ok) throw new Error("Code non envoyé : Resend a refusé l'email");
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
  await envoyer(resend, {
    from: "Axso <noreply@axsoafrica.com>",
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
  // Achat digital payé : lien vers la page d'accès (fichiers, formation, clés) — comme Chariow.
  lienAcces?: string;
}): Promise<boolean> {
  // true seulement si Resend a accepté l'envoi : jamais « e-mail envoyé » sans cette confirmation.
  const resend = getResendClient();
  if (!resend) {
    console.warn("Resend non configuré — email non envoyé");
    return false;
  }

  if (params.lienAcces) {
    const e = (v: string) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
    return envoyer(resend, {
      from: "Axso <noreply@axsoafrica.com>",
      to: params.email,
      subject: `Votre achat est disponible — ${params.boutique}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;">
          <h2>Merci pour votre achat !</h2>
          <p>Bonjour ${e(params.nom)},</p>
          <p>Votre paiement est confirmé (commande <strong>${e(params.numeroCommande)}</strong>). Votre achat est disponible dès maintenant :</p>
          <ul>${params.produits.map((p) => `<li>${e(p.nom)}</li>`).join("")}</ul>
          <p style="text-align: center; margin: 28px 0;">
            <a href="${e(params.lienAcces)}" style="display: inline-block; padding: 14px 28px; background: #111; color: #fff; border-radius: 10px; text-decoration: none; font-weight: bold;">Accéder à mon achat</a>
          </p>
          <p style="color: #666; font-size: 13px;">Votre accès est à vie : gardez cet email. Vous retrouvez aussi tous vos achats dans « Mon compte » de la boutique, avec votre adresse email.</p>
          <p>L'équipe ${e(params.boutique)} via Axso</p>
        </div>
      `,
    });
  }

  const lignesProduits = params.produits
    .map((p) => `- ${p.nom} x${p.quantite} : ${p.prix * p.quantite} ${params.devise}`)
    .join("\n");

  return envoyer(resend, {
    from: "Axso <noreply@axsoafrica.com>",
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
  await envoyer(resend, {
    from: "Axso <noreply@axsoafrica.com>",
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
  await envoyer(resend, {
    from: "Axso <noreply@axsoafrica.com>",
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

// Demande de devis (RFQ) envoyée à un fournisseur depuis AXSO Sourcing — en
// texte brut, réponse dirigée vers le marchand. Renvoie false si rien n'est
// parti (Resend non configuré ou refus) : l'appelant ne marque alors PAS la
// demande comme envoyée et propose le texte à copier.
export async function envoyerDemandeDevis(params: { emailFournisseur: string; emailMarchand: string; boutique: string; reference: string; texte: string }): Promise<boolean> {
  return envoyerEmailTexte({ a: params.emailFournisseur, repondreA: params.emailMarchand, boutique: params.boutique, sujet: `Request for quotation ${params.reference}`, texte: params.texte });
}

// E-mail en texte brut envoyé au nom d'une boutique (devis, bon de commande…),
// réponse dirigée vers le marchand. Renvoie false si rien n'est parti (Resend
// non configuré ou refus) : l'appelant ne doit alors rien marquer comme envoyé.
export async function envoyerEmailTexte(params: { a: string; repondreA: string; boutique: string; sujet: string; texte: string }): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) return false;
  return envoyer(resend, {
    from: `${params.boutique.replace(/[<>"\r\n]/g, "")} via Axso <noreply@axsoafrica.com>`,
    to: params.a,
    replyTo: params.repondreA,
    subject: params.sujet,
    text: params.texte,
  });
}

// Campagne e-mail d'une boutique : envoi par lots de 100 (API batch de Resend), lien de
// désinscription en en-tête (bouton « Se désabonner » de Gmail). Renvoie le nombre réellement accepté.
export async function envoyerCampagneEmail(params: {
  boutique: string; repondreA?: string | null; sujet: string;
  messages: { a: string; html: string; desinscription: string }[];
}): Promise<number> {
  const resend = getResendClient();
  if (!resend) return 0;
  const from = `${params.boutique.replace(/[<>"\r\n]/g, "")} via Axso <noreply@axsoafrica.com>`;
  let acceptes = 0;
  for (let i = 0; i < params.messages.length; i += 100) {
    const lot = params.messages.slice(i, i + 100).map((m) => ({
      from, to: m.a, subject: params.sujet, html: m.html,
      ...(params.repondreA ? { replyTo: params.repondreA } : {}),
      headers: { "List-Unsubscribe": `<${m.desinscription}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    }));
    const { data, error } = await resend.batch.send(lot);
    if (error) { console.error("[email] campagne refusée par Resend :", error.message); break; } // même refus pour les lots suivants
    acceptes += data?.data?.length ?? lot.length;
  }
  return acceptes;
}
