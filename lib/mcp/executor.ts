// Exécuteur MCP — reçoit un nom d'outil + arguments et l'exécute via le bon connecteur
import { prisma } from "@/lib/prisma";
import { posterFacebook, posterInstagram, creerCampagneAds, statsPageFacebook } from "./connectors/meta";
import { envoyerMessageWhatsApp, envoyerTemplateWhatsApp } from "./connectors/whatsapp";
import { envoyerGmail, rafraichirTokenGoogle } from "./connectors/gmail";
import { envoyerSMS, envoyerSMSMasse } from "./connectors/sms";
import {
  appellerOutilHiggsfield, genererVideoHiggsfield, genererImageHiggsfield,
  listerOutilsHiggsfield, HIGGSFIELD_VIDEO_MODELS,
} from "./connectors/higgsfield";
import {
  genererTexte, genererEmailHtml, genererDescriptionProduit,
  genererPostSocial, traduire, analyserImageProduit,
} from "./connectors/gemini";

export interface McpResult {
  succes: boolean;
  resultat: string;
  donnees?: any;
}

// Récupère la config connecteur d'un tenant
async function getConfig(tenantId: string, type: string) {
  return prisma.connecteurConfig.findUnique({
    where: { tenantId_type: { tenantId, type } },
  });
}

// Récupère un access token Gmail valide (rafraîchit si nécessaire)
async function getGmailToken(tenantId: string): Promise<string | null> {
  const config = await getConfig(tenantId, "gmail");
  if (!config) return null;
  const cfg = config.config as any;
  if (cfg.access_token) return cfg.access_token;
  if (cfg.refresh_token) {
    const newToken = await rafraichirTokenGoogle(cfg.refresh_token);
    if (newToken) {
      await prisma.connecteurConfig.update({
        where: { tenantId_type: { tenantId, type: "gmail" } },
        data: { config: { ...cfg, access_token: newToken } },
      });
      return newToken;
    }
  }
  return null;
}

export async function executerOutilMcp(
  toolName: string,
  args: Record<string, any>,
  tenantId: string
): Promise<McpResult> {
  try {
    // ── META ────────────────────────────────────────────────────────────────
    if (toolName === "meta_poster_facebook") {
      const config = await getConfig(tenantId, "meta");
      const pageId = config?.pageId || process.env.META_PAGE_ID;
      const accessToken = config?.accessToken || undefined;
      if (!pageId) return { succes: false, resultat: "Page Facebook ID non configurée — allez dans Connecteurs" };

      const res = await posterFacebook({ pageId, message: args.message, imageUrl: args.imageUrl, lienUrl: args.lienUrl, accessToken });
      if (!res.succes) return { succes: false, resultat: `Erreur Facebook : ${res.erreur}` };

      await prisma.postPlanifie.create({
        data: { tenantId, plateforme: "facebook", contenu: args.message, hashtags: [], planifieLe: new Date(), publieLe: new Date(), statut: "publie", externalId: res.postId },
      });
      return { succes: true, resultat: `Post Facebook publié ✓ (ID: ${res.postId})`, donnees: res };
    }

    if (toolName === "meta_poster_instagram") {
      const config = await getConfig(tenantId, "meta");
      const igUserId = config?.igUserId || process.env.META_IG_USER_ID;
      const accessToken = config?.accessToken || undefined;
      if (!igUserId) return { succes: false, resultat: "Instagram User ID non configuré — allez dans Connecteurs" };
      if (!args.imageUrl) return { succes: false, resultat: "Une image est obligatoire pour Instagram" };

      const res = await posterInstagram({ igUserId, caption: args.caption, imageUrl: args.imageUrl, type: args.type, accessToken });
      if (!res.succes) return { succes: false, resultat: `Erreur Instagram : ${res.erreur}` };

      await prisma.postPlanifie.create({
        data: { tenantId, plateforme: "instagram", contenu: args.caption, hashtags: [], imageUrl: args.imageUrl, planifieLe: new Date(), publieLe: new Date(), statut: "publie", externalId: res.postId },
      });
      return { succes: true, resultat: `Post Instagram publié ✓ (ID: ${res.postId})`, donnees: res };
    }

    if (toolName === "meta_planifier_post") {
      const planifieLe = new Date(args.planifieLe);
      if (isNaN(planifieLe.getTime())) return { succes: false, resultat: "Date invalide — utilisez le format ISO 8601" };

      const post = await prisma.postPlanifie.create({
        data: {
          tenantId,
          plateforme: args.plateforme,
          contenu: args.contenu,
          hashtags: [],
          imageUrl: args.imageUrl,
          planifieLe,
          statut: "planifie",
        },
      });
      return {
        succes: true,
        resultat: `Post planifié pour le ${planifieLe.toLocaleString("fr-FR")} sur ${args.plateforme} ✓`,
        donnees: { id: post.id },
      };
    }

    if (toolName === "meta_creer_campagne_ads") {
      const res = await creerCampagneAds({
        nom: args.nom,
        objectif: args.objectif,
        budget_jour: args.budget_jour,
        pays: args.pays,
        age_min: args.age_min,
        age_max: args.age_max,
        url_destination: args.url_destination,
      });
      if (!res.succes) return { succes: false, resultat: `Erreur Meta Ads : ${res.erreur}` };

      await prisma.campagne.create({
        data: {
          tenantId,
          nom: args.nom,
          plateforme: "meta",
          objectif: args.objectif,
          budget: args.budget_jour,
          statut: "en_pause",
          externalId: res.campagneId,
          ciblePays: args.pays || [],
          dateDebut: new Date(),
        },
      });
      return { succes: true, resultat: `Campagne Meta Ads "${args.nom}" créée ✓ (statut: En pause — activez depuis Meta Ads Manager)`, donnees: res };
    }

    if (toolName === "meta_stats_page") {
      const config = await getConfig(tenantId, "meta");
      const pageId = config?.pageId || process.env.META_PAGE_ID;
      if (!pageId) return { succes: false, resultat: "Page Facebook ID non configurée" };

      const res = await statsPageFacebook({ pageId, accessToken: config?.accessToken || undefined });
      if (!res.succes) return { succes: false, resultat: `Erreur : ${res.erreur}` };
      return { succes: true, resultat: JSON.stringify(res.stats, null, 2), donnees: res.stats };
    }

    // ── WHATSAPP ─────────────────────────────────────────────────────────────
    if (toolName === "whatsapp_envoyer_message") {
      const waCfg = await getConfig(tenantId, "whatsapp");
      const waToken = waCfg?.accessToken || process.env.WHATSAPP_TOKEN;
      const waPhoneId = (waCfg?.config as any)?.phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID;
      if (!waToken || !waPhoneId) return { succes: false, resultat: "WhatsApp non connecté — allez dans Connecteurs pour autoriser l'accès" };

      // Injecter les credentials per-tenant dans les env vars temporairement via les params
      const origToken = process.env.WHATSAPP_TOKEN;
      const origPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      process.env.WHATSAPP_TOKEN = waToken;
      process.env.WHATSAPP_PHONE_NUMBER_ID = waPhoneId;
      const res = await envoyerMessageWhatsApp({ telephone: args.telephone, message: args.message });
      process.env.WHATSAPP_TOKEN = origToken;
      process.env.WHATSAPP_PHONE_NUMBER_ID = origPhoneId;

      if (!res.succes) return { succes: false, resultat: `Erreur WhatsApp : ${res.erreur}` };
      return { succes: true, resultat: `Message WhatsApp envoyé à ${args.telephone} ✓` };
    }

    if (toolName === "whatsapp_diffusion") {
      if (!process.env.WHATSAPP_TOKEN) return { succes: false, resultat: "WHATSAPP_TOKEN non configuré" };

      const clients = await prisma.client.findMany({
        where: {
          tenantId,
          telephone: { not: "" },
          ...(args.segment === "vip" && { totalDepense: { gte: 50000 } }),
          ...(args.segment === "inactifs" && { createdAt: { lte: new Date(Date.now() - 30 * 24 * 3600 * 1000) } }),
          ...(args.segment === "nouveaux" && { totalCommandes: 0 }),
        },
        take: 200,
      });

      let message = args.message;
      if (args.code_promo) message += `\n\n🎁 Code promo : *${args.code_promo}*`;

      let envoyes = 0;
      const erreurs: string[] = [];
      for (const client of clients) {
        if (!client.telephone) continue;
        const res = await envoyerMessageWhatsApp({ telephone: client.telephone, message });
        if (res.succes) envoyes++;
        else erreurs.push(client.telephone);
        await new Promise((r) => setTimeout(r, 100)); // éviter le rate limiting
      }

      return {
        succes: envoyes > 0,
        resultat: `Diffusion WhatsApp : ${envoyes}/${clients.length} messages envoyés${erreurs.length > 0 ? ` (${erreurs.length} échecs)` : ""} ✓`,
      };
    }

    if (toolName === "whatsapp_envoyer_template") {
      const res = await envoyerTemplateWhatsApp({ telephone: args.telephone, templateNom: args.template_nom, variables: args.variables });
      if (!res.succes) return { succes: false, resultat: `Erreur template WhatsApp : ${res.erreur}` };
      return { succes: true, resultat: `Template "${args.template_nom}" envoyé à ${args.telephone} ✓` };
    }

    // ── GMAIL ────────────────────────────────────────────────────────────────
    if (toolName === "gmail_envoyer") {
      const accessToken = await getGmailToken(tenantId);
      if (!accessToken) return { succes: false, resultat: "Gmail non connecté — allez dans Connecteurs pour autoriser l'accès" };

      const res = await envoyerGmail({ accessToken, a: args.destinataire, sujet: args.sujet, corpsHtml: args.corps_html, cc: args.copie });
      if (!res.succes) return { succes: false, resultat: `Erreur Gmail : ${res.erreur}` };
      return { succes: true, resultat: `Email Gmail envoyé à ${args.destinataire} ✓` };
    }

    if (toolName === "gmail_campagne") {
      const accessToken = await getGmailToken(tenantId);
      if (!accessToken) return { succes: false, resultat: "Gmail non connecté" };

      const clients = await prisma.client.findMany({
        where: {
          tenantId,
          email: { not: "" },
          ...(args.segment === "vip" && { totalDepense: { gte: 50000 } }),
          ...(args.segment === "inactifs" && { createdAt: { lte: new Date(Date.now() - 30 * 24 * 3600 * 1000) } }),
          ...(args.segment === "nouveaux" && { totalCommandes: 0 }),
        },
        take: 100,
      });

      let envoyes = 0;
      for (const client of clients) {
        if (!client.email) continue;
        const corps = args.corps_html.replace(/\{\{nom\}\}/g, client.nom ?? "");
        await envoyerGmail({ accessToken, a: client.email, sujet: args.sujet, corpsHtml: corps });
        envoyes++;
        await new Promise((r) => setTimeout(r, 200));
      }
      return { succes: true, resultat: `Campagne Gmail envoyée à ${envoyes} client(s) ✓` };
    }

    // ── SMS ──────────────────────────────────────────────────────────────────
    if (toolName === "sms_envoyer") {
      const res = await envoyerSMS({ telephone: args.telephone, message: args.message });
      if (!res.succes) return { succes: false, resultat: `Erreur SMS : ${res.erreur}` };
      return { succes: true, resultat: `SMS envoyé à ${args.telephone} ✓` };
    }

    if (toolName === "sms_campagne") {
      const clients = await prisma.client.findMany({
        where: {
          tenantId,
          telephone: { not: "" },
          ...(args.segment === "vip" && { totalDepense: { gte: 50000 } }),
          ...(args.segment === "inactifs" && { createdAt: { lte: new Date(Date.now() - 30 * 24 * 3600 * 1000) } }),
        },
        take: 500,
      });

      const telephones = clients.map((c) => c.telephone!).filter(Boolean);
      const res = await envoyerSMSMasse({ telephones, message: args.message });
      return {
        succes: res.succes,
        resultat: `SMS en masse : ${res.envoyes} envoyés, ${res.echecs} échecs`,
        donnees: res,
      };
    }

    // ── HIGGSFIELD ────────────────────────────────────────────────────────────
    if (toolName.startsWith("higgsfield_")) {
      const higgsCfg = await getConfig(tenantId, "higgsfield");
      const apiKey = higgsCfg?.accessToken || process.env.HIGGSFIELD_API_KEY;
      if (!apiKey) return { succes: false, resultat: "Higgsfield non connecté — allez dans Connecteurs → Higgsfield AI pour saisir votre clé API" };

      if (toolName === "higgsfield_lister_outils") {
        const outils = await listerOutilsHiggsfield(apiKey);
        return { succes: true, resultat: JSON.stringify(outils.map((o) => ({ nom: o.name, description: o.description }))), donnees: outils };
      }

      if (toolName === "higgsfield_generer_video") {
        const res = await genererVideoHiggsfield({
          prompt: args.prompt,
          model: args.model,
          duration: args.duration,
          aspectRatio: args.aspect_ratio,
          style: args.style,
          apiKey,
        });
        if (!res.succes) return { succes: false, resultat: res.resultat };

        // Sauvegarder dans VideoGeneree
        if (res.videoUrl) {
          await prisma.videoGeneree.create({
            data: { tenantId, prompt: args.prompt, style: args.style ?? "product", videoUrl: res.videoUrl, statut: "pret" },
          });
        }
        return { succes: true, resultat: `Vidéo générée ✓${res.videoUrl ? `\n[VIDEO:${res.videoUrl}]` : ""}`, donnees: res };
      }

      if (toolName === "higgsfield_generer_image") {
        const res = await genererImageHiggsfield({
          prompt: args.prompt,
          model: args.model,
          style: args.style,
          width: args.width,
          height: args.height,
          apiKey,
        });
        if (!res.succes) return { succes: false, resultat: res.resultat };
        return { succes: true, resultat: `Image générée ✓${res.imageUrl ? `\n[IMAGE:${res.imageUrl}]` : ""}`, donnees: res };
      }

      if (toolName === "higgsfield_video_produit") {
        const produit = await prisma.produit.findUnique({ where: { id: args.produitId, tenantId } });
        if (!produit) return { succes: false, resultat: "Produit introuvable" };

        const prompt = `Professional e-commerce product video for "${produit.nom}". ${produit.description ?? ""} High-quality ${args.style ?? "commercial"} style, African market, ultra HD.`;
        const res = await genererVideoHiggsfield({ prompt, model: args.model ?? "kling-3.0", style: args.style ?? "commercial", duration: 10, aspectRatio: "16:9", apiKey });

        if (!res.succes) return { succes: false, resultat: res.resultat };
        if (res.videoUrl) {
          await prisma.videoGeneree.create({ data: { tenantId, prompt, style: args.style ?? "commercial", videoUrl: res.videoUrl, statut: "pret" } });
          await prisma.produit.update({ where: { id: args.produitId }, data: { videos: { push: res.videoUrl } } });
        }
        return { succes: true, resultat: `Vidéo produit "${produit.nom}" générée ✓`, donnees: res };
      }

      if (toolName === "higgsfield_appeler_outil") {
        const res = await appellerOutilHiggsfield(args.outil, args.arguments ?? {}, apiKey);
        return res;
      }
    }

    // ── GEMINI (Google) ──────────────────────────────────────────────────────
    if (toolName.startsWith("gemini_")) {
      const geminiCfg = await getConfig(tenantId, "gemini");
      const apiKey = geminiCfg?.accessToken || process.env.GEMINI_API_KEY;
      if (!apiKey) return { succes: false, resultat: "Gemini non connecté — allez dans Connecteurs → Gemini IA pour saisir votre clé API Google" };

      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { nomBoutique: true, devise: true } });
      const boutique = tenant?.nomBoutique ?? "Ma boutique";
      const devise = tenant?.devise ?? "XAF";

      if (toolName === "gemini_generer_texte") {
        return genererTexte({ prompt: args.prompt, contexte: args.contexte, apiKey });
      }
      if (toolName === "gemini_generer_email_html") {
        return genererEmailHtml({ sujet: args.sujet, contexte: args.contexte, boutique, couleurPrimaire: args.couleurPrimaire, apiKey });
      }
      if (toolName === "gemini_generer_description_produit") {
        return genererDescriptionProduit({ nomProduit: args.nomProduit, categorie: args.categorie, prix: args.prix, devise, langue: args.langue, apiKey });
      }
      if (toolName === "gemini_generer_post_social") {
        return genererPostSocial({ plateforme: args.plateforme, theme: args.theme, boutique, produit: args.produit, apiKey });
      }
      if (toolName === "gemini_traduire") {
        return traduire({ texte: args.texte, langueCible: args.langueCible, langueSource: args.langueSource, apiKey });
      }
      if (toolName === "gemini_analyser_image") {
        return analyserImageProduit({ imageUrl: args.imageUrl, question: args.question, apiKey });
      }
    }

    return { succes: false, resultat: `Outil MCP inconnu : ${toolName}` };
  } catch (err) {
    return { succes: false, resultat: `Erreur MCP : ${err instanceof Error ? err.message : String(err)}` };
  }
}
