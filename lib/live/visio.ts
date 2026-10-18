// Fournisseurs de visio interchangeables. Un événement garde son fournisseur ;
// la page de l'inscrit ne connaît que { url, integrable } et seulement dans la
// fenêtre d'accès (lib/live/regles.ts → fenetreAcces).
//
// Quatre usages à ne pas confondre (aucune capacité n'est annoncée au-delà de ce
// que le fournisseur garantit) :
//  - réunion interactive : tout le monde peut parler/filmer (Jitsi, Meet, Zoom Meeting, LiveKit, Daily) ;
//  - webinaire grande audience : intervenants + public en écoute (Zoom Webinar, Teams webinar) ;
//  - diffusion : flux à sens unique (YouTube Live, Facebook Live) collé en « lien externe » ;
//  - replay : vidéo enregistrée, servie après coup (Evenement.replayUrl ou produit « formation »).
// AXSO ne mesure ni n'impose la capacité d'une salle externe : la capacité d'un
// événement est le nombre de PLACES vendues/réservées, pas une limite technique.
import crypto from "crypto";

export type CleFournisseur = "lien_externe" | "jitsi" | "livekit" | "daily" | "zoom_api";

export type Fournisseur = {
  cle: CleFournisseur;
  nom: string;
  usage: string;
  /** Variables d'environnement attendues (noms seulement). */
  env: string[];
  configure: () => boolean;
  /** Ce que l'organisateur doit saisir. */
  exigeLien: boolean;
  limites: string;
};

const jitsiDomaine = () => process.env.JITSI_DOMAIN?.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "") || "";

export const FOURNISSEURS: Record<CleFournisseur, Fournisseur> = {
  lien_externe: {
    cle: "lien_externe", nom: "Lien externe (Zoom, Google Meet, Teams, YouTube Live…)",
    usage: "Réunion, webinaire ou diffusion selon l'outil choisi par l'organisateur",
    env: [], configure: () => true, exigeLien: true,
    limites: "Capacité, enregistrement et qualité dépendent du compte de l'organisateur chez ce service.",
  },
  jitsi: {
    cle: "jitsi", nom: "Salle Jitsi Meet générée par AXSO",
    usage: "Réunion interactive (petits groupes)",
    env: ["JITSI_DOMAIN (facultatif : serveur Jitsi auto-hébergé, intégré dans la page)"], configure: () => true, exigeLien: false,
    limites: "Sur meet.jit.si (gratuit, sans clé) la salle s'ouvre dans un nouvel onglet : l'intégration en iframe y est limitée à 5 minutes (démo) et le premier participant doit se connecter (Google/GitHub) pour lancer la réunion. Aucune garantie de capacité ni d'enregistrement. Pour l'intégrer à la page, renseigner JITSI_DOMAIN (serveur auto-hébergé ou JaaS).",
  },
  livekit: {
    cle: "livekit", nom: "LiveKit (intégré)", usage: "Réunion interactive et webinaire intégrés à AXSO",
    env: ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"],
    configure: () => false, exigeLien: false,
    limites: "Non configuré : adaptateur à écrire (jetons d'accès signés côté serveur + client livekit-client).",
  },
  daily: {
    cle: "daily", nom: "Daily.co (intégré)", usage: "Réunion interactive intégrée",
    env: ["DAILY_API_KEY"], configure: () => false, exigeLien: false,
    limites: "Non configuré : adaptateur à écrire (création de salle + jeton de réunion par inscrit).",
  },
  zoom_api: {
    cle: "zoom_api", nom: "Zoom (API, création automatique)", usage: "Réunion ou webinaire Zoom créé par AXSO",
    env: ["ZOOM_ACCOUNT_ID", "ZOOM_CLIENT_ID", "ZOOM_CLIENT_SECRET"], configure: () => false, exigeLien: false,
    limites: "Non configuré : application Server-to-Server OAuth Zoom requise. En attendant, coller le lien Zoom en « Lien externe ».",
  },
};

export const fournisseursDisponibles = () => Object.values(FOURNISSEURS).filter((f) => f.configure());

/** Nom de salle Jitsi : 128 bits aléatoires, impossible à deviner ou énumérer. */
export const nouvelleSalleJitsi = () => `axso-${crypto.randomBytes(16).toString("hex")}`;

/** Adresse https publique, sans identifiants (rien d'autre n'est enregistré comme lien de salle). */
export function lienValide(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !u.username && !u.password && u.hostname.includes(".");
  } catch {
    return false;
  }
}

export type Salle = { url: string; integrable: boolean; fournisseur: string };

/** Salle d'un événement — à n'appeler qu'une fois la fenêtre d'accès vérifiée. */
export function salle(ev: { fournisseur: string; lienSalle: string | null; salleId: string | null }, participant?: string): Salle | null {
  const f = FOURNISSEURS[ev.fournisseur as CleFournisseur];
  if (!f || !f.configure()) return null;
  if (f.cle === "lien_externe") return lienValide(ev.lienSalle) ? { url: ev.lienSalle!, integrable: false, fournisseur: f.nom } : null;
  if (f.cle === "jitsi" && ev.salleId) {
    const domaine = jitsiDomaine();
    const nom = participant ? `#userInfo.displayName=${encodeURIComponent(JSON.stringify(participant))}` : "";
    return { url: `https://${domaine || "meet.jit.si"}/${ev.salleId}${nom}`, integrable: !!domaine, fournisseur: f.nom };
  }
  return null;
}
