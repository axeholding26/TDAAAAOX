// GET /api/preview-theme?fichier=aube-site.html&nom=Ma+Boutique&produits=[...]&devise=XAF
// Sert le HTML du template avec les données de l'utilisateur injectées :
// - grilles accueil/boutique remplies avec les cartes des vrais produits (comme la vitrine)
// - Logo remplacé par le nom de la boutique
// - devise/fmt correcte
// - Vue "home" forcée, navigations désactivées pour le mode aperçu
import { readFileSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";
import { MANIFESTE_LIBRAIRIE } from "@/lib/axso-design-manifest";
import { remplacerTokensCarte } from "@/lib/theme-import-clone";
import { formatMontant } from "@/lib/utils";

const TEMPLATES_DIR = join(process.cwd(), "Templates");

// Même approche pour `function fmt(n){…}` (peut être multi-lignes).
function replaceFmt(html: string, newFmt: string): string {
  const start = html.indexOf("function fmt(");
  if (start === -1) return html;
  const braceStart = html.indexOf("{", start);
  if (braceStart === -1) return html;
  let depth = 0, i = braceStart;
  while (i < html.length) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") { if (--depth === 0) break; }
    i++;
  }
  return html.slice(0, start) + newFmt + html.slice(i + 1);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fichier = searchParams.get("fichier") || "";
  const nom = searchParams.get("nom") || "Ma Boutique";
  const devise = searchParams.get("devise") || "XAF";
  const raw = searchParams.get("produits") || "[]";

  // Sécurité : fichier doit exister dans Templates/ et se terminer par .html
  if (!fichier.endsWith(".html") || fichier.includes("/") || fichier.includes("..")) {
    return new NextResponse("Fichier invalide", { status: 400 });
  }

  let html: string;
  try {
    html = readFileSync(join(TEMPLATES_DIR, fichier), "utf-8");
  } catch {
    return new NextResponse("Template introuvable", { status: 404 });
  }

  // Vrais produits de la boutique (voir components/dashboard/ApercuDesign.tsx::parametresApercu)
  let produits: { id?: string; nom: string; prix: number; image?: string }[] = [];
  try { const v = JSON.parse(raw); if (Array.isArray(v)) produits = v; } catch {}

  // Mêmes cartes que la vraie vitrine (lib/vitrine-design.ts::rafraichirGrillesProduits) :
  // gabarit de carte du manifeste, vraie image, vrai prix — sur l'accueil ET la
  // boutique. Sans produit, on garde les cartes de démonstration du design (comme la vitrine).
  const carte = MANIFESTE_LIBRAIRIE.find((e) => e.fichier === fichier)?.carteTemplate;
  const safeDevCarte = /^[A-Z]{3}$/.test(devise) ? devise : "XAF";
  const cartes = carte ? produits.slice(0, 24).map((p, i) => remplacerTokensCarte(carte, {
    id: String(p.id ?? i), nom: String(p.nom ?? ""), prixAffiche: formatMontant(Number(p.prix) || 0, safeDevCarte),
    image: typeof p.image === "string" && /^https?:\/\//.test(p.image) ? p.image : null, description: null,
  }, "apercu")).join("") : "";

  // Override fmt pour utiliser la bonne devise
  const safeDev = /^[A-Z]{3}$/.test(devise) ? devise : "XAF"; // code devise uniquement : rien d'autre n'entre dans le script
  const fmtOverride = `function fmt(n){ return n.toLocaleString('fr-FR') + ' ${safeDev}'; }`;

  // Injection du nom dans la balise logo (regex tolérante)
  const safeNom = nom.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  html = html.replace(/(<[^>]+class="[^"]*\blogo\b[^"]*"[^>]*>)[^<]*/g, (_m, balise: string) => balise + safeNom);

  // Remplacer fmt (comptage d'accolades)
  html = replaceFmt(html, fmtOverride);

  // Grilles remplies après le rendu du design (listener 'load'), qui les remplit d'abord avec sa démo.
  if (cartes) {
    const js = JSON.stringify(cartes).replace(/</g, "\\u003c");
    const gridScript = `<script>window.addEventListener('load',function(){var h=${js};['homeGrid','plpGrid'].forEach(function(id){var el=document.getElementById(id);if(el)el.innerHTML=h;});});</script>`;
    html = html.replace(/<\/body>/i, gridScript + "\n</body>");
  }

  // Mode PREVIEW : désactiver les liens de navigation et rendre non-interactif
  const previewStyle = `
<style>
  /* Aperçu — pointer-events désactivé pour iframe preview */
  header a, nav a, .btn-primary, .btn-ghost, .btn-full { pointer-events: none !important; }
  /* Masquer footer, panier, commande */
  #view-boutique, #view-produit, #view-panier, #view-commande, #view-confirmation { display:none!important; }
  /* Forcer vue home */
  #view-home { display:block!important; }
  /* Pas de scroll */
  html, body { overflow: hidden; }
</style>`;

  // Insérer juste avant </head>
  html = html.replace("</head>", previewStyle + "\n</head>");

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Autoriser l'iframe depuis la même origine
      "X-Frame-Options": "SAMEORIGIN",
      // Cache 5 min
      "Cache-Control": "public, max-age=300",
    },
  });
}
