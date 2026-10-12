// Supplier Intelligence — ce que fait l'IA, et seulement cela (SERVEUR) :
// - LIRE un texte fourni par le marchand (fiche fournisseur copiée, réponse à
//   un devis) pour en extraire les champs — toujours « déclaré par le fournisseur » ;
// - RÉDIGER (message de négociation) à partir de chiffres calculés par le code ;
// - COMPRENDRE un besoin écrit en langage courant (agent de sourcing).
// L'IA ne cherche, ne note et ne classe aucun fournisseur : la recherche et le
// classement sont faits par le moteur sur la base de la boutique. Elle ne peut
// donc pas inventer un fournisseur, une certification ni un « Top 5 ».
import { z } from "zod";
import { completionAuto } from "@/lib/llm-client";
import type { Candidat } from "./classement";
import { recommander } from "./classement";
import { normaliserDevise, tauxEntre } from "../cout-rendu";
import { rechercher } from "./service";

export class IaIndisponible extends Error {
  status = 503;
  constructor() { super("L'assistant IA est indisponible pour le moment. Vous pouvez saisir les informations à la main."); }
}

async function lireJson(consigne: string, texte: string, maxTokens = 1200): Promise<Record<string, unknown>> {
  try {
    const { text } = await completionAuto([
      { role: "system", content: `${consigne}\nRéponds uniquement par un objet JSON. N'invente rien : une information absente du texte vaut null.` },
      { role: "user", content: texte.slice(0, 12000) },
    ], maxTokens, true);
    const objet = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "");
    if (!objet || typeof objet !== "object") throw new Error("réponse vide");
    return objet;
  } catch (e) {
    console.warn("[sourcing/fournisseurs/ia]", e instanceof Error ? e.message.slice(0, 150) : e);
    throw new IaIndisponible();
  }
}

// Champs tolérants : l'IA renvoie parfois "12" pour 12, "" pour null.
const texte = z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 500) : undefined), z.string().optional());
const nombre = z.preprocess((v) => (v === null || v === "" || !Number.isFinite(Number(v)) ? undefined : Number(v)), z.number().positive().optional());
const entier = z.preprocess((v) => (v === null || v === "" || !Number.isFinite(Number(v)) ? undefined : Math.round(Number(v))), z.number().int().positive().optional());
// Devise lue par l'IA : ramenée à un code connu (« RMB » → CNY), sinon écartée plutôt que convertie à 1 pour 1.
const devise = z.preprocess((v) => normaliserDevise(v) ?? undefined, z.string().optional());
const booleen = z.preprocess((v) => (typeof v === "boolean" ? v : undefined), z.boolean().optional());
const liste = z.preprocess((v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, 20) : []), z.array(z.string()));

const schemaFiche = z.object({
  nom: texte, pays: texte, url: texte, email: texte, telephone: texte,
  typeEntreprise: z.preprocess((v) => (["fabricant", "fabricant_trading", "trading", "grossiste", "distributeur"].includes(v as string) ? v : undefined), z.string().optional()),
  anneeCreation: entier, nbEmployes: entier, capaciteProduction: texte, adresseUsine: texte, equipements: texte, protectionPaiement: texte,
  categoriesProduites: liste, marchesExport: liste, certificationsDeclarees: liste,
  personnalisation: booleen, privateLabel: booleen, packagingPerso: booleen, echantillonPossible: booleen,
  offre: z.object({
    nomProduit: texte, categorie: texte, prixUnitaire: nombre, devise, moq: entier, delaiProduction: entier, poidsKg: nombre,
    paliers: z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(z.object({ quantiteMin: entier, prix: nombre }))),
  }).partial().optional().catch(undefined),
});
export type FicheExtraite = z.infer<typeof schemaFiche>;

/** Extrait une fiche fournisseur d'un texte collé par le marchand. Tout ce qui en sort est « déclaré ». */
export async function extraireFiche(source: string): Promise<FicheExtraite> {
  return schemaFiche.parse(await lireJson(
    `Tu extrais les informations d'un fournisseur à partir d'un texte copié par un commerçant (page fournisseur, message, catalogue).
Clés attendues : nom, pays, url, email, telephone, typeEntreprise (fabricant | fabricant_trading | trading | grossiste | distributeur), anneeCreation, nbEmployes, capaciteProduction, adresseUsine, equipements, protectionPaiement, categoriesProduites (liste), marchesExport (liste), certificationsDeclarees (liste de sigles : CE, RoHS…), personnalisation, privateLabel, packagingPerso, echantillonPossible (booléens), offre { nomProduit, categorie, prixUnitaire, devise (code ISO), moq, delaiProduction (jours), poidsKg, paliers [{ quantiteMin, prix }] }.`,
    source));
}

const schemaReponse = z.object({
  prixUnitaire: nombre, devise, moq: entier, delaiJours: entier,
  packaging: texte, personnalisation: texte, expedition: texte, conditionsPaiement: texte,
});
export type ReponseExtraite = z.infer<typeof schemaReponse>;

/** Extrait les termes d'une réponse de fournisseur à un devis. */
export async function extraireReponseDevis(source: string): Promise<ReponseExtraite> {
  return schemaReponse.parse(await lireJson(
    `Tu extrais les conditions proposées par un fournisseur dans sa réponse à une demande de devis.
Clés attendues : prixUnitaire (nombre), devise (code ISO), moq, delaiJours (délai de production en jours), packaging, personnalisation, expedition (mode, incoterm, coût annoncé), conditionsPaiement.`,
    source, 600));
}

// ─── Demande de devis (RFQ) : texte standardisé, sans IA ─────────────────────

export interface ChampsDevis {
  reference: string; nomProduit: string; description?: string | null; quantite: number;
  prixCible?: number | null; devise: string; paysNom: string; villeDestination?: string | null;
  incoterm?: string | null; couleur?: string | null; packaging?: string | null; personnalisation?: string | null;
  boutique: string;
}

/** Texte du RFQ, en anglais (langue de travail des fournisseurs internationaux) ou en français. */
export function redigerDevis(d: ChampsDevis, langue: "en" | "fr" = "en"): string {
  const en = langue === "en";
  const ligne = (libelle: [string, string], valeur?: string | number | null) => (valeur ? `- ${en ? libelle[0] : libelle[1]}: ${valeur}` : null);
  return [
    en ? `REQUEST FOR QUOTATION — ${d.reference}` : `DEMANDE DE DEVIS — ${d.reference}`,
    "",
    en ? `Hello, we are ${d.boutique}, an online retailer. Please quote the following:` : `Bonjour, nous sommes ${d.boutique}, boutique en ligne. Merci de nous adresser votre offre pour :`,
    ligne(["Product", "Produit"], d.nomProduit),
    ligne(["Details", "Détails"], d.description),
    ligne(["Quantity", "Quantité"], `${d.quantite} ${en ? "units" : "unités"}`),
    ligne(["Color", "Couleur"], d.couleur),
    ligne(["Packaging", "Packaging"], d.packaging),
    ligne(["Customization / logo", "Personnalisation / logo"], d.personnalisation),
    ligne(["Target price", "Prix cible"], d.prixCible ? `${d.prixCible} ${d.devise} / ${en ? "unit" : "unité"}` : null),
    ligne(["Destination", "Destination"], [d.villeDestination, d.paysNom].filter(Boolean).join(", ")),
    ligne(["Incoterm", "Incoterm"], d.incoterm || (en ? "to be defined with the logistics solution — please quote EXW and FOB" : "à déterminer selon la solution logistique — merci de coter EXW et FOB")),
    "",
    en ? "Please include in your reply:" : "Merci d'indiquer dans votre réponse :",
    ...(en
      ? ["1. Unit price for this quantity and your price tiers", "2. MOQ", "3. Production lead time", "4. Packaging and customization options and costs", "5. Shipping options to the destination", "6. Payment terms", "7. Sample availability and cost", "8. Certificates available for this product (with certificate numbers and issuing bodies)", "9. Whether you accept a third-party pre-shipment inspection"]
      : ["1. Le prix unitaire pour cette quantité et vos paliers de prix", "2. Le MOQ", "3. Le délai de production", "4. Les options et coûts de packaging et de personnalisation", "5. Les options d'expédition vers la destination", "6. Les conditions de paiement", "7. La disponibilité et le coût d'un échantillon", "8. Les certificats disponibles pour ce produit (numéros et organismes émetteurs)", "9. Si vous acceptez une inspection avant expédition par un tiers"]),
    "",
    en ? "Thank you." : "Merci.",
  ].filter((l) => l !== null).join("\n");
}

// ─── Copilote de négociation ─────────────────────────────────────────────────

export interface Objectifs {
  quantite: number; prixActuel: number; prixCible: number; devise: string; moqCible?: number | null;
  conditionsPaiement: string; packaging?: string; personnalisation?: string; delaiJours?: number | null; inspection: string;
  /** Arguments chiffrés tirés de l'offre et des offres comparables. */
  arguments: string[];
}

/** Objectifs de départ, calculés sur l'offre (paliers) et les offres comparables — le marchand les ajuste. */
export function objectifsNegociation(c: Candidat, quantite: number, comparables: Candidat[] = []): Objectifs | null {
  if (!c.offre || !c.cout) return null;
  const prixActuel = c.cout.prix;
  const args: string[] = [];
  // Viser le prix du palier supérieur ; à défaut, 10 % de remise comme base de discussion.
  const palierSuperieur = c.offre.grille.find((g) => g.quantite > quantite && g.prix < prixActuel);
  let prixCible = palierSuperieur ? palierSuperieur.prix : Math.round(prixActuel * 0.9 * 100) / 100;
  if (palierSuperieur) args.push(`Votre palier à ${palierSuperieur.quantite} unités est à ${palierSuperieur.prix} ${c.offre.devise}.`);
  const concurrent = comparables.filter((x) => x.ref !== c.ref && x.offre && x.cout && x.offre.devise === c.offre!.devise && x.cout.prix < prixActuel).sort((a, b) => a.cout!.prix - b.cout!.prix)[0];
  if (concurrent) {
    args.push(`Une offre comparable est à ${concurrent.cout!.prix} ${c.offre.devise} pour la même quantité.`);
    prixCible = Math.min(prixCible, Math.round(((prixActuel + concurrent.cout!.prix) / 2) * 100) / 100);
  }
  return {
    quantite, prixActuel, prixCible, devise: c.offre.devise,
    moqCible: c.offre.moq != null && c.offre.moq > quantite ? quantite : null,
    conditionsPaiement: "30 % à la commande, 70 % après inspection avant expédition",
    packaging: c.fournisseur.packagingPerso === false ? undefined : "Packaging personnalisé",
    personnalisation: c.fournisseur.personnalisation === false ? undefined : "Logo sur le produit",
    delaiJours: c.offre.delaiProduction,
    inspection: "Inspection avant expédition par un tiers",
    arguments: args,
  };
}

/** Message de repli quand l'IA ne répond pas : les mêmes demandes, rédigées simplement. */
function messageSimple(o: Objectifs, fournisseur: string, produit: string): string {
  return [
    `Hello ${fournisseur},`,
    "",
    `I would like to order ${o.quantite} units of ${produit}. Your current price is ${o.prixActuel} ${o.devise}; I would like to reach ${o.prixCible} ${o.devise} per unit.`,
    o.moqCible ? `Could you accept an order of ${o.moqCible} units as a first test order?` : null,
    [o.packaging, o.personnalisation].filter(Boolean).length ? `I also need: ${[o.packaging, o.personnalisation].filter(Boolean).join(", ")}.` : null,
    o.delaiJours ? `Requested production lead time: ${o.delaiJours} days.` : null,
    `Payment terms: ${o.conditionsPaiement}.`,
    `Quality: ${o.inspection}.`,
    "",
    "Looking forward to your best offer.",
  ].filter((l) => l !== null).join("\n");
}

/** Rédige le message au fournisseur à partir des objectifs validés par le marchand. */
export async function redigerNegociation(o: Objectifs, fournisseur: string, produit: string, langue = "anglais"): Promise<{ message: string; redigeParIa: boolean }> {
  try {
    const { text } = await completionAuto([
      { role: "system", content: `Tu rédiges, en ${langue}, le message d'un commerçant africain à son fournisseur pour négocier une commande. Ton professionnel, direct et courtois, 120 mots au plus. Utilise uniquement les chiffres et demandes fournis : n'ajoute aucun chiffre, aucune promesse de volume futur, aucune information sur le commerçant. Réponds par le message seul.` },
      { role: "user", content: JSON.stringify({ fournisseur, produit, ...o }) },
    ], 500);
    if (text.trim().length > 40) return { message: text.trim(), redigeParIa: true };
  } catch (e) {
    console.warn("[sourcing/fournisseurs/ia] négociation", e instanceof Error ? e.message.slice(0, 150) : e);
  }
  return { message: messageSimple(o, fournisseur, produit), redigeParIa: false };
}

// ─── Agent de sourcing ───────────────────────────────────────────────────────

const schemaBesoin = z.object({
  produit: texte,
  termes: liste,
  prixVenteMin: nombre, prixVenteMax: nombre, devisePrix: devise, moqMax: entier, quantite: entier,
  fabricant: booleen, personnalisation: booleen,
});
export type Besoin = z.infer<typeof schemaBesoin>;

/**
 * AXSO Sourcing Agent : comprend le besoin, puis cherche UNIQUEMENT parmi les
 * fournisseurs enregistrés dans la boutique. Renvoie au plus 5 lignes, chacune
 * avec ses écarts au besoin, et dit clairement quand il y en a moins — ou aucune.
 */
export async function agentSourcing(tenantId: string, demande: string) {
  const besoin = schemaBesoin.parse(await lireJson(
    `Tu analyses le besoin d'achat d'un commerçant. Clés attendues : produit (désignation courte), termes (2 à 5 façons courtes de nommer ce produit, en français ET en anglais, 1 à 2 mots chacune, du plus précis au plus général), prixVenteMin, prixVenteMax (prix de revente visés, nombres dans la monnaie du texte), devisePrix (code ISO de cette monnaie ; « FCFA » = XAF), moqMax, quantite (volume d'achat souhaité), fabricant (true s'il exige un fabricant), personnalisation (true s'il veut son logo ou une personnalisation).`,
    demande, 400));
  const quantite = besoin.quantite ?? besoin.moqMax ?? 100;
  const termes = besoin.termes.length ? besoin.termes : besoin.produit ? [besoin.produit] : [];
  if (!termes.length) return { besoin, lignes: [], recommandation: null, contexte: null, message: "Je n'ai pas compris quel produit vous cherchez. Décrivez-le en quelques mots." };

  const r = await rechercher(tenantId, { termes, quantite });
  // Prix de vente ramené dans la devise de la boutique (celle des coûts) ; taux fixes de lib/devise-convert.ts.
  const brut = besoin.prixVenteMin && besoin.prixVenteMax ? (besoin.prixVenteMin + besoin.prixVenteMax) / 2 : besoin.prixVenteMax ?? besoin.prixVenteMin ?? null;
  const prixVente = brut === null ? null : Math.round(brut * tauxEntre(besoin.devisePrix ?? r.contexte.devise, r.contexte.devise) * 100) / 100;

  const lignes = r.candidats.map((c) => {
    const a = c.analyse;
    const ecarts: string[] = [];
    if (besoin.moqMax && !(c.offre?.moq != null && c.offre.moq <= besoin.moqMax)) ecarts.push(c.offre?.moq != null ? `MOQ ${c.offre.moq}, au-dessus des ${besoin.moqMax} demandés` : "MOQ non communiqué");
    if (besoin.fabricant && a.fabricant.statut !== "fabricant" && a.fabricant.statut !== "fabricant_trading") ecarts.push(`Statut fabricant non établi (${a.fabricant.libelle.toLowerCase()})`);
    if (besoin.personnalisation && c.fournisseur.personnalisation !== true && c.fournisseur.privateLabel !== true) ecarts.push(c.fournisseur.personnalisation === false ? "Ne propose pas la personnalisation" : "Personnalisation non confirmée");
    const marge = prixVente && c.cout ? prixVente - c.cout.total : null;
    if (marge !== null && marge <= 0) ecarts.push("Coût réel estimé supérieur à votre prix de vente");
    const conseil = ecarts.length ? `Ne répond pas entièrement au besoin : ${ecarts.join(" ; ")}.`
      : a.risque.niveau === "eleve" ? "Risque élevé : lever les alertes avant toute commande."
      : !a.label.criteres.find((x) => x.cle === "echantillon")?.rempli ? "Répond au besoin sur le papier : commandez un échantillon avant d'acheter en volume."
      : "Répond au besoin, échantillon déjà contrôlé : prêt pour une commande test.";
    return { candidat: c, ecarts, margeUnitaire: marge, tauxMarge: marge !== null && prixVente ? marge / prixVente : null, conseil };
  }).sort((x, y) => x.ecarts.length - y.ecarts.length || y.candidat.analyse.score - x.candidat.analyse.score).slice(0, 5);

  const conformes = lignes.filter((l) => !l.ecarts.length);
  const message = !lignes.length
    ? (r.totalFournisseurs
      ? `Aucun des ${r.totalFournisseurs} fournisseur(s) de votre base ne propose « ${besoin.produit ?? termes[0]} ». AXSO ne présente que des fournisseurs réellement enregistrés : ajoutez ceux que vous avez repérés, ou envoyez une demande de devis.`
      : "Votre base ne contient encore aucun fournisseur. AXSO n'en invente pas : ajoutez ceux que vous avez repérés pour qu'ils soient vérifiés, notés et comparés.")
    : `${lignes.length} fournisseur(s) de votre base correspond(ent)${lignes.length < 5 ? " — pas assez pour un Top 5" : ""}, dont ${conformes.length} sans écart avec votre besoin.`;

  const recommandation = recommander((conformes.length ? conformes : lignes).map((l) => l.candidat), quantite);
  // Un seul fournisseur sans écart parmi plusieurs trouvés : il n'est pas « le seul disponible », il est le seul à répondre au besoin.
  if (recommandation && conformes.length === 1 && lignes.length > 1) {
    recommandation.explication = recommandation.explication.replace("est le seul fournisseur disponible pour cette recherche : aucune comparaison possible.", `est le seul des ${lignes.length} fournisseurs trouvés à répondre à votre besoin sans écart.`);
  }
  return { besoin, prixVente, lignes, recommandation, contexte: r.contexte, message };
}
