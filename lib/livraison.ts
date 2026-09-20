import { prisma } from "@/lib/prisma";

export type OptionLivraison = {
  id: string;
  nom: string;
  transporteur: string | null;
  modeLivraison: string;
  delai: string;
  frais: number;
  gratuit: boolean;
};

// Matching zone/poids/montant contre les ReglePort actives d'un tenant.
// Utilisé à la fois par l'API publique /api/livraison/calculer (affichage
// checkout) et par whatsapp-creer/route.ts (calcul serveur autoritaire —
// jamais confiance en un montant envoyé par le client).
export async function calculerOptionsLivraison(params: {
  tenantId: string;
  zone: string;
  poids?: number;
  montantCommande?: number;
}): Promise<OptionLivraison[]> {
  const { tenantId, zone, poids = 0, montantCommande = 0 } = params;

  const regles = await prisma.reglePort.findMany({
    where: { tenantId, actif: true },
    orderBy: { frais: "asc" },
  });

  const matching = regles.filter((r) => {
    const zoneMatch =
      r.zone.toLowerCase() === zone.toLowerCase() ||
      r.zone.toLowerCase().includes("international") ||
      zone.toLowerCase().includes(r.zone.toLowerCase());

    if (!zoneMatch) return false;

    const poidsOk = poids >= r.poidsMin && (r.poidsMax === null || poids <= r.poidsMax);
    const montantMinOk = r.montantMin === null || montantCommande >= r.montantMin;
    const montantMaxOk = r.montantMax === null || montantCommande <= r.montantMax;

    return poidsOk && montantMinOk && montantMaxOk;
  });

  const options: OptionLivraison[] = matching.map((r) => {
    const fraisTotal = r.gratuit ? 0 : r.frais + Math.max(0, poids - r.poidsMin) * r.fraisKg;
    return {
      id: r.id,
      nom: r.nom,
      transporteur: r.transporteur,
      modeLivraison: r.modeLivraison,
      delai: r.delai,
      frais: fraisTotal,
      gratuit: r.gratuit || fraisTotal === 0,
    };
  });

  if (options.length === 0) {
    options.push({
      id: "default",
      nom: "Livraison standard",
      transporteur: null,
      modeLivraison: "livreur_local",
      delai: "7-14 jours",
      frais: 0,
      gratuit: false,
    });
  }

  return options;
}

// Frais serveur autoritaire pour une zone + une règle de livraison données
// (whatsapp-creer/route.ts) : ne jamais faire confiance à un montant envoyé
// par le client. Retourne 0 si aucune règle ne matche ni de zone fournie.
export async function fraisLivraisonServeur(params: {
  tenantId: string;
  zone?: string | null;
  regleId?: string | null;
  poids?: number;
  montantCommande?: number;
}): Promise<number> {
  const { tenantId, zone, regleId, poids = 0, montantCommande = 0 } = params;
  if (!zone) return 0;

  const options = await calculerOptionsLivraison({ tenantId, zone, poids, montantCommande });
  const choisie = regleId ? options.find((o) => o.id === regleId) : options[0];
  return choisie?.frais ?? 0;
}
