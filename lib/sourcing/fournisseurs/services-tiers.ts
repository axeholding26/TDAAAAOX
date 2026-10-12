// Services tiers de vérification — AUCUN n'est branché aujourd'hui.
// Ce fichier fixe le contrat (interface) et déclare les adapters « à connecter » :
// chaque appel échoue explicitement, rien n'est simulé, et l'interface affiche
// leur statut tel quel. AXSO ne crée jamais d'audit ni de vérification lui-même :
// en attendant, le marchand commande l'inspection chez le prestataire et saisit
// le rapport (niveau « déclaré » jusqu'à vérification par un admin AXSO).
import type { StatutIntegration } from "../connecteurs";

export interface DemandeInspection {
  type: string; // clé de TYPES_AUDIT
  fournisseur: { nom: string; adresseUsine?: string | null; pays: string };
  produit?: string;
  quantite?: number;
}

export interface PrestataireInspection {
  id: string;
  nom: string;
  statut: StatutIntegration;
  description: string;
  urlSite: string;
  /** Commande une inspection ; renvoie la référence du dossier chez le prestataire. */
  commander(demande: DemandeInspection): Promise<{ reference: string }>;
  /** Résultat d'une inspection commandée. */
  resultat(reference: string): Promise<{ statut: "planifie" | "reussi" | "echoue"; dateAudit?: Date; rapportUrl?: string }>;
}

export interface VerificateurCertificat {
  id: string;
  nom: string;
  statut: StatutIntegration;
  description: string;
  /** Contrôle un numéro de certificat dans le registre de l'organisme émetteur. */
  verifier(certificat: { certification: string; numero: string; organismeEmetteur: string }): Promise<{ valide: boolean; source: string; expireLe?: Date }>;
}

export class ServiceNonBranche extends Error {
  status = 501;
  constructor(nom: string) {
    super(`${nom} n'est pas encore connecté à AXSO. Passez par son site, puis enregistrez le rapport ici.`);
  }
}

const refuser = (nom: string) => async (): Promise<never> => { throw new ServiceNonBranche(nom); };

const inspection = (id: string, nom: string, urlSite: string): PrestataireInspection => ({
  id, nom, urlSite, statut: "a_connecter",
  description: "Prestataire d'inspection indépendant — aucune intégration avec AXSO : commande à passer sur son site.",
  commander: refuser(nom), resultat: refuser(nom),
});

export const PRESTATAIRES_INSPECTION: PrestataireInspection[] = [
  inspection("sgs", "SGS", "https://www.sgs.com"),
  inspection("bureau-veritas", "Bureau Veritas", "https://www.bureauveritas.com"),
  inspection("intertek", "Intertek", "https://www.intertek.com"),
  inspection("qima", "QIMA", "https://www.qima.com"),
];

export const VERIFICATEURS_CERTIFICATS: VerificateurCertificat[] = [
  {
    id: "registres-organismes", nom: "Registres en ligne des organismes de certification", statut: "a_connecter",
    description: "Contrôle automatique des numéros de certificat — non branché. La vérification est faite à la main par un admin AXSO, qui indique sa source.",
    verifier: refuser("Le contrôle automatique des certificats"),
  },
];
