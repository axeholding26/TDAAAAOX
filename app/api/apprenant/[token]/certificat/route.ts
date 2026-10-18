import { NextRequest, NextResponse } from "next/server";
import { delivrerCertificatSiEligible, eligibilite, parcoursOuRefus } from "@/lib/formation/parcours";
import { pdfCertificat } from "@/lib/formation/certificat-pdf";
import { lienBoutique } from "@/lib/origine-site";

type Ctx = { params: Promise<{ token: string }> };

// GET — PDF de l'attestation de l'apprenant (délivrée automatiquement quand les critères sont remplis).
// ?etat=1 : état JSON (code ou ce qu'il manque), pour le lecteur.
export async function GET(req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const p = await parcoursOuRefus(req, token);
  if (p instanceof NextResponse) return p;
  if (!p.formation.certif) return NextResponse.json({ error: "Cette formation ne délivre pas d'attestation" }, { status: 404 });
  const c = await delivrerCertificatSiEligible(p);
  const valide = c && !c.revoqueAt ? c : null;
  if (req.nextUrl.searchParams.get("etat")) {
    return NextResponse.json({ code: valide?.code ?? null, revoque: !!c?.revoqueAt, manque: valide ? [] : eligibilite(p).manque });
  }
  if (!valide) return NextResponse.json({ error: c?.revoqueAt ? "Attestation révoquée" : "Attestation pas encore obtenue", manque: eligibilite(p).manque }, { status: 403 });
  const pdf = await pdfCertificat({ ...valide, lienVerification: await lienBoutique(p.slug, `/certificat/${valide.code}`) });
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="attestation-${valide.code}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
