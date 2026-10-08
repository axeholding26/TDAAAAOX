import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PAYS_AFRICAINS } from "@/lib/devise-convert";

// Pays d'une règle : codes ISO2 africains uniquement, sans doublon ; [] = tous les pays.
const nettoyerPays = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.map(String).map((c) => c.toUpperCase()).filter((c) => PAYS_AFRICAINS.includes(c)))] : [];

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const regles = await prisma.reglePort.findMany({
    where: { tenantId },
    orderBy: [{ createdAt: "desc" }],
  });
  return NextResponse.json({ regles });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const body = await req.json();
  const { nom, pays, zone, poidsMin, poidsMax, montantMin, montantMax, frais, fraisKg, delai, transporteur, gratuit, modeLivraison } = body;

  if (!nom || frais === undefined) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const regle = await prisma.reglePort.create({
    data: {
      tenantId,
      nom,
      pays: nettoyerPays(pays),
      zone: typeof zone === "string" ? zone.trim() : "",
      poidsMin: poidsMin ?? 0,
      poidsMax: poidsMax ?? null,
      montantMin: montantMin ?? null,
      montantMax: montantMax ?? null,
      frais,
      fraisKg: fraisKg ?? 0,
      delai: delai ?? "3-5 jours",
      transporteur: transporteur ?? null,
      gratuit: gratuit ?? false,
      modeLivraison: modeLivraison ?? "livreur_local",
    },
  });

  return NextResponse.json({ regle }, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const body = await req.json();
  const { id, ...data } = body;
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const existing = await prisma.reglePort.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Règle introuvable" }, { status: 404 });

  if ("pays" in data) data.pays = nettoyerPays(data.pays);
  if ("zone" in data) data.zone = typeof data.zone === "string" ? data.zone.trim() : "";
  const regle = await prisma.reglePort.update({ where: { id }, data });
  return NextResponse.json({ regle });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const existing = await prisma.reglePort.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Règle introuvable" }, { status: 404 });

  await prisma.reglePort.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
