// Règles pures de la Live Academy : séances, fenêtre d'accès au lien, rappels,
// certificat, permissions de la communauté. Sans base ni réseau : testées dans
// tests/live.test.ts.

export const TYPES_EVENEMENT = ["webinaire", "masterclass", "atelier", "qr", "classe"] as const;
export const LIBELLE_TYPE: Record<string, string> = {
  webinaire: "Webinaire", masterclass: "Masterclass", atelier: "Atelier", qr: "Session Q&R", classe: "Classe récurrente", session: "Séance de bootcamp",
};
/** Produits livrés par une place (lib/livraison-numerique.ts). */
export const TYPES_PRODUIT_LIVE = new Set(["evenement", "bootcamp"]);
export const FUSEAU_DEFAUT = "Africa/Douala";
/** Le lien reste ouvert après la fin prévue (débordement, retardataires). */
export const GRACE_APRES_MIN = 30;

export type Recurrence = { frequence: "quotidienne" | "hebdomadaire"; occurrences: number } | null;
type EvLike = { debut: Date; dureeMin: number; recurrence?: unknown; statut: string; ouvertureMin: number };

export function lireRecurrence(r: unknown): Recurrence {
  const o = r as { frequence?: string; occurrences?: number } | null;
  if (!o || (o.frequence !== "quotidienne" && o.frequence !== "hebdomadaire")) return null;
  const n = Math.min(Math.max(Math.floor(Number(o.occurrences) || 1), 1), 52);
  return { frequence: o.frequence, occurrences: n };
}

/** Débuts de toutes les séances (une seule pour un événement simple). */
export function seances(ev: Pick<EvLike, "debut" | "recurrence">): Date[] {
  const r = lireRecurrence(ev.recurrence);
  if (!r) return [ev.debut];
  const pas = (r.frequence === "quotidienne" ? 1 : 7) * 86_400_000;
  return Array.from({ length: r.occurrences }, (_, i) => new Date(ev.debut.getTime() + i * pas));
}

/** Séance en cours ou prochaine (index), null si toutes sont passées. */
export function seanceCourante(ev: Pick<EvLike, "debut" | "recurrence" | "dureeMin">, maintenant = new Date()): number | null {
  const liste = seances(ev);
  const i = liste.findIndex((d) => d.getTime() + (ev.dureeMin + GRACE_APRES_MIN) * 60_000 > maintenant.getTime());
  return i < 0 ? null : i;
}

export type EtatAcces =
  | { ouvert: true; occurrence: number }
  | { ouvert: false; raison: "annule" | "trop_tot" | "termine" | "non_inscrit"; ouvreA?: Date };

/**
 * Le lien de salle n'est révélé qu'à un inscrit actif, de `ouvertureMin` minutes avant
 * le début jusqu'à GRACE_APRES_MIN après la fin de la séance. Jamais si annulé.
 */
export function fenetreAcces(ev: EvLike, inscrit: boolean, maintenant = new Date()): EtatAcces {
  if (!inscrit) return { ouvert: false, raison: "non_inscrit" };
  if (ev.statut === "annule") return { ouvert: false, raison: "annule" };
  const i = seanceCourante(ev, maintenant);
  if (i === null || ev.statut === "termine") return { ouvert: false, raison: "termine" };
  const debut = seances(ev)[i];
  const ouvreA = new Date(debut.getTime() - Math.max(0, ev.ouvertureMin) * 60_000);
  // « en_direct » posé par l'organisateur ouvre la salle même un peu en avance.
  if (maintenant < ouvreA && ev.statut !== "en_direct") return { ouvert: false, raison: "trop_tot", ouvreA };
  return { ouvert: true, occurrence: i };
}

/**
 * Rappels dus maintenant : pour chaque séance future et chaque délai configuré (minutes avant),
 * le rappel part dès que son heure est passée, tant que la séance n'a pas commencé.
 * Un cron en retard rattrape donc le rappel au lieu de le perdre ; `deja` (clés du journal)
 * empêche tout doublon. Clé : evenementId:occurrence:minutes.
 */
export function rappelsDus(ev: EvLike & { id: string; rappels: number[]; createdAt?: Date }, deja: Set<string>, maintenant = new Date()): { cle: string; occurrence: number; minutes: number }[] {
  if (ev.statut === "annule" || ev.statut === "termine") return [];
  const dus: { cle: string; occurrence: number; minutes: number }[] = [];
  const delais = [...new Set(ev.rappels.filter((m) => m > 0))].sort((a, b) => a - b);
  seances(ev).forEach((debut, occurrence) => {
    if (debut <= maintenant) return;
    // Délais échus, sauf ceux déjà passés à la création de l'événement (rappel sans objet).
    const echus = delais.filter((m) => {
      const heure = debut.getTime() - m * 60_000;
      return heure <= maintenant.getTime() && (!ev.createdAt || heure >= ev.createdAt.getTime() - 60_000);
    });
    if (!echus.length) return;
    // Un seul rappel par séance et par passage : le plus proche du début (un cron en retard
    // n'envoie pas J-1 puis H-1 d'un coup ; une fois H-1 parti, J-1 est caduc).
    const m = echus[0];
    const cle = `${ev.id}:${occurrence}:${m}`;
    if (!deja.has(cle)) dus.push({ cle, occurrence, minutes: m });
  });
  return dus;
}

/** Places restantes (null = illimité). */
export function placesRestantes(capacite: number | null | undefined, prises: number): number | null {
  return capacite == null ? null : Math.max(0, capacite - prises);
}

/** Certificat conditionnel d'un bootcamp : présence et missions validées au-dessus des seuils. */
export function eligibleCertificat(p: { seancesTotal: number; presences: number; missionsTotal: number; missionsValidees: number; seuilPresence: number; seuilMissions: number }) {
  const tauxPresence = p.seancesTotal ? Math.round((p.presences / p.seancesTotal) * 100) : 100;
  const tauxMissions = p.missionsTotal ? Math.round((p.missionsValidees / p.missionsTotal) * 100) : 100;
  return { tauxPresence, tauxMissions, eligible: tauxPresence >= p.seuilPresence && tauxMissions >= p.seuilMissions };
}

// ─── Communauté ──────────────────────────────────────────────────────────────

export type RoleCommunaute = "apprenant" | "mentor" | "formateur";
export type ActionCommunaute = "lire" | "ecrire" | "repondre" | "annonce" | "reagir" | "signaler" | "resoudre" | "moderer" | "epingler" | "regles" | "creneau" | "reserver";

const DROITS: Record<RoleCommunaute, ActionCommunaute[]> = {
  apprenant: ["lire", "ecrire", "repondre", "reagir", "signaler", "reserver"],
  mentor: ["lire", "ecrire", "repondre", "reagir", "signaler", "resoudre", "reserver"],
  formateur: ["lire", "ecrire", "repondre", "annonce", "reagir", "resoudre", "moderer", "epingler", "regles", "creneau"],
};

/** null = non-inscrit (aucun droit). Un espace fermé n'est plus que lisible, et seulement par le formateur pour modérer. */
export function peutCommunaute(role: RoleCommunaute | null, action: ActionCommunaute, espaceActif = true): boolean {
  if (!role) return false;
  if (!espaceActif && role !== "formateur" && action !== "lire") return false;
  return DROITS[role].includes(action);
}

/** Au-delà de ce nombre de signalements distincts, un message est masqué en attendant le formateur. */
export const SEUIL_MASQUAGE = 3;

// ─── Affichage ───────────────────────────────────────────────────────────────

export function formaterDate(d: Date, fuseau = FUSEAU_DEFAUT): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short", timeZone: fuseau, timeZoneName: "short" }).format(d);
  } catch {
    return d.toISOString();
  }
}

/**
 * Lit une date « locale » saisie dans un fuseau (input datetime-local : "2026-11-02T18:00")
 * et renvoie l'instant UTC correspondant. Intl seul, sans dépendance.
 */
export function dateDansFuseau(local: string, fuseau = FUSEAU_DEFAUT): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return new Date(local);
  const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Décalage du fuseau à cet instant (deux passes pour les changements d'heure).
  let t = utc;
  for (let i = 0; i < 2; i++) t = utc - decalageMs(new Date(t), fuseau);
  return new Date(t);
}

function decalageMs(d: Date, fuseau: string): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: fuseau, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(d).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(d.getTime() / 1000) * 1000;
}

/** Inverse de dateDansFuseau, pour pré-remplir un input datetime-local. */
export function versLocal(d: Date, fuseau = FUSEAU_DEFAUT): string {
  return new Date(d.getTime() + decalageMs(d, fuseau)).toISOString().slice(0, 16);
}
