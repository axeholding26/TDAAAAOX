// Droits d'AXIA = droits du membre connecté. Sans ce filtre, un membre
// d'équipe restreint (caissier, lecture seule…) pouvait faire par AXIA ce que
// le menu et les API lui refusent (lire les revenus, modifier des produits…).
// Chaque outil est rattaché à un module de lib/permissions.ts et au niveau
// minimum requis ; les outils absents de la table ne demandent aucun droit.
import type { GrillePermissions, ModuleKey } from "@/lib/permissions";

type Regle = [ModuleKey, "lecture" | "ecriture"];
const L = (m: ModuleKey): Regle => [m, "lecture"], E = (m: ModuleKey): Regle => [m, "ecriture"];

const REGLES: Record<string, Regle> = {
  // Catalogue
  lister_produits: L("produits"), rechercher_produits: L("produits"), produits_performance: L("produits"), lister_fournisseurs: L("produits"), lister_entrepots: L("produits"),
  ajouter_produit: E("produits"), enrichir_produit: E("produits"), mettre_a_jour_prix: E("produits"), modifier_fiche_produit: E("produits"), generer_image: E("produits"),
  ajouter_fournisseur: E("produits"), creer_entrepot: E("produits"), sync_fournisseurs: E("produits"), router_commande_fournisseur: E("produits"),
  // Boutique
  lire_boutique: L("boutique"), lister_regles_livraison: L("boutique"), calculer_frais_livraison: L("boutique"), verifier_badges: L("boutique"),
  publier_boutique: E("boutique"), modifier_boutique: E("boutique"), configurer_livraison: E("boutique"), ajouter_regle_livraison: E("boutique"),
  personnaliser_page_boutique: E("boutique"), modifier_design_accueil: E("boutique"), modifier_theme: E("boutique"), modifier_page: E("boutique"), modifier_couleurs: E("boutique"), creer_popup: E("boutique"),
  // Commandes
  statut_commande: L("commandes"), dashboard_livraison: L("commandes"), lister_retours: L("commandes"), lister_commandes_fournisseur: L("commandes"), verifier_retards_fournisseurs: L("commandes"),
  assigner_livreur: E("commandes"), initier_retour: E("commandes"), creer_retour: E("commandes"), mettre_a_jour_retour: E("commandes"),
  // Clients
  lister_clients: L("clients"), contexte_client: L("clients"), recommandations_client: L("clients"), analyser_avis: L("clients"),
  envoyer_email_client: E("clients"), whatsapp_envoyer_message: E("clients"), gmail_envoyer: E("clients"),
  // Marketing & contenu
  creer_code_promo: E("marketing"), envoyer_campagne_email: E("marketing"), generer_post_social: E("marketing"), whatsapp_diffusion: E("marketing"), sms_campagne: E("marketing"),
  creer_automation: E("marketing"), ajouter_programme_affiliation_entrante: E("marketing"), meta_poster_facebook: E("marketing"), meta_poster_instagram: E("marketing"),
  meta_planifier_post: E("marketing"), meta_creer_campagne_ads: E("marketing"), generer_video: E("marketing"), generer_voiceover: E("marketing"),
  higgsfield_generer_video: E("marketing"), higgsfield_generer_image: E("marketing"), higgsfield_video_produit: E("marketing"), higgsfield_lister_outils: L("marketing"), higgsfield_appeler_outil: E("marketing"),
  // Finance
  stats_globales: L("finance"), rapport_complet: L("finance"), lister_factures: L("finance"), calculer_tva: L("finance"),
  generer_facture: E("finance"), payer_commission_affilie: E("finance"),
};

const tousLesDroits = (g: GrillePermissions) => Object.values(g).every((n) => n === "ecriture");

export function outilAutorise(nom: string, g: GrillePermissions): boolean {
  if (nom === "deleguer_vers_agent") return tousLesDroits(g); // les sous-agents n'appliquent pas ce filtre
  const r = REGLES[nom];
  if (!r) return true;
  const niveau = g[r[0]];
  return r[1] === "lecture" ? niveau !== "aucun" : niveau === "ecriture";
}

/** Outils proposés au modèle + exécuteur qui refuse tout outil hors droits (défense en profondeur). */
export function restreindreAxia<T extends { name: string }, X extends (nom: string, args: any, tenantId: string) => Promise<any>>(outils: T[], executer: X, g: GrillePermissions): { outils: T[]; executer: X } {
  const refus = { succes: false, resultat: "Action non autorisée : ton rôle dans l'équipe ne donne pas accès à ce module. Demande au propriétaire de la boutique." };
  return {
    outils: outils.filter((o) => outilAutorise(o.name, g)),
    executer: (async (nom: string, args: any, tenantId: string) => (outilAutorise(nom, g) ? executer(nom, args, tenantId) : refus)) as X,
  };
}

const NOMS_MODULES: Record<ModuleKey, string> = {
  commandes: "commandes", produits: "catalogue", pos: "caisse", clients: "clients", marketing: "marketing",
  finance: "finances (revenus, factures, paiements)", equipe: "équipe", parametres: "paramètres", boutique: "boutique et design",
};

/** Consigne ajoutée au prompt quand l'interlocuteur est un membre restreint (vide pour un accès complet). */
export function consigneDroits(g: GrillePermissions): string {
  if (tousLesDroits(g)) return "";
  const interdits = (Object.keys(g) as ModuleKey[]).filter((m) => g[m] === "aucun").map((m) => NOMS_MODULES[m]);
  const lecture = (Object.keys(g) as ModuleKey[]).filter((m) => g[m] === "lecture").map((m) => NOMS_MODULES[m]);
  return `─── DROITS DE TON INTERLOCUTEUR ───
Tu parles à un membre de l'équipe, pas au propriétaire.${interdits.length ? ` Il n'a PAS accès à : ${interdits.join(", ")} — si sa demande porte là-dessus, dis-lui simplement que son rôle ne le permet pas et de s'adresser au propriétaire ; ne déduis ni n'estimes jamais ces informations à partir d'autres données.` : ""}${lecture.length ? ` Il peut seulement consulter (pas modifier) : ${lecture.join(", ")}.` : ""}`;
}
