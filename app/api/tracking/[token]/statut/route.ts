// Livreur sans compte (lien de la course, QR montré par le marchand) : démarrer, livrer avec le
// code du client, signaler un échec. Mêmes contrôles que l'appli livreur (lib/cycle-livraison.ts).
import { NextResponse } from "next/server";
import { changerStatutCommande } from "@/lib/cycle-livraison";
import { getClientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

// Public : limité par adresse, en plus des 5 essais de code par commande.
const limite = rateLimit({ windowMs: 60_000, max: 20, keyPrefix: "lien-livreur" });

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const rl = limite.check(getClientIp(req));
  if (!rl.success) return rateLimitResponse(rl.reset);
  const { token } = await params;
  const { statut, code, echecRaison } = await req.json().catch(() => ({}));
  if (typeof statut !== "string") return NextResponse.json({ error: "statut requis" }, { status: 400 });

  const commande = await prisma.commande.findFirst({ where: { livreurToken: token }, select: { id: true } });
  if (!commande) return NextResponse.json({ error: "Lien de livraison invalide." }, { status: 404 });

  const r = await changerStatutCommande({
    commandeId: commande.id, statut, code, acteur: { type: "lien", token },
    echecRaison: typeof echecRaison === "string" ? echecRaison.slice(0, 120) : null,
  });
  if (!r.ok) return NextResponse.json({ error: r.error, code: r.code }, { status: r.status });
  return NextResponse.json({ ok: true, statut: r.statut });
}
