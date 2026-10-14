// Enregistrement dynamique d'un client OAuth (RFC 7591) : l'IA déclare son nom et ses
// adresses de retour, Axso lui rend un client_id signé (rien n'est stocké).
import { NextResponse } from "next/server";
import { creerClientId, lireClientId } from "@/lib/controle-ia/regles";

export async function POST(req: Request) {
  const corps = await req.json().catch(() => null);
  const clientId = creerClientId(corps?.client_name, corps?.redirect_uris);
  if (!clientId) return NextResponse.json({ error: "invalid_redirect_uri", error_description: "redirect_uris : 1 à 5 adresses en https (ou http://localhost)." }, { status: 400 });
  const client = lireClientId(clientId)!;
  return NextResponse.json({
    client_id: clientId, client_name: client.nom, redirect_uris: client.redirectUris,
    token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"],
  }, { status: 201 });
}
