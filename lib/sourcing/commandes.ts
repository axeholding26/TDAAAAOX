// Commandes à faire livrer par un fournisseur, avec leur étape dans le parcours
// complet (14 étapes, lib/sourcing/statuts.ts) et le message de commande prêt à
// envoyer. SERVEUR uniquement — lu par /api/sourcing/commandes et par l'assistant.
import { prisma } from "@/lib/prisma";
import { etapeCommande } from "./statuts";
import { messageCommandeFournisseur } from "./connecteurs";

export async function commandesSourcing(tenantId: string) {
  const commandes = await prisma.commande.findMany({
    where: { tenantId: tenantId, OR: [{ commandesFournisseur: { some: {} } }, { lignes: { some: { produit: { type: "dropshipping" } } } }] },
    select: {
      id: true, numero: true, clientNom: true, clientTelephone: true, adresseLivraison: true, ville: true, pays: true,
      montantTotal: true, devise: true, statut: true, paiementStatut: true, methodePaiement: true, createdAt: true,
      lignes: { select: { nom: true, quantite: true, variante: true, produit: { select: { sku: true, fournisseurId: true, type: true } } } },
      retours: { where: { statut: { in: ["accepte", "clos"] } }, select: { id: true }, take: 1 },
      commandesFournisseur: {
        orderBy: { createdAt: "asc" },
        select: { id: true, statut: true, reference: true, trackingNo: true, montantFournisseur: true, createdAt: true, fournisseurId: true, fournisseur: { select: { nom: true, telephone: true, email: true, url: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const expeditions = await prisma.expedition.findMany({
    where: { tenantId: tenantId, commandeId: { in: commandes.map((c) => c.id) }, statut: { not: "annulee" } },
    select: { id: true, commandeId: true, commandeFournisseurId: true, statut: true, trackingNo: true, arriveeEstimee: true },
    orderBy: { createdAt: "desc" },
  });

  return commandes.map(({ lignes, retours, commandesFournisseur, ...c }) => {
      const expedition = expeditions.find((e) => e.commandeId === c.id) ?? null;
      return {
        ...c,
        articles: lignes.map((l) => `${l.quantite} × ${l.nom}`).join(", "),
        etape: etapeCommande({ ...c, retourAccepte: retours.length > 0, commandeFournisseur: commandesFournisseur[0] ?? null, expedition }),
        expedition,
        commandesFournisseur: commandesFournisseur.map((cf) => ({
          ...cf,
          expeditionId: expeditions.find((e) => e.commandeFournisseurId === cf.id)?.id ?? null,
          // Aucun connecteur fournisseur n'est branché : la commande se transmet par ce message, envoyé par le marchand.
          message: messageCommandeFournisseur({
            numero: c.numero,
            lignes: lignes.filter((l) => !l.produit.fournisseurId || l.produit.fournisseurId === cf.fournisseurId).map((l) => ({ nom: l.nom, quantite: l.quantite, variante: l.variante, sku: l.produit.sku })),
            destinataire: { nom: c.clientNom, telephone: c.clientTelephone, adresse: c.adresseLivraison, ville: c.ville, pays: c.pays },
          }),
        })),
        // Produits dropshipping sans fournisseur rattaché : la commande ne peut pas être routée automatiquement.
        sansFournisseur: commandesFournisseur.length === 0 && lignes.some((l) => l.produit.type === "dropshipping"),
      };
    });
}
