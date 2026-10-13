// Source unique de vérité des variables d'environnement lues par AXSO : quelle
// fonction chacune active, et si elle est renseignée. SERVEUR uniquement.
// Sert à masquer proprement une fonction non configurée (integrationActive) et à
// la page admin « État des intégrations ». Ne rend JAMAIS une valeur, même partielle.

export interface Integration {
  cle: string;
  nom: string;
  /** Ce que le marchand ou la plateforme perd quand elle manque. */
  fonction: string;
  variables: string[];
  /** Sans elle, l'application ne fonctionne pas. */
  indispensable?: boolean;
}

export const INTEGRATIONS: Integration[] = [
  { cle: "base", nom: "Base de données", fonction: "Toute l'application.", variables: ["DATABASE_URL"], indispensable: true },
  { cle: "connexion", nom: "Connexion des comptes", fonction: "Ouverture de session des marchands, clients et admins.", variables: ["AUTH_SECRET", "NEXTAUTH_SECRET"], indispensable: true },
  { cle: "adresses", nom: "Adresse du site", fonction: "Liens, e-mails, retours de paiement, sous-domaines des boutiques.", variables: ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_AXSO_DOMAIN"], indispensable: true },
  { cle: "fichiers", nom: "Stockage des fichiers", fonction: "Images produits, médias, documents fournisseurs.", variables: ["BLOB_READ_WRITE_TOKEN"], indispensable: true },
  { cle: "notchpay", nom: "Paiements NotchPay", fonction: "Paiement en ligne des commandes et des abonnements, retraits automatiques.", variables: ["NOTCHPAY_PUBLIC_KEY", "NOTCHPAY_PRIVATE_KEY", "NOTCHPAY_WEBHOOK_SECRET"], indispensable: true },
  { cle: "crons", nom: "Tâches planifiées", fonction: "Surveillance des fournisseurs, alertes de caisse, publications programmées.", variables: ["CRON_SECRET"], indispensable: true },
  { cle: "emails", nom: "E-mails (Resend)", fonction: "Confirmations de commande, invitations, mots de passe oubliés.", variables: ["RESEND_API_KEY"], indispensable: true },
  { cle: "ia", nom: "IA (Gemini)", fonction: "AXIA, assistant Sourcing, génération de boutiques et de textes.", variables: ["GEMINI_API_KEY"], indispensable: true },
  { cle: "ia_secours", nom: "IA de secours (DeepSeek)", fonction: "Prend le relais quand Gemini est indisponible.", variables: ["DEEPSEEK_API_KEY"] },
  { cle: "meta", nom: "Meta (Facebook, Instagram)", fonction: "Connexion des comptes Meta des marchands ; réception des messages WhatsApp, Instagram et des leads (webhooks signés).", variables: ["META_APP_ID", "META_APP_SECRET"] },
  { cle: "meta_webhook", nom: "Inscription du webhook Meta", fonction: "Jeton demandé par Meta pour enregistrer l'adresse du webhook.", variables: ["META_WEBHOOK_VERIFY_TOKEN", "NEXT_PUBLIC_META_WEBHOOK_TOKEN"] },
  { cle: "whatsapp", nom: "Numéro WhatsApp d'Axso", fonction: "Notifications de commande pour les boutiques qui n'ont pas connecté leur propre numéro.", variables: ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"] },
  { cle: "gmail", nom: "Gmail des marchands", fonction: "Connexion d'un compte Gmail pour envoyer les e-mails d'une boutique.", variables: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] },
  { cle: "sms", nom: "SMS (Africa's Talking)", fonction: "Campagnes SMS.", variables: ["AFRICASTALKING_USERNAME", "AFRICASTALKING_KEY"] },
  { cle: "domaines", nom: "Domaines personnalisés", fonction: "Rattacher le nom de domaine d'un marchand à sa boutique.", variables: ["VERCEL_API_TOKEN", "VERCEL_PROJECT_ID", "VERCEL_TEAM_ID"] },
  { cle: "genuka", nom: "WhatsApp via Genuka (jeton partagé)", fonction: "WhatsApp simplifié pour les boutiques sans jeton Genuka propre.", variables: ["GENUKA_PROXY_TOKEN"] },
  { cle: "higgsfield", nom: "Vidéo IA (Higgsfield)", fonction: "Génération de vidéos dans Médias.", variables: ["HIGGSFIELD_API_KEY"] },
];

const renseignee = (variable: string) => !!process.env[variable]?.trim();

/** La fonction est-elle utilisable ? (toutes ses variables sont renseignées) */
export function integrationActive(cle: string): boolean {
  return INTEGRATIONS.find((i) => i.cle === cle)?.variables.every(renseignee) ?? false;
}

/** État de chaque intégration, variable par variable — sans aucune valeur. */
export function etatIntegrations() {
  return INTEGRATIONS.map((i) => ({ ...i, variables: i.variables.map((nom) => ({ nom, configuree: renseignee(nom) })), active: i.variables.every(renseignee) }));
}

export const BIENTOT_DISPONIBLE = "Cette fonction sera bientôt disponible.";
