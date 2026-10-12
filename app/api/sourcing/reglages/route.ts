// Réglages Sourcing de la boutique (pays, hypothèses de coût) et état réel des
// intégrations — ce qui est branché, ce qui est en sandbox, ce qui reste à
// connecter. Aucune clé d'API ne sort d'ici : uniquement des statuts.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accesSourcing, contexteCalcul, tauxRefusReel, journaliser, reponseErreur } from "@/lib/sourcing/acces";
import { schemaHypotheses } from "@/lib/sourcing/produit-source";
import { CONNECTEURS } from "@/lib/sourcing/connecteurs";
import { PRESTATAIRES_PAIEMENT, etatPaiements } from "@/lib/sourcing/paiements";
import { PRESTATAIRES_LIVRAISON } from "@/lib/sourcing/fulfillment";

export async function GET() {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  try {
    const [contexte, refus, transporteurs, journal] = await Promise.all([
      contexteCalcul(acces.tenantId),
      tauxRefusReel(acces.tenantId),
      prisma.reglePort.findMany({ where: { tenantId: acces.tenantId, actif: true }, select: { nom: true, transporteur: true, pays: true, zone: true, frais: true, delai: true }, take: 50 }),
      prisma.journalSourcing.findMany({ where: { tenantId: acces.tenantId }, orderBy: { createdAt: "desc" }, take: 30 }),
    ]);
    return NextResponse.json({
      // Forme de ContexteCalcul (pays, devise, reglages, taux, tauxRefusReel) : sert aussi au calculateur libre.
      ...contexte, refus,
      integrations: {
        connecteurs: CONNECTEURS.map(({ id, nom, statut, description, urlSite }) => ({ id, nom, statut, description, urlSite })),
        paiements: PRESTATAIRES_PAIEMENT.map(({ id, nom, statut }) => ({ id, nom, statut })),
        moyensPaiement: etatPaiements(contexte.pays),
        livraison: PRESTATAIRES_LIVRAISON.map(({ id, nom, statut }) => ({ id, nom, statut })),
      },
      transporteurs,
      journal,
    });
  } catch (e) {
    return reponseErreur(e);
  }
}

export async function PUT(req: Request) {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  try {
    const reglages = schemaHypotheses.parse(await req.json());
    await prisma.reglagesSourcing.upsert({ where: { tenantId: acces.tenantId }, create: { tenantId: acces.tenantId, reglages }, update: { reglages } });
    await journaliser(acces, "reglages_modifies", undefined, reglages);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return reponseErreur(e);
  }
}
