// Sélection du numéro WhatsApp Business à utiliser
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { lireConnexion, enregistrerConnexion } from "@/lib/connect";
import { z } from "zod";

const selectSchema = z.object({
  phone_number_id: z.string(),
  display_phone: z.string(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const parsed = selectSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Format invalide" }, { status: 400 });
  const body = parsed.data;

  const metaConfig = await lireConnexion(tenantId, "meta");
  const userToken = (metaConfig?.config as any)?.user_token;

  const existing = await lireConnexion(tenantId, "whatsapp");

  const configData = {
    ...((existing?.config as object) ?? {}),
    phone_number_id: body.phone_number_id,
    display_phone: body.display_phone,
  };

  // Sans jeton utilisateur Meta, celui déjà enregistré est conservé.
  await enregistrerConnexion(tenantId, "whatsapp", { statut: "actif", accessToken: userToken ?? undefined, config: configData });

  return NextResponse.json({ ok: true });
}
