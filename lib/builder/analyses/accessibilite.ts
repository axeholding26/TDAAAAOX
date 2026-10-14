// Analyse d'accessibilité (pur) : contrastes WCAG réels entre les couleurs du thème et des
// blocs, textes alternatifs, hiérarchie des titres, liens et boutons sans nom, éléments
// cliquables sans adresse (non focusables au clavier), champs sans libellé.
// Les contrastes du CSS d'un design importé ne se calculent pas sans rendu : la vérification
// visuelle (axso_builder_render_check) les mesure dans la vraie page.
import type { ThemeConfig } from "@/lib/theme-config";
import { ajusterContraste, contraste, corr, noeuds, pagesDe, pb, px, tronquer, type Boutique, type Probleme } from "./commun";

const AA = 4.5, AA_GRAND = 3;

export function analyserAccessibilite(cfg: ThemeConfig, b: Boutique): Probleme[] {
  const out: Probleme[] = [];
  const c = cfg.colors;

  // Thème : paires réellement utilisées par les blocs (texte sur fond, bouton plein, bande CTA, surfaces).
  const paires: [keyof typeof c, keyof typeof c, string, number][] = [
    ["texte", "fond", "texte principal sur le fond", AA],
    ["texte", "surface", "texte sur les cartes (surface)", AA],
    ["texteMuted", "fond", "texte secondaire sur le fond", AA],
    // Texte des boutons : 14-15 px, donc seuil du texte normal.
    ["fond", "accent", "texte des boutons et bandes CTA sur la couleur d'accent", AA],
  ];
  for (const [t, f, quoi, seuil] of paires) {
    const r = contraste(c[t], c[f]);
    if (r === null || r >= seuil) continue;
    // On corrige la couleur du texte (sauf boutons : on fonce l'accent, qui porte le texte).
    const [aCorriger, sur] = t === "fond" ? [f, t] : [t, f];
    const neuve = ajusterContraste(String(c[aCorriger]), String(c[sur]), seuil + 0.1);
    out.push(pb(r < AA_GRAND ? "critique" : "attention", "accessibilite", `theme:colors.${aCorriger}`,
      `Contraste insuffisant pour le ${quoi} : ${r}:1 (${c[t]} sur ${c[f]}), minimum ${seuil}:1.${neuve ? ` ${aCorriger} → ${neuve} suffirait.` : ""}`,
      neuve ? corr.couleurs({ [aCorriger]: neuve }) : null));
  }

  // Blocs avec couleur de texte ou de fond forcée.
  for (const { page, n, fond } of noeuds(cfg)) {
    const couleur = n.style?.typography?.color;
    const surFond = n.style?.background?.color ?? fond ?? c.fond;
    if (!couleur && !n.style?.background?.color) continue;
    const r = contraste(couleur ?? c.texte, surFond);
    const grand = (px(n.style?.typography?.taille) ?? 16) >= 24 || n.type === "heading";
    const seuil = grand ? AA_GRAND : AA;
    if (r !== null && r < seuil) {
      const neuve = ajusterContraste(couleur ?? c.texte, surFond, seuil + 0.1);
      out.push(pb(r < 2 ? "critique" : "attention", "accessibilite", n.id, `${page} : bloc ${n.type} — contraste ${r}:1 (${couleur ?? c.texte} sur ${surFond}), minimum ${seuil}:1.`,
        neuve ? corr.styleBloc(page, n.id, { typography: { color: neuve } }) : null));
    }
  }

  for (const p of pagesDe(cfg, b)) {
    for (const e of p.elements) {
      if (e.sorte === "image" && e.url && e.alt === null) out.push(pb("attention", "accessibilite", e.bloc, `${p.nom} : image sans attribut alt (${tronquer(e.url.split("/").pop(), 40)}) — un lecteur d'écran lit le nom du fichier.`));
      if ((e.sorte === "lien" || e.sorte === "bouton") && !e.texte?.trim()) out.push(pb("attention", "accessibilite", e.bloc, `${p.nom} : ${e.sorte} sans texte ni aria-label — annoncé « lien » sans destination compréhensible.`));
      if (e.sorte === "lien" && e.lien === null && e.source === "design") out.push(pb("info", "accessibilite", e.bloc, `${p.nom} : « ${tronquer(e.texte, 30)} » ressemble à un lien mais n'a pas d'adresse — inaccessible au clavier.`));
      if (e.sorte === "champ" && !e.texte) out.push(pb("attention", "accessibilite", e.bloc, `${p.nom} : champ de formulaire sans libellé${e.alt ? ` (seulement un texte indicatif « ${tronquer(e.alt, 30)} », qui disparaît à la saisie)` : ""}.`));
      if (e.couleur && e.fond && e.source === "design") {
        const r = contraste(e.couleur, e.fond);
        if (r !== null && r < AA) out.push(pb("attention", "accessibilite", e.bloc, `${p.nom} : « ${tronquer(e.texte, 30)} » — contraste ${r}:1 (${e.couleur} sur ${e.fond}).`));
      }
    }
    const titres = p.elements.filter((e) => e.sorte === "titre" && e.zone === "template");
    if (titres.length && titres[0].niveau! > 2) out.push(pb("info", "accessibilite", titres[0].bloc, `${p.nom} : la page commence par un titre h${titres[0].niveau} — la navigation par titres saute le début.`));
  }
  return out;
}
