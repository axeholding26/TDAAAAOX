import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const TRANSPORTEURS_DISPO = [
  { code: "dhl", nom: "DHL Express", zones: ["international"], logo: "🟡", actif: false },
  { code: "chronopost", nom: "Chronopost", zones: ["fr", "europe"], logo: "🔵", actif: false },
  { code: "campost", nom: "Campost", zones: ["cm"], logo: "🟢", actif: false },
  { code: "youpik", nom: "Youpik Livraison", zones: ["cm", "ci", "sn"], logo: "🟠", actif: false },
  { code: "gls", nom: "GLS", zones: ["europe"], logo: "⚫", actif: false },
  { code: "fedex", nom: "FedEx", zones: ["international"], logo: "🟣", actif: false },
  { code: "colissimo", nom: "Colissimo", zones: ["fr"], logo: "🔴", actif: false },
  { code: "sendbox", nom: "Sendbox", zones: ["ng", "gh"], logo: "🔶", actif: false },
];

export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { parametresLivraison: true },
    });

    const config: Record<string, any> = (tenant?.parametresLivraison as any)?.transporteurs ?? {};

    const transporteurs = TRANSPORTEURS_DISPO.map(t => ({
      ...t,
      actif: config[t.code]?.actif ?? false,
      apiKey: config[t.code]?.apiKey ? "***" : "",
      tarif: config[t.code]?.tarif ?? null,
    }));

    return NextResponse.json({ transporteurs });
  } catch {
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;

    const body = await request.json();
    const { code, actif, apiKey, tarif } = body;
    if (!code) return NextResponse.json({ message: "code requis" }, { status: 400 });

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { parametresLivraison: true },
    });

    const meta = (tenant?.parametresLivraison as any) ?? {};
    const transporteurs = meta.transporteurs ?? {};
    transporteurs[code] = {
      ...(transporteurs[code] ?? {}),
      actif: actif ?? transporteurs[code]?.actif ?? false,
      ...(apiKey !== undefined && apiKey !== "***" ? { apiKey } : {}),
      ...(tarif !== undefined ? { tarif } : {}),
    };

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { parametresLivraison: { ...meta, transporteurs } },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
