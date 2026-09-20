import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/fournisseurs/import-csv
// Body: { fournisseurId, csv: "string CSV", marge: 30 }
// CSV format: nom,description,prix,stock,sku,categorie
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;

    const body = await request.json();
    const { fournisseurId, csv, marge = 30 } = body;

    if (!csv) return NextResponse.json({ message: "CSV requis" }, { status: 400 });

    const lines = csv.split("\n").filter((l: string) => l.trim());
    const headers = lines[0].split(",").map((h: string) => h.trim().toLowerCase());

    const idx = {
      nom: headers.indexOf("nom"),
      description: headers.indexOf("description"),
      prix: headers.indexOf("prix"),
      stock: headers.indexOf("stock"),
      sku: headers.indexOf("sku"),
      categorie: headers.indexOf("categorie"),
      image: headers.indexOf("image"),
    };

    if (idx.nom === -1) return NextResponse.json({ message: "Colonne 'nom' requise" }, { status: 400 });

    const produits = [];
    const erreurs = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c: string) => c.trim());
      const nom = cols[idx.nom];
      if (!nom) continue;

      const prixFournisseur = idx.prix >= 0 ? parseFloat(cols[idx.prix]) || 0 : 0;
      const prixVente = prixFournisseur * (1 + marge / 100);
      const slug = nom.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + Date.now() + "-" + i;

      try {
        const produit = await prisma.produit.create({
          data: {
            tenantId,
            nom,
            slug,
            description: idx.description >= 0 ? cols[idx.description] || "" : "",
            prix: Math.round(prixVente),
            stock: idx.stock >= 0 ? parseInt(cols[idx.stock]) || 0 : 0,
            sku: idx.sku >= 0 ? cols[idx.sku] || null : null,
            categorie: idx.categorie >= 0 ? cols[idx.categorie] || null : null,
            images: idx.image >= 0 && cols[idx.image] ? [cols[idx.image]] : [],
            type: "physique",
            actif: true,
            fournisseurId: fournisseurId || null,
            prixFournisseur: prixFournisseur || null,
          } as any,
        });
        produits.push({ id: produit.id, nom: produit.nom });
      } catch {
        erreurs.push({ ligne: i + 1, nom });
      }
    }

    return NextResponse.json({
      ok: true,
      importes: produits.length,
      erreurs: erreurs.length,
      detail: { produits, erreurs },
    });
  } catch {
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
