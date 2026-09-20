// ─── Bibliothèque AXSO Design (Templates/*.html) — provisionnement ────────────
// Devient LE système de thèmes d'AXSO — remplace progressivement les 16
// anciens thèmes classiques/premium (voir plan de migration). Provisionne
// une vraie boutique à partir d'un des 15 designs de référence, via le
// pipeline de clonage de lib/theme-import-clone.ts. Le manifeste lui-même
// (données pures, importable côté client) vit dans lib/axso-design-manifest.ts
// — CE fichier lit `fs` (Templates/*.html) et écrit en base (prisma), donc
// server-only : ne jamais l'importer depuis un composant "use client".
import { readFileSync } from "fs";
import path from "path";
import { prisma } from "./prisma";
import { resolveThemeConfig, type ThemeConfig } from "./theme-config";
import { prixClient } from "./pricing";
import { formatMontant } from "./utils";
import { MANIFESTE_LIBRAIRIE, selectionnerGabaritLibrairie, type EntreeLibrairie } from "./axso-design-manifest";
import {
  extraireVuesLibrairie,
  injecterGrilleLibrairie,
  type ProduitPourClone,
} from "./theme-import-clone";

export { MANIFESTE_LIBRAIRIE, selectionnerGabaritLibrairie, type EntreeLibrairie };

// Construit le mapping couleurs ThemeConfig → noms de variables CSS en
// comparant les valeurs hex du manifeste aux valeurs de `:root{}` dans le HTML
// brut du template. Stocké une fois dans Theme.config à la provision pour que
// ImportedLiteralHomePage puisse injecter des surcharges précises.
function parseCssVarMapping(
  htmlBrut: string,
  couleurs: EntreeLibrairie["couleurs"],
): Record<string, string> {
  const rootMatch = htmlBrut.match(/:root\s*\{([^}]*)\}/);
  if (!rootMatch) return {};
  const cssVars: Record<string, string> = {};
  for (const decl of rootMatch[1].split(";")) {
    const m = decl.match(/--([a-z0-9-]+)\s*:\s*(#[a-fA-F0-9]{3,6})/i);
    if (m) cssVars[m[1]] = m[2].toLowerCase();
  }
  const mapping: Record<string, string> = {};
  for (const [key, value] of Object.entries(couleurs)) {
    if (!value) continue;
    const lower = value.toLowerCase();
    const found = Object.keys(cssVars)
      .filter((v) => cssVars[v] === lower)
      .map((v) => `--${v}`);
    if (found.length > 0) mapping[key] = found.join(",");
  }
  return mapping;
}

// Provisionne une vraie boutique à partir de la bibliothèque : lit le
// fichier source, clone la grille (accueil + boutique) avec les vrais
// produits du marchand, construit le ThemeConfig complet, crée le Theme en
// base. Ne bind PAS la fiche produit ici (elle se lie à chaque requête —
// voir lierProduitLibrairieAuGabarit, appelée depuis
// app/(storefront)/[slug]/produits/[id]/page.tsx).
export async function provisionerThemeDepuisLibrairie(params: {
  tenantId: string;
  categorie: string;
  produits: ProduitPourClone[];
  slug: string;
  nomBoutique?: string;
  // Force un design précis (ex. "aube-site") plutôt que de le déduire de
  // `categorie` — utilisé quand le marchand choisit lui-même un design dans
  // la galerie (voir app/api/themes/provisionner). `categorie` reste requis
  // dans ce cas pour construire le reste du ThemeConfig (socle structurel).
  fichier?: string;
}): Promise<{ id: string }> {
  const { tenantId, categorie, produits, slug, nomBoutique, fichier } = params;
  const entree = fichier
    ? MANIFESTE_LIBRAIRIE.find((e) => e.fichier === fichier) ?? selectionnerGabaritLibrairie(categorie)
    : selectionnerGabaritLibrairie(categorie);
  const htmlBrut = readFileSync(path.join(process.cwd(), "Templates", entree.fichier), "utf-8");
  const vues = extraireVuesLibrairie({ htmlBrut, slug });
  if (!vues) throw new Error(`Bibliothèque AXSO Design : ${entree.fichier} ne suit pas la convention à 6 vues attendue.`);

  const home = injecterGrilleLibrairie({ vueHtml: vues.home, idConteneur: "homeGrid", carteTemplate: entree.carteTemplate, produits, slug });
  const boutique = injecterGrilleLibrairie({ vueHtml: vues.boutique, idConteneur: "plpGrid", carteTemplate: entree.carteTemplate, produits, slug });

  // Socle structurel (sections/animations/etc. — types requis par
  // ThemeConfig, non fournis par le clonage) : réutilise resolveThemeConfig
  // comme le fait déjà l'import manuel (app/api/themes/importer/route.ts).
  const base = resolveThemeConfig("terre-et-or");
  const axsoDesignCssVarMapping = parseCssVarMapping(htmlBrut, entree.couleurs);
  const config: ThemeConfig = {
    ...base,
    colors: { ...base.colors, ...entree.couleurs },
    fonts: { ...base.fonts, ...entree.polices },
    axsoDesignCssVarMapping,
    builderCss: vues.css,
    builderHtml: vues.chromeAvant + home + vues.chromeApres,
    builderHtmlProduits: vues.chromeAvant + boutique + vues.chromeApres,
    builderHtmlProduit: vues.chromeAvant + vues.produit + vues.chromeApres, // gabarit non lié — voir lierProduitLibrairieAuGabarit
    builderHtmlPanierChrome: vues.chromeAvant + vues.panier + vues.chromeApres,
    builderHtmlCheckoutChrome: vues.chromeAvant + vues.commande + vues.chromeApres,
    builderHtmlConfirmationChrome: vues.chromeAvant + vues.confirmation + vues.chromeApres,
    axsoDesignSelecteurVisuelPdp: entree.selecteurVisuelPdp,
  } as ThemeConfig;

  const theme = await prisma.theme.create({
    data: {
      tenantId,
      nom: entree.nom,
      slug: `axso-design-${entree.fichier.replace(".html", "")}-${Date.now()}`,
      badge: "✦ AXSO Design",
      description: nomBoutique ? `Design ${entree.nom} — ${nomBoutique}` : `Design ${entree.nom}`,
      config: config as any,
      actif: true,
    },
  });

  return { id: theme.id };
}

// Variante pratique pour les points d'entrée qui créent/migrent une boutique
// (inscription, création manuelle, onboarding IA, migration des boutiques
// existantes) : relit les vrais produits déjà en base pour ce tenant (le cas
// échéant — une inscription simple n'en a encore aucun, la grille reste
// alors vide comme le ferait un thème classique fraîchement créé) plutôt que
// d'obliger chaque appelant à reformater lui-même prix/devise/description.
export async function provisionerThemeInitial(params: {
  tenantId: string;
  categorie: string;
  slug: string;
  nomBoutique?: string;
  devise: string;
  commissionRate?: number;
  fichier?: string;
}): Promise<{ id: string }> {
  const { tenantId, categorie, slug, nomBoutique, devise, commissionRate, fichier } = params;
  const produitsDb = await prisma.produit.findMany({
    where: { tenantId, actif: true },
    orderBy: { createdAt: "desc" },
    take: 24,
  });
  const taux = commissionRate ?? 0.06;
  const produits: ProduitPourClone[] = produitsDb.map((p) => ({
    id: p.id,
    nom: p.nom,
    prixAffiche: formatMontant(prixClient(p.prix, taux), devise),
    image: p.images[0] ?? null,
    description: p.description,
  }));
  return provisionerThemeDepuisLibrairie({ tenantId, categorie, produits, slug, nomBoutique, fichier });
}
