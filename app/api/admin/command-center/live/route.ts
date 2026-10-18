// Mode LIVE : compteurs de la dernière heure, lus directement en base (pas le cache de 60 s).
// En démo, activité simulée et signalée comme telle.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionPour } from "@/lib/admin-auth";
import { demoAutorisee } from "@/lib/command-center/serveur";
import { PLATFORM_TENANT_SLUG } from "@/lib/wallet";

const FENETRE_MIN = 60;

export async function GET(req: NextRequest) {
  const session = await getAdminSessionPour("cc");
  if (!session) return NextResponse.json({ erreur: "Accès refusé" }, { status: 403 });
  const maintenant = Date.now();
  if (req.nextUrl.searchParams.get("source") === "demo" && demoAutorisee()) {
    // Simulation stable à la minute près (pas de hasard d'un rafraîchissement à l'autre).
    const m = Math.floor(maintenant / 60_000), h = new Date(maintenant).getUTCHours();
    const jour = h >= 7 && h <= 21 ? 1 : 0.3, b = (k: number, base: number) => Math.round(base * jour * (0.85 + ((m * 9301 + k * 49297) % 233280) / 233280 * 0.3));
    return NextResponse.json({ a: maintenant, simule: true, fenetreMin: FENETRE_MIN, compteurs: [
      { cle: "actifs", nom: "Marchands actifs", valeur: b(1, 64) }, { cle: "commandes", nom: "Commandes", valeur: b(2, 41) },
      { cle: "transactions", nom: "Paiements réussis", valeur: b(3, 29) }, { cle: "boutiques", nom: "Boutiques créées", valeur: b(4, 3) },
      { cle: "ia", nom: "Requêtes Axia", valeur: b(5, 120) }, { cle: "echecs", nom: "Paiements échoués", valeur: b(6, 2) },
    ] });
  }
  const depuis = new Date(maintenant - FENETRE_MIN * 60_000);
  const horsPlateforme = { tenant: { slug: { not: PLATFORM_TENANT_SLUG } } };
  const [commandes, payees, echecs, boutiques, conversations, actifs] = await Promise.all([
    prisma.commande.count({ where: { createdAt: { gte: depuis }, ...horsPlateforme } }),
    prisma.commande.count({ where: { createdAt: { gte: depuis }, paiementStatut: "completed", ...horsPlateforme } }),
    prisma.commande.count({ where: { createdAt: { gte: depuis }, paiementStatut: "failed", ...horsPlateforme } }),
    prisma.tenant.count({ where: { createdAt: { gte: depuis }, slug: { not: PLATFORM_TENANT_SLUG } } }),
    prisma.axiaConversation.count({ where: { updatedAt: { gte: depuis } } }),
    prisma.tenant.count({ where: { updatedAt: { gte: depuis }, slug: { not: PLATFORM_TENANT_SLUG } } }),
  ]);
  return NextResponse.json({ a: maintenant, simule: false, fenetreMin: FENETRE_MIN, compteurs: [
    { cle: "actifs", nom: "Boutiques modifiées", valeur: actifs }, { cle: "commandes", nom: "Commandes", valeur: commandes },
    { cle: "transactions", nom: "Paiements réussis", valeur: payees }, { cle: "boutiques", nom: "Boutiques créées", valeur: boutiques },
    { cle: "ia", nom: "Conversations Axia", valeur: conversations }, { cle: "echecs", nom: "Paiements échoués", valeur: echecs },
  ] });
}
