// Contrôle IA — section « Services reliés » (Axso Connect) : état des services tiers de la
// boutique active, sans aucun secret, et déconnexion d'un service.
// Même règle d'accès que ../route.ts : toute session de la boutique consulte ; ces
// connexions appartenant à la boutique (pas à un membre), seul un accès complet déconnecte.
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { permissionsSession } from "@/lib/permissions-server";
import { outilAutorise } from "@/lib/axia/droits";
import { etatConnexions, deconnecter } from "@/lib/connect";

async function acces() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  const tenantId = (session?.user as any)?.tenantId as string | undefined;
  if (!userId || !tenantId) return null;
  return { tenantId, complet: outilAutorise("deleguer_vers_agent", await permissionsSession(session)) };
}

export async function GET() {
  const a = await acces();
  if (!a) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  return NextResponse.json({ services: await etatConnexions(a.tenantId) });
}

export async function DELETE(req: Request) {
  const a = await acces();
  if (!a) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!a.complet) return NextResponse.json({ error: "Accès complet requis" }, { status: 403 });
  const type = new URL(req.url).searchParams.get("type");
  if (!type) return NextResponse.json({ error: "Type requis" }, { status: 400 });
  await deconnecter(a.tenantId, type);
  return NextResponse.json({ ok: true });
}
