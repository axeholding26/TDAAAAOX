import { completionAuto } from "./llm-client";
import { generateProductImageUrl, buildProductImagePrompt } from "./image-gen";
import { selectionnerGabaritLibrairie } from "./axso-design-manifest";

export interface PlanProduit {
  nom: string;
  description: string;
  prix: number;
  stock: number;
  categorie: string;
  type?: "physique" | "digital";
}

export interface PlanLivraison {
  locale: number;
  nationale: number;
  gratuite: number;
}

export interface PlanSection {
  type: "features" | "gallery" | "cta-band" | "stats" | "richtext";
  label: string;
  config: Record<string, any>;
}

export interface PlanBoutique {
  nomBoutique: string;
  slug: string;
  categorie: string;
  pays: string;
  devise: string;
  // Fichier de la bibliothèque AXSO Design (ex: "aube-site") choisi
  // automatiquement d'après `categorie` — voir selectionnerGabaritLibrairie.
  // Ce n'est plus l'IA qui choisit un thème parmi un enum figé : le champ
  // est calculé après coup dans analyserBusinessEtCreerPlan (ci-dessous).
  themeId: string;
  description: string;
  produits: PlanProduit[];
  livraison: PlanLivraison;
  sections?: PlanSection[];
}

// Carte devise par code pays ISO2 — couverture mondiale
export const PAYS_DEVISES: Record<string, string> = {
  // Afrique de l'Ouest CFA
  SN: "XOF", CI: "XOF", TG: "XOF", BJ: "XOF", ML: "XOF", BF: "XOF", GN: "GNF", NE: "XOF",
  // Afrique Centrale CFA
  CM: "XAF", GA: "XAF", CG: "XAF", TD: "XAF", CF: "XAF", CD: "CDF",
  // Afrique subsaharienne
  GH: "GHS", NG: "NGN", KE: "KES", ZA: "ZAR", ET: "ETB", TZ: "TZS",
  UG: "UGX", RW: "RWF", MZ: "MZN", AO: "AOA", ZM: "ZMW", ZW: "USD",
  // Afrique du Nord
  MA: "MAD", DZ: "DZD", TN: "TND", EG: "EGP", LY: "LYD",
  // Europe
  FR: "EUR", DE: "EUR", ES: "EUR", IT: "EUR", PT: "EUR", NL: "EUR", BE: "EUR",
  GB: "GBP", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN",
  // Amérique du Nord
  US: "USD", CA: "CAD", MX: "MXN",
  // Amérique Latine
  BR: "BRL", AR: "ARS", CO: "COP", CL: "CLP", PE: "PEN", VE: "USD",
  // Asie
  CN: "CNY", JP: "JPY", IN: "INR", ID: "IDR", PH: "PHP", TH: "THB",
  VN: "VND", SG: "SGD", MY: "MYR", KR: "KRW", PK: "PKR", BD: "BDT",
  // Moyen-Orient
  AE: "AED", SA: "SAR", QA: "QAR", KW: "KWD", BH: "BHD", OM: "OMR",
  TR: "TRY", IL: "ILS", LB: "USD",
  // Océanie
  AU: "AUD", NZ: "NZD",
};

const PROMPT_ANALYSTE = `Tu es AXIA, l'agent IA d'Axso — la plateforme e-commerce mondiale propulsée par l'IA.
Tu aides les entrepreneurs du monde entier à lancer leur boutique en ligne.
Analyse la description du business et génère un plan de boutique complet en JSON.

Règles strictes :
- pays : code ISO 2 lettres (ex: SN, FR, US, MA, NG, DE, BR, AE, etc.) — détecte le pays depuis la description
- devise : adapte à la devise locale du pays (EUR pour France, USD pour USA, XOF pour Sénégal, GBP pour UK, etc.)
- slug : lettres minuscules, chiffres, tirets seulement (ex: mode-aminata, tech-paris, shop-dubai)
- Propose 3 à 5 produits représentatifs avec des prix réalistes en devise locale
- Si la boutique vend des produits digitaux (ebooks, formations, templates, musique, logiciels, NFT, etc.), mets "type": "digital" sur chaque produit et stock: 999
- Pour les produits physiques, omets le champ type (il sera "physique" par défaut)
- Prix livraison locale adaptés au pays et au contexte (0 si digital)
- Crée entre 2 et 4 sections pertinentes pour la boutique
- Pour les sections "gallery", génère 3 descriptions d'images précises en anglais (tu ne mets que le texte descriptif, l'image sera générée automatiquement)
- Réponds UNIQUEMENT avec le JSON, aucun texte avant ou après

Format JSON attendu :
{
  "nomBoutique": "...",
  "slug": "...",
  "categorie": "...",
  "pays": "...",
  "devise": "...",
  "description": "...",
  "messageIA": "Message chaleureux expliquant le plan en 2-3 phrases avec des emojis",
  "produits": [
    { "nom": "...", "description": "...", "prix": 0, "stock": 10, "categorie": "...", "type": "physique" }
  ],
  "livraison": { "locale": 0, "nationale": 0, "gratuite": 0 },
  "sections": [
    {
      "type": "features",
      "label": "Nos avantages",
      "config": {
        "titre": "Pourquoi nous choisir ?",
        "items": [
          { "icone": "🚀", "titre": "Livraison rapide", "description": "..." },
          { "icone": "✨", "titre": "Qualité garantie", "description": "..." },
          { "icone": "🔒", "titre": "Paiement sécurisé", "description": "..." }
        ]
      }
    },
    {
      "type": "gallery",
      "label": "Galerie",
      "config": {
        "titre": "Notre univers",
        "imagePrompts": ["detailed description of image 1 in english", "detailed description of image 2 in english", "detailed description of image 3 in english"]
      }
    }
  ]
}`;

// Tente d'extraire et parser le JSON du texte retourné par le modèle
function extraireJSON(texte: string): any {
  const json = texte.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error("L'IA n'a pas retourné de plan JSON valide");
  return JSON.parse(json);
}

export async function analyserBusinessEtCreerPlan(
  description: string
): Promise<PlanBoutique & { messageIA: string }> {

  const messages = [
    { role: "system" as const, content: PROMPT_ANALYSTE },
    { role: "user" as const, content: description },
  ];

  // Essaie jusqu'à 3 fois avec la chaîne de fallback automatique
  let texte = "";
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await completionAuto(messages, 2000);
      texte = result.text;
      // Vérifie que la réponse contient bien du JSON avant d'accepter
      if (texte.includes("{")) break;
    } catch (e: any) {
      lastError = e;
    }
  }

  if (!texte || !texte.includes("{")) {
    throw new Error(lastError?.message ?? "Aucun fournisseur IA disponible — réessaie dans quelques secondes");
  }

  const plan = extraireJSON(texte);

  // Corriger la devise selon le pays (carte mondiale)
  if (plan.pays && PAYS_DEVISES[plan.pays]) {
    plan.devise = PAYS_DEVISES[plan.pays];
  }

  // Design de la bibliothèque AXSO Design le plus proche de la catégorie —
  // déterministe, aucun appel IA supplémentaire (voir Templates/*.html).
  plan.themeId = selectionnerGabaritLibrairie(plan.categorie || "").fichier;

  // Génère les visuels produits via Gemini dès la création de la boutique
  // (échec silencieux par image — ne doit jamais faire échouer la création de boutique)
  if (Array.isArray(plan.produits)) {
    plan.produits = await Promise.all(plan.produits.map(async (p: any) => ({
      ...p,
      imageUrl: await generateProductImageUrl(buildProductImagePrompt(p.nom, p.categorie || plan.categorie)),
    })));
  }

  // Convertit les imagePrompts des sections gallery en vraies images Gemini
  if (Array.isArray(plan.sections)) {
    plan.sections = await Promise.all(plan.sections.map(async (section: any) => {
      if (section.type === "gallery" && Array.isArray(section.config?.imagePrompts)) {
        const images = await Promise.all(
          section.config.imagePrompts.map((prompt: string) => generateProductImageUrl(prompt))
        );
        return { ...section, config: { ...section.config, images, imagePrompts: undefined } };
      }
      return section;
    }));
  }

  return plan;
}

// Outils pour le copilote dashboard (tool use — moteur Gemini)
interface CopiloteTool {
  name: string;
  description: string;
  input_schema: Record<string, any>;
}

export const OUTILS_COPILOTE: CopiloteTool[] = [
  {
    name: "ajouter_produit",
    description: "Ajoute un nouveau produit à la boutique du marchand",
    input_schema: {
      type: "object" as const,
      properties: {
        nom: { type: "string", description: "Nom du produit" },
        description: { type: "string", description: "Description du produit" },
        prix: { type: "number", description: "Prix en devise locale" },
        stock: { type: "number", description: "Quantité en stock" },
        categorie: { type: "string", description: "Catégorie du produit" },
      },
      required: ["nom", "prix", "categorie"],
    },
  },
  {
    name: "creer_code_promo",
    description: "Crée un code promo pour la boutique",
    input_schema: {
      type: "object" as const,
      properties: {
        code: { type: "string", description: "Code promo (ex: PROMO20)" },
        type: { type: "string", enum: ["pourcentage", "montant_fixe"], description: "Type de réduction" },
        valeur: { type: "number", description: "Valeur de la réduction" },
        minCommande: { type: "number", description: "Montant minimum de commande" },
      },
      required: ["code", "type", "valeur"],
    },
  },
  {
    name: "modifier_theme",
    description: "Change le design visuel de la boutique — provisionne un nouveau design de la bibliothèque AXSO Design adapté à une catégorie/ambiance, avec les vrais produits du marchand déjà branchés",
    input_schema: {
      type: "object" as const,
      properties: {
        categorie: {
          type: "string",
          description: "Catégorie/ambiance recherchée (ex: 'bijoux', 'mode', 'tech', 'beauté') — sert à choisir le design le plus proche dans la bibliothèque",
        },
      },
      required: ["categorie"],
    },
  },
  {
    name: "lire_statistiques",
    description: "Lit les statistiques de ventes et commandes récentes",
    input_schema: {
      type: "object" as const,
      properties: {
        periode: { type: "string", enum: ["7j", "30j", "90j"], description: "Période d'analyse" },
      },
      required: ["periode"],
    },
  },
];
