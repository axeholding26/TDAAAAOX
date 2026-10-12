// Moteur de routage d'une commande : pour chaque article, d'où il part
// (entrepôt local ou fournisseur), par où il passe, avec quel transporteur, à
// quel coût et dans quel délai. SERVEUR uniquement.
//
// Règle : un stock local disponible passe TOUJOURS avant une commande au
// fournisseur (livraison en jours au lieu de semaines, pas de douane).
// Exemple Cameroun sans stock local :
//   Fournisseur (Chine) → transport international → Douala → entrepôt → client.
//
// Le moteur PROPOSE un itinéraire ; il ne réserve ni ne déplace aucun stock
// (les sorties de stock restent celles de lib/stock.ts).
import { prisma } from "../prisma";
import { calculerOptionsLivraison } from "../livraison";
import { codePays } from "../devise-convert";
import { contexteCalcul } from "./acces";
import { evaluerProduit } from "./produit-source";
import { configPays } from "./pays";

export interface RouteLigne {
  produitId: string;
  nom: string;
  quantite: number;
  origine: "stock_local" | "fournisseur" | "indisponible";
  fournisseur: string | null;
  entrepot: string | null;
  /** Itinéraire, étape par étape. */
  etapes: string[];
  /** Coût d'approvisionnement estimé de la ligne (hors livraison au client). */
  cout: number | null;
  /** Délai avant que l'article soit prêt à être livré localement, en jours. */
  delaiJours: number;
  explication: string;
}

export async function routerCommande(tenantId: string, commandeId: string) {
  const commande = await prisma.commande.findFirst({
    where: { id: commandeId, tenantId },
    select: {
      id: true, numero: true, ville: true, pays: true, montantSousTotal: true,
      lignes: {
        select: {
          produitId: true, nom: true, quantite: true,
          produit: {
            select: {
              type: true, stock: true, poids: true, cout: true, prixFournisseur: true, nomFournisseur: true,
              fournisseur: { select: { nom: true, pays: true, delaiLivraison: true } },
              stocksEntrepot: { where: { quantite: { gt: 0 }, entrepot: { actif: true } }, select: { quantite: true, entrepot: { select: { nom: true, ville: true, principal: true } } } },
            },
          },
        },
      },
    },
  });
  if (!commande) return null;

  const ctx = await contexteCalcul(tenantId);
  const [sources, entrepotPrincipal] = await Promise.all([
    prisma.produitSource.findMany({ where: { tenantId, produitId: { in: commande.lignes.map((l) => l.produitId) } } }),
    prisma.entrepot.findFirst({ where: { tenantId, actif: true }, orderBy: { principal: "desc" }, select: { nom: true, ville: true } }),
  ]);
  const pays = codePays(commande.pays) ?? ctx.pays;
  const pointEntree = ctx.reglages.pointEntree ?? configPays(pays).pointEntree;
  const memeVille = (v?: string | null) => !!v && v.trim().toLowerCase() === commande.ville.trim().toLowerCase();

  const lignes: RouteLigne[] = commande.lignes.map((l) => {
    const p = l.produit;
    const source = sources.find((s) => s.produitId === l.produitId);
    const base = { produitId: l.produitId, nom: l.nom, quantite: l.quantite };
    const client = `Livraison au client (${commande.ville})`;

    // 1. Stock local : entrepôt de la ville du client d'abord, puis l'entrepôt principal, puis le plus fourni.
    const entrepots = p.stocksEntrepot.filter((s) => s.quantite >= l.quantite)
      .sort((a, b) => Number(memeVille(b.entrepot.ville)) - Number(memeVille(a.entrepot.ville)) || Number(b.entrepot.principal) - Number(a.entrepot.principal) || b.quantite - a.quantite);
    const stockBoutique = p.type === "physique" && p.stock >= l.quantite;
    if (entrepots.length || stockBoutique) {
      const e = entrepots[0]?.entrepot;
      const nomEntrepot = e ? `${e.nom}${e.ville ? ` (${e.ville})` : ""}` : "Stock de la boutique";
      return {
        ...base, origine: "stock_local", fournisseur: null, entrepot: nomEntrepot,
        etapes: [nomEntrepot, client], cout: p.cout != null ? p.cout * l.quantite : null, delaiJours: 0,
        explication: "Stock local disponible : pas de commande au fournisseur, pas de douane.",
      };
    }

    // 2. Fournisseur : produit en dropshipping, ou produit physique en rupture rattaché à un fournisseur.
    const nomFournisseur = p.fournisseur?.nom ?? source?.fournisseurNom ?? p.nomFournisseur;
    if (nomFournisseur) {
      const delaiSource = (source?.logistique as { delaiJours?: number } | null)?.delaiJours;
      const entrepot = entrepotPrincipal ? `${entrepotPrincipal.nom}${entrepotPrincipal.ville ? ` (${entrepotPrincipal.ville})` : ""}` : null;
      const coutUnitaire = source
        ? evaluerProduit(source, ctx).cout.coutProduitRendu
        : p.prixFournisseur ?? p.cout;
      return {
        ...base, origine: "fournisseur", fournisseur: nomFournisseur, entrepot,
        etapes: [
          `${nomFournisseur}${p.fournisseur?.pays ? ` (${p.fournisseur.pays})` : ""}`,
          "Transport international",
          `Arrivée et dédouanement à ${pointEntree}`,
          ...(entrepot ? [entrepot] : []),
          client,
        ],
        cout: coutUnitaire != null ? coutUnitaire * l.quantite : null,
        delaiJours: p.fournisseur?.delaiLivraison ?? delaiSource ?? 15,
        explication: p.type === "physique" ? "Stock local insuffisant : réapprovisionnement chez le fournisseur." : "Aucun stock local : commande transmise au fournisseur.",
      };
    }

    return {
      ...base, origine: "indisponible", fournisseur: null, entrepot: null, etapes: [], cout: null, delaiJours: 0,
      explication: "Ni stock local ni fournisseur rattaché à ce produit : rattachez un fournisseur ou réapprovisionnez.",
    };
  });

  const poids = commande.lignes.reduce((s, l) => s + (l.produit.poids ?? 0) * l.quantite, 0);
  const options = await calculerOptionsLivraison({ tenantId, pays, zone: commande.ville, poids, montantCommande: commande.montantSousTotal });
  const transporteur = options[0] ?? null; // triées par frais croissants

  return {
    commande: { id: commande.id, numero: commande.numero, ville: commande.ville, pays },
    devise: ctx.devise,
    lignes,
    transporteur: transporteur && { nom: transporteur.transporteur ?? transporteur.nom, mode: transporteur.modeLivraison, frais: transporteur.frais, delai: transporteur.delai },
    coutAppro: lignes.some((l) => l.cout === null) ? null : lignes.reduce((s, l) => s + l.cout!, 0),
    delaiApproJours: Math.max(0, ...lignes.map((l) => l.delaiJours)),
  };
}
