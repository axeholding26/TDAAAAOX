// Appels de lecture de l'écran de caisse. Les écritures critiques (vente,
// ouverture de caisse, suspension) passent par envoyerMutation
// (lib/pos/client/transport.ts) ; ici, même forme de réponse pour le reste.
import type { Reponse } from "@/lib/pos/client/transport";
import type { DefinitionModePaiement } from "@/lib/pos/paiements";
import type { DroitsPos, ReglagesPosComplets } from "@/lib/pos/types";

/** Caisse de travail retenue sur ce poste (localStorage). */
export const CLE_CAISSE = "axso_pos_caisse";

/** Réponse de GET /api/pos/reglages : tout ce qu'il faut pour démarrer l'écran. */
export type Demarrage = ReglagesPosComplets & {
  sessionObligatoire: boolean;
  droits: DroitsPos;
  utilisateur: { id: string; nom: string; appareilId: string | null };
  boutique: { nomBoutique: string; devise: string; tauxTVA: number; pays: string | null; logoUrl: string | null; adresse: string | null; telephone: string | null };
  magasin: { id: string; nom: string; ville: string | null; adresse: string | null; telephone: string | null } | null;
  caisse: { id: string; nom: string } | null;
  session: { id: string; ouvertePar: string; ouverteAt: string; fondsInitial: number; nbVentes: number } | null;
  modesPaiement: DefinitionModePaiement[];
};

/**
 * Appel JSON vers une route de la caisse. Ne lève jamais.
 * Code `indisponible` : la route n'existe pas (encore) sur ce serveur — à
 * afficher comme une fonction indisponible, pas comme une erreur.
 * Code `annule` : requête abandonnée (frappe suivante), à ignorer.
 */
export async function appelPos<T = any>(url: string, o: OptionsAppel = {}): Promise<Reponse<T>> {
  return repli ? repli(url, o, () => appelDirect<T>(url, o)) : appelDirect<T>(url, o);
}

type OptionsAppel = { method?: "GET" | "POST" | "PATCH"; corps?: unknown; caisseId?: string | null; signal?: AbortSignal };

/**
 * Repli du mode hors ligne (drapeau `offline_pos`) : reçoit l'appel et la
 * fonction qui le fait vraiment, et peut répondre depuis le catalogue gardé sur
 * l'appareil quand le réseau manque. null (défaut) : appel direct, comme toujours.
 * Posé par components/pos/hors-ligne/useHorsLigne.ts.
 */
type Repli = (url: string, o: OptionsAppel, reseau: () => Promise<Reponse<any>>) => Promise<Reponse<any>>;
let repli: Repli | null = null;
export function definirRepliHorsLigne(r: Repli | null) { repli = r; }

async function appelDirect<T = any>(url: string, o: OptionsAppel): Promise<Reponse<T>> {
  let r: Response;
  try {
    r = await fetch(url, {
      method: o.method ?? "GET", signal: o.signal, cache: "no-store",
      headers: { ...(o.corps !== undefined ? { "Content-Type": "application/json" } : {}), ...(o.caisseId ? { "x-pos-caisse": o.caisseId } : {}) },
      body: o.corps !== undefined ? JSON.stringify(o.corps) : undefined,
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return { ok: false, code: "annule", status: 0, message: "" };
    return { ok: false, code: "hors_ligne", status: 0, message: "Connexion interrompue. Vérifiez le réseau puis réessayez." };
  }
  const corps = await r.json().catch(() => null);
  if (!r.ok) {
    return {
      ok: false, status: r.status, details: corps?.details,
      code: corps?.code ?? (r.status === 404 ? "indisponible" : r.status === 401 ? "non_connecte" : r.status === 403 ? "non_autorise" : r.status === 409 ? "conflit" : "erreur_serveur"),
      message: corps?.error ?? corps?.message ?? (r.status === 404 ? "Cette fonction n'est pas encore disponible sur cette caisse." : "Un problème est survenu. Réessayez dans un instant."),
    };
  }
  return { ok: true, donnees: (corps ?? {}) as T, rejoue: corps?.rejoue === true };
}
