// Bootcamp OS — création d'un bootcamp (Produit type « bootcamp » = une cohorte).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { tenantOuRefus, zDateLocale, zFuseau, creerProduitLive } from "@/lib/live/api";
import { dateDansFuseau } from "@/lib/live/regles";

const Creation = z.object({
  nom: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000).nullable().optional(),
  cohorte: z.string().trim().max(80).nullable().optional(),
  dateDebut: zDateLocale,
  dateFin: zDateLocale,
  fuseau: zFuseau,
  prix: z.number().min(0).max(100_000_000).default(0),
  capacite: z.number().int().min(1).max(100_000).nullable().optional(),
  image: z.string().url().max(1000).nullable().optional(),
  seuilPresence: z.number().int().min(0).max(100).default(75),
  seuilMissions: z.number().int().min(0).max(100).default(100),
  certificat: z.boolean().default(true),
  publier: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const t = await tenantOuRefus();
  if (t instanceof NextResponse) return t;
  const p = Creation.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  const d = p.data;
  const dateDebut = dateDansFuseau(d.dateDebut, d.fuseau), dateFin = dateDansFuseau(d.dateFin, d.fuseau);
  if (dateFin <= dateDebut) return NextResponse.json({ error: "La fin doit suivre le début" }, { status: 400 });
  const produit = await creerProduitLive(t.tenantId, { nom: d.nom, description: d.description, prix: d.prix, image: d.image, type: "bootcamp", actif: d.publier });
  const bootcamp = await prisma.bootcamp.create({
    data: { tenantId: t.tenantId, produitId: produit.id, cohorte: d.cohorte || null, dateDebut, dateFin, fuseau: d.fuseau, capacite: d.capacite ?? null, seuilPresence: d.seuilPresence, seuilMissions: d.seuilMissions, certificat: d.certificat },
  });
  return NextResponse.json({ bootcamp, produitId: produit.id }, { status: 201 });
}
