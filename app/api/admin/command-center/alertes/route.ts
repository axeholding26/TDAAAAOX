// Alertes du contexte courant (cloche de la barre du haut).
import { NextResponse, type NextRequest } from "next/server";
import { contexteApi, analyser } from "@/lib/command-center/serveur";
import { getT } from "@/lib/i18n/serveur";

export async function GET(req: NextRequest) {
  const c = await contexteApi("alertes", req);
  if (c instanceof NextResponse) return c;
  // Textes dans la langue de l'admin, comme la page /admin/alertes.
  const { alertes } = analyser(c, await getT());
  return NextResponse.json({ alertes: alertes.map(({ id, categorie, titre, detail, lien }) => ({ id, categorie, titre, detail, lien })) });
}
