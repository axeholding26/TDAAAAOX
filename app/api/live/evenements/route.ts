// Live Academy — liste et création des événements vendables (un Produit type « evenement » chacun).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { tenantOuRefus, zSeance, donneesSeance, creerProduitLive } from "@/lib/live/api";
import { fournisseursDisponibles, FOURNISSEURS } from "@/lib/live/visio";

export async function GET() {
  const t = await tenantOuRefus();
  if (t instanceof NextResponse) return t;
  const [evenements, bootcamps] = await Promise.all([
    prisma.evenement.findMany({
      where: { tenantId: t.tenantId, bootcampId: null },
      orderBy: { debut: "desc" }, take: 200,
      select: { id: true, titre: true, type: true, debut: true, fuseau: true, statut: true, capacite: true, placesPrises: true, fournisseur: true, produit: { select: { id: true, prix: true, actif: true } } },
    }),
    prisma.bootcamp.findMany({
      where: { tenantId: t.tenantId }, orderBy: { dateDebut: "desc" }, take: 100,
      select: { id: true, cohorte: true, dateDebut: true, dateFin: true, capacite: true, placesPrises: true, produit: { select: { id: true, nom: true, prix: true, actif: true } }, _count: { select: { sessions: true, missions: true } } },
    }),
  ]);
  return NextResponse.json({
    evenements, bootcamps,
    fournisseurs: Object.values(FOURNISSEURS).map((f) => ({ cle: f.cle, nom: f.nom, usage: f.usage, env: f.env, limites: f.limites, configure: f.configure(), exigeLien: f.exigeLien })),
    disponibles: fournisseursDisponibles().map((f) => f.cle),
  });
}

const Creation = zSeance.extend({
  prix: z.number().min(0).max(100_000_000).default(0),
  capacite: z.number().int().min(1).max(100_000).nullable().optional(),
  image: z.string().url().max(1000).nullable().optional(),
  certificat: z.boolean().default(false),
  publier: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const t = await tenantOuRefus();
  if (t instanceof NextResponse) return t;
  const p = Creation.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  if (p.data.type === "session") return NextResponse.json({ error: "Une séance se crée depuis son bootcamp" }, { status: 400 });
  const d = donneesSeance(p.data);
  if ("erreur" in d) return NextResponse.json({ error: d.erreur }, { status: 400 });
  const produit = await creerProduitLive(t.tenantId, { nom: p.data.titre, description: p.data.description, prix: p.data.prix, image: p.data.image, type: "evenement", actif: p.data.publier });
  const ev = await prisma.evenement.create({
    data: { ...(d.data as any), tenantId: t.tenantId, produitId: produit.id, capacite: p.data.capacite ?? null, certificat: p.data.certificat },
  });
  return NextResponse.json({ evenement: ev, produitId: produit.id }, { status: 201 });
}
