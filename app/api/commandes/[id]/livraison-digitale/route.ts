import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireNiveau } from "@/lib/permissions-server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { livrerCommandeDigitale } from "@/lib/livraison-numerique";

// Un e-mail client ne part pas en rafale depuis le bouton marchand.
const limite = rateLimit({ windowMs: 10 * 60_000, max: 5, keyPrefix: "renvoi-lien" });

// POST /api/commandes/[id]/livraison-digitale — « Renvoyer le lien » : reprend la livraison
// (droits manquants créés, jamais dupliqués) et renvoie l'e-mail d'accès au client.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!session || !tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const refus = await requireNiveau(session, "commandes", "ecriture");
  if (refus) return NextResponse.json({ error: refus.error }, { status: refus.status });

  const { id } = await params;
  const commande = await prisma.commande.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!commande) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  const rl = limite.check(id);
  if (!rl.success) return rateLimitResponse(rl.reset);

  const bilan = await livrerCommandeDigitale(id, { renvoyerEmail: true });
  if (!bilan.ok) {
    const messages = {
      introuvable: "Commande introuvable",
      non_payee: "Commande non payée, annulée ou remboursée : aucun accès à envoyer",
      sans_digital: "Cette commande ne contient pas de produit numérique",
      en_cours: "Une livraison est déjà en cours, réessaie dans une minute",
    } as const;
    return NextResponse.json({ error: messages[bilan.raison] }, { status: bilan.raison === "en_cours" ? 409 : 400 });
  }
  return NextResponse.json(bilan);
}
