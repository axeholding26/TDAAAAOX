// Analyse design et UX (pur) : cohérence visuelle des blocs (couleurs, polices, boutons
// dispersés) et défauts visibles par le client (image vide, galerie trouée, section vide,
// page libre sans contenu, en-tête ou pied de page absent).
import type { ThemeConfig } from "@/lib/theme-config";
import { corr, noeuds, pagesDe, pb, type Boutique, type Probleme } from "./commun";

export function analyserDesign(cfg: ThemeConfig, b: Boutique): Probleme[] {
  const out: Probleme[] = [];
  const tous = noeuds(cfg);

  const couleurs = new Set<string>(), polices = new Set<string>(), styles = new Set<string>();
  for (const { n } of tous) {
    const s = n.style ?? {};
    for (const c of [s.typography?.color, s.background?.color]) if (c) couleurs.add(c.toLowerCase());
    if (s.typography?.police) polices.add(s.typography.police);
    if (n.type === "button") styles.add(`${n.config?.style ?? "primary"}/${n.config?.taille ?? "md"}`);
  }
  if (couleurs.size > 6) out.push(pb("attention", "design", "theme:colors", `${couleurs.size} couleurs forcées bloc par bloc : la palette se disperse. Repasse par les couleurs du thème (accent, texte, surface).`));
  if (polices.size > 1) out.push(pb("attention", "design", "theme:fonts", `${polices.size} polices forcées sur des blocs (${[...polices].join(", ")}) en plus de celles du thème.`));
  if (styles.size > 3) out.push(pb("info", "design", "theme:boutons", `${styles.size} variantes de boutons (${[...styles].join(", ")}) : garde un bouton principal et un secondaire.`));

  for (const { page, n } of tous) {
    const c = n.config ?? {};
    if (n.type === "image" && !c.url) out.push(pb("critique", "ux", n.id, `${page} : bloc Image sans image — le client voit « Aucune image ».`));
    if (n.type === "gallery" && (c.images ?? []).some((u: string) => !u)) {
      const pleines = (c.images ?? []).filter(Boolean);
      out.push(pb("critique", "ux", n.id, `${page} : galerie avec ${(c.images ?? []).length - pleines.length} emplacement(s) vide(s), affichés comme des images cassées.`, pleines.length ? corr.configBloc(page, n.id, { images: pleines }) : null));
    }
    if ((n.type === "section" || n.type === "column") && !(n.children ?? []).some((e) => e.actif !== false)) {
      out.push(pb(n.type === "section" ? "attention" : "info", "ux", n.id, `${page} : ${n.type === "section" ? "section" : "colonne"} vide.`,
        n.type === "section" ? corr.supprimerSection(page, n.id) : null));
    }
    if ((n.type === "button" || n.type === "cta-band") && !(c.texte ?? c.ctaTexte)) out.push(pb("attention", "ux", n.id, `${page} : bouton sans texte.`));
  }

  for (const p of pagesDe(cfg, b)) {
    if (p.cle !== "accueil" && !p.elements.length) out.push(pb("critique", "ux", `page:${p.cle}`, `${p.nom} : page libre vide.`));
    if (p.sections.length && cfg.builderTree?.length && p.cle === "accueil") {
      const zones = new Set(p.sections.map((s) => s.config?.zone ?? "template"));
      // Un arbre découpé en zones sans en-tête : la boutique n'a plus de menu ni de logo.
      if (zones.size > 1 && !zones.has("header")) out.push(pb("critique", "ux", "page:accueil", "Pas d'en-tête : la boutique n'a plus de menu ni de logo."));
      if (zones.size > 1 && !zones.has("footer")) out.push(pb("attention", "ux", "page:accueil", "Pas de pied de page : contact, réseaux et pages légales introuvables."));
    }
  }
  return out;
}
