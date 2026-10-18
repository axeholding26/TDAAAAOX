import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TYPES_LIVRAISON_DIGITALE } from "@/lib/affiliation";
import { cleAccesCommande } from "@/lib/livraison-numerique";
import { mesFormations } from "@/lib/formation/parcours";

// GET /api/clients-acheteurs/commandes?token=xxx&slug=xxx
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const slug = searchParams.get("slug");

  if (!token || !slug) return NextResponse.json({ error: "token et slug requis" }, { status: 400 });

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });

  // Session ouverte par un lien de suivi : uniquement CETTE commande (voir connexion/route.ts).
  const lien = token.startsWith("lien:") ? token.slice(5) : null;
  const compteLien = lien
    ? await prisma.commande.findFirst({ where: { tenantId: tenant.id, trackingToken: lien }, select: { id: true, clientNom: true } })
    : null;
  // Anciennes sessions « téléphone » (email null) : refusées, elles ouvraient toutes les
  // commandes d'un numéro sans preuve de possession.
  const compte = lien ? null : await prisma.compteAcheteur.findFirst({
    where: {
      token,
      tenantId: tenant.id,
      tokenExpire: { gt: new Date() },
      email: { not: null },
    },
  });

  if (!compte && !compteLien) return NextResponse.json({ error: "Session expirée" }, { status: 401 });

  const parIdentifiant = compteLien ? { id: compteLien.id } : { clientEmail: compte!.email };
  const commandes = await prisma.commande.findMany({
    where: { tenantId: tenant.id, ...parIdentifiant },
    omit: { livreurToken: true }, // accès livreur au suivi GPS : jamais côté client
    include: {
      lignes: {
        include: {
          produit: { select: { id: true, nom: true, images: true, type: true } },
        },
      },
      facture: { select: { numero: true, statut: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Mes formations : seulement les achats payés et non annulés de CE compte (ou de CETTE commande via le lien).
  const formations = await mesFormations(commandes.filter((c) => c.paiementStatut === "completed" && c.statut !== "annulee").map((c) => c.id));

  return NextResponse.json({
    formations,
    compte: compte
      ? { id: compte.id, email: compte.email, nom: compte.nom, telephone: compte.telephone }
      : { id: null, email: null, nom: compteLien!.clientNom, telephone: null },
    // Achat digital payé : accès (fichiers, formation, clés) par sa page d'accès — jamais
    // l'adresse brute du fichier, qui se partagerait sans contrôle.
    commandes: commandes.map((c) => {
      const accesDigital = c.paiementStatut === "completed" && c.statut !== "annulee" && c.lignes.some((l) => TYPES_LIVRAISON_DIGITALE.has(l.produit.type));
      // Clé signée de la page d'accès : l'acheteur a prouvé son e-mail (code) ou détient le lien de suivi.
      return { ...c, accesDigital, cleAcces: accesDigital ? cleAccesCommande(c.id) : null };
    }),
  });
}
