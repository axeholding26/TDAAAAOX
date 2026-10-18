// PDF d'une attestation de réussite (pdf-lib, déjà utilisé pour le filigrane des téléchargements).
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Les polices standard ne savent écrire que le jeu WinAnsi (latin-1 étendu) : le reste est remplacé.
const winAnsi = (s: string) => s.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E\xA0-\xFF€œŒ…–—]/g, "?");

export async function pdfCertificat(c: { code: string; nom: string; formationTitre: string; boutiqueNom: string; delivreAt: Date; lienVerification: string }) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Attestation — ${winAnsi(c.formationTitre)}`);
  const page = doc.addPage([842, 595]); // A4 paysage
  const [normal, gras] = await Promise.all([doc.embedFont(StandardFonts.Helvetica), doc.embedFont(StandardFonts.HelveticaBold)]);
  const or = rgb(0.96, 0.65, 0.14);
  const encre = rgb(0.07, 0.07, 0.07);
  const gris = rgb(0.45, 0.45, 0.45);
  page.drawRectangle({ x: 24, y: 24, width: 794, height: 547, borderColor: or, borderWidth: 3 });

  const centre = (texte: string, y: number, taille: number, police = normal, couleur = encre) => {
    let t = winAnsi(texte);
    while (police.widthOfTextAtSize(t, taille) > 720 && t.length > 4) t = t.slice(0, -2);
    if (t !== winAnsi(texte)) t = t.slice(0, -1) + "…";
    page.drawText(t, { x: (842 - police.widthOfTextAtSize(t, taille)) / 2, y, size: taille, font: police, color: couleur });
  };
  centre("ATTESTATION DE RÉUSSITE", 470, 30, gras, or);
  centre("Ce document atteste que", 415, 14, normal, gris);
  centre(c.nom, 370, 30, gras);
  centre("a suivi et réussi la formation", 330, 14, normal, gris);
  centre(c.formationTitre, 290, 22, gras);
  centre(`proposée par ${c.boutiqueNom} · délivrée le ${c.delivreAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`, 250, 12, normal, gris);
  centre(`Identifiant : ${c.code}`, 150, 13, gras);
  centre(`Vérification : ${c.lienVerification}`, 130, 10, normal, gris);
  centre("Attestation interne délivrée par le formateur via Axso. Ce n'est pas un diplôme ni une certification accréditée.", 60, 9, normal, gris);
  return doc.save();
}
