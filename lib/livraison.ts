import { prisma } from "@/lib/prisma";
import { PAYS_OPTIONS, GROUPES_PAYS } from "@/lib/devise-convert";

export type OptionLivraison = {
  id: string;
  nom: string;
  transporteur: string | null;
  modeLivraison: string;
  delai: string;
  frais: number;
  gratuit: boolean;
};

// Tarifs de livraison, modèle Shopify : chaque ReglePort couvre une liste de
// pays (vide = tous) et, en option, un quartier/ville précis de ces pays.
// Le pays de l'adresse du client décide ; parmi les règles qui correspondent,
// seules les plus précises comptent (quartier > pays > tous les pays) — une
// règle « International » ne s'applique donc plus à une livraison locale.
// Sans règle applicable : réglages « Ma boutique → Livraison » (frais fixes,
// gratuité dès un minimum). Utilisé par /api/livraison/calculer (affichage
// checkout) et par les routes de création de commande (calcul serveur
// autoritaire — jamais confiance en un montant envoyé par le client).
export async function calculerOptionsLivraison(params: {
  tenantId: string;
  pays?: string | null; // code ISO2 du client
  zone?: string | null; // quartier/ville choisi au checkout
  poids?: number;
  montantCommande?: number;
}): Promise<OptionLivraison[]> {
  const { tenantId, poids = 0, montantCommande = 0 } = params;
  const pays = params.pays?.toUpperCase() ?? "";
  const zone = params.zone?.trim().toLowerCase() ?? "";

  const regles = await prisma.reglePort.findMany({
    where: { tenantId, actif: true },
    orderBy: { frais: "asc" },
  });

  const precision = (r: (typeof regles)[number]) => {
    if (r.pays.length && !r.pays.includes(pays)) return -1;
    if (r.zone.trim()) return r.zone.trim().toLowerCase() === zone ? 2 : -1;
    return r.pays.length ? 1 : 0;
  };
  const candidates = regles.filter((r) =>
    precision(r) >= 0 &&
    poids >= r.poidsMin && (r.poidsMax === null || poids <= r.poidsMax) &&
    (r.montantMin === null || montantCommande >= r.montantMin) &&
    (r.montantMax === null || montantCommande <= r.montantMax));
  const meilleure = Math.max(-1, ...candidates.map(precision));

  const options: OptionLivraison[] = candidates.filter((r) => precision(r) === meilleure).map((r) => {
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
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { parametresLivraison: true } });
    const pl = (tenant?.parametresLivraison ?? {}) as { gratuite?: boolean; frais?: number; minimum?: number };
    const offerte = !!pl.gratuite || (!!pl.minimum && montantCommande >= pl.minimum);
    const frais = offerte ? 0 : Number(pl.frais) || 0;
    options.push({
      id: "default",
      nom: "Livraison standard",
      transporteur: null,
      modeLivraison: "livreur_local",
      delai: "7-14 jours",
      frais,
      gratuit: frais === 0,
    });
  }

  return options;
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
