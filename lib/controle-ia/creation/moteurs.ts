// Moteurs de création d'AXSO CONTROL. Le module créatif ne connaît que l'interface Moteur :
// ajouter un fournisseur = ajouter une entrée à MOTEURS. Un moteur n'annonce une capacité
// que s'il sait réellement la rendre ; sinon l'outil répond UNAVAILABLE (jamais de faux rendu).
// Aucune clé n'est lue ici pour un moteur relié par la boutique : Higgsfield passe par
// executerOutilMcp, qui détient (et déchiffre) le jeton.
import { GoogleGenAI } from "@google/genai";
import { etatConnexions } from "@/lib/connect";
import { generateImageGemini, hasGemini, pollVideoGemini, startVideoGemini } from "@/lib/llm-client";
import { executerOutilMcp } from "@/lib/mcp/executor";
import { telecharger, type Rendu } from "../mediatheque";
import { FORMATS, NOMS_CAPACITES, Refus, indisponible, moteursPour, type Capacite, type EtatMoteur, type Format } from "./regles";

/** Image de départ (photo du produit, média de la médiathèque) : son adresse, et ses octets à la demande. */
export interface Source { url: string; lire: () => Promise<{ donnees: Buffer; mime: string }> }
export type RatioVideo = "16:9" | "9:16" | "1:1";
export interface Demande { prompt?: string; source?: Source; format?: Format; ratio?: RatioVideo; duree?: number }
/** Rendu immédiat, ou `reference` d'un rendu en cours à suivre avec sonder(). */
export type RenduDiffere = Rendu & { reference?: string };

export interface Moteur {
  id: string;
  /** `pour` : capacité demandée — évite d'interroger le fournisseur quand la réponse est connue d'avance. */
  etat: (tenantId: string, pour?: Capacite) => Promise<EtatMoteur>;
  image?: (tenantId: string, d: Demande) => Promise<Rendu>;
  edition?: (tenantId: string, d: Demande) => Promise<Rendu>;
  detourage?: (tenantId: string, d: Demande) => Promise<Rendu>;
  agrandissement?: (tenantId: string, d: Demande) => Promise<Rendu>;
  video?: (tenantId: string, d: Demande) => Promise<RenduDiffere>;
  animation?: (tenantId: string, d: Demande) => Promise<RenduDiffere>;
  /** null tant que le rendu n'est pas prêt. */
  sonder?: (reference: string) => Promise<Rendu | null>;
}

const court = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").slice(0, 200);

// ─── Gemini (clé d'Axso) ─────────────────────────────────────────────────────
// Mêmes modèles que lib/llm-client.ts, qui ne sait partir que d'un texte : la retouche et
// l'animation à partir d'une photo appellent le SDK ici.
const GEMINI_IMAGE = "gemini-3.1-flash-image";
const GEMINI_VIDEO = "veo-3.1-fast-generate-preview";
const genai = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

/** Le plan gratuit de Google rend un quota nul sur l'image et la vidéo : c'est une indisponibilité, pas une panne. */
async function gemini<T>(appel: () => Promise<T>): Promise<T> {
  try { return await appel(); } catch (e: any) {
    if (e instanceof Refus) throw e;
    const m = String(e?.message ?? "");
    throw indisponible(/429|RESOURCE_EXHAUSTED|quota/i.test(m) ? "Quota du moteur Gemini atteint (ou facturation Google non activée pour l'image et la vidéo)." : `Moteur Gemini en erreur : ${court(m)}`);
  }
}
const octets = (dataUrl: string): Rendu => {
  const [meta, b64] = dataUrl.split(",");
  return { donnees: Buffer.from(b64, "base64"), mime: /data:(.*?);base64/.exec(meta)?.[1] ?? "image/png" };
};

const GEMINI: Moteur = {
  id: "gemini",
  etat: async () => ({ id: "gemini", portee: hasGemini() ? "plateforme" : null, capacites: ["image", "edition", "video", "animation"] }),
  image: (_t, d) => gemini(async () => {
    const url = await generateImageGemini(d.prompt!);
    if (!url) throw indisponible("Gemini n'a renvoyé aucune image.");
    return octets(url);
  }),
  edition: (_t, d) => gemini(async () => {
    const { donnees, mime } = await d.source!.lire();
    const r = await genai().models.generateContent({
      model: GEMINI_IMAGE,
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: mime, data: donnees.toString("base64") } }, { text: d.prompt! }] }],
    });
    const img = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
    if (!img?.data) throw indisponible("Gemini n'a renvoyé aucune image.");
    return { donnees: Buffer.from(img.data, "base64"), mime: img.mimeType ?? "image/png" };
  }),
  video: (_t, d) => gemini(async () => ({ reference: await startVideoGemini(d.prompt!, d.ratio ?? "16:9") })),
  animation: (_t, d) => gemini(async () => {
    const { donnees, mime } = await d.source!.lire();
    const op = await genai().models.generateVideos({
      model: GEMINI_VIDEO,
      source: { prompt: d.prompt, image: { imageBytes: donnees.toString("base64"), mimeType: mime } },
      config: { numberOfVideos: 1, aspectRatio: d.ratio ?? "16:9" } as any,
    });
    if (!op.name) throw indisponible("Gemini n'a pas démarré le rendu.");
    return { reference: op.name };
  }),
  sonder: (reference) => gemini(async () => {
    const e = await pollVideoGemini(reference);
    if (!e.done) return null;
    if (e.error || !e.videoUri) throw indisponible(`Gemini Veo : ${court(e.error ?? "aucune vidéo renvoyée")}`);
    // La clé n'accompagne le téléchargement que vers Google, et ne sort jamais dans une adresse enregistrée.
    if (!/\.googleapis\.com$/.test(new URL(e.videoUri).hostname)) throw indisponible("Adresse de rendu inattendue.");
    return telecharger(e.videoUri, "video", { entetes: { "x-goog-api-key": process.env.GEMINI_API_KEY! }, suivre: true });
  }),
};

// ─── Higgsfield (clé de la boutique dans Connecteurs, sinon celle d'Axso) ─────
// Image et vidéo sont des outils fixes du connecteur ; détourage, agrandissement et animation
// n'existent que si le serveur Higgsfield expose un outil qui les fait : on le lui demande.
const MOTIFS: Partial<Record<Capacite, RegExp>> = {
  detourage: /remov\w*[_ -]?(bg|background)|background[_ -]?remov|rembg|cutout/i,
  agrandissement: /upscal|super[_ -]?res/i,
  animation: /image[_ -]?to[_ -]?video|img2vid|animate/i,
};
type OutilDistant = { name: string; inputSchema?: { properties?: Record<string, unknown> } };
const listes = new Map<string, { le: number; outils: OutilDistant[] }>();

async function outilsHiggsfield(tenantId: string): Promise<OutilDistant[]> {
  const c = listes.get(tenantId);
  if (c && Date.now() - c.le < 600_000) return c.outils;
  const r = await executerOutilMcp("higgsfield_lister_outils", {}, tenantId);
  if (!r.succes || !Array.isArray(r.donnees)) return [];
  listes.set(tenantId, { le: Date.now(), outils: r.donnees });
  return r.donnees;
}

function fichierHiggsfield(contenu: any[] | undefined, texte = ""): Rendu {
  const media = contenu?.find((c) => c.type === "image" || c.type === "resource");
  if (media?.data) return { donnees: Buffer.from(media.data, "base64"), mime: media.mimeType ?? "image/png" };
  const url = media?.resource?.uri ?? `${contenu?.map((c) => c.text ?? "").join(" ") ?? ""} ${texte}`.match(/https:\/\/[^\s"')\]]+/)?.[0];
  if (!url) throw indisponible("Higgsfield n'a renvoyé aucun fichier.");
  return { url };
}

async function outilHiggsfield(tenantId: string, capacite: Capacite, d: Demande): Promise<Rendu> {
  const outil = (await outilsHiggsfield(tenantId)).find((o) => MOTIFS[capacite]!.test(o.name));
  if (!outil) throw indisponible(`Higgsfield ne propose pas : ${NOMS_CAPACITES[capacite]}.`);
  if (!d.source!.url.startsWith("https://")) throw indisponible("Higgsfield a besoin d'une image en ligne (stockage de fichiers non configuré).");
  const champs = Object.keys(outil.inputSchema?.properties ?? {});
  const champImage = champs.find((k) => /image|url|src|input/i.test(k)) ?? "image_url";
  const r: any = await executerOutilMcp("higgsfield_appeler_outil", { outil: outil.name, arguments: { [champImage]: d.source!.url, ...(d.prompt && champs.includes("prompt") && { prompt: d.prompt }) } }, tenantId);
  if (!r.succes) throw indisponible(court(r.resultat));
  return fichierHiggsfield(r.contenu, r.resultat);
}

async function appelHiggsfield(tenantId: string, outil: string, args: Record<string, unknown>, champ: "imageUrl" | "videoUrl"): Promise<Rendu> {
  const r = await executerOutilMcp(outil, args, tenantId);
  if (!r.succes) throw indisponible(court(r.resultat));
  if (!r.donnees?.[champ]) throw indisponible("Higgsfield n'a renvoyé aucun fichier.");
  return { url: r.donnees[champ] };
}

const HIGGSFIELD: Moteur = {
  id: "higgsfield",
  etat: async (tenantId, pour) => {
    // On ne lit que l'état du connecteur (sans secret) : le jeton reste dans lib/mcp/executor.ts.
    const c = (await etatConnexions(tenantId)).find((e) => e.type === "higgsfield");
    const portee = c?.statut === "actif" ? "boutique" : process.env.HIGGSFIELD_API_KEY ? "plateforme" : null;
    const capacites: Capacite[] = ["image", "video"];
    if (portee && pour && MOTIFS[pour]) {
      const outils = await outilsHiggsfield(tenantId).catch(() => []);
      if (outils.some((o) => MOTIFS[pour]!.test(o.name))) capacites.push(pour);
    }
    return { id: "higgsfield", portee, capacites };
  },
  image: (t, d) => appelHiggsfield(t, "higgsfield_generer_image", { prompt: d.prompt, width: FORMATS[d.format ?? "square"].largeur, height: FORMATS[d.format ?? "square"].hauteur }, "imageUrl"),
  // dejaEnregistre : la vidéo est indexée par la médiathèque, pas une seconde fois par le connecteur.
  video: (t, d) => appelHiggsfield(t, "higgsfield_generer_video", { prompt: d.prompt, duration: d.duree, aspect_ratio: d.ratio, dejaEnregistre: true }, "videoUrl"),
  detourage: (t, d) => outilHiggsfield(t, "detourage", d),
  agrandissement: (t, d) => outilHiggsfield(t, "agrandissement", d),
  animation: (t, d) => outilHiggsfield(t, "animation", d),
};

export const MOTEURS: Moteur[] = [GEMINI, HIGGSFIELD];
export const ID_MOTEURS = MOTEURS.map((m) => m.id);
export const moteur = (id: string) => MOTEURS.find((m) => m.id === id);

export const etatsMoteurs = (tenantId: string, pour?: Capacite): Promise<EtatMoteur[]> =>
  Promise.all(MOTEURS.map((m) => m.etat(tenantId, pour).catch((): EtatMoteur => ({ id: m.id, portee: null, capacites: [] }))));

/**
 * Rend une capacité avec le premier moteur configuré qui y parvient (le suivant prend le relais
 * si le premier échoue : quota, panne). Aucun moteur → UNAVAILABLE.
 */
export async function rendre(tenantId: string, capacite: Capacite, d: Demande, prefere?: string): Promise<{ moteur: string; rendu: RenduDiffere }> {
  const ids = moteursPour(capacite, await etatsMoteurs(tenantId, capacite), prefere);
  if (!ids.length) throw indisponible(`Aucun moteur ${prefere && prefere !== "auto" ? `« ${prefere} » ` : ""}configuré pour : ${NOMS_CAPACITES[capacite]}. Rien n'a été généré.`);
  let derniere: unknown;
  for (const id of ids) {
    try { return { moteur: id, rendu: await moteur(id)![capacite]!(tenantId, d) }; } catch (e) { derniere = e; }
  }
  throw derniere instanceof Refus ? derniere : indisponible("Le moteur de création est momentanément en erreur. Rien n'a été généré.");
}
