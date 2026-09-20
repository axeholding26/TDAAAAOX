// ─── Manifeste de la bibliothèque AXSO Design (données pures) ─────────────────
// Séparé de lib/axso-design-library.ts pour rester importable depuis un
// composant client (ex. app/(auth)/inscription/page.tsx) : ce fichier ne
// touche ni `fs` ni `prisma`, contrairement à lib/axso-design-library.ts qui
// lit Templates/*.html et écrit en base — celui-ci est server-only.
//
// Le MANIFESTE ci-dessous est figé une fois pour toutes (produit par
// lib/gemini.ts::extraireGabaritsLibrairie, appelé une seule fois par
// fichier via app/api/internal/build-library-manifest — jamais à
// l'exécution normale) : carteTemplate (gabarit HTML tokenisé de la carte
// produit, seul élément bespoke par design puisque généré par une fonction
// JS jamais exécutée) et selecteurVisuelPdp (conteneur du visuel principal
// en fiche produit).
import { detectCategory, type CategoryType } from "./generate-store-config";

export interface EntreeLibrairie {
  fichier: string;
  nom: string;
  categories: CategoryType[];
  carteTemplate: string;
  selecteurVisuelPdp: string;
  couleurs: { fond?: string; accent?: string; texte?: string; surface?: string };
  polices: { titre?: string; corps?: string };
  ambiance: string[];
}

// Figé le 2026-09-12 par app/api/internal/build-library-manifest — 15/15
// fichiers analysés avec succès (sur les 18 fournis ; codex-site.html,
// noir-atelier-single.html et pulse-site.html sont mono-page, hors
// périmètre de cette bibliothèque pour l'instant).
export const MANIFESTE_LIBRAIRIE: EntreeLibrairie[] = [
  {
    fichier: "aube-site.html", nom: "AUBE", categories: ["jewelry"],
    carteTemplate: `<a href="{{LIEN}}" class="pcard">
    <div class="frame">
        <img src="{{IMAGE}}" alt="{{NOM}}" style="width:100%;height:100%;object-fit:cover;">
    </div>
    <div class="name">{{NOM}}</div>
    <div class="price">{{PRIX}}</div>
</a>`,
    selecteurVisuelPdp: "#pdpFrame",
    couleurs: { fond: "#F7F3EC", accent: "#B8935A", texte: "#2A2016", surface: "#EFE7D8" },
    polices: { titre: "italiana", corps: "jost" },
    ambiance: ["raffiné", "minimaliste"],
  },
  {
    fichier: "cadran-site.html", nom: "CADRAN", categories: ["jewelry"],
    carteTemplate: `<a class="pcard" href="{{LIEN}}"><div class="media"><img src="{{IMAGE}}" alt="{{NOM}}" style="width:100%;height:100%;object-fit:cover;"></div><div class="name">{{NOM}}</div><div class="price">{{PRIX}}</div></a>`,
    selecteurVisuelPdp: "#pdpStage",
    couleurs: { fond: "#F5F1E8", accent: "#A8823D", texte: "#1C1A16", surface: "#EAE2D0" },
    polices: { titre: "cormorant", corps: "inter" },
    ambiance: ["raffinée", "horlogère"],
  },
  {
    fichier: "circuit-site.html", nom: "CIRCUIT", categories: ["auto", "sport"],
    carteTemplate: `<a href="{{LIEN}}" class="pcard" data-id="{{ID}}"><div class="media"><img src="{{IMAGE}}" alt="{{NOM}}" style="width:100%;height:100%;object-fit:cover;"></div><div class="info"><div class="name">{{NOM}}</div><div class="price"><span class="now">{{PRIX}}</span></div></div></a>`,
    selecteurVisuelPdp: "#pdpMain",
    couleurs: { fond: "#0D0D0F", accent: "#E8142E", texte: "#F5F5F5", surface: "#18181B" },
    polices: { titre: "oswald", corps: "inter" },
    ambiance: ["technique", "industriel", "minimaliste", "dynamique"],
  },
  {
    fichier: "clarte-site.html", nom: "CLARTÉ", categories: ["beauty"],
    carteTemplate: `<a href="{{LIEN}}" class="pcard" data-id="{{ID}}">
    <div class="media">
      <img src="{{IMAGE}}" alt="{{NOM}}" style="width:100%;height:100%;object-fit:cover;">
    </div>
    <div class="name">{{NOM}}</div>
    <div class="price">{{PRIX}}</div>
  </a>`,
    selecteurVisuelPdp: "#pdpMain",
    couleurs: { fond: "#F4F7F3", accent: "#5B8A6B", texte: "#1F2A22", surface: "#E3ECE2" },
    polices: { titre: "plus-jakarta-sans", corps: "plus-jakarta-sans" },
    ambiance: ["naturelle", "clinique", "apaisante"],
  },
  {
    fichier: "equilibre-site.html", nom: "ÉQUILIBRE", categories: ["health", "services"],
    carteTemplate: `<a href="{{LIEN}}" class="pcard"><div class="media"><img src="{{IMAGE}}" alt="{{NOM}}" style="width:100%;height:100%;object-fit:cover;"></div><div class="name">{{NOM}}</div><div class="price">{{PRIX}}</div></a>`,
    selecteurVisuelPdp: "#pdpMain",
    couleurs: { fond: "#FAF7F2", accent: "#8FA888", texte: "#2B2620", surface: "#F0EAE0" },
    polices: { titre: "lora", corps: "inter" },
    ambiance: ["apaisant", "organique"],
  },
  {
    fichier: "grind-site.html", nom: "GRIND", categories: ["sport"],
    carteTemplate: `<a href="{{LIEN}}" class="pcard" data-id="{{ID}}"><div class="media"><img src="{{IMAGE}}" alt="{{NOM}}" style="width:100%;height:100%;object-fit:cover;"></div><div class="info"><div class="name">{{NOM}}</div><div class="price"><span class="now">{{PRIX}}</span></div></div></a>`,
    selecteurVisuelPdp: "#spinFrame",
    couleurs: { fond: "#111111", accent: "#FF5C00", texte: "#F5F5F0", surface: "#1C1C1C" },
    polices: { titre: "anton", corps: "inter" },
    ambiance: ["urbain", "brut"],
  },
  {
    fichier: "halle-site.html", nom: "HALLE", categories: ["home"],
    carteTemplate: `<a href="{{LIEN}}" class="pcard" data-id="{{ID}}"><div class="media"><img src="{{IMAGE}}" alt="{{NOM}}" style="width:100%;height:100%;object-fit:cover;"></div><div class="info"><span class="name">{{NOM}}</span><span class="price">{{PRIX}}</span></div></a>`,
    selecteurVisuelPdp: "#pdpMain",
    couleurs: { fond: "#EDEBE6", accent: "#8B5E34", texte: "#242220", surface: "#DED9D0" },
    polices: { titre: "work-sans", corps: "work-sans" },
    ambiance: ["minimaliste", "artisanal", "sophistiqué"],
  },
  {
    fichier: "ignite-site.html", nom: "IGNITE", categories: ["food"],
    carteTemplate: `<a href="{{LIEN}}" class="pcard" data-id="{{ID}}"><div class="media"><img src="{{IMAGE}}" alt="{{NOM}}" style="width:100%;height:100%;object-fit:cover;"></div><div class="name">{{NOM}}</div><div class="price"><span class="now">{{PRIX}}</span></div></a>`,
    selecteurVisuelPdp: "#pdpCan",
    couleurs: { fond: "#0C0C0C", accent: "#D7FF3D", texte: "#F5F5F0", surface: "#181818" },
    polices: { titre: "anton", corps: "inter" },
    ambiance: ["énergique", "moderne"],
  },
  {
    fichier: "ndop-site.html", nom: "NDOP", categories: ["fashion", "artisan"],
    carteTemplate: `<a class="pcard" href="{{LIEN}}"><div class="media"><img src="{{IMAGE}}" alt="{{NOM}}" style="width:100%;height:100%;object-fit:cover;"></div><div class="info"><span class="name">{{NOM}}</span><span class="price">{{PRIX}}</span></div></a>`,
    selecteurVisuelPdp: "#pdpMain",
    couleurs: { fond: "#F7F1E4", accent: "#B5522E", texte: "#241A0E", surface: "#EFE3C8" },
    polices: { titre: "archivo", corps: "work-sans" },
    ambiance: ["authentique", "artisanal"],
  },
  {
    fichier: "nexus-site.html", nom: "NEXUS", categories: ["tech"],
    carteTemplate: `<a class="pcard" data-id="{{ID}}" href="{{LIEN}}"><div class="media"><img src="{{IMAGE}}" alt="{{NOM}}" style="width:100%;height:100%;object-fit:cover;"></div><div class="info"><div class="name">{{NOM}}</div><div class="price">{{PRIX}}</div></div></a>`,
    selecteurVisuelPdp: ".pdp-stage .frame",
    couleurs: { fond: "#0A0E17", accent: "#00E5FF", texte: "#E8ECF5", surface: "#121826" },
    polices: { titre: "rajdhani", corps: "inter" },
    ambiance: ["technologique", "moderne"],
  },
  {
    fichier: "onze-site.html", nom: "ONZE", categories: ["sport"],
    carteTemplate: `<a class="pcard" href="{{LIEN}}"><div class="media" style="background:var(--panel2);"><img src="{{IMAGE}}" alt="{{NOM}}" style="width:100%;height:100%;object-fit:cover;"></div><div class="info"><div class="name">{{NOM}}</div><div class="price"><span class="now">{{PRIX}}</span></div></div></a>`,
    selecteurVisuelPdp: "#pdpStage",
    couleurs: { fond: "#0F1A12", accent: "#FFC83D", texte: "#F0F5EE", surface: "#16241A" },
    polices: { titre: "teko", corps: "inter" },
    ambiance: ["sportif", "premium"],
  },
  {
    fichier: "opal-site.html", nom: "OPAL", categories: ["tech"],
    carteTemplate: `<a href="{{LIEN}}" class="pcard" data-id="{{ID}}"><div class="media"><img src="{{IMAGE}}" alt="{{NOM}}" style="width:100%;height:100%;object-fit:cover;"></div><div class="name">{{NOM}}</div><div class="price">{{PRIX}}</div></a>`,
    selecteurVisuelPdp: "#pdpStage",
    couleurs: { fond: "#000000", accent: "#0A84FF", texte: "#F5F5F7", surface: "#1C1C1E" },
    polices: { titre: "manrope", corps: "inter" },
    ambiance: ["minimaliste", "technologique", "premium"],
  },
  {
    fichier: "pop-site.html", nom: "POP!", categories: ["general", "books"],
    carteTemplate: `<a class="pcard" data-id="{{ID}}" href="{{LIEN}}">
    <div class="media">
        <img src="{{IMAGE}}" alt="{{NOM}}" style="width:100%;height:100%;object-fit:cover;">
    </div>
    <div class="info">
        <div class="name">{{NOM}}</div>
        <div class="price">{{PRIX}}</div>
    </div>
</a>`,
    selecteurVisuelPdp: "#pdpMain",
    couleurs: { fond: "#FFFFFF", accent: "#FF6B6B", texte: "#1A1A2E", surface: "#FFFFFF" },
    polices: { titre: "baloo-2", corps: "nunito-sans" },
    ambiance: ["ludique", "dynamique"],
  },
  {
    fichier: "ring-site.html", nom: "RING", categories: ["sport"],
    carteTemplate: `<a href="{{LIEN}}" class="pcard" data-id="{{ID}}"><div class="media"><img src="{{IMAGE}}" alt="{{NOM}}" style="width:100%;height:100%;object-fit:cover;"></div><div class="info"><div class="name">{{NOM}}</div><div class="price"><span class="now">{{PRIX}}</span></div></div></a>`,
    selecteurVisuelPdp: "#pdpStage",
    couleurs: { fond: "#0C0C0C", accent: "#E31C2A", texte: "#F2F2F0", surface: "#1A1A1A" },
    polices: { titre: "anton", corps: "inter" },
    ambiance: ["minimaliste", "industrielle", "puissante"],
  },
  {
    // weight-tag d'origine affichait un poids ("450g") — retiré : aucun
    // champ équivalent dans ProduitPourClone, mieux vaut l'omettre que d'y
    // afficher {{ID}} brut (ce que le modèle avait fait par défaut).
    fichier: "sentier-site.html", nom: "SENTIER", categories: ["agriculture"],
    carteTemplate: `<a href="{{LIEN}}" class="pcard"><div class="media"><img src="{{IMAGE}}" alt="{{NOM}}" style="width:100%;height:100%;object-fit:cover;"></div><div class="name">{{NOM}}</div><div class="price">{{PRIX}}</div></a>`,
    selecteurVisuelPdp: "#pdpMain",
    couleurs: { fond: "#EDF0E8", accent: "#C1622E", texte: "#22301F", surface: "#DDE3D4" },
    polices: { titre: "chivo", corps: "inter" },
    ambiance: ["naturelle", "minimaliste"],
  },
];

// Choisit l'entrée de la bibliothèque la plus proche d'une catégorie de
// boutique — même principe que l'ancien selectThemeId (lib/generate-store-
// config.ts), réadapté aux 15 designs. Premier match dans l'ordre du
// manifeste ; "general" (ou la 1ère entrée) sert de repli.
export function selectionnerGabaritLibrairie(categorie: string): EntreeLibrairie {
  const type = detectCategory(categorie);
  const match = MANIFESTE_LIBRAIRIE.find((e) => e.categories.includes(type));
  if (match) return match;
  const general = MANIFESTE_LIBRAIRIE.find((e) => e.categories.includes("general"));
  return general || MANIFESTE_LIBRAIRIE[0];
}
