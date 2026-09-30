// Actions sensibles d'AXIA : jamais exécutées directement. L'outil crée une
// demande de confirmation (AxiaProposition "confirmation") affichée dans la
// bulle AXIA ; l'action ne part qu'au clic « Autoriser » du marchand
// (app/api/axia/propositions). Le blocage est côté serveur : le modèle ne
// peut pas le contourner, même par délégation à un agent ou via le cron.
import { randomUUID, createHash } from "crypto";
import { prisma } from "@/lib/prisma";

// Argent, prix, envois aux clients, publication, retours, livraison.
const SENSIBLES: Record<string, string> = {
  // Outils AXIA (lib/axia/tools.ts)
  mettre_a_jour_prix: "Changer un prix",
  payer_commission_affilie: "Payer une commission",
  creer_code_promo: "Créer un code promo",
  router_commande_fournisseur: "Commander chez un fournisseur",
  configurer_livraison: "Modifier la livraison",
  ajouter_regle_livraison: "Ajouter un tarif de livraison",
  publier_boutique: "Publier la boutique",
  envoyer_campagne_email: "Envoyer une campagne email",
  envoyer_email_client: "Envoyer un email à un client",
  creer_automation: "Créer une automatisation",
  initier_retour: "Lancer un retour",
  creer_retour: "Créer un retour",
  mettre_a_jour_retour: "Modifier un retour",
  assigner_livreur: "Assigner un livreur",
  // Outils des agents autonomes (app/api/ai/agent-*)
  ajuster_prix_produit: "Changer un prix",
  creer_offre_flash: "Créer une offre flash",
  creer_code_vip: "Créer un code VIP",
  relancer_clients_abandons: "Relancer des clients",
  campagne_reactivation: "Lancer une campagne de réactivation",
  campagne_acquisition_email: "Envoyer une campagne email",
  message_anniversaire: "Envoyer un message d'anniversaire",
  creer_programme_parrainage: "Créer un programme de parrainage",
  creer_pack_bundle: "Créer un pack produits",
  desactiver_produit_rupture: "Désactiver un produit",
  mettre_a_jour_statut: "Changer le statut d'une commande",
};

// Connecteurs (Meta, WhatsApp, Gmail, SMS…) : tout ce qui publie ou envoie.
const PREFIXES_ENVOI = /^(meta|whatsapp|gmail|sms|tiktok|google_ads)_/;
const LECTURE = /(^|_)(lister|lire|stats|statut)(_|$)/;

export function estSensible(nom: string): boolean {
  return nom in SENSIBLES || (PREFIXES_ENVOI.test(nom) && !LECTURE.test(nom));
}

function resumerArgs(args: Record<string, any>): string {
  return Object.entries(args ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .slice(0, 5)
    .map(([k, v]) => {
      const texte = typeof v === "string" ? v : JSON.stringify(v);
      return `${k.replace(/_/g, " ")} : ${texte.length > 90 ? texte.slice(0, 90) + "…" : texte}`;
    })
    .join(" · ");
}

function semaine() {
  return Math.floor(Date.now() / (7 * 86_400_000));
}

/** Enregistre l'action en attente et renvoie au modèle la consigne à suivre. */
export async function demanderConfirmation(tenantId: string, outil: string, args: Record<string, any>, agent?: string) {
  const libelle = SENSIBLES[outil] ?? outil.replace(/_/g, " ");
  const details = resumerArgs(args);
  // Agent autonome (cron horaire) : la même action n'est proposée qu'une fois par semaine.
  const cle = agent
    ? `confirmation:${agent}:${semaine()}:${createHash("sha1").update(outil + JSON.stringify(args)).digest("hex")}`
    : `confirmation:${randomUUID()}`;
  await prisma.axiaProposition.createMany({
    skipDuplicates: true,
    data: {
      tenantId,
      type: "confirmation",
      cle,
      message: details ? `${libelle} — ${details}` : libelle,
      action: { outil, args, ...(agent && { agent }) },
    },
  });
  return {
    succes: true,
    resultat: `EN ATTENTE DE CONFIRMATION : « ${libelle} » n'est PAS encore fait. Le marchand doit l'autoriser dans la bulle AXIA en bas à droite. Dis-lui en une phrase ce que tu t'apprêtes à faire et que tu attends son feu vert ; ne dis jamais que c'est fait.`,
  };
}
