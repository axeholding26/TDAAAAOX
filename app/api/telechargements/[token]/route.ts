import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { metaDigital } from "@/lib/commandes";
import { controlerJeton, compterTelechargement, estFichierBlob } from "@/lib/livraison-numerique";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ token: string }> };

// Jetons inventés : deviner 256 bits est hors de portée, on freine quand même les rafales par IP.
const parIp = rateLimit({ windowMs: 60_000, max: 60, keyPrefix: "dl-ip" });
// Anti-partage : un même lien ne sert pas plus de 20 fichiers en 10 minutes, quelle que soit l'IP.
const parJeton = rateLimit({ windowMs: 10 * 60_000, max: 20, keyPrefix: "dl-jeton" });

// GET /api/telechargements/[token]?fichier=[fichierId]
// Jeton aléatoire lié à une commande et à un produit. Le fichier n'est servi que si la
// commande est payée (confirmée par NotchPay), non annulée/remboursée, le jeton non révoqué
// ni expiré et la limite du produit non atteinte. L'adresse de stockage n'est jamais renvoyée.
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const rl = parIp.check(getClientIp(req));
    if (!rl.success) return rateLimitResponse(rl.reset);
    const { token } = await params;
    if (!/^[A-Za-z0-9-]{32,128}$/.test(token)) return NextResponse.json({ error: "Lien invalide" }, { status: 404 });

    const dl = await prisma.telechargement.findUnique({ where: { token } });
    const [commande, produit] = dl
      ? await Promise.all([
          prisma.commande.findUnique({ where: { id: dl.commandeId }, select: { clientNom: true, clientEmail: true, createdAt: true, paiementStatut: true, statut: true } }),
          prisma.produit.findUnique({
            where: { id: dl.produitId },
            select: {
              id: true, fichierUrl: true, fichierNom: true, instructionsTelechargement: true,
              produitFichier: { select: { motDePasse: true, filigrane: true, fichiers: { orderBy: { ordre: "asc" }, select: { id: true, nom: true, url: true, mimeType: true } } } },
            },
          }),
        ])
      : [null, null];

    // La limite du marchand compte des téléchargements du PRODUIT : à plusieurs fichiers, chaque fichier
    // en consomme un, donc on la multiplie (limite 5, 3 fichiers → 15 : l'ensemble se télécharge 5 fois).
    const parProduit = metaDigital(produit?.instructionsTelechargement).limiteTelechargement as number | null | undefined;
    const limite = parProduit ? parProduit * Math.max(1, produit?.produitFichier?.fichiers.length ?? 0) : parProduit;
    const refus = controlerJeton({ dl, commande, limite });
    if (refus) return NextResponse.json({ error: refus.error }, { status: refus.status });
    if (!produit || !commande) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    if (!parJeton.check(token).success) return NextResponse.json({ error: "Trop de téléchargements avec ce lien, réessayez dans quelques minutes" }, { status: 429 });

    const fichierId = req.nextUrl.searchParams.get("fichier");
    let fileUrl: string;
    let fileName: string;
    let mimeType: string | null = null;
    let filigrane = false;

    const fichiers = produit.produitFichier?.fichiers ?? [];
    if (fichiers.length > 0) {
      if (produit.produitFichier!.motDePasse && !(await bcrypt.compare(req.nextUrl.searchParams.get("pw") || "", produit.produitFichier!.motDePasse))) {
        return NextResponse.json({ error: "Mot de passe requis ou incorrect" }, { status: 401 });
      }
      // Seuls les fichiers DE CE produit : un identifiant d'un autre produit ne sert rien.
      const fichier = fichierId ? fichiers.find((f) => f.id === fichierId) : fichiers[0];
      if (!fichier) return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
      fileUrl = fichier.url;
      fileName = fichier.nom;
      mimeType = fichier.mimeType;
      filigrane = produit.produitFichier!.filigrane;
    } else if (produit.fichierUrl) {
      fileUrl = produit.fichierUrl;
      fileName = produit.fichierNom || "fichier";
    } else {
      return NextResponse.json({ error: "Aucun fichier attaché" }, { status: 404 });
    }

    // Compté avant l'envoi, atomiquement sous la limite (deux clics simultanés ne la dépassent pas).
    if (!(await compterTelechargement(token, limite))) return NextResponse.json({ error: "Limite de téléchargements atteinte" }, { status: 403 });

    // Lien externe choisi par le marchand (Drive, Dropbox…) : jamais lu par le serveur (SSRF),
    // le client y est renvoyé après les contrôles. Il ne peut pas être protégé davantage.
    if (!estFichierBlob(fileUrl)) {
      if (!/^https:\/\//i.test(fileUrl)) return NextResponse.json({ error: "Fichier indisponible" }, { status: 404 });
      return NextResponse.redirect(fileUrl, { status: 302, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
    }

    const blobRes = await fetch(fileUrl, { signal: AbortSignal.timeout(60_000) });
    if (!blobRes.ok || !blobRes.body) return NextResponse.json({ error: "Erreur de récupération du fichier" }, { status: 502 });

    const contentType = mimeType || blobRes.headers.get("content-type") || "application/octet-stream";
    const entetes = {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    };

    // Filigrane PDF (nom, e-mail et date de l'acheteur sur chaque page).
    if (filigrane && contentType.includes("pdf")) {
      try {
        const { PDFDocument, rgb, degrees } = await import("pdf-lib");
        const pdfDoc = await PDFDocument.load(await blobRes.arrayBuffer());
        const watermark = `${commande.clientNom} • ${commande.clientEmail ?? ""} • ${commande.createdAt.toLocaleDateString("fr-FR")}`;
        for (const page of pdfDoc.getPages()) {
          const { width, height } = page.getSize();
          page.drawText(watermark, { x: width / 2 - 200, y: height / 2, size: 14, color: rgb(0.6, 0.6, 0.6), opacity: 0.35, rotate: degrees(30) });
        }
        return new NextResponse(Buffer.from(await pdfDoc.save()), { headers: { ...entetes, "Content-Type": "application/pdf" } });
      } catch (err) {
        console.error("[telechargement] filigrane PDF impossible", err);
        return NextResponse.json({ error: "Fichier momentanément indisponible" }, { status: 502 });
      }
    }

    // Envoi en flux : le fichier n'est jamais chargé entier en mémoire.
    const longueur = blobRes.headers.get("content-length");
    return new NextResponse(blobRes.body, { headers: longueur ? { ...entetes, "Content-Length": longueur } : entetes });
  } catch (err) {
    console.error("[api/telechargements/[token] GET]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
