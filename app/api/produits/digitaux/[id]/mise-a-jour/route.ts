import { NextResponse } from "next/server";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { acheteursDuProduit, prevenirAcheteursMiseAJour } from "@/lib/livraison-numerique";

type Ctx = { params: Promise<{ id: string }> };

// Une annonce par produit toutes les 10 minutes : un double clic n'envoie pas deux e-mails à chaque acheteur.
const parProduit = rateLimit({ windowMs: 10 * 60_000, max: 1, keyPrefix: "maj-produit" });

async function produitDuMarchand(id: string) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId as string | undefined;
  if (!tenantId) return null;
  const produit = await prisma.produit.findFirst({ where: { id, tenantId, type: { in: ["digital", "fichier"] } }, select: { id: true } });
  return produit ? tenantId : null;
}

// GET — nombre d'acheteurs qui recevraient l'annonce.
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const tenantId = await produitDuMarchand(id);
  if (!tenantId) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  return NextResponse.json({ acheteurs: (await acheteursDuProduit(tenantId, id)).length });
}

// POST — e-mail « nouvelle version disponible » à chaque acheteur, avec son lien d'accès (envoyé après la réponse).
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const tenantId = await produitDuMarchand(id);
  if (!tenantId) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  const acheteurs = (await acheteursDuProduit(tenantId, id)).length;
  if (!acheteurs) return NextResponse.json({ acheteurs: 0 });
  if (!parProduit.check(id).success) return NextResponse.json({ error: "Les acheteurs viennent déjà d'être prévenus. Réessaie dans 10 minutes." }, { status: 429 });
  after(() => prevenirAcheteursMiseAJour(tenantId, id).catch((e) => console.error("[mise-a-jour-produit]", String(e?.message).slice(0, 200))));
  return NextResponse.json({ acheteurs });
}
