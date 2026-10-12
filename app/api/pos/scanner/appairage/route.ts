// Appairage d'un téléphone-scanner à la caisse de travail.
// POST /api/pos/scanner/appairage — droit : gerer_appareils. Corps : { nom? }.
// Rend le lien à usage unique (5 min) et son QR code ; le code n'est jamais
// relisible ensuite (la base n'en garde que l'empreinte).
import { NextResponse } from "next/server";
import { routePos } from "@/lib/pos/acces";
import { ouvrirAppairage, schemaAppairage } from "@/lib/pos/scanner/service";
import { origineSite } from "@/lib/origine-site";
import { qrSvg } from "@/lib/qr";

export const POST = routePos(async (ctx, req) => {
  const d = schemaAppairage.parse(await req.json().catch(() => ({})));
  const a = await ouvrirAppairage(ctx, d);
  // Même adresse que celle du poste : le cookie du téléphone doit être posé sur le site qui sert /api/pos.
  const url = `${await origineSite()}/scanner?code=${encodeURIComponent(a.code)}`;
  return NextResponse.json({ ok: true, appareilId: a.appareilId, url, qr: await qrSvg(url), expireAt: a.expireAt }, { status: 201 });
});
