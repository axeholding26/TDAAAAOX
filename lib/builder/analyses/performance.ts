// Analyse de performance (pur) : images (nombre, poids et dimensions connus, chargement
// différé, décalage de mise en page), scripts (CSS libre, scripts de suivi — tailles
// seulement, jamais leur contenu), polices, poids du HTML importé, médias inutilisés.
// Rendu actuel (components/storefront/blocks) : le bloc Image n'a ni loading="lazy" ni
// dimensions ; la Galerie est en différé ; les cartes de produits ont un ratio fixe.
import type { ThemeConfig } from "@/lib/theme-config";
import { corr, noeuds, pagesDe, pb, type Boutique, type Probleme } from "./commun";

export function analyserPerformance(cfg: ThemeConfig, b: Boutique): Probleme[] {
  const out: Probleme[] = [];
  const pages = pagesDe(cfg, b);
  const medias = new Map((b.medias ?? []).map((m) => [m.url, m]));

  for (const p of pages) {
    const images = p.elements.filter((e) => e.sorte === "image" && e.url);
    if (images.length > 30) out.push(pb("attention", "performance", `page:${p.cle}`, `${p.nom} : ${images.length} images — page lourde au premier chargement.`));
    // Au-delà du premier écran, une image non différée ralentit l'affichage.
    const tardives = images.filter((e, i) => i > 2 && e.differe === false);
    if (tardives.length) out.push(pb("info", "performance", tardives[0].bloc, `${p.nom} : ${tardives.length} image(s) plus bas dans la page chargées tout de suite (sans loading="lazy").`));
    for (const e of images) {
      if (e.dimensionne === false) out.push(pb("info", "performance", e.bloc, `${p.nom} : image sans ratio ni dimensions — la page « saute » quand elle arrive (CLS).${e.typeBloc === "image" ? " Choisis un ratio (carré, 16:9, portrait) qui respecte la photo." : ""}`));
      const m = medias.get(e.url!);
      if (m?.octets && m.octets > 400_000) out.push(pb(m.octets > 1_500_000 ? "critique" : "attention", "performance", e.bloc, `${p.nom} : image de ${Math.round(m.octets / 1024)} Ko${m.largeur ? ` (${m.largeur}×${m.hauteur})` : ""} — compresse-la (WebP, < 300 Ko).`));
      else if (m?.largeur && m.largeur > 2600) out.push(pb("info", "performance", e.bloc, `${p.nom} : image de ${m.largeur} px de large — inutile au-delà de 2000 px.`));
    }
    const videos = p.elements.filter((e) => e.sorte === "video");
    if (videos.length > 2) out.push(pb("attention", "performance", videos[0].bloc, `${p.nom} : ${videos.length} vidéos sur la page.`));
    if (p.htmlOctets > 250_000) out.push(pb("attention", "performance", `page:${p.cle}`, `${p.nom} : ${Math.round(p.htmlOctets / 1024)} Ko de contenu (design importé compris) à transmettre avant l'affichage.`));
  }
  for (const { page, n } of noeuds(cfg)) {
    if (n.type === "video" && n.config?.autoplay) out.push(pb("info", "performance", n.id, `${page} : vidéo en lecture automatique — consomme les données mobiles dès l'arrivée.`, corr.configBloc(page, n.id, { autoplay: false })));
  }

  // Scripts et styles.
  const css = (cfg.customCss ?? "").length + (cfg.builderCss ?? "").length;
  if (css > 80_000) out.push(pb("attention", "performance", "theme:css", `${Math.round(css / 1024)} Ko de CSS (design + CSS personnalisé).`));
  if (b.scripts && b.scripts.octets > 20_000) out.push(pb("attention", "performance", "boutique:scripts", `Scripts de suivi personnalisés : ${Math.round(b.scripts.octets / 1024)} Ko chargés sur chaque page.`));
  if (b.scripts && b.scripts.pixels + (b.scripts.octets ? 1 : 0) > 3) out.push(pb("info", "performance", "boutique:scripts", `${b.scripts.pixels} pixels de suivi actifs${b.scripts.octets ? " + scripts personnalisés" : ""} : chacun ralentit l'ouverture de la page.`));

  // Polices : chaque famille est un téléchargement de plus.
  const familles = new Set([cfg.fonts?.titre, cfg.fonts?.corps, cfg.axsoDesignPolices?.titre, cfg.axsoDesignPolices?.corps].filter(Boolean).map((f) => String(f).toLowerCase()));
  for (const { n } of noeuds(cfg)) if (n.style?.typography?.police) familles.add(n.style.typography.police.toLowerCase());
  if (familles.size > 3) out.push(pb("attention", "performance", "theme:fonts", `${familles.size} familles de polices (${[...familles].join(", ")}) — 2 suffisent ; chaque famille retarde l'affichage du texte.`));

  // Médias de la médiathèque jamais utilisés (ni dans la boutique, ni sur un produit).
  if (b.medias?.length) {
    const texte = JSON.stringify(cfg) + JSON.stringify(b.produits.map((p) => p.images)) + (b.bannerUrl ?? "") + (b.logoUrl ?? "");
    const inutiles = b.medias.filter((m) => !m.url.startsWith("data:") && !texte.includes(m.url));
    if (inutiles.length > 5) out.push(pb("info", "performance", "medias", `${inutiles.length} médias de la médiathèque ne sont utilisés nulle part (rangement possible, sans effet sur la vitesse).`));
  }
  return out;
}
