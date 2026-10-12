// Listes des filtres du pilotage (magasins, caisses, vendeurs, catégories) et
// noms à poser sur les identifiants des agrégats. SERVEUR uniquement.
import { prisma } from "../../prisma";
import { categoriesCatalogue } from "../catalogue";
import { nomsUtilisateurs } from "../caisse/mouvements";
import type { FiltresVentes } from "./ventes";

export type ListesFiltres = {
  magasins: { id: string; nom: string; demo: boolean; actif: boolean; caisses: { id: string; nom: string; actif: boolean; ouverte: boolean }[] }[];
  vendeurs: { id: string; nom: string }[];
  categories: string[];
};

/** Magasins permis au lecteur, avec leurs caisses ; vendeurs ayant vendu en caisse depuis 90 jours ; catégories du catalogue. */
export async function listesFiltres(f: Pick<FiltresVentes, "tenantId" | "magasinsAutorises">): Promise<ListesFiltres> {
  const { tenantId } = f;
  const [magasins, ouvertes, vendeurs, categories] = await Promise.all([
    prisma.magasin.findMany({
      where: { tenantId, ...(f.magasinsAutorises.length ? { id: { in: f.magasinsAutorises } } : {}) },
      orderBy: { createdAt: "asc" },
      select: { id: true, nom: true, demo: true, actif: true, caisses: { orderBy: { createdAt: "asc" }, select: { id: true, nom: true, actif: true } } },
    }),
    prisma.sessionCaisse.findMany({ where: { tenantId, statut: "ouverte" }, select: { caisseId: true } }),
    prisma.commande.groupBy({
      by: ["vendeurId"],
      where: { tenantId, canal: "pos", vendeurId: { not: null }, createdAt: { gte: new Date(Date.now() - 90 * 86_400_000) } },
    }),
    categoriesCatalogue(tenantId),
  ]);
  const ouvert = new Set(ouvertes.map((s) => s.caisseId));
  const ids = vendeurs.map((v) => v.vendeurId!);
  const noms = await nomsUtilisateurs(tenantId, ids);
  return {
    magasins: magasins.map((m) => ({ ...m, caisses: m.caisses.map((c) => ({ ...c, ouverte: ouvert.has(c.id) })) })),
    vendeurs: ids.map((id) => ({ id, nom: noms[id] ?? "Utilisateur" })).sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    categories: categories.map((c) => c.nom),
  };
}
