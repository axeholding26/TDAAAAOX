// Alertes Sourcing — recalculées à chaque lecture à partir des données réelles
// (ventes, stocks, commandes fournisseurs) : rien n'est stocké, une alerte
// disparaît dès que sa cause disparaît. SERVEUR uniquement.
import { prisma } from "../prisma";
import type { TableauDeBord } from "./profit";
import type { PrevisionStock } from "./stocks";

export interface Alerte {
  type: "produit_rentable" | "marge_faible" | "fournisseur_lent" | "stock_faible" | "refus_eleve" | "pub_trop_chere" | "a_scaler";
  ton: "positif" | "attention";
  titre: string;
  message: string;
  lien?: string;
}

const MARGE_FAIBLE = 0.15;
const MARGE_RENTABLE = 0.3;
const REFUS_ELEVE = 0.25;
const VENTES_SCALE = 20;

const pct = (n: number) => `${Math.round(n * 100)} %`;

export async function alertesSourcing(tenantId: string, tdb: TableauDeBord, stocks: PrevisionStock[]): Promise<Alerte[]> {
  const alertes: Alerte[] = [];
  const stockOk = new Set(stocks.filter((s) => s.niveau === "ok").map((s) => s.produitId));

  for (const p of tdb.topProduits) {
    if (!(p.ca > 0) || p.cout === 0) continue; // sans coût connu, la marge ne veut rien dire
    const marge = p.benefice / p.ca;
    const lien = `/dashboard/produits/${p.produitId}`;
    if (marge >= MARGE_RENTABLE && p.quantite >= VENTES_SCALE && stockOk.has(p.produitId)) {
      alertes.push({ type: "a_scaler", ton: "positif", titre: `Produit à scaler : ${p.nom}`, message: `${p.quantite} ventes en ${tdb.jours} jours à ${pct(marge)} de marge avant publicité, et le stock suit. Augmentez le budget publicitaire par paliers.`, lien });
    } else if (marge >= MARGE_RENTABLE && p.quantite >= 5) {
      alertes.push({ type: "produit_rentable", ton: "positif", titre: `Produit rentable : ${p.nom}`, message: `${pct(marge)} de marge avant publicité sur ${p.quantite} ventes.`, lien });
    } else if (marge < MARGE_FAIBLE) {
      alertes.push({ type: "marge_faible", ton: "attention", titre: `Marge faible : ${p.nom}`, message: `Seulement ${pct(Math.max(0, marge))} de marge avant publicité. Revoyez le prix ou le coût d'achat.`, lien });
    }
  }

  const { tauxRefus, roas, ca } = tdb.kpi;
  if (tauxRefus !== null && tauxRefus > REFUS_ELEVE && tdb.refus.livrees + tdb.refus.refusees >= 10) {
    alertes.push({ type: "refus_eleve", ton: "attention", titre: "Taux de refus élevé", message: `${tdb.refus.refusees} commandes refusées sur ${tdb.refus.livrees + tdb.refus.refusees} (${pct(tauxRefus)}). Confirmez chaque commande par WhatsApp avant d'expédier.`, lien: "/dashboard/commandes" });
  }

  // ROAS minimum de la boutique : le CA divisé par ce qu'il reste une fois tous les autres coûts payés.
  const resteAvantPub = tdb.kpi.benefice + tdb.postes.publicite;
  if (roas !== null && tdb.postes.publicite > 0 && (resteAvantPub <= 0 || roas < ca / resteAvantPub)) {
    alertes.push({ type: "pub_trop_chere", ton: "attention", titre: "Coût publicitaire trop élevé", message: `ROAS de ${roas.toFixed(2)} : la publicité coûte plus que ce que les ventes laissent après les autres frais. Coupez les publicités les moins rentables.`, lien: "/dashboard/marketing" });
  }

  for (const s of stocks) {
    if (s.niveau !== "rupture" && s.niveau !== "urgent") continue;
    if (s.niveau === "rupture" && s.ventes30j === 0) continue; // en rupture mais sans demande récente : pas une urgence
    alertes.push({
      type: "stock_faible", ton: "attention", titre: `Stock faible : ${s.nom}`,
      message: s.niveau === "rupture"
        ? `En rupture. ${s.aCommander ? `Commander ${s.aCommander} unités maintenant.` : ""}`
        : `Rupture estimée dans ${s.joursRestants} jour(s), le réapprovisionnement en demande ${s.delaiReappro}. Commander ${s.aCommander} unités maintenant.`,
      lien: "/dashboard/sourcing?bloc=stocks",
    });
  }

  // Commandes transmises au fournisseur et toujours pas expédiées une fois son délai dépassé.
  const enCours = await prisma.commandeFournisseur.findMany({
    where: { tenantId, statut: { in: ["envoye", "confirme"] } },
    select: { createdAt: true, delaiEstime: true, fournisseur: { select: { nom: true, delaiLivraison: true } }, commande: { select: { numero: true } } },
    take: 100,
  });
  const retards = new Map<string, string[]>();
  for (const cf of enCours) {
    const delai = cf.delaiEstime ?? cf.fournisseur.delaiLivraison;
    if (delai === null) continue; // aucun délai annoncé : pas de retard mesurable
    if (Date.now() - cf.createdAt.getTime() > delai * 86400_000) retards.set(cf.fournisseur.nom, [...(retards.get(cf.fournisseur.nom) ?? []), `#${cf.commande.numero}`]);
  }
  for (const [nom, numeros] of retards) {
    alertes.push({ type: "fournisseur_lent", ton: "attention", titre: `Fournisseur lent : ${nom}`, message: `${numeros.length} commande(s) en retard sur le délai annoncé : ${numeros.slice(0, 5).join(", ")}. Relancez-le ou comparez avec un autre fournisseur.`, lien: "/dashboard/sourcing?bloc=commandes" });
  }

  return alertes;
}
