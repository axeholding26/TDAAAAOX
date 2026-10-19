// Pages qu'AXIA peut ouvrir (outil ouvrir_page) : liste fermée des routes réelles
// du dashboard. Sans import serveur : lu aussi par les fenêtres AXIA côté client.

export const PAGES_DASHBOARD: Record<string, [chemin: string, nom: string]> = {
  accueil: ["/dashboard", "Accueil (AXIA)"],
  tableau_de_bord: ["/dashboard/accueil", "Tableau de bord"],
  produits: ["/dashboard/produits", "Produits"],
  nouveau_produit: ["/dashboard/produits/nouveau", "Nouveau produit"],
  categories: ["/dashboard/produits/categories", "Catégories"],
  produits_digitaux: ["/dashboard/produits/digital", "Produits digitaux"],
  import_produits: ["/dashboard/magic-import", "Import de produits"],
  commandes: ["/dashboard/commandes", "Commandes"],
  clients: ["/dashboard/clients", "Clients"],
  livraison: ["/dashboard/livraison", "Livraison"],
  livreurs: ["/dashboard/livreurs", "Livreurs"],
  logistique: ["/dashboard/logistique", "Logistique"],
  transporteurs: ["/dashboard/transporteurs", "Transporteurs"],
  entrepots: ["/dashboard/entrepots", "Entrepôts"],
  retours: ["/dashboard/retours", "Retours"],
  avis: ["/dashboard/avis", "Avis"],
  messages: ["/dashboard/messages", "Messages"],
  marketing: ["/dashboard/marketing", "Marketing"],
  codes_promo: ["/dashboard/marketing/codes-promo", "Codes promo"],
  emails: ["/dashboard/marketing/email", "Emails"],
  campagnes: ["/dashboard/campagnes", "Campagnes"],
  publicite: ["/dashboard/publicite", "Publicité"],
  whatsapp: ["/dashboard/whatsapp", "WhatsApp"],
  sms: ["/dashboard/sms", "SMS"],
  automatisations: ["/dashboard/automation", "Automatisations"],
  affiliation: ["/dashboard/affiliation", "Affiliation"],
  analytics: ["/dashboard/analytics", "Statistiques"],
  rapports: ["/dashboard/rapports", "Rapports"],
  revenus: ["/dashboard/revenus", "Revenus"],
  wallet: ["/dashboard/wallet", "Portefeuille"],
  paiements: ["/dashboard/paiements", "Paiements"],
  factures: ["/dashboard/factures", "Factures"],
  abonnement: ["/dashboard/abonnement", "Abonnement"],
  boutique: ["/dashboard/boutique", "Boutique"],
  constructeur: ["/dashboard/builder", "Constructeur"],
  themes: ["/dashboard/themes", "Thèmes"],
  medias: ["/dashboard/medias", "Médias"],
  fichiers: ["/dashboard/fichiers", "Fichiers"],
  studio: ["/dashboard/studio", "Studio"],
  caisse: ["/dashboard/pos", "Caisse"],
  stock: ["/dashboard/pos/stock", "Stock"],
  inventaire: ["/dashboard/pos/inventaire", "Inventaire"],
  sourcing: ["/dashboard/sourcing", "Sourcing"],
  fournisseurs: ["/dashboard/sourcing/fournisseurs", "Fournisseurs"],
  objectifs: ["/dashboard/objectifs", "Objectifs"],
  agents: ["/dashboard/agents", "Agents"],
  chatbot: ["/dashboard/chatbot", "Chatbot"],
  journal_axia: ["/dashboard/axia/journal", "Journal d'AXIA"],
  connecteurs: ["/dashboard/connecteurs", "Connecteurs"],
  controle_ia: ["/dashboard/controle-ia", "Contrôle des IA"],
  parametres: ["/dashboard/parametres", "Paramètres"],
  equipe: ["/dashboard/parametres/equipe", "Équipe"],
  domaine: ["/dashboard/parametres/domaine", "Domaine"],
  notifications: ["/dashboard/parametres/notifications", "Notifications"],
  profil: ["/dashboard/profil", "Profil"],
};

const MARQUE = "OUVRIR_PAGE:";

/** Résultat de l'outil : la première ligne porte l'adresse lue par les fenêtres AXIA. */
export const resultatOuverture = (lien: string, nom: string) => `${MARQUE}${lien}\nPage « ${nom} » ouverte à l'écran du marchand.`;

/** Adresse à ouvrir d'après les résultats d'outils d'une réponse AXIA (la dernière demandée), sinon null. */
export function pageAOuvrir(actions: string[] | undefined): string | null {
  for (const a of [...(actions ?? [])].reverse()) {
    const lien = a.startsWith(MARQUE) ? a.slice(MARQUE.length).split("\n")[0] : "";
    // Garde-fou : uniquement le dashboard ou une adresse web (boutique publique).
    if (/^\/dashboard(\/|$|\?)/.test(lien) || /^https?:\/\//.test(lien)) return lien;
  }
  return null;
}

/** Retire la marque technique d'un résultat avant de l'afficher. */
export const sansMarque = (a: string) => (a.startsWith(MARQUE) ? a.split("\n").slice(1).join("\n") : a);

/** Ouvre la page : dans l'application, ou dans un nouvel onglet pour la boutique publique. */
export function ouvrirPage(lien: string, push: (href: string) => void) {
  if (lien.startsWith("/")) push(lien);
  else window.open(lien, "_blank", "noopener");
}
