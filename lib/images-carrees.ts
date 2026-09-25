// Photos produit du catalogue : carrées obligatoires (tolérance 2 %, ex.
// 1000×1015 accepté, 1000×1200 refusé) — la grille du catalogue les affiche
// en carré. Navigateur uniquement (formulaires produit).

export const estCarre = (l: number, h: number) => l > 0 && h > 0 && Math.abs(l - h) <= 0.02 * Math.max(l, h);

/** Dimensions réelles d'une image (fichier ou URL). */
export function dimensions(src: File | string): Promise<{ l: number; h: number }> {
  return new Promise((ok, ko) => {
    const url = typeof src === "string" ? src : URL.createObjectURL(src);
    const img = new Image();
    img.onload = () => { ok({ l: img.naturalWidth, h: img.naturalHeight }); if (typeof src !== "string") URL.revokeObjectURL(url); };
    img.onerror = () => ko(new Error("Image illisible"));
    img.src = url;
  });
}

/** Envoie les images carrées (une ou plusieurs) ; les autres sont refusées avec leurs dimensions. Ne lève jamais : un échec d'envoi est rendu dans `erreur`, sans masquer les refus. */
export async function envoyerImagesCarrees(fichiers: File[]): Promise<{ urls: string[]; refusees: string[]; erreur?: string }> {
  const urls: string[] = [], refusees: string[] = [];
  let erreur: string | undefined;
  for (const f of fichiers) {
    const { l, h } = await dimensions(f).catch(() => ({ l: 0, h: 0 }));
    if (!estCarre(l, h)) { refusees.push(l ? `${f.name} (${l}×${h})` : f.name); continue; }
    const fd = new FormData();
    fd.append("file", f);
    const res = await fetch("/api/upload", { method: "POST", body: fd }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) { erreur = data.error === "blob_not_configured" ? "Stockage des fichiers non configuré" : data.error || "Erreur upload"; continue; }
    urls.push(data.url);
  }
  return { urls, refusees, erreur };
}

export const MESSAGE_REFUS = (refusees: string[]) => `Image${refusees.length > 1 ? "s" : ""} refusée${refusees.length > 1 ? "s" : ""} — elle${refusees.length > 1 ? "s" : ""} doi${refusees.length > 1 ? "vent" : "t"} être carrée${refusees.length > 1 ? "s" : ""} : ${refusees.join(", ")}`;
