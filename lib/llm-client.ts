/**
 * LLM Client — Gemini en principal, DeepSeek en secours automatique
 *
 * Le texte (chat, tool-calling, streaming) essaie toujours Gemini d'abord ;
 * si Gemini échoue (clé invalide, projet suspendu, quota, 5xx...), on
 * bascule silencieusement sur DeepSeek (API compatible OpenAI) sans que
 * l'appelant n'ait à le savoir — même signature de fonctions, même forme de
 * retour. Nécessite DEEPSEEK_API_KEY ; sans elle, le comportement est
 * strictement identique à avant (Gemini seul, erreur si Gemini échoue).
 *
 * La génération média (images, vidéo, voix) reste exclusive à Gemini — voir
 * generateSpeechGemini / generateImageGemini / startVideoGemini /
 * pollVideoGemini ci-dessous, ainsi que lib/image-gen.ts.
 */
import { GoogleGenAI } from "@google/genai";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionResult {
  text: string;
  provider?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  /** Signature opaque Gemini à ré-échoïr telle quelle sur le tour suivant (requis par l'API même thinking désactivé) */
  signature?: string;
}

export interface CompletionWithToolsResult {
  text?: string;
  toolCalls?: ToolCall[];
  stopReason: "end_turn" | "tool_use";
  provider?: string;
}

const GEMINI_MODEL = "gemini-3.1-flash-lite";
const GEMINI_TTS_MODEL = "gemini-3.1-flash-tts-preview";
const DEEPSEEK_MODEL = "deepseek-chat";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

// ─── Client Gemini (singleton) ────────────────────────────────────────────────

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY manquante");
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

export function hasGemini(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export function hasDeepSeek(): boolean {
  return !!process.env.DEEPSEEK_API_KEY;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Supprime les balises de raisonnement interne que le modèle peut inclure dans ses réponses */
function cleanModelResponse(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/RÈGLES ABSOLUES\s*:[\s\S]*?(?=\n\n|$)/gm, "")
    .replace(/OUTILS DISPONIBLES[\s\S]*?(?=\n\n|$)/gm, "")
    .replace(/BOUTIQUE ACTIVE\s*:.*$/gm, "")
    .trim();
}

/** Convertit un schéma JSON (type: "object"/"string"/...) au format attendu par Gemini (Type: "OBJECT"/"STRING"/...) */
function toGeminiSchema(schema: any): any {
  if (!schema || typeof schema !== "object") return schema;
  const out: any = Array.isArray(schema) ? [...schema] : { ...schema };
  if (typeof out.type === "string") out.type = out.type.toUpperCase();
  if (out.properties) {
    out.properties = Object.fromEntries(
      Object.entries(out.properties).map(([k, v]) => [k, toGeminiSchema(v)])
    );
  }
  if (out.items) out.items = toGeminiSchema(out.items);
  return out;
}

function toGeminiTools(tools: ToolDefinition[]) {
  if (!tools.length) return undefined;
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: toGeminiSchema(t.parameters),
      })),
    },
  ];
}

/** Convertit un contenu utilisateur (string, ou tableau de blocs OpenAI-style text/image_url) en parts Gemini */
async function toGeminiParts(content: any): Promise<any[]> {
  if (typeof content === "string" || content == null) {
    return [{ text: String(content ?? "") }];
  }
  if (!Array.isArray(content)) {
    return [{ text: String(content) }];
  }

  const parts: any[] = [];
  for (const block of content) {
    if (block?.type === "text") {
      parts.push({ text: block.text ?? "" });
      continue;
    }
    if (block?.type === "image_url") {
      const url = block.image_url?.url ?? block.image_url;
      if (typeof url === "string" && url.startsWith("data:")) {
        const [meta, data] = url.split(",");
        const mimeType = meta.match(/data:(.*?);base64/)?.[1] ?? "image/jpeg";
        parts.push({ inlineData: { mimeType, data } });
      } else if (typeof url === "string") {
        try {
          const res = await fetch(url);
          const buf = await res.arrayBuffer();
          const mimeType = res.headers.get("content-type") ?? "image/jpeg";
          parts.push({ inlineData: { mimeType, data: Buffer.from(buf).toString("base64") } });
        } catch {
          // Image inaccessible — on l'ignore plutôt que de faire échouer toute la requête
        }
      }
      continue;
    }
  }
  return parts.length ? parts : [{ text: "" }];
}

async function toGeminiContents(messages: any[]): Promise<{ systemInstruction: string; contents: any[] }> {
  let systemInstruction = "";
  const contents: any[] = [];
  const idToName: Record<string, string> = {};

  for (const m of messages) {
    if (!m) continue;

    if (m.role === "system") {
      systemInstruction += (systemInstruction ? "\n\n" : "") + (m.content ?? "");
      continue;
    }

    if (m.role === "user") {
      contents.push({ role: "user", parts: await toGeminiParts(m.content) });
      continue;
    }

    if (m.role === "assistant") {
      if (m.tool_calls?.length) {
        const parts = m.tool_calls.map((tc: any) => {
          const name = tc.function?.name ?? tc.name;
          const args = (() => {
            try { return JSON.parse(tc.function?.arguments ?? "{}"); }
            catch { return {}; }
          })();
          idToName[tc.id] = name;
          const part: any = { functionCall: { id: tc.id, name, args } };
          if (tc.signature) part.thoughtSignature = tc.signature;
          return part;
        });
        contents.push({ role: "model", parts });
      } else {
        contents.push({ role: "model", parts: [{ text: String(m.content ?? "") }] });
      }
      continue;
    }

    if (m.role === "tool") {
      const name = idToName[m.tool_call_id] ?? "unknown";
      contents.push({
        role: "user",
        parts: [{ functionResponse: { id: m.tool_call_id, name, response: { result: String(m.content ?? "") } } }],
      });
      continue;
    }
  }

  return { systemInstruction, contents };
}

// ─── Complétion simple (sans tool use) ────────────────────────────────────────

export async function completionGemini(messages: ChatMessage[], maxTokens = 800): Promise<CompletionResult> {
  const client = getGeminiClient();
  const { systemInstruction, contents } = await toGeminiContents(messages);

  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config: {
      ...(systemInstruction ? { systemInstruction } : {}),
      maxOutputTokens: maxTokens,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  return { text: cleanModelResponse(response.text ?? ""), provider: GEMINI_MODEL };
}

// ─── Complétion avec tool use ─────────────────────────────────────────────────

export async function completionWithToolsGemini(
  messages: any[],
  tools: ToolDefinition[],
  maxTokens = 2000
): Promise<CompletionWithToolsResult> {
  const client = getGeminiClient();
  const { systemInstruction, contents } = await toGeminiContents(messages);

  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config: {
      ...(systemInstruction ? { systemInstruction } : {}),
      ...(tools.length ? { tools: toGeminiTools(tools) } : {}),
      maxOutputTokens: maxTokens,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  // On relit les parts brutes (pas le getter response.functionCalls) pour récupérer le
  // thoughtSignature attaché à chaque part — l'API l'exige en écho sur le tour suivant,
  // même thinking désactivé, sous peine de 400 "missing a thought_signature".
  const rawParts = response.candidates?.[0]?.content?.parts ?? [];
  const functionCallParts = rawParts.filter((p) => p.functionCall);
  if (functionCallParts.length > 0) {
    const toolCalls: ToolCall[] = functionCallParts.map((p) => ({
      id: p.functionCall!.id ?? `tc-${Math.random().toString(36).slice(2)}`,
      name: p.functionCall!.name ?? "",
      arguments: (p.functionCall!.args as Record<string, any>) ?? {},
      signature: p.thoughtSignature,
    }));
    return { toolCalls, stopReason: "tool_use", provider: GEMINI_MODEL };
  }

  return { text: cleanModelResponse(response.text ?? ""), stopReason: "end_turn", provider: GEMINI_MODEL };
}

// ─── DeepSeek — secours automatique quand Gemini échoue ───────────────────────
// API compatible OpenAI (chat.completions) — les messages de l'appelant sont
// déjà quasi au format OpenAI (role/content/tool_calls/tool_call_id), donc
// pas de conversion lourde comme pour Gemini, juste un passe-plat + le
// formatage des tools au format { type: "function", function: {...} }.

function toOpenAiTools(tools: ToolDefinition[]) {
  if (!tools.length) return undefined;
  return tools.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

/** Normalise les messages internes (contenu parfois en blocs image_url) vers le format OpenAI simple. */
function toOpenAiMessages(messages: any[]): any[] {
  return messages.map((m) => {
    if (!m) return m;
    if (Array.isArray(m.content)) {
      // DeepSeek-chat ne supporte pas la vision — on ne garde que le texte.
      const text = m.content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("\n");
      return { ...m, content: text };
    }
    return m;
  });
}

async function deepSeekChatCompletion(body: Record<string, any>): Promise<any> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY manquante");
  const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: DEEPSEEK_MODEL, ...body }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`DeepSeek ${res.status}: ${errText.slice(0, 200)}`);
  }
  return res.json();
}

export async function completionWithToolsDeepSeek(
  messages: any[],
  tools: ToolDefinition[],
  maxTokens = 2000
): Promise<CompletionWithToolsResult> {
  const data = await deepSeekChatCompletion({
    messages: toOpenAiMessages(messages),
    ...(tools.length ? { tools: toOpenAiTools(tools) } : {}),
    max_tokens: maxTokens,
  });
  const choice = data.choices?.[0];
  const msg = choice?.message;

  if (msg?.tool_calls?.length) {
    const toolCalls: ToolCall[] = msg.tool_calls.map((tc: any) => ({
      id: tc.id,
      name: tc.function?.name ?? "",
      arguments: (() => { try { return JSON.parse(tc.function?.arguments ?? "{}"); } catch { return {}; } })(),
    }));
    return { toolCalls, stopReason: "tool_use", provider: DEEPSEEK_MODEL };
  }

  return { text: cleanModelResponse(msg?.content ?? ""), stopReason: "end_turn", provider: DEEPSEEK_MODEL };
}

/** Stream DeepSeek (SSE natif OpenAI-style) — même contrat que streamGemini. */
export async function* streamDeepSeek(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  maxTokens = 4000
): AsyncGenerator<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY manquante");

  const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [{ role: "system", content: systemPrompt }, ...toOpenAiMessages(messages)],
      max_tokens: maxTokens,
      stream: true,
    }),
  });
  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "");
    throw new Error(`DeepSeek ${res.status}: ${errText.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6);
      if (payload === "[DONE]") return;
      try {
        const evt = JSON.parse(payload);
        const delta = evt.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {}
    }
  }
}

// ─── Streaming (synthèse de réponse) ──────────────────────────────────────────

/** Stream natif — Gemini d'abord, bascule sur DeepSeek si Gemini échoue (voir hasDeepSeek). */
export async function* streamGemini(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  maxTokens = 4000
): AsyncGenerator<string> {
  try {
    const client = getGeminiClient();
    const { contents } = await toGeminiContents(messages);

    const stream = await client.models.generateContentStream({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: maxTokens,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    let emitted = false;
    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) { emitted = true; yield text; }
    }
    if (emitted) return;
    // Gemini a répondu mais sans le moindre texte — probable coupure côté
    // fournisseur, on tente quand même le secours plutôt que de renvoyer du vide.
    throw new Error("Gemini n'a renvoyé aucun texte");
  } catch (err) {
    if (!hasDeepSeek()) throw err;
    console.warn("[llm-client] streamGemini échoué, secours DeepSeek:", err instanceof Error ? err.message.slice(0, 150) : err);
    yield* streamDeepSeek(systemPrompt, messages, maxTokens);
  }
}

// ─── Points d'entrée génériques (compat des appelants existants) ─────────────

export async function completionAuto(messages: ChatMessage[], maxTokens = 800): Promise<CompletionResult> {
  try {
    return await completionGemini(messages, maxTokens);
  } catch (err) {
    if (!hasDeepSeek()) throw err;
    console.warn("[llm-client] completionGemini échoué, secours DeepSeek:", err instanceof Error ? err.message.slice(0, 150) : err);
    const data = await deepSeekChatCompletion({ messages: toOpenAiMessages(messages), max_tokens: maxTokens });
    return { text: cleanModelResponse(data.choices?.[0]?.message?.content ?? ""), provider: DEEPSEEK_MODEL };
  }
}

export async function completionWithToolsAuto(
  messages: any[],
  tools: ToolDefinition[],
  maxTokens = 2000,
  _fast = false
): Promise<CompletionWithToolsResult> {
  try {
    return await completionWithToolsGemini(messages, tools, maxTokens);
  } catch (err) {
    if (!hasDeepSeek()) throw err;
    console.warn("[llm-client] completionWithToolsGemini échoué, secours DeepSeek:", err instanceof Error ? err.message.slice(0, 150) : err);
    return completionWithToolsDeepSeek(messages, tools, maxTokens);
  }
}

// ─── Génération média — Gemini exclusif (images, vidéo, voix) ─────────────────
//
// Comme pour le texte, toute génération média d'Axso passe exclusivement par
// Gemini (@google/genai) : plus aucun fournisseur tiers (fal.ai, Pollinations,
// ElevenLabs...). Note : sur le plan gratuit, les modèles image (gemini-*-image)
// et vidéo (veo-*) peuvent renvoyer un quota de 0 requête tant qu'aucun compte
// de facturation n'est rattaché au projet Google AI — c'est un vrai palier de
// plan, pas un bug ; le texte et la voix (TTS) fonctionnent sans facturation.

const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image";
const GEMINI_VIDEO_MODEL = "veo-3.1-fast-generate-preview";

export const GEMINI_TTS_VOICES = [
  { id: "Kore",    nom: "Kore",    genre: "F", style: "Ferme, professionnelle" },
  { id: "Puck",    nom: "Puck",    genre: "M", style: "Enjoué, dynamique" },
  { id: "Zephyr",  nom: "Zephyr",  genre: "F", style: "Légère, chaleureuse" },
  { id: "Charon",  nom: "Charon",  genre: "M", style: "Grave, posé" },
  { id: "Fenrir",  nom: "Fenrir",  genre: "M", style: "Énergique" },
  { id: "Aoede",   nom: "Aoede",   genre: "F", style: "Douce, apaisante" },
  { id: "Leda",    nom: "Leda",    genre: "F", style: "Jeune, vive" },
  { id: "Orus",    nom: "Orus",    genre: "M", style: "Autoritaire" },
] as const;

/** Enveloppe un flux PCM brut (tel que renvoyé par les modèles TTS Gemini) dans un en-tête WAV lisible partout. */
function pcmToWav(pcmBase64: string, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
  const pcm = Buffer.from(pcmBase64, "base64");
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** Génère une voix off via le TTS natif Gemini — retourne un data: URL WAV prêt à jouer. */
export async function generateSpeechGemini(texte: string, voiceName: string = "Kore"): Promise<string> {
  const client = getGeminiClient();
  const response = await client.models.generateContent({
    model: GEMINI_TTS_MODEL,
    contents: [{ role: "user", parts: [{ text: texte }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
    },
  });
  const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  const inline = part?.inlineData;
  if (!inline?.data) throw new Error("Aucun audio renvoyé par Gemini");

  const rateMatch = /rate=(\d+)/.exec(inline.mimeType ?? "");
  const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
  const wav = pcmToWav(inline.data, sampleRate, 1, 16);
  return `data:audio/wav;base64,${wav.toString("base64")}`;
}

/** Génère une image via le modèle multimodal Gemini — retourne un data: URL, ou null si aucune image n'est renvoyée. */
export async function generateImageGemini(prompt: string): Promise<string | null> {
  const client = getGeminiClient();
  const response = await client.models.generateContent({
    model: GEMINI_IMAGE_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });
  const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  const inline = part?.inlineData;
  if (!inline?.data) return null;
  return `data:${inline.mimeType ?? "image/png"};base64,${inline.data}`;
}

/** Lance une génération vidéo Veo (asynchrone) — retourne le nom de l'opération à sonder via pollVideoGemini. */
export async function startVideoGemini(prompt: string, ratio: "16:9" | "9:16" | "1:1" = "16:9"): Promise<string> {
  const client = getGeminiClient();
  const operation = await client.models.generateVideos({
    model: GEMINI_VIDEO_MODEL,
    source: { prompt },
    config: { numberOfVideos: 1, aspectRatio: ratio } as any,
  });
  if (!operation.name) throw new Error("Gemini n'a renvoyé aucun identifiant d'opération vidéo");
  return operation.name;
}

/** Sonde une opération vidéo Veo en cours — retourne son état et, une fois prête, l'URI de la vidéo générée. */
export async function pollVideoGemini(operationName: string): Promise<{ done: boolean; videoUri?: string; error?: string }> {
  const client = getGeminiClient();
  const operation = await client.operations.getVideosOperation({ operation: { name: operationName } as any });
  if (!operation.done) return { done: false };
  if (operation.error) return { done: true, error: String((operation.error as any)?.message ?? "Erreur Veo") };
  const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
  return { done: true, videoUri: uri };
}
