// API Route — Dropshipping : Fournisseurs
// Stockage via AgentMemory (agentId="dropshipping", cle="fournisseurs")
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Fournisseur {
  id: string;
  nom: string;
  pays: string;
  type: "aliexpress" | "jumia" | "local" | "autre";
  delaiLivraison: number;       // jours
  fiabilite: number;            // 1–5 (calculé automatiquement)
  catalogueCount: number;
  url?: string;
  email?: string;
  telephone?: string;
  livraisonsTerminees: number;  // pour le score de fiabilité
  livraisonsEnTemps: number;    // livraisons dans le délai annoncé
  createdAt: string;
}

async function lireFournisseurs(tenantId: string): Promise<Fournisseur[]> {
  const entry = await prisma.agentMemory.findUnique({
    where: { tenantId_agentId_cle: { tenantId, agentId: "dropshipping", cle: "fournisseurs" } },
  });
  if (!entry) return [];
  try {
    return JSON.parse(entry.valeur) as Fournisseur[];
  } catch {
    return [];
  }
}

async function ecrireFournisseurs(tenantId: string, fournisseurs: Fournisseur[]) {
  await prisma.agentMemory.upsert({
    where: { tenantId_agentId_cle: { tenantId, agentId: "dropshipping", cle: "fournisseurs" } },
    create: {
      tenantId,
      agentId: "dropshipping",
      cle: "fournisseurs",
      valeur: JSON.stringify(fournisseurs),
    },
    update: { valeur: JSON.stringify(fournisseurs) },
  });
}

function calculerFiabilite(f: Fournisseur): number {
  if (f.livraisonsTerminees === 0) return f.fiabilite || 3;
  return Math.max(1, Math.min(5, Math.round((f.livraisonsEnTemps / f.livraisonsTerminees) * 5)));
}

// ── GET — liste des fournisseurs ──────────────────────────────────────────
export async function GET(_request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;

    const fournisseurs = await lireFournisseurs(tenantId);
    return NextResponse.json({ fournisseurs });
  } catch {
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

// ── POST — ajouter un fournisseur ─────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const body = await request.json();

    const { nom, pays, type, delaiLivraison, catalogueCount, url, email, telephone } = body;
    if (!nom || !pays) {
      return NextResponse.json({ message: "Nom et pays requis" }, { status: 400 });
    }

    const fournisseurs = await lireFournisseurs(tenantId);

    const nouveau: Fournisseur = {
      id: `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      nom,
      pays,
      type: type || "autre",
      delaiLivraison: delaiLivraison || 14,
      fiabilite: 3,
      catalogueCount: catalogueCount || 0,
      url: url || undefined,
      email: email || undefined,
      telephone: telephone || undefined,
      livraisonsTerminees: 0,
      livraisonsEnTemps: 0,
      createdAt: new Date().toISOString(),
    };

    fournisseurs.push(nouveau);
    await ecrireFournisseurs(tenantId, fournisseurs);

    return NextResponse.json({ fournisseur: nouveau }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

// ── PUT — modifier un fournisseur ──────────────────────────────────────────
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const body = await request.json();

    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ message: "ID requis" }, { status: 400 });

    const fournisseurs = await lireFournisseurs(tenantId);
    const idx = fournisseurs.findIndex((f) => f.id === id);
    if (idx === -1) return NextResponse.json({ message: "Fournisseur introuvable" }, { status: 404 });

    const updated = { ...fournisseurs[idx], ...updates };
    updated.fiabilite = calculerFiabilite(updated);
    fournisseurs[idx] = updated;
    await ecrireFournisseurs(tenantId, fournisseurs);

    return NextResponse.json({ fournisseur: updated });
  } catch {
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

// ── DELETE — supprimer un fournisseur ─────────────────────────────────────
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ message: "ID requis" }, { status: 400 });

    const fournisseurs = await lireFournisseurs(tenantId);
    const filtered = fournisseurs.filter((f) => f.id !== id);
    if (filtered.length === fournisseurs.length) {
      return NextResponse.json({ message: "Fournisseur introuvable" }, { status: 404 });
    }
    await ecrireFournisseurs(tenantId, filtered);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
