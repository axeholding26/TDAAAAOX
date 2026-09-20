// GET /api/preview-theme?fichier=aube-site.html&nom=Ma+Boutique&produits=[...]&devise=XAF
// Sert le HTML du template avec les données de l'utilisateur injectées :
// - PRODUCTS remplacé par les produits de l'utilisateur
// - Logo remplacé par le nom de la boutique
// - devise/fmt correcte
// - Vue "home" forcée, navigations désactivées pour le mode aperçu
import { readFileSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";

const TEMPLATES_DIR = join(process.cwd(), "Templates");

// Clés de produits sûres pour l'objet JS
function toKey(nom: string, i: number) {
  return "p" + i + "_" + nom.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
}

// Remplace `const PRODUCTS = { … };` en comptant les accolades (le regex
// échouait sur les objets multi-niveaux ou avec des lookaheads instables).
function replacePRODUCTS(html: string, newDef: string): string {
  const start = html.indexOf("const PRODUCTS");
  if (start === -1) return html;
  const braceStart = html.indexOf("{", start);
  if (braceStart === -1) return html;
  let depth = 0, i = braceStart;
  while (i < html.length) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") { if (--depth === 0) break; }
    i++;
  }
  // sauter le `;` et les espaces / sauts de ligne qui suivent
  let end = i + 1;
  while (end < html.length && (html[end] === ";" || html[end] === "\n" || html[end] === "\r" || html[end] === " ")) end++;
  return html.slice(0, start) + newDef + "\n" + html.slice(end);
}

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

  // Parse les produits
  let produits: { nom: string; prix: number; description?: string }[] = [];
  try { produits = JSON.parse(raw); } catch {}
  if (produits.length === 0) {
    produits = [
      { nom: "Produit Signature", prix: 45000 },
      { nom: "Édition Limitée",   prix: 78000 },
      { nom: "Collection Phare",  prix: 32000 },
    ];
  }

  // Construire l'objet PRODUCTS en JS compatible avec tous les templates
  const productEntries = produits.slice(0, 9).map((p, i) => {
    const key = toKey(p.nom, i);
    const safeNom = p.nom.replace(/'/g, "\\'").replace(/\\/g, "\\\\");
    const safeDesc = (p.description || p.nom).replace(/'/g, "\\'").replace(/\\/g, "\\\\");
    return `${key}:{name:'${safeNom}',price:${p.prix},was:null,cat:'all',tone:'t1',metal:'',stone:'',desc:'${safeDesc}',sizes:[],colors:['#888']}`;
  });

  const keys = produits.slice(0, 9).map((p, i) => toKey(p.nom, i));
  const homeKeys = keys.slice(0, 3);

  const injectedProducts = `const PRODUCTS = {\n  ${productEntries.join(",\n  ")}\n};`;

  // Override renderHomeGrid et renderBoutiqueGrid pour utiliser les vrais ids
  const gridOverride = `
function renderHomeGrid(){
  const el = document.getElementById('homeGrid');
  if(!el) return;
  el.innerHTML = [${homeKeys.map(k => `'${k}'`).join(",")}].filter(k=>PRODUCTS[k]).map(cardHTML).join('');
}
function renderBoutiqueGrid(){
  const el = document.getElementById('plpGrid');
  if(!el) return;
  el.innerHTML = Object.keys(PRODUCTS).map(cardHTML).join('');
  if(typeof applyFilters==='function') applyFilters();
}`;

  // Override fmt pour utiliser la bonne devise
  const safeDev = devise.replace(/'/g, "");
  const fmtOverride = `function fmt(n){ return n.toLocaleString('fr-FR') + ' ${safeDev}'; }`;

  // Injection du nom dans la balise logo (regex tolérante)
  const safeNom = nom.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  html = html.replace(
    /(<[^>]+class="[^"]*\blogo\b[^"]*"[^>]*>)[^<]*/g,
    `$1${safeNom}`
  );

  // Remplacer le bloc PRODUCTS existant (comptage d'accolades)
  html = replacePRODUCTS(html, injectedProducts);

  // Remplacer fmt (comptage d'accolades)
  html = replaceFmt(html, fmtOverride);

  // Injecter les overrides de grilles juste avant </body> ; on les enveloppe
  // dans un listener 'load' pour qu'ils s'exécutent après le rendu initial.
  const gridScript = `<script>\n${gridOverride}\nwindow.addEventListener('load',function(){if(typeof renderHomeGrid==='function')renderHomeGrid();if(typeof renderBoutiqueGrid==='function')renderBoutiqueGrid();});\n</script>`;
  html = html.replace(/<\/body>/i, gridScript + "\n</body>");

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
