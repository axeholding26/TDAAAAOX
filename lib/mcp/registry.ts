// Registre MCP Axso — liste tous les connecteurs et leurs outils disponibles
// Inspiré du Model Context Protocol : chaque connecteur expose des "tools" que les agents peuvent appeler

export type ConnecteurType = "meta" | "whatsapp" | "gmail" | "google_ads" | "tiktok" | "sms" | "higgsfield" | "gemini";

export interface McpTool {
  name: string;
  description: string;
  connecteur: ConnecteurType;
  parameters: Record<string, any>;
}

export interface ConnecteurDef {
  type: ConnecteurType;
  nom: string;
  description: string;
  icone: string;
  couleur: string;
  outils: McpTool[];
  scopes?: string[];
  oauthUrl?: string;
}

export const MCP_CONNECTEURS: ConnecteurDef[] = [
  {
    type: "meta",
    nom: "Meta (Facebook & Instagram)",
    description: "Publier des posts, stories, reels sur Facebook et Instagram. Créer et gérer des campagnes Meta Ads.",
    icone: "📘",
    couleur: "#1877F2",
    outils: [
      {
        name: "meta_poster_facebook",
        description: "Publie un post texte + image sur la page Facebook de la boutique",
        connecteur: "meta",
        parameters: {
          type: "object",
          properties: {
            message: { type: "string", description: "Texte du post Facebook" },
            imageUrl: { type: "string", description: "URL de l'image (optionnel)" },
            lienUrl: { type: "string", description: "Lien à inclure (optionnel)" },
          },
          required: ["message"],
        },
      },
      {
        name: "meta_poster_instagram",
        description: "Publie une photo ou un carousel sur le compte Instagram de la boutique",
        connecteur: "meta",
        parameters: {
          type: "object",
          properties: {
            caption: { type: "string", description: "Légende Instagram avec hashtags" },
            imageUrl: { type: "string", description: "URL de l'image (obligatoire)" },
            type: { type: "string", enum: ["IMAGE", "REELS"], description: "Type de post" },
          },
          required: ["caption", "imageUrl"],
        },
      },
      {
        name: "meta_planifier_post",
        description: "Programme un post Facebook ou Instagram pour une date/heure future",
        connecteur: "meta",
        parameters: {
          type: "object",
          properties: {
            plateforme: { type: "string", enum: ["facebook", "instagram"] },
            contenu: { type: "string" },
            imageUrl: { type: "string" },
            planifieLe: { type: "string", description: "ISO 8601 : 2026-06-15T18:00:00" },
          },
          required: ["plateforme", "contenu", "planifieLe"],
        },
      },
      {
        name: "meta_creer_campagne_ads",
        description: "Crée une campagne publicitaire Meta Ads (Facebook + Instagram) avec budget et ciblage",
        connecteur: "meta",
        parameters: {
          type: "object",
          properties: {
            nom: { type: "string" },
            objectif: { type: "string", enum: ["OUTCOME_TRAFFIC", "OUTCOME_SALES", "OUTCOME_LEADS", "OUTCOME_AWARENESS"] },
            budget_jour: { type: "number", description: "Budget journalier en XAF/USD" },
            pays: { type: "array", items: { type: "string" }, description: "Codes pays : SN, CM, CI, NG..." },
            age_min: { type: "number" },
            age_max: { type: "number" },
            url_destination: { type: "string" },
          },
          required: ["nom", "objectif", "budget_jour"],
        },
      },
      {
        name: "meta_stats_page",
        description: "Récupère les statistiques de la page Facebook (fans, portée, engagement)",
        connecteur: "meta",
        parameters: { type: "object", properties: {}, required: [] },
      },
    ],
  },
  {
    type: "whatsapp",
    nom: "WhatsApp Business",
    description: "Envoyer des messages individuels ou en masse, templates approuvés Meta, chatbot automatique.",
    icone: "📱",
    couleur: "#25D366",
    outils: [
      {
        name: "whatsapp_envoyer_message",
        description: "Envoie un message WhatsApp à un numéro de téléphone",
        connecteur: "whatsapp",
        parameters: {
          type: "object",
          properties: {
            telephone: { type: "string", description: "Numéro avec indicatif : +221701234567" },
            message: { type: "string" },
          },
          required: ["telephone", "message"],
        },
      },
      {
        name: "whatsapp_diffusion",
        description: "Envoie un message à tous les clients de la boutique (ou un segment)",
        connecteur: "whatsapp",
        parameters: {
          type: "object",
          properties: {
            message: { type: "string", description: "Message à diffuser (max 1024 chars)" },
            segment: { type: "string", enum: ["tous", "vip", "inactifs", "nouveaux"], description: "Segment clients" },
            code_promo: { type: "string", description: "Code promo à inclure (optionnel)" },
          },
          required: ["message"],
        },
      },
      {
        name: "whatsapp_envoyer_template",
        description: "Envoie un template WhatsApp approuvé (pour notifications commande, livraison...)",
        connecteur: "whatsapp",
        parameters: {
          type: "object",
          properties: {
            telephone: { type: "string" },
            template_nom: { type: "string", description: "Nom du template approuvé" },
            variables: { type: "array", items: { type: "string" }, description: "Variables du template" },
          },
          required: ["telephone", "template_nom"],
        },
      },
    ],
  },
  {
    type: "gmail",
    nom: "Gmail",
    description: "Envoyer des emails depuis votre compte Gmail professionnel avec pièces jointes et HTML.",
    icone: "📧",
    couleur: "#EA4335",
    oauthUrl: "/api/mcp/oauth/google",
    outils: [
      {
        name: "gmail_envoyer",
        description: "Envoie un email depuis votre Gmail avec contenu HTML",
        connecteur: "gmail",
        parameters: {
          type: "object",
          properties: {
            destinataire: { type: "string", description: "Email du destinataire" },
            sujet: { type: "string" },
            corps_html: { type: "string", description: "Corps de l'email en HTML" },
            copie: { type: "string", description: "Email en copie CC (optionnel)" },
          },
          required: ["destinataire", "sujet", "corps_html"],
        },
      },
      {
        name: "gmail_campagne",
        description: "Envoie un email en masse à un segment de clients via Gmail",
        connecteur: "gmail",
        parameters: {
          type: "object",
          properties: {
            sujet: { type: "string" },
            corps_html: { type: "string" },
            segment: { type: "string", enum: ["tous", "vip", "inactifs", "nouveaux"] },
          },
          required: ["sujet", "corps_html", "segment"],
        },
      },
    ],
  },
  {
    type: "google_ads",
    nom: "Google Ads",
    description: "Créer et gérer des campagnes Search et Display sur Google pour cibler les acheteurs africains.",
    icone: "🎯",
    couleur: "#4285F4",
    outils: [
      {
        name: "google_ads_creer_campagne",
        description: "Crée une campagne Google Ads Search avec mots-clés et budget",
        connecteur: "google_ads",
        parameters: {
          type: "object",
          properties: {
            nom: { type: "string" },
            budget_jour: { type: "number" },
            mots_cles: { type: "array", items: { type: "string" } },
            url_destination: { type: "string" },
            pays: { type: "array", items: { type: "string" } },
          },
          required: ["nom", "budget_jour", "mots_cles", "url_destination"],
        },
      },
      {
        name: "google_ads_stats",
        description: "Récupère les performances des campagnes Google Ads (clics, coût, conversions)",
        connecteur: "google_ads",
        parameters: {
          type: "object",
          properties: {
            periode_jours: { type: "number", description: "Période en jours (défaut: 30)" },
          },
          required: [],
        },
      },
    ],
  },
  {
    type: "tiktok",
    nom: "TikTok",
    description: "Publier des vidéos courtes sur TikTok pour toucher les jeunes consommateurs africains.",
    icone: "🎵",
    couleur: "#010101",
    outils: [
      {
        name: "tiktok_planifier_video",
        description: "Programme une vidéo TikTok pour publication automatique",
        connecteur: "tiktok",
        parameters: {
          type: "object",
          properties: {
            videoUrl: { type: "string", description: "URL de la vidéo MP4" },
            description: { type: "string", description: "Texte + hashtags" },
            planifieLe: { type: "string", description: "ISO 8601" },
          },
          required: ["videoUrl", "description", "planifieLe"],
        },
      },
    ],
  },
  {
    type: "sms",
    nom: "SMS (Africa's Talking)",
    description: "Envoyer des SMS en masse à vos clients partout en Afrique via Africa's Talking.",
    icone: "💬",
    couleur: "#FF6B35",
    outils: [
      {
        name: "sms_envoyer",
        description: "Envoie un SMS à un numéro de téléphone africain",
        connecteur: "sms",
        parameters: {
          type: "object",
          properties: {
            telephone: { type: "string", description: "Numéro avec indicatif : +221701234567" },
            message: { type: "string", description: "SMS (max 160 chars)" },
          },
          required: ["telephone", "message"],
        },
      },
      {
        name: "sms_campagne",
        description: "Envoie un SMS en masse à un segment de clients",
        connecteur: "sms",
        parameters: {
          type: "object",
          properties: {
            message: { type: "string" },
            segment: { type: "string", enum: ["tous", "vip", "inactifs"] },
          },
          required: ["message", "segment"],
        },
      },
    ],
  },
  // ── HIGGSFIELD ──────────────────────────────────────────────────────────────
  {
    type: "higgsfield",
    nom: "Higgsfield AI",
    description: "Génération vidéo et image ultra HD avec 30+ modèles IA (Kling 3.0, Veo 3.1, Sora 2). Vidéos produit, campagnes cinématiques, visuels 3D.",
    icone: "🎬",
    couleur: "#6366f1",
    outils: [
      {
        name: "higgsfield_generer_video",
        description: "Génère une vidéo ultra HD depuis un prompt texte (Kling 3.0, Veo 3.1, Sora 2, Cinema Studio 3.5...)",
        connecteur: "higgsfield",
        parameters: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "Description détaillée de la vidéo à générer" },
            model: { type: "string", description: "Modèle : kling-3.0, veo-3.1, sora-2, cinema-3.5, seedance-2.0", enum: ["kling-3.0", "veo-3.1", "sora-2", "cinema-3.5", "seedance-2.0", "minimax-02"] },
            duration: { type: "number", description: "Durée en secondes (5 ou 10)" },
            aspect_ratio: { type: "string", description: "Format : 16:9, 9:16, 1:1", enum: ["16:9", "9:16", "1:1"] },
            style: { type: "string", description: "Style : cinematic, commercial, ugc, product, lifestyle" },
          },
          required: ["prompt"],
        },
      },
      {
        name: "higgsfield_generer_image",
        description: "Génère une image ultra HD (Recraft 4.1, GPT Image, Seedream 4.0, Wan 2.5)",
        connecteur: "higgsfield",
        parameters: {
          type: "object",
          properties: {
            prompt: { type: "string" },
            model: { type: "string", enum: ["recraft-4.1", "gpt-image", "seedream-4.0", "wan-2.5"], description: "Modèle de génération image" },
            style: { type: "string", description: "Style : photorealistic, illustration, 3d, cinematic" },
            width: { type: "number" },
            height: { type: "number" },
          },
          required: ["prompt"],
        },
      },
      {
        name: "higgsfield_video_produit",
        description: "Génère une vidéo produit e-commerce ultra professionnelle depuis le nom/description d'un produit",
        connecteur: "higgsfield",
        parameters: {
          type: "object",
          properties: {
            produitId: { type: "string", description: "ID du produit Axso" },
            style: { type: "string", enum: ["commercial", "lifestyle", "ugc", "cinematic"], description: "Style de la vidéo produit" },
            model: { type: "string", description: "Modèle vidéo à utiliser" },
          },
          required: ["produitId"],
        },
      },
      {
        name: "higgsfield_appeler_outil",
        description: "Appelle n'importe quel outil Higgsfield MCP disponible (accès brut à tous les 40+ outils)",
        connecteur: "higgsfield",
        parameters: {
          type: "object",
          properties: {
            outil: { type: "string", description: "Nom exact de l'outil Higgsfield MCP" },
            arguments: { type: "object", description: "Arguments de l'outil" },
          },
          required: ["outil"],
        },
      },
      {
        name: "higgsfield_lister_outils",
        description: "Liste tous les outils disponibles sur le serveur MCP Higgsfield de l'utilisateur",
        connecteur: "higgsfield",
        parameters: { type: "object", properties: {}, required: [] },
      },
    ],
  },
  {
    type: "gemini",
    nom: "Gemini IA (Google)",
    description: "Génération de texte, descriptions produits, posts sociaux, emails HTML, traduction en langues africaines, analyse d'images.",
    icone: "✨",
    couleur: "#4285F4",
    outils: [
      {
        name: "gemini_generer_texte",
        description: "Génère du texte libre avec Gemini (réponses, scripts, contenus)",
        connecteur: "gemini",
        parameters: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "Instruction ou question à envoyer à Gemini" },
            contexte: { type: "string", description: "Contexte système optionnel" },
          },
          required: ["prompt"],
        },
      },
      {
        name: "gemini_generer_email_html",
        description: "Génère un email marketing HTML complet prêt à envoyer",
        connecteur: "gemini",
        parameters: {
          type: "object",
          properties: {
            sujet: { type: "string" },
            contexte: { type: "string", description: "Objectif et contenu de l'email" },
            couleurPrimaire: { type: "string", description: "Code couleur hex (ex: #F5A623)" },
          },
          required: ["sujet", "contexte"],
        },
      },
      {
        name: "gemini_generer_description_produit",
        description: "Génère une description produit optimisée pour la boutique",
        connecteur: "gemini",
        parameters: {
          type: "object",
          properties: {
            nomProduit: { type: "string" },
            categorie: { type: "string" },
            prix: { type: "number" },
            langue: { type: "string", description: "fr | en | wo | ha | sw | yo | ig", default: "fr" },
          },
          required: ["nomProduit"],
        },
      },
      {
        name: "gemini_generer_post_social",
        description: "Génère un post optimisé pour Instagram, Facebook, TikTok ou WhatsApp",
        connecteur: "gemini",
        parameters: {
          type: "object",
          properties: {
            plateforme: { type: "string", enum: ["instagram", "facebook", "tiktok", "whatsapp"] },
            theme: { type: "string", description: "promotion | nouveau_produit | temoignage | evenement | storytelling" },
            produit: { type: "string", description: "Nom du produit à mettre en avant (optionnel)" },
          },
          required: ["plateforme", "theme"],
        },
      },
      {
        name: "gemini_traduire",
        description: "Traduit du contenu en langues africaines (wolof, haoussa, swahili, yoruba, igbo, twi…)",
        connecteur: "gemini",
        parameters: {
          type: "object",
          properties: {
            texte: { type: "string" },
            langueCible: { type: "string", description: "fr | en | wo | ha | sw | am | yo | ig | tw" },
            langueSource: { type: "string", description: "Langue source (optionnel, auto-détecté)" },
          },
          required: ["texte", "langueCible"],
        },
      },
      {
        name: "gemini_analyser_image",
        description: "Analyse une image produit et génère une description ou répond à une question",
        connecteur: "gemini",
        parameters: {
          type: "object",
          properties: {
            imageUrl: { type: "string", description: "URL publique de l'image" },
            question: { type: "string", description: "Question sur l'image (optionnel)" },
          },
          required: ["imageUrl"],
        },
      },
    ],
  },
];

export function getOutilsMcp(connecteurs: ConnecteurType[]): McpTool[] {
  return MCP_CONNECTEURS
    .filter((c) => connecteurs.includes(c.type))
    .flatMap((c) => c.outils);
}

export function getConnecteurDef(type: ConnecteurType): ConnecteurDef | undefined {
  return MCP_CONNECTEURS.find((c) => c.type === type);
}
