// Permissions d'équipe sur l'API — appliquées une seule fois, dans proxy.ts,
// au lieu de route par route (seules 13 routes sur ~150 les vérifiaient : un
// caissier pouvait par exemple vider le portefeuille de la boutique).
// Un membre d'équipe n'atteint une route que si sa grille donne au module la
// lecture (GET) ou l'écriture (le reste). Propriétaires : accès complet.
// Les routes IA (AXIA, agents) appliquent leurs propres droits ; les routes
// publiques (vitrine, webhooks, tâches planifiées) ne sont pas concernées.
import type { ModuleKey } from "./permissions";

// Préfixe le plus long d'abord. `null` = route publique ou gérée ailleurs.
const MODULES_API: [string, ModuleKey | null][] = [
  // publiques, appelées par la vitrine
  ["/api/commandes/digital-creer", null],
  ["/api/commandes/whatsapp-creer", null],
  ["/api/commandes/whatsapp-redirect", null],
  ["/api/livraison/calculer", null],
  ["/api/formations/progression", null],
  ["/api/codes-promo/verifier", null],
  ["/api/affiliation/generer", null],
  ["/api/licences/activer", null],
  ["/api/livreurs/inscription", null],
  ["/api/equipe/accepter", null],
  ["/api/popups", null],
  // finance
  ["/api/affiliation/paiements", "finance"],
  ["/api/pos/comptabilite", "finance"],
  ["/api/pos/charges", "finance"],
  ["/api/pos/rapprochement", "finance"], // rapprochement des paiements de caisse
  ["/api/wallet", "finance"],
  ["/api/factures", "finance"],
  ["/api/tva", "finance"],
  ["/api/abonnement", "finance"],
  // Caisse 2.0 — routes ouvertes à plusieurs métiers, contrôlées par les DROITS FINS seuls
  // (accesPos + exigerDroit dans chaque route, lib/pos/droits.ts), pas par un module :
  // - import, export, journal d'audit : droits « import_export » / « voir_audit », accordés au
  //   comptable (module finance) comme au gérant (module pos) — un seul module refuserait l'un des deux ;
  // - scanner : le téléphone appairé est reconnu par son jeton d'appareil, même si le navigateur
  //   porte aussi la session d'un compte sans accès à la caisse.
  // Chacune de ces routes DOIT passer par routePos / routeScanner et exiger son droit.
  ["/api/pos/import", null],
  ["/api/pos/export", null],
  ["/api/pos/audit", null],
  ["/api/pos/scanner", null],
  // caisse
  ["/api/commandes/pos-creer", "pos"],
  // Caisse 2.0 (ventes, articles, sessions, magasins, scanner, flux, stock,
  // achats, clients…) : module « pos », puis droits fins par action dans chaque
  // route (lib/pos/acces.ts → accesPos + exigerDroit). Une requête SANS session
  // marchande — le téléphone appairé, reconnu par son jeton — n'est pas
  // contrôlée ici : c'est accesPos() qui l'authentifie.
  ["/api/pos", "pos"],
  // commandes et livraison
  ["/api/commandes", "commandes"],
  ["/api/retours", "commandes"],
  ["/api/livraison-digitale", "commandes"],
  ["/api/livraison", "commandes"],
  ["/api/livreurs", "commandes"],
  ["/api/transporteurs", "commandes"],
  ["/api/dropshipping", "commandes"],
  // catalogue
  ["/api/produits-digitaux", "produits"],
  ["/api/produits", "produits"],
  ["/api/variantesPrix", "produits"],
  ["/api/categories", "produits"],
  ["/api/stock", "produits"],
  ["/api/entrepots", "produits"],
  ["/api/fournisseurs", "produits"],
  ["/api/formations", "produits"],
  ["/api/licences", "produits"],
  ["/api/magic-import", "produits"],
  ["/api/sourcing/commandes", "commandes"],
  ["/api/sourcing/expeditions", "commandes"],
  ["/api/sourcing/routage", "commandes"],
  ["/api/sourcing/tableau-de-bord", "commandes"],
  ["/api/sourcing", "produits"], // AXSO Sourcing (dropshipping engine + fournisseurs)
  // clients
  ["/api/messages", "clients"],
  // marketing
  ["/api/affiliation", "marketing"],
  ["/api/campagnes", "marketing"],
  ["/api/codes-promo", "marketing"],
  ["/api/sms", "marketing"],
  ["/api/email", "marketing"],
  ["/api/posts", "marketing"],
  ["/api/automation", "marketing"],
  ["/api/veille", "marketing"],
  // équipe, paramètres, boutique
  ["/api/equipe", "equipe"],
  ["/api/tenant", "parametres"],
  ["/api/tenants", "parametres"],
  ["/api/domaine", "parametres"],
  ["/api/connecteurs", "parametres"],
  ["/api/themes", "boutique"],
  ["/api/preview-theme", "boutique"],
];

export function moduleApi(pathname: string): ModuleKey | null {
  for (const [prefixe, module] of MODULES_API) {
    if (pathname === prefixe || pathname.startsWith(prefixe + "/")) return module;
  }
  return null;
}
