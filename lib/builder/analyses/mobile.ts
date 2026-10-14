// Analyse mobile (pur) : ce qui casse ou gêne sur un téléphone de 375 px. Les rangées du
// Constructeur s'empilent d'elles-mêmes sous 640 px et la grille de produits passe à 2
// colonnes (components/storefront/blocks) : on ne signale que ce que la config peut forcer.
import type { ThemeConfig } from "@/lib/theme-config";
import { corr, noeuds, pagesDe, pb, px, tronquer, type Boutique, type Probleme } from "./commun";

const ECRAN = 375;

export function analyserMobile(cfg: ThemeConfig, b: Boutique): Probleme[] {
  const out: Probleme[] = [];
  const pages = pagesDe(cfg, b);

  for (const p of pages) {
    for (const e of p.elements) {
      const taille = px(e.policeMobile ?? e.police);
      // Les titres du Constructeur ont déjà une taille mobile ; seule une taille forcée sans surcharge mobile compte.
      if (taille && !e.policeMobile && taille > (e.sorte === "titre" ? 40 : 22)) {
        const mobile = e.sorte === "titre" ? "32px" : "18px";
        out.push(pb("attention", "mobile", e.bloc, `${p.nom} : ${e.sorte} « ${tronquer(e.texte, 40)} » en ${taille}px aussi sur mobile — risque de débordement ou de mots coupés.`,
          e.source === "bloc" ? corr.styleMobile(p.cle, e.bloc, { typography: { taille: mobile } })
            : e.elId ? corr.styleElement(p.cle, e.elId, { taille: mobile }, "mobile") : null));
      }
      if (taille && taille < 12) out.push(pb("attention", "mobile", e.bloc, `${p.nom} : texte en ${taille}px, illisible sur téléphone (minimum 12 px, idéal 16 px).`,
        e.source === "bloc" ? corr.styleBloc(p.cle, e.bloc, { typography: { taille: "14px" } }) : e.elId ? corr.styleElement(p.cle, e.elId, { taille: "14px" }) : null));
      // Bouton « sm » du Constructeur : px-4 py-2 text-xs ≈ 32 px de haut, sous la cible tactile de 44 px.
      if (e.sorte === "bouton" && e.taille === "sm") out.push(pb("attention", "mobile", e.bloc, `${p.nom} : bouton « ${tronquer(e.texte, 30)} » trop petit pour le doigt (≈ 32 px de haut, minimum 44 px).`, corr.configBloc(p.cle, e.bloc, { taille: "md" })));
      // Largeur d'un bloc du Constructeur = flex-basis qui rétrécit (styleUtils.ts) : jamais de débordement, vérifié au rendu.
      // Seule une vraie largeur CSS d'un élément de design peut dépasser.
      const larg = e.source === "design" ? px(e.largeurMobile ?? e.largeur) : null;
      if (larg && larg > ECRAN - 20 && !e.largeurMobile) out.push(pb("critique", "mobile", e.bloc, `${p.nom} : largeur fixe de ${larg}px — dépasse l'écran d'un téléphone (${ECRAN} px), la page défile de côté.`,
        e.elId ? corr.styleElement(p.cle, e.elId, { largeur: "100%" }, "mobile") : null));
    }

    // Au-dessus de la ligne de flottaison : un appel à l'action dans la première section de contenu.
    const premiere = p.elements.find((e) => e.zone === "template")?.section;
    if (premiere && !p.elements.some((e) => e.section === premiere && e.sorte === "bouton" || (e.section === premiere && e.sorte === "lien" && e.texte && e.lien))) {
      out.push(pb("attention", "mobile", premiere, `${p.nom} : aucun bouton d'action dans le premier écran — sur mobile, le visiteur doit défiler avant de pouvoir agir.`));
    }
    const contenu = p.sections.filter((s) => s.actif !== false && (s.config?.zone ?? "template") === "template");
    if (contenu.length > 12) out.push(pb("info", "mobile", `page:${p.cle}`, `${p.nom} : ${contenu.length} sections — page très longue sur mobile ; regroupe ou retire les moins utiles.`));
    const liensEntete = p.elements.filter((e) => e.zone === "header" && (e.sorte === "lien" || e.sorte === "bouton"));
    if (liensEntete.length > 8) out.push(pb("attention", "mobile", liensEntete[0].section, `${p.nom} : ${liensEntete.length} liens dans l'en-tête — navigation trop chargée pour un téléphone (vise 5 à 7).`));
  }

  // Blocs du Constructeur : marges latérales et espacements forcés sans valeur mobile.
  for (const { page, n } of noeuds(cfg)) {
    const s = n.style ?? {}, m = s.responsive?.mobile?.spacing ?? {};
    const lat = Math.max(px(s.spacing?.pl) ?? 0, px(s.spacing?.pr) ?? 0, px(s.spacing?.ml) ?? 0, px(s.spacing?.mr) ?? 0);
    if (lat > 48 && !m.pl && !m.pr && !m.ml && !m.mr) out.push(pb("attention", "mobile", n.id, `${page} : marge latérale de ${lat}px gardée sur mobile — le contenu est écrasé.`, corr.styleMobile(page, n.id, { spacing: { pl: "16px", pr: "16px" } })));
    const vert = Math.max(px(s.spacing?.pt) ?? 0, px(s.spacing?.pb) ?? 0);
    if (vert > 120 && !m.pt && !m.pb) out.push(pb("info", "mobile", n.id, `${page} : espacement vertical de ${vert}px aussi sur mobile — beaucoup de vide à faire défiler.`, corr.styleMobile(page, n.id, { spacing: { pt: "48px", pb: "48px" } })));
    if (n.type === "spacer" && (px(n.config?.hauteur) ?? 0) > 120) out.push(pb("info", "mobile", n.id, `${page} : espacement de ${n.config?.hauteur} — trop haut sur mobile.`, corr.configBloc(page, n.id, { hauteur: "48px" })));
  }

  // Accueil du socle : grille produits mobile.
  if ((cfg.layout?.colonnesMobile ?? 2) > 2) out.push(pb("attention", "mobile", "theme:layout", `Grille produits à ${cfg.layout?.colonnesMobile} colonnes sur mobile : cartes trop étroites, prix et noms illisibles.`, corr.miseEnPage({ colonnesMobile: 2 })));

  // Images lourdes (poids connu par la médiathèque).
  const poids = new Map((b.medias ?? []).filter((m) => m.octets).map((m) => [m.url, m.octets!]));
  for (const p of pages) for (const e of p.elements) {
    const o = e.sorte === "image" && e.url ? poids.get(e.url) : undefined;
    if (o && o > 500_000) out.push(pb(o > 1_500_000 ? "critique" : "attention", "mobile", e.bloc, `${p.nom} : image de ${Math.round(o / 1024)} Ko — lente à charger en 3G/4G (vise moins de 300 Ko).`));
  }
  return out;
}
