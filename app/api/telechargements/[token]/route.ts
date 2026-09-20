import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

type Ctx = { params: Promise<{ token: string }> };

// GET /api/telechargements/[token]?fichier=[fichierId]
// Valide le token de téléchargement, applique le filigrane si nécessaire, sert le fichier.
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const { token } = await params;

    // Token existant (système legacy)
    const dl = await prisma.telechargement.findUnique({ where: { token } });
    if (!dl) return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 404 });
    if (dl.expireAt < new Date()) return NextResponse.json({ error: "Lien expiré" }, { status: 410 });

    // Identifier quel fichier servir
    const url = new URL(req.url);
    const fichierId = url.searchParams.get("fichier");
    const pw = url.searchParams.get("pw");

    // Récupérer les infos produit + commande
    const [produit, commande] = await Promise.all([
      prisma.produit.findUnique({
        where: { id: dl.produitId },
        include: {
          produitFichier: {
            include: { fichiers: { orderBy: { ordre: "asc" } } },
          },
        },
      }),
      prisma.commande.findUnique({
        where: { id: dl.commandeId },
        select: { clientNom: true, clientEmail: true, createdAt: true },
      }),
    ]);

    if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

    let fileUrl: string;
    let fileName: string;
    let mimeType: string | null = null;
    let filigrane = false;

    if (produit.produitFichier && produit.produitFichier.fichiers.length > 0) {
      // Nouveau système multi-fichiers — mot de passe optionnel (jamais vérifié
      // avant ce fix, malgré le champ stocké et affiché comme actif au marchand).
      if (produit.produitFichier.motDePasse && !(await bcrypt.compare(pw || "", produit.produitFichier.motDePasse))) {
        return NextResponse.json({ error: "Mot de passe requis ou incorrect" }, { status: 401 });
      }
      const fichiers = produit.produitFichier.fichiers;
      const fichier = fichierId
        ? fichiers.find((f) => f.id === fichierId) || fichiers[0]
        : fichiers[0];

      fileUrl  = fichier.url;
      fileName = fichier.nom;
      mimeType = fichier.mimeType;
      filigrane = produit.produitFichier.filigrane;
    } else if (produit.fichierUrl) {
      // Système legacy (fichierUrl direct)
      fileUrl  = produit.fichierUrl;
      fileName = produit.fichierNom || "fichier";
    } else {
      return NextResponse.json({ error: "Aucun fichier attaché" }, { status: 404 });
    }

    // Marquer comme téléchargé (best-effort, ne bloque pas si déjà fait)
    prisma.telechargement.update({
      where: { token },
      data:  { telecharge: true },
    }).catch(() => {});

    // Récupérer le fichier depuis le blob
    const blobRes = await fetch(fileUrl);
    if (!blobRes.ok) return NextResponse.json({ error: "Erreur de récupération du fichier" }, { status: 502 });

    const contentType = mimeType || blobRes.headers.get("content-type") || "application/octet-stream";
    const isPdf = contentType.includes("pdf");

    // Filigrane PDF
    if (filigrane && isPdf && commande) {
      try {
        const { PDFDocument, rgb, degrees } = await import("pdf-lib");
        const pdfBytes  = await blobRes.arrayBuffer();
        const pdfDoc    = await PDFDocument.load(pdfBytes);
        const pages     = pdfDoc.getPages();
        const watermark = `${commande.clientNom} • ${commande.clientEmail} • ${commande.createdAt.toLocaleDateString("fr-FR")}`;

        for (const page of pages) {
          const { width, height } = page.getSize();
          page.drawText(watermark, {
            x:        width / 2 - 200,
            y:        height / 2,
            size:     14,
            color:    rgb(0.6, 0.6, 0.6),
            opacity:  0.35,
            rotate:   degrees(30),
          });
        }

        const modifiedBytes = await pdfDoc.save();
        return new NextResponse(modifiedBytes, {
          headers: {
            "Content-Type":        "application/pdf",
            "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
            "Cache-Control":       "no-store",
          },
        });
      } catch (err) {
        console.error("[telechargement] filigrane PDF échoué, envoi sans filigrane", err);
      }
    }

    // Envoi direct (sans filigrane ou format non PDF)
    const buffer = await blobRes.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type":        contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control":       "no-store",
      },
    });
  } catch (err) {
    console.error("[api/telechargements/[token] GET]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
