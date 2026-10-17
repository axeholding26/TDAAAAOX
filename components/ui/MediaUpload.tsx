"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/components/I18nProvider";
import { cheminImport } from "@/lib/televerser";

export const ACCEPT = { image: "image/jpeg,image/png,image/webp,image/gif,image/avif", video: "video/mp4,video/webm,video/quicktime" };

/**
 * Envoi d'une image ou d'une vidéo dans le stockage (voir app/api/upload/client) ; renvoie son URL.
 * Stockage indisponible (ex. BLOB_READ_WRITE_TOKEN absent en local) : une petite image est gardée en
 * ligne (data URL), comme ImageUpload ; une vidéo, trop lourde pour la base, ne l'est jamais (null).
 */
export async function importerMedia(type: "image" | "video", file: File, onProgression?: (pct: number) => void): Promise<string | null> {
  try {
    const blob = await upload(await cheminImport(`${type}s`, file.name), file, {
      access: "public",
      handleUploadUrl: "/api/upload/client",
      onUploadProgress: (e) => onProgression?.(Math.round(e.percentage)),
    });
    return blob.url;
  } catch {
    if (type === "image" && file.size <= 2 * 1024 * 1024) {
      return new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(r.result as string); r.readAsDataURL(file); });
    }
    return null;
  }
}

// Bouton « Importer depuis l'appareil » : l'image ou la vidéo part directement
// dans le stockage (voir app/api/upload/client) et son URL remplace le champ.
export function MediaUpload({ type, onUrl }: { type: "image" | "video"; onUrl: (url: string) => void }) {
  const t = useT();
  const ref = useRef<HTMLInputElement>(null);
  const [progression, setProgression] = useState<number | null>(null);

  const envoyer = async (file?: File) => {
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) return void toast.error(t("Fichier trop lourd (100 Mo maximum)"));
    setProgression(0);
    try {
      const url = await importerMedia(type, file, setProgression);
      if (url) { onUrl(url); toast.success(type === "video" ? t("Vidéo importée") : t("Image importée")); }
      else toast.error(t("Import impossible : stockage des fichiers indisponible. Colle plutôt un lien."));
    } finally {
      setProgression(null);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <>
      <input ref={ref} type="file" accept={ACCEPT[type]} className="hidden" onChange={(e) => envoyer(e.target.files?.[0])} />
      <button type="button" onClick={() => ref.current?.click()} disabled={progression !== null}
        className="w-full h-9 flex items-center justify-center gap-2 rounded-lg border border-dashed border-[#D8D8D8] text-[13px] font-medium text-[#555555] hover:border-[#F5A623] hover:text-[#111111] hover:bg-[#FFFBF2] disabled:opacity-60 transition-colors">
        {progression !== null ? <><Loader2 size={14} className="animate-spin" />{" "}{t("Import…")}{" "}{t(progression)} %</> : <><Upload size={14} />{" "}{t("Importer")}{" "}{type === "video" ? t("une vidéo") : t("une image")}{" "}{t("depuis l'appareil")}</>}
      </button>
    </>
  );
}
