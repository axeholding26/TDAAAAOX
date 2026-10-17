import { prisma } from "@/lib/prisma";
import { PAYS_OPTIONS, GROUPES_PAYS } from "@/lib/devise-convert";
import { lireReglagesLivraison, normaliserZone, trouverZone } from "@/lib/livraison-reglages";

export type OptionLivraison = {
  id: string;
  nom: string;
  transporteur: string | null;
  modeLivraison: string;
  delai: string;
  frais: number;
  gratuit: boolean;
};

// Tarifs de livraison, modèle Shopify. Ordre de précision (la plus précise gagne) :
//   1. règle avancée de quartier (Logistique → Livraison, ReglePort.zone)
//   2. tarif de la zone dans Ma boutique → Livraison (pays de la boutique seulement)
//   3. règle avancée du pays, puis « tous les pays »
//   4. tarif standard de Ma boutique → Livraison
// Puis la gratuité de Ma boutique (« pour tous » ou dès un minimum) s'applique à tout : avant,
// elle ne valait que sans aucune règle, et une règle de pays la faisait payer quand même.
// Les règles au poids utilisent le poids du panier (poidsPanier). Utilisé par
// /api/livraison/calculer (affichage checkout) et par les routes de création de commande
// (calcul serveur autoritaire — jamais confiance en un montant envoyé par le client).
export async function calculerOptionsLivraison(params: {
  tenantId: string;
  pays?: string | null; // code ISO2 du client
  zone?: string | null; // quartier/ville choisi au checkout
  poids?: number;
  montantCommande?: number;
}): Promise<OptionLivraison[]> {
  const { tenantId, poids = 0, montantCommande = 0 } = params;
  const pays = params.pays?.toUpperCase() ?? "";
  const zone = normaliserZone(params.zone);

  const [regles, tenant] = await Promise.all([
    prisma.reglePort.findMany({ where: { tenantId, actif: true }, orderBy: { frais: "asc" } }),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { parametresLivraison: true, pays: true } }),
  ]);
  const reglages = lireReglagesLivraison(tenant?.parametresLivraison);
  const zoneBoutique = pays && pays === tenant?.pays?.toUpperCase() ? trouverZone(reglages.zones, params.zone) : undefined;

  const precision = (r: (typeof regles)[number]) => {
    if (r.pays.length && !r.pays.includes(pays)) return -1;
    if (r.zone.trim()) return normaliserZone(r.zone) === zone && !!zone ? 2 : -1;
    return r.pays.length ? 1 : 0;
  };
  const candidates = regles.filter((r) =>
    precision(r) >= 0 &&
    poids >= r.poidsMin && (r.poidsMax === null || poids <= r.poidsMax) &&
    (r.montantMin === null || montantCommande >= r.montantMin) &&
    (r.montantMax === null || montantCommande <= r.montantMax));
  const meilleure = Math.max(-1, ...candidates.map(precision));

  let options: OptionLivraison[];
  if (meilleure < 2 && zoneBoutique?.frais != null) {
    options = [{
      id: "zone", nom: `Livraison ${zoneBoutique.nom}`, transporteur: null, modeLivraison: "livreur_local",
      delai: zoneBoutique.delai || reglages.delai, frais: zoneBoutique.frais, gratuit: zoneBoutique.frais === 0,
    }];
  } else if (candidates.length) {
    options = candidates.filter((r) => precision(r) === meilleure).map((r) => {
      const frais = r.gratuit ? 0 : r.frais + Math.max(0, poids - r.poidsMin) * r.fraisKg;
      return { id: r.id, nom: r.nom, transporteur: r.transporteur, modeLivraison: r.modeLivraison, delai: r.delai, frais, gratuit: r.gratuit || frais === 0 };
    });
  } else {
    options = [{
      id: "default", nom: "Livraison standard", transporteur: null, modeLivraison: "livreur_local",
      delai: zoneBoutique?.delai || reglages.delai, frais: reglages.frais, gratuit: reglages.frais === 0,
    }];
  }

  const offerte = reglages.gratuite || (reglages.minimum > 0 && montantCommande >= reglages.minimum);
  return offerte ? options.map((o) => ({ ...o, frais: 0, gratuit: true })) : options;
}

/** Poids du panier en kg : Produit.poids (kg) × quantité (la boutique en ligne vend à l'unité ; la pesée est en caisse, sans livraison). */
export async function poidsPanier(tenantId: string, lignes: { produitId: string; quantite: number }[]) {
  if (!lignes.length) return 0;
  const produits = await prisma.produit.findMany({
    where: { tenantId, id: { in: lignes.map((l) => String(l.produitId)) } },
    select: { id: true, poids: true },
  });
  return lignes.reduce((total, l) => {
    const p = produits.find((x) => x.id === String(l.produitId));
    const q = Math.max(0, Number(l.quantite) || 0);
    return total + (p?.poids ?? 0) * q;
  }, 0);
}

/** Zone obligatoire : la boutique propose des zones et le client est livré dans son pays. Erreur à afficher, sinon null. */
export async function verifierZone(tenantId: string, pays: string | null | undefined, zone: string | null | undefined) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { parametresLivraison: true, pays: true } });
  const { zones } = lireReglagesLivraison(tenant?.parametresLivraison);
  if (!zones.length || !pays || pays.toUpperCase() !== tenant?.pays?.toUpperCase()) return null;
  return trouverZone(zones, zone) ? null : "Sélectionnez votre zone de livraison";
}

// Frais serveur autoritaire pour un pays/quartier + une règle donnée.
export async function fraisLivraisonServeur(params: {
  tenantId: string;
  pays?: string | null;
  zone?: string | null;
  regleId?: string | null;
  poids?: number;
  montantCommande?: number;
}): Promise<number> {
  const options = await calculerOptionsLivraison(params);
  const choisie = params.regleId ? options.find((o) => o.id === params.regleId) : options[0];
  return choisie?.frais ?? 0;
}

const normaliser = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");

/** Texte libre (Axia, anciennes règles) → pays d'une règle : « Cameroun » → [CM],
 *  « UEMOA »/« CEMAC » → le groupe, « International »/« Afrique »/« Tous » → [] (tous) ;
 *  null si ce n'est pas un pays (alors c'est un quartier/une ville). */
export function paysDepuisTexte(texte?: string | null): string[] | null {
  const t = normaliser(texte ?? "");
  if (!t) return [];
  if (["international", "afrique", "tous", "touslespays", "monde", "partout"].includes(t)) return [];
  const groupe = t.length >= 4 ? Object.entries(GROUPES_PAYS).find(([nom]) => normaliser(nom).startsWith(t)) : undefined;
  if (groupe) return groupe[1];
  const pays = PAYS_OPTIONS.find((p) => normaliser(p.nom) === t || p.code.toLowerCase() === t);
  return pays ? [pays.code] : null;
}

/** « Cameroun, Gabon · Akwa » — résumé lisible d'une règle (Axia, listes). */
export function decrireRegle(r: { pays: string[]; zone: string }): string {
  const noms = r.pays.length ? r.pays.map((c) => PAYS_OPTIONS.find((p) => p.code === c)?.nom ?? c).join(", ") : "Tous les pays";
  return r.zone ? `${noms} · ${r.zone}` : noms;
}
