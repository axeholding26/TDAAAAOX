// Moteur CRO (pur) : ce qui fait acheter ou partir — hero et appel à l'action, preuve
// sociale, produits mis en avant, signaux de confiance, prix, friction (WhatsApp, livraison),
// navigation, longueur de page — croisé avec les vrais chiffres quand on les a.
import type { ThemeConfig } from "@/lib/theme-config";
import { pagesDe, pb, tronquer, type Boutique, type Probleme } from "./commun";

/** Chiffres réels des 30 derniers jours (chiffre d'affaires seulement si le droit finance le permet). */
export interface Stats { visites: number; commandes: number; ajoutsPanier?: number; chiffreAffaires?: number | null }

const CONFIANCE = /livraison|paiement|s[ée]curis|retour|rembours|garanti|whatsapp|mobile money|orange money|mtn|wave|à la livraison/i;
const CTA_FAIBLE = /^(cliquez ici|ici|en savoir plus|voir|lire la suite|ok|bouton)$/i;

export function analyserConversion(cfg: ThemeConfig, b: Boutique, stats?: Stats | null): Probleme[] {
  const out: Probleme[] = [];
  const accueil = pagesDe(cfg, b)[0];
  const els = accueil.elements;
  const contenu = els.filter((e) => e.zone === "template");
  const premiere = contenu[0]?.section;
  const hero = contenu.filter((e) => e.section === premiere);

  // Hero : promesse claire (h1) et une action.
  if (!hero.some((e) => e.sorte === "titre" && e.niveau === 1)) out.push(pb("attention", "conversion", premiere ?? "page:accueil", "Le premier écran n'a pas de titre principal qui dit ce que vend la boutique."));
  const ctas = contenu.filter((e) => e.sorte === "bouton" || (e.sorte === "lien" && /produit|boutique|collection|acheter|commander|d[ée]couvr/i.test(`${e.texte} ${e.lien}`)));
  if (!ctas.length) out.push(pb("critique", "conversion", "page:accueil", "Aucun bouton d'action sur l'accueil : le visiteur ne sait pas où cliquer pour acheter."));
  else if (!hero.some((e) => ctas.includes(e))) out.push(pb("attention", "conversion", premiere ?? "page:accueil", "Pas de bouton d'action dans le premier écran (hero)."));
  for (const e of ctas) if (e.texte && CTA_FAIBLE.test(e.texte.trim())) out.push(pb("info", "conversion", e.bloc, `Bouton « ${e.texte} » vague : dis ce qu'on obtient (« Voir la collection », « Commander »).`));

  // Produits mis en avant.
  const actifs = b.produits.filter((p) => p.actif !== false);
  const montreProduits = contenu.some((e) => e.sorte === "produits");
  if (!montreProduits) out.push(pb("attention", "conversion", "page:accueil", "L'accueil ne montre aucun produit : ajoute un bloc Produits (meilleures ventes) haut dans la page."));
  if (!actifs.length) out.push(pb("critique", "conversion", "produits", `Aucun produit actif : rien à acheter${contenu.some((e) => e.sorte === "produits" && e.source === "design") ? " — et la grille du design affiche ses produits de démonstration" : ""}.`));
  const sansImage = actifs.filter((p) => !p.images?.length);
  if (sansImage.length) out.push(pb("attention", "conversion", "produits", `${sansImage.length} produit(s) sans photo : ${sansImage.slice(0, 4).map((p) => tronquer(p.nom, 25)).join(", ")}${sansImage.length > 4 ? "…" : ""}.`));
  const fauxPrixBarre = actifs.filter((p) => p.prixCompare != null && p.prixCompare > 0 && p.prixCompare <= p.prix);
  if (fauxPrixBarre.length) out.push(pb("attention", "conversion", "produits", `${fauxPrixBarre.length} produit(s) avec un prix barré inférieur ou égal au prix : la « promo » inquiète au lieu de rassurer (${fauxPrixBarre.slice(0, 3).map((p) => tronquer(p.nom, 20)).join(", ")}).`));

  // Preuve sociale et confiance.
  const preuve = contenu.some((e) => e.sorte === "preuve") || /avis|t[ée]moign|review|clients satisfaits|★/i.test(contenu.map((e) => e.texte).join(" "));
  if (!preuve) out.push(pb((b.avisApprouves ?? 0) > 0 ? "attention" : "info", "conversion", "page:accueil",
    (b.avisApprouves ?? 0) > 0 ? `${b.avisApprouves} avis clients approuvés, mais l'accueil n'en montre aucun : ajoute une section d'avis ou de preuve sociale.` : "Aucune preuve sociale (avis, nombre de clients) : collecte des avis puis affiche-les."));
  const texte = els.map((e) => e.texte ?? "").join(" ");
  if (!contenu.some((e) => e.sorte === "confiance") && !CONFIANCE.test(texte)) out.push(pb("attention", "conversion", "page:accueil", "Aucun signal de confiance visible (livraison, paiement sécurisé ou à la livraison, retours) : c'est la première objection d'un acheteur en ligne."));

  // Friction.
  if (!b.whatsapp) out.push(pb("attention", "conversion", "boutique", "Pas de numéro WhatsApp : les commandes en paiement à la livraison et les questions n'ont pas de canal."));
  const l = b.livraison ?? {};
  if (!Object.keys(l).length) out.push(pb("attention", "conversion", "boutique", "Livraison non configurée : le client ne voit ni délais ni frais avant de commander."));

  // Navigation et longueur.
  const nav = els.filter((e) => e.zone === "header" && (e.sorte === "lien" || e.sorte === "bouton"));
  if (accueil.sections.length && !nav.some((e) => /produit|boutique|collection|shop/i.test(`${e.texte} ${e.lien}`))) out.push(pb("attention", "conversion", "page:accueil", "L'en-tête n'a pas de lien vers le catalogue."));
  const nbSections = accueil.sections.filter((s) => (s.config?.zone ?? "template") === "template" && s.actif !== false).length;
  if (nbSections > 12) out.push(pb("info", "conversion", "page:accueil", `${nbSections} sections sur l'accueil : au-delà de 8 à 10, la plupart des visiteurs ne vont pas au bout.`));
  const titres = contenu.filter((e) => e.sorte === "titre");
  if (titres.length > 2 && new Set(titres.map((e) => e.niveau)).size === 1 && titres[0].niveau !== 1) out.push(pb("info", "conversion", "page:accueil", "Tous les titres ont le même niveau : la page n'a pas de hiérarchie visuelle claire."));

  // Chiffres réels.
  if (stats && stats.visites >= 100) {
    const taux = stats.commandes / stats.visites;
    if (taux < 0.005) out.push(pb("attention", "conversion", "boutique:stats", `${stats.visites} visites et ${stats.commandes} commande(s) en 30 jours (${(taux * 100).toFixed(2)} %) : sous 0,5 %, le problème est sur la boutique plus que sur le trafic.`));
    if (stats.ajoutsPanier != null && stats.ajoutsPanier > 10 && stats.commandes / stats.ajoutsPanier < 0.2) out.push(pb("attention", "conversion", "boutique:stats", `${stats.ajoutsPanier} ajouts au panier pour ${stats.commandes} commande(s) : la friction est dans la commande (livraison, paiement, formulaire).`));
  }
  return out;
}
