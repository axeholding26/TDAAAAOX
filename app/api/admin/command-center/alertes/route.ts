// Alertes du contexte courant (cloche de la barre du haut).
import { NextResponse, type NextRequest } from "next/server";
import { contexteApi, analyser } from "@/lib/command-center/serveur";

export async function GET(req: NextRequest) {
  const c = await contexteApi("alertes", req);
  if (c instanceof NextResponse) return c;
  const { alertes } = analyser(c);
  return NextResponse.json({ alertes: alertes.map(({ id, categorie, titre, detail, lien }) => ({ id, categorie, titre, detail, lien })) });
}
