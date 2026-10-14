// Point d'accès des jetons OAuth : échange du code (PKCE obligatoire) et rafraîchissement
// (le jeton de rafraîchissement change à chaque usage). Logique dans lib/controle-ia.
import { NextResponse } from "next/server";
import { echangerCode, rafraichir } from "@/lib/controle-ia/serveur";

export async function POST(req: Request) {
  const f = await req.formData().catch(() => null);
  const champ = (nom: string) => String(f?.get(nom) ?? "");
  const jetons = champ("grant_type") === "authorization_code"
    ? await echangerCode({ code: champ("code"), clientId: champ("client_id"), redirectUri: champ("redirect_uri"), verifier: champ("code_verifier") })
    : champ("grant_type") === "refresh_token" ? await rafraichir(champ("refresh_token")) : null;
  const sansCache = { "Cache-Control": "no-store" };
  if (!jetons) return NextResponse.json({ error: "invalid_grant" }, { status: 400, headers: sansCache });
  return NextResponse.json(jetons, { headers: sansCache });
}
