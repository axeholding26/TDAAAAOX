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
  ["/api/wallet", "finance"],
  ["/api/factures", "finance"],
  ["/api/tva", "finance"],
  ["/api/abonnement", "finance"],
  // caisse
  ["/api/commandes/pos-creer", "pos"],
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
