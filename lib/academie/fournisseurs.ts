// Fournisseurs IA interchangeables de l'académie (Multimodal Learning Factory).
// Un fournisseur n'annonce une capacité que s'il sait réellement la rendre ; sinon il est
// déclaré « non configuré » avec la variable attendue, et rien n'est simulé.
// Image et vidéo réutilisent les moteurs existants (lib/image-gen.ts, lib/llm-client.ts) ;
// l'import de fichiers/visuels reste celui de lib/import-creations.
import { completionAuto, generateSpeechGemini, hasDeepSeek, hasGemini, startVideoGemini, type ChatMessage } from "@/lib/llm-client";
import { generateProductImage } from "@/lib/image-gen";

export type Capacite = "texte" | "image" | "audio" | "video" | "avatar";
export type FonctionTexte = (messages: ChatMessage[], o: { maxTokens: number; json?: boolean }) => Promise<{ texte: string; modele?: string }>;

export interface Fournisseur {
  id: string;
  nom: string;
  variables: string[]; // variables d'environnement attendues (noms seulement)
  configure: () => boolean;
  remarque?: string;
  texte?: FonctionTexte;
  image?: (tenantId: string, prompt: string) => Promise<{ url: string }>;
  audio?: (texte: string, voix?: string) => Promise<{ dataUrl: string }>;
  video?: (prompt: string, ratio?: "16:9" | "9:16" | "1:1") => Promise<{ reference: string }>;
  avatar?: never; // aucun fournisseur d'avatar branché
}

/** Capacités payantes : jamais lancées sans accord explicite du marchand ET budget. */
export const PAYANTES: Capacite[] = ["image", "audio", "video", "avatar"];

export const FOURNISSEURS: Fournisseur[] = [
  {
    id: "gemini",
    nom: "Google Gemini",
    variables: ["GEMINI_API_KEY"],
    configure: hasGemini,
    remarque: "Texte et voix (TTS) sans facturation ; image et vidéo (Veo) demandent la facturation Google activée (sinon quota 0).",
    // completionAuto bascule seul sur DeepSeek quand Gemini échoue (si DEEPSEEK_API_KEY est présente).
    texte: async (messages, o) => {
      const r = await completionAuto(messages, o.maxTokens, o.json);
      return { texte: r.text, modele: r.provider };
    },
    image: async (tenantId, prompt) => {
      const url = await generateProductImage({ prompt, tenantId });
      if (!url) throw new NonConfigure("image", "Gemini n'a renvoyé aucune image (quota ou facturation Google).");
      return { url };
    },
    audio: async (texte, voix) => ({ dataUrl: await generateSpeechGemini(texte, voix) }),
    video: async (prompt, ratio) => ({ reference: await startVideoGemini(prompt, ratio) }),
  },
  { id: "deepseek", nom: "DeepSeek (secours texte)", variables: ["DEEPSEEK_API_KEY"], configure: hasDeepSeek, remarque: "Utilisé automatiquement si Gemini échoue." },
  { id: "higgsfield", nom: "Higgsfield (image, vidéo)", variables: ["HIGGSFIELD_API_KEY ou connecteur de la boutique"], configure: () => !!process.env.HIGGSFIELD_API_KEY, remarque: "Disponible pour la boutique via Connecteurs → module créatif (lib/controle-ia/creation)." },
  { id: "elevenlabs", nom: "Voix clonée", variables: ["ELEVENLABS_API_KEY"], configure: () => false, remarque: "Non branché." },
  { id: "avatar", nom: "Avatar vidéo (HeyGen, D-ID…)", variables: ["HEYGEN_API_KEY"], configure: () => false, remarque: "Non branché." },
];

export class NonConfigure extends Error {
  constructor(public capacite: Capacite, message: string) { super(message); }
}

/** Premier fournisseur configuré qui sait rendre la capacité ; sinon erreur explicite (jamais de faux succès). */
export function fournisseurPour(c: Capacite): Fournisseur {
  const f = FOURNISSEURS.find((x) => x.configure() && typeof x[c] === "function");
  if (f) return f;
  const attendues = FOURNISSEURS.filter((x) => x.id !== "deepseek").flatMap((x) => x.variables);
  throw new NonConfigure(c, `Aucun fournisseur configuré pour « ${c} ». Variables possibles : ${attendues.join(", ")}.`);
}

/** Garde des capacités payantes. */
export function exigerAccord(c: Capacite, accord: boolean | undefined) {
  if (PAYANTES.includes(c) && accord !== true) throw new Error(`Génération « ${c} » payante : accord explicite du marchand requis.`);
}

/** Matrice affichée dans le studio : capacité réelle (code), configurée (clé), manquante. */
export function matriceFournisseurs() {
  const capacites: Capacite[] = ["texte", "image", "audio", "video", "avatar"];
  return FOURNISSEURS.map((f) => ({
    id: f.id, nom: f.nom, configure: f.configure(), variables: f.variables, remarque: f.remarque ?? null,
    capacites: capacites.filter((c) => typeof f[c] === "function"),
  }));
}

export const texteParDefaut: FonctionTexte = (messages, o) => fournisseurPour("texte").texte!(messages, o);
