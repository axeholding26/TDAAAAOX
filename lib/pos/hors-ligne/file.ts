// File des mutations saisies hors ligne — LOGIQUE PURE (aucun navigateur,
// aucune base, aucun réseau) : la même sous IndexedDB (moteur.ts) que dans une
// vérification en mémoire.
//
// GARANTIES
// - Aucune perte : une mutation ne quitte l'état « en_attente » que sur une
//   réponse du serveur (enregistrée, ou refusée pour une raison définitive).
//   Onglet fermé pendant un envoi : elle est toujours « en_attente » au
//   redémarrage et repart avec la MÊME clé.
// - Aucun doublon : la clé d'idempotence ne change jamais ; le serveur rend la
//   vente d'origine quand il la revoit (réponse perdue, double envoi).
// - Ordre d'arrivée, une mutation à la fois : la suivante n'est envoyée que
//   quand la précédente a reçu une réponse (enregistrée ou classée « à traiter »).
// - Poste partagé : les ventes d'un autre compte restent en attente pour leur
//   auteur et ne retiennent pas celles du compte connecté.
// - Un refus définitif n'est jamais rejoué en boucle : il passe « à traiter »,
//   avec la phrase du serveur, et reste exportable.
import type { Reponse } from "../client/transport";
import type { ResultatVente } from "../types";

/** Version du format d'une mutation en file (à incrémenter si la forme du payload change). */
export const VERSION_MUTATION = 1;

/**
 * en_attente   : pas encore acceptée par le serveur.
 * synchronisee : enregistrée par le serveur (`resultat.conflits` liste ce qu'un responsable doit regarder).
 * a_traiter    : refusée par le serveur pour une raison qui ne passera pas seule — un humain décide.
 * traitee      : un humain a réglé un « à traiter » à la main ; gardée pour l'export.
 */
export type StatutMutation = "en_attente" | "synchronisee" | "a_traiter" | "traitee";

/** Écart constaté par le serveur entre ce que la caisse a fait hors ligne et l'état réel. */
export type ConflitSync = {
  type: "survente" | "prix" | "total" | "session" | "serie";
  /** Phrase à afficher telle quelle. */
  message: string;
  details?: Record<string, unknown>;
};

/** Ce que la caisse a constaté au moment de la vente hors ligne (sert au reçu provisoire et à la détection des écarts). */
export type VenteLocale = {
  /** Numéro provisoire imprimé sur le reçu. */
  numero: string;
  /** Total encaissé, calculé sur l'appareil. */
  total: number;
  paye: number;
  monnaie: number;
  /** Session de caisse ouverte au moment de la vente. */
  sessionCaisseId: string | null;
  /** Date de l'instantané du catalogue utilisé pour les prix. */
  catalogueAt: string | null;
  /** Prix catalogue local de chaque ligne (même ordre que payload.lignes) : à la pièce, ou au kilo. */
  prix: (number | null)[];
  /** Quantités sorties du stock local (grammes si kg). */
  sorties: { produitId: string; varianteId: string | null; quantite: number }[];
};

export type ResultatRejeu = Omit<ResultatVente, "rejoue"> & { conflits: ConflitSync[] };

export type Mutation = {
  /** Rang d'arrivée (clé auto-incrémentée du magasin IndexedDB « file »). */
  ordre?: number;
  /** Clé d'idempotence : unique, jamais régénérée. */
  cle: string;
  type: string;
  payload: Record<string, unknown>;
  /** Identifiant de ce poste (navigateur). */
  appareilId: string;
  userId: string;
  caisseId: string | null;
  /** Horodatage de l'appareil, ISO. */
  creeLocalAt: string;
  version: number;
  tentatives: number;
  statut: StatutMutation;
  /** Pas de nouvel essai avant cet instant (ms). */
  prochainEssaiAt?: number;
  local?: VenteLocale;
  /** Dernier refus ou dernière panne. */
  erreur?: { code: string; message: string; status: number } | null;
  resultat?: (Partial<ResultatRejeu> & { rejoue?: boolean }) | null;
  synchroniseeAt?: string;
  /** Conflits lus par un responsable. */
  vu?: boolean;
  /** Un responsable a validé l'écart de prix refusé par le serveur (« ecart_a_valider ») : le rejeu repart avec `valider: true`. */
  valide?: boolean;
};

/**
 * Que faire d'une réponse du serveur à un rejeu.
 * ok          : enregistrée (ou déjà enregistrée : même clé).
 * reseau      : pas de réponse exploitable — nouvel essai plus tard, attente croissante.
 * reconnexion : session expirée, ou file d'un autre compte — la file est conservée, on demande de se reconnecter.
 * bloquee     : le serveur attend une action sur place (caisse à ouvrir) — nouvel essai plus tard.
 * definitive  : refus métier — ne sera pas rejouée seule, passe « à traiter ».
 */
export type ClasseReponse = "ok" | "reseau" | "reconnexion" | "bloquee" | "definitive";

export function classerReponse(r: Reponse<unknown>): ClasseReponse {
  if (r.ok) return "ok";
  if (r.status === 401 || r.code === "non_connecte" || r.code === "autre_utilisateur") return "reconnexion";
  // 404 sans code métier : la route de synchronisation n'est pas (ou plus) déployée — surtout ne rien classer définitif.
  if (r.status === 0 || r.status >= 500 || r.status === 408 || r.status === 425 || r.status === 429 || r.code === "hors_ligne" || (r.status === 404 && r.code === "erreur_serveur")) return "reseau";
  if (r.code === "caisse_fermee") return "bloquee";
  return "definitive";
}

/** Attente avant le prochain essai : 2 s, 4 s, 8 s… plafonnée à 5 minutes. */
export function delaiAttente(tentatives: number): number {
  return Math.min(300_000, 2_000 * 2 ** Math.max(0, Math.min(tentatives, 20) - 1));
}

/** Numéro provisoire d'une vente hors ligne : « HL-AAMMJJ-XXXXXX » (fin de la clé d'idempotence). */
export function numeroProvisoire(cle: string, date: Date): string {
  const j = `${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `HL-${j}-${cle.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase()}`;
}

export type Compteurs = { enAttente: number; aTraiter: number; conflits: number };

/** Ce que le badge et l'écran de synchronisation affichent. */
export function compterFile(file: Mutation[]): Compteurs {
  return {
    enAttente: file.filter((m) => m.statut === "en_attente").length,
    aTraiter: file.filter((m) => m.statut === "a_traiter").length,
    conflits: file.filter((m) => m.statut === "synchronisee" && !m.vu && (m.resultat?.conflits?.length ?? 0) > 0).length,
  };
}

const JOUR = 86_400_000;

/**
 * Mutations qu'on peut effacer de l'appareil : enregistrées par le serveur
 * depuis plus de 7 jours (conflits lus), ou réglées à la main depuis plus de
 * 30 jours. Jamais une mutation en attente ni « à traiter ».
 */
export function purgeables(file: Mutation[], maintenant: number): Mutation[] {
  return file.filter((m) => {
    const age = maintenant - new Date(m.synchroniseeAt ?? m.creeLocalAt).getTime();
    if (m.statut === "synchronisee") return age > 7 * JOUR && (m.vu || !(m.resultat?.conflits?.length));
    return m.statut === "traitee" && age > 30 * JOUR;
  });
}

export type DepRejeu = {
  /** Toute la file, dans l'ordre d'arrivée. */
  lire: () => Promise<Mutation[]>;
  ecrire: (m: Mutation) => Promise<void>;
  /** Envoie UNE mutation avec sa clé d'idempotence. Ne lève jamais. */
  envoyer: (m: Mutation) => Promise<Reponse<ResultatRejeu>>;
  maintenant: () => number;
};

export type BilanRejeu = {
  /** Enregistrées par le serveur pendant ce passage. */
  envoyees: number;
  /** … dont celles que le serveur a marquées d'un conflit. */
  conflits: number;
  /** Refusées définitivement pendant ce passage. */
  aTraiter: number;
  /** Encore en attente à la fin du passage. */
  restantes: number;
  /** Pourquoi le passage s'est arrêté. */
  arret: "vide" | "reseau" | "reconnexion" | "bloquee" | "attente";
  prochainEssaiAt?: number;
  /** Phrase du serveur à l'arrêt (reconnexion, caisse à ouvrir), ou sur les ventes d'un autre compte. */
  message?: string;
  /** Comptes dont des ventes attendent sur ce poste : seul leur auteur peut les synchroniser. */
  autresComptes: number;
};

/**
 * Rejoue la file : la plus ancienne mutation en attente d'abord, une à la fois.
 * S'arrête à la première qui n'obtient pas de réponse (les suivantes attendent
 * leur tour) ; un refus définitif est classé « à traiter » et laisse passer les
 * suivantes (une vente refusée ne doit pas retenir toutes les autres). Les
 * ventes d'un autre compte restent en attente pour lui, sans arrêter le passage.
 */
export async function rejouerFile(dep: DepRejeu): Promise<BilanRejeu> {
  const bilan: BilanRejeu = { envoyees: 0, conflits: 0, aTraiter: 0, restantes: 0, arret: "vide", autresComptes: 0 };
  // Comptes dont le serveur a refusé une vente pendant ce passage (« autre_utilisateur ») : une seule demande par compte.
  const autres = new Set<string>();
  const laissees = new Set<string>();
  let messageAutres: string | undefined;
  for (;;) {
    // ponytail: file relue en entier à chaque tour (une vente saisie pendant le rejeu prend son rang) — curseur IndexedDB si elle dépasse quelques milliers d'entrées.
    const m = (await dep.lire()).find((x) => x.statut === "en_attente" && !laissees.has(x.cle) && !(autres.has(x.userId) && !x.valide));
    if (!m) break;
    if ((m.prochainEssaiAt ?? 0) > dep.maintenant()) { bilan.arret = "attente"; bilan.prochainEssaiAt = m.prochainEssaiAt; bilan.message = m.erreur?.message; break; }

    const r = await dep.envoyer(m);
    const classe = classerReponse(r);
    if (r.ok) {
      const conflits = r.donnees.conflits ?? [];
      await dep.ecrire({ ...m, statut: "synchronisee", erreur: null, prochainEssaiAt: undefined, resultat: { ...r.donnees, conflits, rejoue: r.rejoue }, synchroniseeAt: new Date(dep.maintenant()).toISOString() });
      bilan.envoyees++;
      if (conflits.length) bilan.conflits++;
      continue;
    }
    const erreur = { code: r.code, message: r.message, status: r.status };
    if (classe === "definitive") {
      await dep.ecrire({ ...m, statut: "a_traiter", tentatives: m.tentatives + 1, erreur, prochainEssaiAt: undefined });
      bilan.aTraiter++;
      continue;
    }
    if (r.code === "autre_utilisateur") {
      // Vente d'un autre caissier de ce poste : elle reste en attente, intacte, et repart dès qu'il se reconnecte ici.
      await dep.ecrire({ ...m, erreur });
      autres.add(m.userId); laissees.add(m.cle); messageAutres = r.message;
      continue;
    }
    if (classe === "reconnexion") {
      // La file reste telle quelle : pas de tentative comptée, pas d'attente — elle repart dès la reconnexion.
      await dep.ecrire({ ...m, erreur });
      bilan.arret = "reconnexion"; bilan.message = r.message;
      break;
    }
    const tentatives = m.tentatives + 1;
    const prochainEssaiAt = dep.maintenant() + delaiAttente(tentatives);
    await dep.ecrire({ ...m, tentatives, prochainEssaiAt, erreur });
    bilan.arret = classe === "bloquee" ? "bloquee" : "reseau"; bilan.prochainEssaiAt = prochainEssaiAt; bilan.message = r.message;
    break;
  }
  bilan.restantes = (await dep.lire()).filter((x) => x.statut === "en_attente").length;
  bilan.autresComptes = autres.size;
  bilan.message ??= messageAutres;
  return bilan;
}

/** Fichier de secours : toute la file, lisible et ré-importable à la main par le support. */
export function exporterFile(file: Mutation[], meta: { boutique?: string | null; poste: string; userId?: string | null }) {
  return {
    format: "axso-pos-file-hors-ligne", version: VERSION_MUTATION, exporteAt: new Date().toISOString(), ...meta,
    compteurs: compterFile(file),
    mutations: file,
  };
}
