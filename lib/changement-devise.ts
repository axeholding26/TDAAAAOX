// Changement de pays d'une boutique → TOUS ses montants passent dans la nouvelle
// devise, aux taux du jour, dans la même transaction que le changement de pays :
// catalogue, codes promo, livraison, commandes, commissions, wallet, affiliation…
// Sans ça, un produit à 12 000 FCFA devenait 12 000 ₦ (≈ 5 000 FCFA) et les
// statistiques additionnaient des FCFA et des nairas.
// Exception volontaire : les FACTURES émises restent telles qu'éditées (documents légaux).
import { Prisma } from "@prisma/client";
import { ratioConversion } from "./devise-convert";

// Monnaies à « petite » unité : on garde les centimes ; les autres sont arrondies à l'unité.
const AVEC_CENTIMES = new Set("EUR USD GBP CHF CAD AUD NZD GHS MAD TND EGP ZAR BWP NAD LSL SZL MUR SCR LYD ZMW ERN SLE STN AED SAR QAR KWD BHD OMR SGD MYR BRL PEN ILS TRY CNY PLN SEK NOK DKK".split(" "));

type Tx = Prisma.TransactionClient;

export async function convertirDeviseBoutique(tx: Tx, tenantId: string, ancienne: string, nouvelle: string, taux: Record<string, number>): Promise<{ ratio: number } | null> {
  const ratio = ratioConversion(ancienne, nouvelle, taux);
  if (ancienne === nouvelle || ratio === 1) return null; // taux inconnu : rien n'est touché
  const d = AVEC_CENTIMES.has(nouvelle) ? 2 : 0;
  const t = tenantId, a = ancienne, n = nouvelle;
  // Colonne × ratio, arrondie (NULL reste NULL). ratio et d sont des nombres calculés ici, jamais une saisie.
  // alias : table de l'UPDATE quand elle est jointe (UPDATE … FROM), sinon la colonne est ambiguë.
  const conv = (col: string, alias?: string) => Prisma.raw(`"${col}" = ROUND((${alias ? `${alias}.` : ""}"${col}" * ${ratio})::numeric, ${d})`);

  // Catalogue et réglages (tous les enregistrements de la boutique)
  await tx.$executeRaw`UPDATE "Produit" SET ${conv("prix")}, ${conv("prixCompare")}, ${conv("cout")}, ${conv("prixFournisseur")} WHERE "tenantId" = ${t}`;
  await tx.$executeRaw`UPDATE "Variante" v SET ${conv("prix", "v")} FROM "Produit" p WHERE v."produitId" = p.id AND p."tenantId" = ${t}`;
  await tx.$executeRaw`UPDATE "VariantePrix" SET ${conv("prix")}, ${conv("prixPromo")} WHERE "tenantId" = ${t}`;
  await tx.$executeRaw`UPDATE "CodePromo" SET ${conv("minCommande")} WHERE "tenantId" = ${t}`;
  await tx.$executeRaw`UPDATE "CodePromo" SET ${conv("valeur")} WHERE "tenantId" = ${t} AND type <> 'pourcentage'`;
  await tx.$executeRaw`UPDATE "ReglePort" SET ${conv("montantMin")}, ${conv("montantMax")}, ${conv("frais")}, ${conv("fraisKg")} WHERE "tenantId" = ${t}`;
  await tx.$executeRaw`UPDATE "ProgrammeAffiliation" SET ${conv("seuilPaiement")} WHERE "tenantId" = ${t}`;
  await tx.$executeRaw`UPDATE "ProgrammeAffiliation" SET ${conv("valeurCommission")} WHERE "tenantId" = ${t} AND "typeCommission" <> 'pourcentage'`;
  await tx.$executeRaw`UPDATE "Client" SET ${conv("totalDepense")} WHERE "tenantId" = ${t}`;

  // Historique (seulement ce qui est encore dans l'ancienne devise)
  await tx.$executeRaw`UPDATE "LigneCommande" l SET ${conv("prix", "l")} FROM "Commande" c WHERE l."commandeId" = c.id AND c."tenantId" = ${t} AND c.devise = ${a}`;
  await tx.$executeRaw`UPDATE "Commande" SET ${conv("montantSousTotal")}, ${conv("montantLivraison")}, ${conv("montantReduction")}, ${conv("montantTotal")}, devise = ${n} WHERE "tenantId" = ${t} AND devise = ${a}`;
  await tx.$executeRaw`UPDATE "Commission" SET ${conv("montantCommande")}, ${conv("montantCommission")}, ${conv("montantMarchand")}, devise = ${n} WHERE "tenantId" = ${t} AND devise = ${a}`;
  await tx.$executeRaw`UPDATE "WalletTransaction" w SET ${conv("montant", "w")}, devise = ${n} FROM "Wallet" wa WHERE w."walletId" = wa.id AND wa."tenantId" = ${t} AND w.devise = ${a}`;
  await tx.$executeRaw`UPDATE "Wallet" SET ${conv("solde")}, ${conv("totalRecu")}, ${conv("totalRetire")}, ${conv("totalCommission")}, devise = ${n} WHERE "tenantId" = ${t} AND devise = ${a}`;
  await tx.$executeRaw`UPDATE "Retrait" SET ${conv("montant")}, devise = ${n} WHERE "tenantId" = ${t} AND devise = ${a}`;
  await tx.$executeRaw`UPDATE "AffiliationCommission" SET ${conv("montantCommande")}, ${conv("montantGagne")}, devise = ${n} WHERE "tenantId" = ${t} AND devise = ${a}`;
  await tx.$executeRaw`UPDATE "ChargeExploitation" SET ${conv("montant")}, devise = ${n} WHERE "tenantId" = ${t} AND devise = ${a}`;
  await tx.$executeRaw`UPDATE "Campagne" SET ${conv("budget")}, ${conv("budgetJour")}, devise = ${n} WHERE "tenantId" = ${t} AND devise = ${a}`;
  await tx.$executeRaw`UPDATE "AgentGoal" SET ${conv("cible")}, devise = ${n} WHERE "tenantId" = ${t} AND devise = ${a} AND type IN ('ca', 'panier_moyen')`;
  await tx.$executeRaw`UPDATE "AgentGoal" SET devise = ${n} WHERE "tenantId" = ${t} AND devise = ${a}`;
  // Tables sans colonne devise : toujours dans la devise de la boutique
  await tx.$executeRaw`UPDATE "RetourRMA" SET ${conv("montant")} WHERE "tenantId" = ${t}`;
  await tx.$executeRaw`UPDATE "CommandeFournisseur" SET ${conv("montantFournisseur")} WHERE "tenantId" = ${t}`;
  await tx.$executeRaw`UPDATE "AffiliationLien" SET ${conv("montantGenere")} WHERE "tenantId" = ${t}`;
  await tx.$executeRaw`UPDATE "PaiementCommission" SET ${conv("montant")} WHERE "tenantId" = ${t}`;
  await tx.$executeRaw`UPDATE "Affilie" SET ${conv("commissionTotal")}, ${conv("commissionPending")} WHERE "tenantId" = ${t}`;
  await tx.$executeRaw`UPDATE "CommissionAffilie" SET ${conv("montantCommission")}, ${conv("valeurCommande")} WHERE "tenantId" = ${t}`;

  // Réglages de livraison simples (JSON) : montants locale / nationale / gratuiteA
  const tenant = await tx.tenant.findUnique({ where: { id: t }, select: { parametresLivraison: true } });
  const pl = (tenant?.parametresLivraison ?? {}) as Record<string, any>;
  const arrondi = (x: number) => Math.round(x * ratio * 10 ** d) / 10 ** d;
  if (["locale", "nationale", "gratuiteA"].some((k) => typeof pl[k] === "number")) {
    const maj = { ...pl };
    for (const k of ["locale", "nationale", "gratuiteA"]) if (typeof pl[k] === "number") maj[k] = arrondi(pl[k]);
    await tx.tenant.update({ where: { id: t }, data: { parametresLivraison: maj } });
  }
  return { ratio };
}
