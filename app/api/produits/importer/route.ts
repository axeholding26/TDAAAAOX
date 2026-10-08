// Import de produits depuis un fichier Excel (.xlsx, .xls) ou CSV.
// GET  → modèle Excel à remplir (une ligne d'exemple).
// POST → FormData { fichier } : chaque ligne valide devient un produit physique ;
//        les lignes invalides sont ignorées et renvoyées avec leur numéro.
// Permission « produits » appliquée par proxy.ts (lib/permissions-api.ts).
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { schemaProduit } from "@/lib/validations";
import { slugify } from "@/lib/utils";

const COLONNES = ["Nom", "Prix", "Prix barré", "Stock", "Description", "Catégorie", "SKU", "Code-barres", "Images", "Actif"];
const MAX_LIGNES = 1000;
const MAX_OCTETS = 5 * 1024 * 1024;

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

  const feuille = XLSX.utils.aoa_to_sheet([
    COLONNES,
    ["Sac cabas en cuir", 24900, 29900, 12, "Cuir pleine fleur, cousu main à Dakar.", "Maroquinerie", "SAC-001", "", "https://exemple.com/photo1.jpg, https://exemple.com/photo2.jpg", "oui"],
  ]);
  feuille["!cols"] = COLONNES.map((c) => ({ wch: Math.max(14, c.length + 4) }));
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, "Produits");
  const contenu = XLSX.write(classeur, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(contenu), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modele-import-produits-axso.xlsx"',
    },
  });
}

// En-têtes comparés sans accents/casse/espaces : « prix barre », « PRIX BARRÉ »… passent.
const cle = (s: string) => slugify(String(s ?? ""));
const nombre = (v: unknown) => {
  if (v === "" || v == null) return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};
const texte = (v: unknown) => (v == null || String(v).trim() === "" ? undefined : String(v).trim());

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const form = await request.formData().catch(() => null);
  const fichier = form?.get("fichier");
  if (!(fichier instanceof File)) return NextResponse.json({ message: "Aucun fichier reçu" }, { status: 400 });
  if (fichier.size > MAX_OCTETS) return NextResponse.json({ message: "Fichier trop lourd (5 Mo maximum)" }, { status: 400 });

  let lignes: Record<string, unknown>[];
  try {
    // Un CSV lu en binaire perd ses accents (« Prix barrÃ© ») : on le décode en UTF-8 d'abord.
    const classeur = /\.csv$/i.test(fichier.name)
      ? XLSX.read(await fichier.text(), { type: "string" })
      : XLSX.read(new Uint8Array(await fichier.arrayBuffer()), { type: "array" });
    const brut = XLSX.utils.sheet_to_json<Record<string, unknown>>(classeur.Sheets[classeur.SheetNames[0]], { defval: "" });
    lignes = brut.map((l) => Object.fromEntries(Object.entries(l).map(([k, v]) => [cle(k), v])));
  } catch {
    return NextResponse.json({ message: "Fichier illisible : utilise le modèle Excel ou un CSV" }, { status: 400 });
  }
  if (!lignes.length) return NextResponse.json({ message: "Le fichier ne contient aucune ligne" }, { status: 400 });
  if (lignes.length > MAX_LIGNES) return NextResponse.json({ message: `${MAX_LIGNES} produits maximum par import` }, { status: 400 });

  const existants = await prisma.produit.findMany({ where: { tenantId }, select: { slug: true, codeBarres: true } });
  const slugs = new Set(existants.map((p) => p.slug));
  const codes = new Set(existants.map((p) => p.codeBarres).filter(Boolean));

  const aCreer: any[] = [];
  const erreurs: { ligne: number; message: string }[] = [];

  lignes.forEach((l, i) => {
    const numero = i + 2; // ligne 1 = en-têtes
    const nom = texte(l["nom"]);
    if (!nom) return; // ligne vide
    const codeBarres = texte(l["code-barres"]);
    if (codeBarres && codes.has(codeBarres)) { erreurs.push({ ligne: numero, message: "Code-barres déjà utilisé" }); return; }

    // Slug unique dans la boutique : sac-cabas, sac-cabas-2, …
    const base = slugify(nom) || "produit";
    let slug = base;
    for (let n = 2; slugs.has(slug); n++) slug = `${base}-${n}`;

    const prix = nombre(l["prix"]), prixCompare = nombre(l["prix-barre"]), stock = nombre(l["stock"]) ?? 0;
    if (!prix || !(prix > 0)) { erreurs.push({ ligne: numero, message: "Prix manquant ou invalide" }); return; }
    if (Number.isNaN(prixCompare)) { erreurs.push({ ligne: numero, message: "Prix barré invalide" }); return; }
    if (!Number.isInteger(stock) || stock < 0) { erreurs.push({ ligne: numero, message: "Stock invalide (nombre entier attendu)" }); return; }

    const actif = texte(l["actif"])?.toLowerCase();
    const resultat = schemaProduit.safeParse({
      nom, slug, prix, prixCompare, stock,
      description: texte(l["description"]),
      categorie: texte(l["categorie"]),
      sku: texte(l["sku"]),
      codeBarres,
      images: (texte(l["images"]) ?? "").split(/[,\s]+/).filter((u) => /^https?:\/\//.test(u)),
      actif: !actif || !["non", "no", "0", "false", "faux"].includes(actif),
    });
    if (!resultat.success) {
      const e = resultat.error.issues[0];
      erreurs.push({ ligne: numero, message: `${e.path.join(".") || "ligne"} : ${e.message}` });
      return;
    }
    slugs.add(slug);
    if (codeBarres) codes.add(codeBarres);
    const { variantes: _v, ...data } = resultat.data as any;
    aCreer.push({ ...data, tenantId });
  });

  const { count } = aCreer.length ? await prisma.produit.createMany({ data: aCreer }) : { count: 0 };
  return NextResponse.json({ importes: count, erreurs });
}
