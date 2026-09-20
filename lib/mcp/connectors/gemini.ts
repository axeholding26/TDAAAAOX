// Connecteur MCP Gemini (Google) — génération de texte, email HTML, traduction, analyse
// Chaque tenant peut utiliser sa propre clé API Gemini ou la clé globale Axso

import { GoogleGenAI } from "@google/genai";

export interface GeminiResult {
  succes: boolean;
  resultat: string;
  donnees?: any;
}

const MODEL = "gemini-3.5-flash";

function getClient(apiKey: string) {
  return new GoogleGenAI({ apiKey });
}

// ── Génération de texte libre ─────────────────────────────────────────────────
export async function genererTexte(params: {
  prompt: string;
  contexte?: string;
  maxTokens?: number;
  apiKey: string;
}): Promise<GeminiResult> {
  try {
    const client = getClient(params.apiKey);
    const systemInstruction = params.contexte ?? "Tu es un assistant expert en e-commerce africain. Tu réponds de manière concise et adaptée au contexte local.";
    const response = await client.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: params.prompt }] }],
      config: { systemInstruction, maxOutputTokens: params.maxTokens ?? 1024, thinkingConfig: { thinkingBudget: 0 } },
    });
    return { succes: true, resultat: response.text ?? "" };
  } catch (err: any) {
    return { succes: false, resultat: `Erreur Gemini : ${err.message}` };
  }
}

// ── Génération d'email HTML complet ──────────────────────────────────────────
export async function genererEmailHtml(params: {
  sujet: string;
  contexte: string;
  boutique: string;
  couleurPrimaire?: string;
  apiKey: string;
}): Promise<GeminiResult> {
  try {
    const client = getClient(params.apiKey);
    const prompt = `Génère un email marketing HTML complet pour la boutique "${params.boutique}".
Sujet : ${params.sujet}
Contexte : ${params.contexte}
Couleur principale : ${params.couleurPrimaire ?? "#F5A623"}

Exigences :
- HTML complet avec styles inline
- Design responsive, max 600px
- Adapté au marché africain (ton chaleureux, émojis, appel à l'action fort)
- Variables autorisées : {{prenom}}, {{boutique}}
- Bouton CTA visible
- Footer avec lien de désabonnement

Retourne UNIQUEMENT le HTML complet, sans commentaires.`;

    const response = await client.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 0 } },
    });
    const html = response.text ?? "";
    return { succes: true, resultat: html, donnees: { longueur: html.length } };
  } catch (err: any) {
    return { succes: false, resultat: `Erreur Gemini Email : ${err.message}` };
  }
}

// ── Génération de description produit ────────────────────────────────────────
export async function genererDescriptionProduit(params: {
  nomProduit: string;
  categorie?: string;
  prix?: number;
  devise?: string;
  langue?: string;
  apiKey: string;
}): Promise<GeminiResult> {
  try {
    const client = getClient(params.apiKey);
    const langue = params.langue ?? "français";
    const prompt = `Rédige une description produit accrocheuse en ${langue} pour :
Produit : ${params.nomProduit}
Catégorie : ${params.categorie ?? "non spécifiée"}
${params.prix ? `Prix : ${params.prix} ${params.devise ?? "XAF"}` : ""}

Style : persuasif, adapté au e-commerce africain, 80-120 mots, mets en avant la qualité et la valeur. Pas de hashtags.`;

    const response = await client.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 512, thinkingConfig: { thinkingBudget: 0 } },
    });
    return { succes: true, resultat: response.text ?? "" };
  } catch (err: any) {
    return { succes: false, resultat: `Erreur Gemini : ${err.message}` };
  }
}

// ── Génération de post social ─────────────────────────────────────────────────
export async function genererPostSocial(params: {
  plateforme: "instagram" | "facebook" | "tiktok" | "whatsapp";
  theme: string;
  boutique: string;
  produit?: string;
  apiKey: string;
}): Promise<GeminiResult> {
  try {
    const client = getClient(params.apiKey);
    const spec: Record<string, string> = {
      instagram: "Max 2200 chars, 5-10 hashtags pertinents, émojis, CTA fort",
      facebook: "Max 500 chars, ton conversationnel, lien naturel, 1-3 hashtags",
      tiktok: "Texte court pour description vidéo, TikTok hook, hashtags viraux",
      whatsapp: "Message court et direct, pas de hashtags, WhatsApp Business friendly",
    };
    const prompt = `Génère un post ${params.plateforme} pour la boutique "${params.boutique}".
Thème : ${params.theme}
${params.produit ? `Produit : ${params.produit}` : ""}
Spécifications : ${spec[params.plateforme]}
Marché : Afrique francophone. Ton local, authentique, engageant.`;

    const response = await client.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 768, thinkingConfig: { thinkingBudget: 0 } },
    });
    return { succes: true, resultat: response.text ?? "" };
  } catch (err: any) {
    return { succes: false, resultat: `Erreur Gemini : ${err.message}` };
  }
}

// ── Traduction multilingue africaine ──────────────────────────────────────────
export async function traduire(params: {
  texte: string;
  langueSource?: string;
  langueCible: string;
  apiKey: string;
}): Promise<GeminiResult> {
  try {
    const client = getClient(params.apiKey);
    const LANGUES: Record<string, string> = {
      fr: "Français",
      en: "Anglais",
      wo: "Wolof (Sénégal)",
      ha: "Haoussa (Nigeria/Niger)",
      sw: "Swahili (Kenya/Tanzanie/RDC)",
      am: "Amharique (Éthiopie)",
      yo: "Yoruba (Nigeria)",
      ig: "Igbo (Nigeria)",
      tw: "Twi (Ghana)",
    };
    const cible = LANGUES[params.langueCible] ?? params.langueCible;
    const source = params.langueSource ? (LANGUES[params.langueSource] ?? params.langueSource) : "auto-détecté";

    const response = await client.models.generateContent({
      model: MODEL,
      contents: [{
        role: "user",
        parts: [{ text: `Traduis ce texte du ${source} vers le ${cible}. Retourne UNIQUEMENT la traduction, sans introduction ni explication :\n\n${params.texte}` }],
      }],
      config: { maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } },
    });
    const traduction = response.text ?? "";
    return { succes: true, resultat: traduction, donnees: { langue: cible } };
  } catch (err: any) {
    return { succes: false, resultat: `Erreur traduction : ${err.message}` };
  }
}

// ── Analyse d'image produit ───────────────────────────────────────────────────
export async function analyserImageProduit(params: {
  imageUrl: string;
  question?: string;
  apiKey: string;
}): Promise<GeminiResult> {
  try {
    const client = getClient(params.apiKey);
    const question = params.question ?? "Décris ce produit en détail : catégorie, caractéristiques visuelles, qualité apparente, suggestion de prix pour le marché africain.";

    const imgRes = await fetch(params.imageUrl);
    const buffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const mimeType = imgRes.headers.get("content-type") ?? "image/jpeg";

    const response = await client.models.generateContent({
      model: MODEL,
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType, data: base64 } },
          { text: question },
        ],
      }],
      config: { maxOutputTokens: 512, thinkingConfig: { thinkingBudget: 0 } },
    });
    return { succes: true, resultat: response.text ?? "" };
  } catch (err: any) {
    return { succes: false, resultat: `Erreur analyse image : ${err.message}` };
  }
}
