// Connecteur Higgsfield MCP — génération vidéo + image ultra HD
// Endpoint : https://mcp.higgsfield.ai/mcp (JSON-RPC 2.0 over HTTP)
// Docs : https://higgsfield.ai — 30+ modèles vidéo, 40+ outils image

const HIGGSFIELD_MCP = "https://mcp.higgsfield.ai/mcp";

export interface HiggsfieldTool {
  name: string;
  description: string;
  inputSchema?: Record<string, any>;
}

// ── Appel générique au serveur MCP Higgsfield ──────────────────────────────

async function callMcp(
  method: string,
  params: Record<string, any>,
  apiKey: string
): Promise<any> {
  const res = await fetch(HIGGSFIELD_MCP, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method,
      params,
      id: Date.now(),
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Higgsfield MCP ${res.status}: ${err}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(`Higgsfield MCP Error: ${data.error.message}`);
  return data.result;
}

// ── Lister les outils disponibles ─────────────────────────────────────────

export async function listerOutilsHiggsfield(apiKey: string): Promise<HiggsfieldTool[]> {
  const result = await callMcp("tools/list", {}, apiKey);
  return result?.tools ?? [];
}

// ── Appeler un outil spécifique ────────────────────────────────────────────

export async function appellerOutilHiggsfield(
  toolName: string,
  args: Record<string, any>,
  apiKey: string
): Promise<{ succes: boolean; resultat: string; contenu?: any[] }> {
  try {
    const result = await callMcp("tools/call", { name: toolName, arguments: args }, apiKey);

    // MCP retourne { content: [{ type: "text", text: "..." } | { type: "image", data: "..." }] }
    const contenu = result?.content ?? [];
    const texte = contenu.find((c: any) => c.type === "text")?.text ?? "Génération terminée";

    return { succes: true, resultat: texte, contenu };
  } catch (err) {
    return { succes: false, resultat: `Erreur Higgsfield : ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ── Génération vidéo simplifiée (outil principal) ─────────────────────────

export async function genererVideoHiggsfield(params: {
  prompt: string;
  model?: string;
  duration?: number;
  aspectRatio?: string;
  style?: string;
  apiKey: string;
}): Promise<{ succes: boolean; videoUrl?: string; imageUrl?: string; resultat: string }> {
  const args: Record<string, any> = {
    prompt: params.prompt,
    ...(params.model && { model: params.model }),
    ...(params.duration && { duration: params.duration }),
    ...(params.aspectRatio && { aspect_ratio: params.aspectRatio }),
    ...(params.style && { style: params.style }),
  };

  const res = await appellerOutilHiggsfield("generate_video", args, params.apiKey);

  if (!res.succes) return { succes: false, resultat: res.resultat };

  // Extraire l'URL de la vidéo depuis le contenu retourné
  const videoContent = res.contenu?.find((c: any) => c.type === "resource" || (c.type === "text" && c.text?.includes("http")));
  const videoUrl = videoContent?.resource?.uri ?? videoContent?.text?.match(/https?:\/\/\S+/)?.[0];

  return { succes: true, videoUrl, resultat: res.resultat };
}

// ── Génération image simplifiée ───────────────────────────────────────────

export async function genererImageHiggsfield(params: {
  prompt: string;
  model?: string;
  style?: string;
  width?: number;
  height?: number;
  apiKey: string;
}): Promise<{ succes: boolean; imageUrl?: string; resultat: string }> {
  const args: Record<string, any> = {
    prompt: params.prompt,
    ...(params.model && { model: params.model }),
    ...(params.style && { style: params.style }),
    ...(params.width && { width: params.width }),
    ...(params.height && { height: params.height }),
  };

  const res = await appellerOutilHiggsfield("generate_image", args, params.apiKey);
  if (!res.succes) return { succes: false, resultat: res.resultat };

  const imageContent = res.contenu?.find((c: any) => c.type === "image" || c.type === "resource");
  const imageUrl = imageContent?.data
    ? `data:image/png;base64,${imageContent.data}`
    : imageContent?.resource?.uri ?? res.contenu?.find((c: any) => c.type === "text")?.text?.match(/https?:\/\/\S+/)?.[0];

  return { succes: true, imageUrl, resultat: res.resultat };
}

// ── Modèles disponibles (connus) ───────────────────────────────────────────

export const HIGGSFIELD_VIDEO_MODELS = [
  { id: "kling-3.0",     nom: "Kling 3.0",      type: "video", qualite: "ultra" },
  { id: "veo-3.1",       nom: "Veo 3.1",        type: "video", qualite: "ultra" },
  { id: "sora-2",        nom: "Sora 2",          type: "video", qualite: "cinematic" },
  { id: "seedance-2.0",  nom: "Seedance 2.0",    type: "video", qualite: "high" },
  { id: "minimax-02",    nom: "MiniMax Hailuo 02", type: "video", qualite: "high" },
  { id: "cinema-3.5",    nom: "Cinema Studio 3.5", type: "video", qualite: "cinematic" },
];

export const HIGGSFIELD_IMAGE_MODELS = [
  { id: "recraft-4.1",   nom: "Recraft 4.1",    type: "image" },
  { id: "gpt-image",     nom: "GPT Image",       type: "image" },
  { id: "seedream-4.0",  nom: "Seedream 4.0",    type: "image" },
  { id: "wan-2.5",       nom: "Wan 2.5",         type: "image" },
];
