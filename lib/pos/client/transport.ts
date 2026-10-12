// Envoi des mutations de la caisse au serveur. NAVIGATEUR uniquement.
//
// La SIGNATURE de `envoyerMutation` est figée : l'écran de caisse l'appelle
// pour toute écriture (vente, ouverture / fermeture de caisse…), sans savoir
// si le réseau est là.
//
// - Sans le mode hors ligne (drapeau `offline_pos` éteint) : envoi direct, EN
//   LIGNE seulement — une coupure rend `{ ok: false, code: "hors_ligne" }`.
// - Avec le mode hors ligne : le moteur (lib/pos/hors-ligne/moteur.ts) pose un
//   RELAIS ici. Une vente qui ne peut pas partir est alors enregistrée sur
//   l'appareil, mise en file avec la MÊME clé, et rejouée au retour du réseau.
//   Ce fichier ne connaît pas le moteur : il appelle le relais s'il existe.
//
// La clé d'idempotence voyage dans le corps (`cle`) ET dans l'en-tête
// `Idempotency-Key` : rejouer le même appel ne crée jamais de doublon.

/** Types de mutation connus et leur route. */
export const ROUTES_MUTATION: Record<string, { url: string; method: "POST" | "PATCH" }> = {
  "vente": { url: "/api/pos/ventes", method: "POST" },
  "caisse.ouvrir": { url: "/api/pos/sessions", method: "POST" },
  "caisse.fermer": { url: "/api/pos/sessions/fermer", method: "POST" },
  "panier.suspendre": { url: "/api/pos/ventes/suspendus", method: "POST" },
};

export type Reponse<T = any> =
  | { ok: true; donnees: T; /** true = déjà enregistrée lors d'un envoi précédent, aucun doublon créé */ rejoue: boolean }
  | {
      ok: false;
      /** hors_ligne | non_connecte | non_autorise | conflit | invalide | stock_insuffisant | … (codes d'ErreurPos) */
      code: string;
      /** Phrase à afficher telle quelle. */
      message: string;
      status: number;
      details?: Record<string, unknown>;
    };

export type OptionsEnvoi = {
  caisseId?: string | null;
  /** Abandonne l'attente après ce délai (ms) et rend « hors_ligne ». Sans risque : la même clé sera rejouée. */
  delaiMs?: number;
};

/** Clé d'idempotence d'une action de l'utilisateur : à générer UNE fois, puis à réutiliser à chaque nouvel essai. */
export function nouvelleCle(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/** Envoi JSON idempotent vers une route de la caisse. Ne lève jamais. */
export async function envoyerJson<T = any>(url: string, method: "POST" | "PATCH", corps: Record<string, unknown>, cle: string, options: OptionsEnvoi = {}): Promise<Reponse<T>> {
  const abandon = options.delaiMs ? new AbortController() : null;
  const minuterie = abandon ? setTimeout(() => abandon.abort(), options.delaiMs) : null;
  let r: Response;
  try {
    r = await fetch(url, {
      method, signal: abandon?.signal,
      headers: { "Content-Type": "application/json", "Idempotency-Key": cle, ...(options.caisseId ? { "x-pos-caisse": options.caisseId } : {}) },
      body: JSON.stringify({ ...corps, cle }),
    });
  } catch {
    return { ok: false, code: "hors_ligne", status: 0, message: "Connexion interrompue. L'opération n'a pas été envoyée : réessayez dès que le réseau revient." };
  } finally {
    if (minuterie) clearTimeout(minuterie);
  }
  const reponse = await r.json().catch(() => ({}));
  if (!r.ok) {
    return {
      ok: false, status: r.status, details: reponse.details,
      code: reponse.code ?? (r.status === 401 ? "non_connecte" : r.status === 403 ? "non_autorise" : r.status === 409 ? "conflit" : "erreur_serveur"),
      message: reponse.error ?? "Un problème est survenu. Réessayez dans un instant.",
    };
  }
  return { ok: true, donnees: reponse as T, rejoue: reponse.rejoue === true };
}

/**
 * Relais du mode hors ligne : reçoit la mutation et la fonction d'envoi direct,
 * décide (envoyer, ou enregistrer sur l'appareil). null = pas de mode hors ligne.
 */
export type RelaisMutation = (type: string, payload: Record<string, unknown>, cle: string, options: OptionsEnvoi, direct: (o?: OptionsEnvoi) => Promise<Reponse<any>>) => Promise<Reponse<any>>;
let relais: RelaisMutation | null = null;
export function definirRelaisHorsLigne(r: RelaisMutation | null) { relais = r; }

/**
 * Envoie une mutation. Ne lève jamais : le résultat dit ce qui s'est passé.
 * `caisseId` (facultatif) désigne la caisse de travail (en-tête x-pos-caisse).
 * Une vente enregistrée hors ligne rend `ok: true` avec `donnees.provisoire = true`
 * (numéro provisoire, en attente de synchronisation).
 */
export async function envoyerMutation<T = any>(type: string, payload: Record<string, unknown>, cle: string, options: { caisseId?: string | null } = {}): Promise<Reponse<T>> {
  const route = ROUTES_MUTATION[type];
  if (!route) return { ok: false, code: "invalide", status: 400, message: "Cette opération n'est pas reconnue par la caisse." };
  const direct = (o: OptionsEnvoi = {}) => envoyerJson<T>(route.url, route.method, payload, cle, { ...options, ...o });
  return relais ? relais(type, payload, cle, options, direct) : direct();
}
