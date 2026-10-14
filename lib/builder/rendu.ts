// Vérification visuelle du Builder : la vraie vitrine (aperçu du brouillon) ouverte dans un
// Chromium sans écran à 1280, 768 et 375 px, capture d'écran et mesures du DOM rendu
// (débordement horizontal, éléments hors écran, images cassées, textes illisibles, cibles
// tactiles trop petites, contrastes calculés). La capture sert à VÉRIFIER : la source de
// vérité reste la config structurée. Playwright n'existe qu'en local (devDependency) :
// en production, rendreDisponible() répond non et les analyses statiques restent.

export const LARGEURS = [1280, 768, 375] as const;
const HAUTEUR_MAX = 6000; // px de capture par largeur : au-delà, le fichier devient inutilement lourd

export interface Mesures {
  debordement: number;
  horsEcran: { cible: string | null; quoi: string; droite: number }[];
  imagesCassees: { cible: string | null; src: string }[];
  textesPetits: { cible: string | null; texte: string; taille: number }[];
  ciblesPetites: { cible: string | null; texte: string; largeur: number; hauteur: number }[];
  contrastes: { cible: string | null; texte: string; ratio: number; couleur: string; fond: string }[];
  hauteurPage: number;
}

export interface RenduLargeur { largeur: number; statut: number; mesures: Mesures | null; capture: Buffer | null; erreur?: string }

// Exécuté DANS la page (chaîne : aucun outil de compilation ne doit le transformer).
const SCRIPT = `(() => {
  const W = window.innerWidth, mobile = W < 640;
  const cible = (el) => { const b = el.closest("[data-axs-id]"); return b ? b.getAttribute("data-axs-id") : null; };
  const quoi = (el) => (el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\\s+/).slice(0, 2).join(".") : "")).slice(0, 60);
  const visible = (el) => { const s = getComputedStyle(el), r = el.getBoundingClientRect(); return s.display !== "none" && s.visibility !== "hidden" && +s.opacity > 0 && r.width > 0 && r.height > 0; };
  const txt = (el) => (el.innerText || el.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim().slice(0, 50);
  const rgb = (c) => { const m = /rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?/.exec(c); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const fondDe = (el) => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.backgroundImage !== "none") return null; const c = rgb(s.backgroundColor); if (c && c[3] > 0.9) return c; } return [255, 255, 255, 1]; };
  const out = { debordement: Math.max(0, document.documentElement.scrollWidth - W), horsEcran: [], imagesCassees: [], textesPetits: [], ciblesPetites: [], contrastes: [], hauteurPage: document.documentElement.scrollHeight };
  const tous = Array.from(document.body.querySelectorAll("*"));
  // Hors écran : seulement si la page défile vraiment de côté (un carrousel masqué n'en est pas un).
  if (out.debordement > 0) for (const el of tous) {
    if (out.horsEcran.length >= 10) break;
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > W + 2 && r.width < W * 3) out.horsEcran.push({ cible: cible(el), quoi: quoi(el), droite: Math.round(r.right) });
  }
  for (const img of Array.from(document.images)) if (img.getAttribute("src") && img.complete && img.naturalWidth === 0 && out.imagesCassees.length < 15) out.imagesCassees.push({ cible: cible(img), src: (img.currentSrc || img.src).slice(0, 120) });
  const vus = new Set();
  for (const el of tous) {
    if (!visible(el)) continue;
    const direct = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!direct) continue;
    const s = getComputedStyle(el), taille = parseFloat(s.fontSize);
    if (taille < 12 && out.textesPetits.length < 10) out.textesPetits.push({ cible: cible(el), texte: txt(el), taille });
    const c = rgb(s.color), f = fondDe(el);
    if (c && f && out.contrastes.length < 10) {
      const [a, b] = [lum(c), lum(f)].sort((x, y) => y - x), ratio = Math.round((a + 0.05) / (b + 0.05) * 100) / 100;
      const grand = taille >= 24 || (taille >= 18.66 && +s.fontWeight >= 700);
      const cle = s.color + "|" + f.join(",");
      if (ratio < (grand ? 3 : 4.5) && !vus.has(cle)) { vus.add(cle); out.contrastes.push({ cible: cible(el), texte: txt(el), ratio, couleur: s.color, fond: "rgb(" + f.slice(0, 3).join(", ") + ")" }); }
    }
  }
  if (mobile) for (const el of Array.from(document.querySelectorAll("a[href], button, [role=button], input[type=submit]"))) {
    if (out.ciblesPetites.length >= 15) break;
    if (!visible(el) || el.closest("p, li p")) continue;
    const r = el.getBoundingClientRect();
    if (r.height < 44 || r.width < 44) out.ciblesPetites.push({ cible: cible(el), texte: txt(el), largeur: Math.round(r.width), hauteur: Math.round(r.height) });
  }
  return out;
})()`;

/** Playwright et Chromium sont-ils là ? (non en production). */
export async function chargerPlaywright(): Promise<typeof import("playwright") | null> {
  try {
    const pw: typeof import("playwright") = await import(/* webpackIgnore: true */ "playwright");
    return pw?.chromium ? pw : null;
  } catch { return null; }
}

/**
 * Ouvre `url` (lien d'aperçu signé : il pose le cookie du brouillon puis redirige vers la
 * vitrine) à chaque largeur, mesure et capture. Un navigateur par appel, fermé à la fin.
 */
export async function rendre(url: string, largeurs: readonly number[] = LARGEURS, avancer?: (p: number, etape: string) => Promise<void>): Promise<RenduLargeur[]> {
  const pw = await chargerPlaywright();
  if (!pw) throw new Error("PLAYWRIGHT_ABSENT");
  const navigateur = await pw.chromium.launch({ headless: true });
  try {
    const out: RenduLargeur[] = [];
    for (const [i, largeur] of largeurs.entries()) {
      await avancer?.((i / largeurs.length) * 90, `rendu à ${largeur} px`);
      const contexte = await navigateur.newContext({ viewport: { width: largeur, height: largeur < 640 ? 812 : 900 }, deviceScaleFactor: 1, isMobile: largeur < 640, hasTouch: largeur < 640 });
      const page = await contexte.newPage();
      try {
        // « load » puis réseau calme si possible : une page qui garde une connexion ouverte (vidéo, suivi) n'est jamais « idle ».
        let erreur: string | undefined;
        const rep = await page.goto(url, { waitUntil: "load", timeout: 45_000 }).catch((e) => { erreur = String(e?.message ?? e).split("\n")[0].replace(/ at https?:.*$/, "").slice(0, 160); return null; });
        await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
        const statut = rep?.status() ?? 0;
        if (!rep || statut >= 400) { out.push({ largeur, statut, mesures: null, capture: null, erreur }); continue; }
        // Fait défiler pour déclencher les images en chargement différé, puis revient en haut.
        await page.evaluate(`(async () => { for (let y = 0; y < Math.min(document.body.scrollHeight, ${HAUTEUR_MAX}); y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); } window.scrollTo(0, 0); })()`);
        await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
        const mesures = (await page.evaluate(SCRIPT)) as Mesures;
        const capture = await page.screenshot({ type: "jpeg", quality: 60, fullPage: true, clip: { x: 0, y: 0, width: largeur, height: Math.min(mesures.hauteurPage, HAUTEUR_MAX) } });
        out.push({ largeur, statut, mesures, capture });
      } finally { await contexte.close(); }
    }
    return out;
  } finally { await navigateur.close(); }
}
