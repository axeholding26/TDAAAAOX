// Le téléphone échange le code du QR contre son jeton d'appareil.
// POST /api/pos/scanner/appairage/echange — PUBLIC : le téléphone n'a encore
// aucune identité. Corps : { code }. Le jeton part en cookie httpOnly, jamais
// dans le corps de la réponse. Essais ratés comptés en base (5 au plus).
import { NextResponse } from "next/server";
import { reponseErreurPos } from "@/lib/pos/erreurs";
import { echangerCode, lireJetonAppareil, poserCookieAppareil, schemaEchange } from "@/lib/pos/scanner/service";

export async function POST(req: Request) {
  try {
    const d = schemaEchange.parse(await req.json());
    const r = await echangerCode({
      code: d.code, userAgent: req.headers.get("user-agent"),
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      ancienJeton: lireJetonAppareil(req),
    });
    return poserCookieAppareil(NextResponse.json({ ok: true, appareilId: r.appareilId }), r.jeton);
  } catch (e) {
    return reponseErreurPos(e);
  }
}
