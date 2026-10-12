// IA d'AXSO Sourcing : copilote produit, kit de test (page + angles marketing)
// et centre publicitaire. SERVEUR uniquement — passe par le client LLM du dépôt.
//
// Garde-fous, répétés dans chaque consigne ET appliqués à l'affichage :
// - l'IA n'a accès à AUCUNE donnée de marché : tout ce qu'elle dit du marché,
//   de la demande ou de la concurrence est une HYPOTHÈSE, jamais un fait ;
// - les chiffres (coût, prix, marge) viennent du calculateur d'Axso et lui sont
//   fournis : elle ne les recalcule pas et n'en invente pas d'autres ;
// - jamais de faux avis, de faux témoignages ni de chiffres de vente inventés.
import { completionAuto } from "../llm-client";
import { configPays } from "./pays";
import type { ContexteCalcul, Evaluation } from "./produit-source";

export const AVERTISSEMENT_IA = "Analyse générée par IA à partir de la fiche du produit et de vos chiffres. Aucune donnée de marché n'est branchée : ce sont des hypothèses à vérifier par un test, pas des certitudes.";

/** Les six angles marketing du centre de test. */
export const ANGLES = [
  { cle: "probleme", libelle: "Problème" },
  { cle: "transformation", libelle: "Transformation" },
  { cle: "demonstration", libelle: "Démonstration" },
  { cle: "gain_temps", libelle: "Gain de temps" },
  { cle: "economie", libelle: "Économie" },
  { cle: "preuve_sociale", libelle: "Preuve sociale" },
] as const;

export interface AnalyseCopilote {
  verdict: "tester" | "tester_avec_prudence" | "eviter";
  resume: string;
  analyseMarche: string;
  profilClient: string;
  objections: string[];
  propositionValeur: string;
  risques: string[];
  strategiePublicitaire: string;
  strategieLancement: string[];
  recommandationsLogistiques: string[];
  /** Estimations de 1 à 5 proposées pour les critères du score que rien ne mesure. */
  estimations: Record<string, number>;
}

export interface KitTest {
  titre: string;
  description: string;
  avantages: string[];
  faq: { question: string; reponse: string }[];
  argumentsVente: string[];
  offrePromotionnelle: string;
  angles: { cle: string; accroche: string; texte: string }[];
}

export interface VariantePub {
  angle: string;
  hook: string;
  scriptVideo: string;
  texteFacebook: string;
  texteTiktok: string;
  headline: string;
  cta: string;
  audience: string;
}

interface FicheIA { nom: string; description?: string | null; poidsKg?: number | null; fournisseurNom?: string | null; modeAppro?: string }

const REGLES = `RÈGLES ABSOLUES :
- Tu n'as accès à aucune donnée de marché, de recherche ou de vente. Tout ce que tu dis de la demande, de la concurrence ou du client est une hypothèse : formule-le comme tel (« probablement », « à vérifier par un test »), jamais comme un fait.
- N'invente aucun chiffre : ni statistique, ni volume de ventes, ni part de marché, ni pourcentage. Les seuls chiffres autorisés sont ceux fournis ci-dessous.
- N'invente jamais d'avis client, de témoignage, de note, ni de nombre de clients satisfaits.
- Aucune promesse médicale, aucun résultat garanti.
- Français simple, pour un commerçant qui débute. Réponds UNIQUEMENT avec l'objet JSON demandé.`;

function contexte(f: FicheIA, ev: Evaluation, ctx: ContexteCalcul): string {
  const c = ev.cout;
  return `PRODUIT : ${f.nom}
Description fournisseur : ${(f.description ?? "non fournie").slice(0, 1500)}
Poids : ${f.poidsKg ? `${f.poidsKg} kg` : "inconnu"} · Fournisseur : ${f.fournisseurNom ?? "inconnu"} · Mode : ${f.modeAppro ?? "dropshipping"}
PAYS DE VENTE : ${configPays(ctx.pays).nom} (devise ${ctx.devise})
CHIFFRES CALCULÉS PAR AXSO (à reprendre tels quels) :
- Coût réel par commande livrée : ${c.coutTotal} ${ctx.devise}
- Prix de vente retenu : ${c.prixVente} ${ctx.devise} (prix conseillé : ${ev.conseil.prix})
- Bénéfice estimé par commande : ${c.margeNette} ${ctx.devise}
- ROAS minimum pour ne pas perdre d'argent : ${c.roasMinimum ?? "non calculable"}
- Taux de refus à la livraison retenu : ${Math.round(ev.hypotheses.tauxRefus * 100)} % (${ev.hypotheses.refusMesure ? "mesuré sur les commandes de la boutique" : "estimation"})`;
}

async function demander<T>(systeme: string, demande: string, maxTokens: number): Promise<T> {
  const { text } = await completionAuto([{ role: "system", content: `${systeme}\n\n${REGLES}` }, { role: "user", content: demande }], maxTokens, true);
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw Object.assign(new Error("L'IA n'a pas renvoyé de réponse exploitable. Réessayez."), { status: 502 });
  try {
    return JSON.parse(json) as T;
  } catch {
    throw Object.assign(new Error("L'IA n'a pas renvoyé de réponse exploitable. Réessayez."), { status: 502 });
  }
}

/** « Est-ce que ce produit vaut la peine d'être testé en Afrique ? » */
export function analyserProduit(f: FicheIA, ev: Evaluation, ctx: ContexteCalcul): Promise<AnalyseCopilote> {
  return demander<AnalyseCopilote>(
    "Tu es le copilote produit d'AXSO, plateforme e-commerce pour commerçants africains. Tu aides un commerçant à décider s'il doit tester un produit importé.",
    `${contexte(f, ev, ctx)}

Question du commerçant : « Est-ce que ce produit vaut la peine d'être testé ? »

Réponds avec cet objet JSON :
{
  "verdict": "tester" | "tester_avec_prudence" | "eviter",
  "resume": "2 phrases : ta recommandation et sa raison principale, en t'appuyant sur les chiffres fournis",
  "analyseMarche": "hypothèses sur le marché local, formulées comme des hypothèses",
  "profilClient": "qui achèterait probablement ce produit et pourquoi",
  "objections": ["3 à 5 objections probables du client"],
  "propositionValeur": "la promesse à mettre en avant, en une phrase",
  "risques": ["3 à 5 risques : logistique, retours, réglementation, qualité"],
  "strategiePublicitaire": "canaux, type de vidéo et budget de test raisonné à partir du ROAS minimum fourni",
  "strategieLancement": ["4 à 6 étapes concrètes pour les 14 premiers jours"],
  "recommandationsLogistiques": ["2 à 4 conseils : mode d'expédition, emballage, stock local ou non"],
  "estimations": { "demande": 1-5, "concurrence": 1-5, "livraison": 1-5, "potentielPub": 1-5, "risqueRetour": 1-5, "risqueReglementaire": 1-5, "branding": 1-5, "reachat": 1-5 }
}
Pour "estimations" : 5 est toujours favorable au commerçant (forte demande, PEU de concurrence, livraison facile, FAIBLE risque de retour, FAIBLE risque réglementaire). Ce sont tes hypothèses, le commerçant les corrigera.`,
    1800,
  );
}

/** Centre de test : page produit prête à publier et un message par angle marketing. */
export function genererKitTest(f: FicheIA, ev: Evaluation, ctx: ContexteCalcul): Promise<KitTest> {
  return demander<KitTest>(
    "Tu es rédacteur e-commerce pour AXSO. Tu écris la page de vente d'un produit pour une boutique en ligne africaine (commande sur le site ou par WhatsApp, souvent paiement à la livraison).",
    `${contexte(f, ev, ctx)}

Réponds avec cet objet JSON :
{
  "titre": "titre de page produit clair et vendeur, 70 caractères maximum",
  "description": "description de 80 à 130 mots, bénéfices concrets, sans exagération",
  "avantages": ["4 à 6 avantages courts"],
  "faq": [{ "question": "...", "reponse": "..." }] (4 questions : usage, livraison, paiement, retour — sans promettre de délai ni de garantie que tu ne connais pas),
  "argumentsVente": ["3 à 5 arguments pour répondre à un client sur WhatsApp"],
  "offrePromotionnelle": "une idée d'offre de lancement qui respecte le bénéfice par commande fourni (ne propose pas une remise supérieure à ce bénéfice)",
  "angles": [${ANGLES.map((a) => `{ "cle": "${a.cle}", "accroche": "...", "texte": "2 à 3 phrases" }`).join(", ")}]
}
Angle "preuve_sociale" : n'écris AUCUN avis ni témoignage. Explique seulement comment le commerçant mettra en avant de VRAIS retours une fois les premières ventes faites (photo client avec accord, avis vérifiés de la boutique).`,
    2200,
  );
}

/** Centre publicitaire : plusieurs variantes de publicité pour un produit. */
export async function genererPublicites(f: FicheIA, ev: Evaluation, ctx: ContexteCalcul, nombre = 3): Promise<VariantePub[]> {
  const r = await demander<{ variantes: VariantePub[] }>(
    "Tu es média buyer pour AXSO. Tu prépares des publicités Facebook et TikTok pour un commerçant africain.",
    `${contexte(f, ev, ctx)}

Écris ${nombre} variantes de publicité, chacune sur un angle différent parmi : ${ANGLES.map((a) => a.libelle).join(", ")}.
Réponds avec cet objet JSON :
{ "variantes": [{
  "angle": "nom de l'angle",
  "hook": "première phrase qui arrête le défilement, 12 mots maximum",
  "scriptVideo": "script d'une vidéo de 20 à 30 secondes, plan par plan, filmable au téléphone",
  "texteFacebook": "texte de publicité Facebook, 3 à 5 lignes",
  "texteTiktok": "légende TikTok courte avec 3 hashtags",
  "headline": "titre de 40 caractères maximum",
  "cta": "appel à l'action",
  "audience": "audience suggérée : âge, centres d'intérêt, villes — présentée comme une hypothèse de départ"
}] }
Pas de faux témoignage, pas de « déjà X clients », pas de compte à rebours mensonger.`,
    2600,
  );
  return Array.isArray(r.variantes) ? r.variantes : [];
}

/**
 * Budget de test publicitaire, CALCULÉ (pas généré) : de quoi payer une
 * dizaine de commandes au coût publicitaire maximal supportable.
 */
export function budgetTest(ev: Evaluation): { total: number; parJour: number; explication: string } | null {
  const max = ev.cout.budgetPubMax;
  if (!max || max <= 0) return null;
  const total = Math.round(max * 10);
  return { total, parJour: Math.round(total / 5), explication: `10 commandes × ${Math.round(max)} ${ev.cout.devise} (publicité maximale par commande avant de vendre à perte), réparti sur 5 jours. Si le budget est dépensé sans approcher 10 commandes, arrêtez le test.` };
}
