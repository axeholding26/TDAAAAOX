// Inscription GRATUITE à un événement / bootcamp depuis la vitrine. Les places payantes passent
// par le checkout existant (digital-creer → NotchPay → lib/livraison-numerique.ts).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { inscrire, envoyerConfirmationInscription, refusVenteLive } from "@/lib/live/service";

const limite = rateLimit({ windowMs: 60_000, max: 8, keyPrefix: "live-inscription" });
const Corps = z.object({ produitId: z.string().min(1).max(40), nom: z.string().trim().min(2).max(120), email: z.string().trim().toLowerCase().email().max(200) });

export async function POST(req: NextRequest) {
  const rl = limite.check(getClientIp(req));
  if (!rl.success) return rateLimitResponse(rl.reset);
  const p = Corps.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Nom et e-mail valides requis" }, { status: 400 });
  const produit = await prisma.produit.findFirst({
    where: { id: p.data.produitId, actif: true, type: { in: ["evenement", "bootcamp"] }, tenant: { statut: "active" } },
    select: { id: true, prix: true, tenantId: true, evenement: { select: { id: true } }, bootcamp: { select: { id: true } } },
  });
  if (!produit) return NextResponse.json({ error: "Événement introuvable" }, { status: 404 });
  if (produit.prix > 0) return NextResponse.json({ error: "Événement payant : réservez votre place via le paiement" }, { status: 402 });
  // Mêmes contrôles que la vente (annulé, terminé), le prix nul mis à part.
  const refus = await refusVenteLive(produit.id, 1);
  if (refus && refus !== "complet") return NextResponse.json({ error: `Inscription fermée : ${refus}` }, { status: 409 });
  const cible = produit.evenement ? { evenementId: produit.evenement.id } : { bootcampId: produit.bootcamp!.id };
  const r = await inscrire({ tenantId: produit.tenantId, cible, nom: p.data.nom, email: p.data.email });
  if (!r.ok) return NextResponse.json({ error: r.raison === "complet" ? "Complet : plus aucune place disponible" : "Inscription impossible" }, { status: 409 });
  const emailEnvoye = await envoyerConfirmationInscription(r.inscription.id);
  // Déjà inscrit : le lien personnel n'est JAMAIS renvoyé au navigateur (quiconque connaît l'e-mail
  // l'obtiendrait) — seulement par e-mail.
  if (r.deja) return NextResponse.json({ ok: true, deja: true, emailEnvoye });
  return NextResponse.json({ ok: true, token: r.inscription.token, emailEnvoye }, { status: 201 });
}
