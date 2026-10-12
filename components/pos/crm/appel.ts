// Appel d'une route /api/pos depuis un écran du lot clients / promotions /
// fidélité / crédit. Ne lève jamais : rend la même forme que envoyerMutation
// (lib/pos/client/transport.ts), pour que <EtatPos code message /> s'en serve tel quel.
import type { Reponse } from "@/lib/pos/client/transport";

export { nouvelleCle } from "@/lib/pos/client/transport";
export type { Reponse };

export async function appelPos<T = any>(url: string, o: { method?: "GET" | "POST" | "PATCH" | "DELETE"; corps?: Record<string, unknown>; cle?: string; caisseId?: string | null; signal?: AbortSignal } = {}): Promise<Reponse<T>> {
  let r: Response;
  try {
    r = await fetch(url, {
      method: o.method ?? (o.corps ? "POST" : "GET"), signal: o.signal, cache: "no-store",
      headers: { ...(o.corps ? { "Content-Type": "application/json" } : {}), ...(o.cle ? { "Idempotency-Key": o.cle } : {}), ...(o.caisseId ? { "x-pos-caisse": o.caisseId } : {}) },
      body: o.corps ? JSON.stringify(o.cle ? { ...o.corps, cle: o.cle } : o.corps) : undefined,
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return { ok: false, code: "annule", status: 0, message: "" };
    return { ok: false, code: "hors_ligne", status: 0, message: "Connexion interrompue. Rien n'a été envoyé : réessayez dès que le réseau revient." };
  }
  const corps = await r.json().catch(() => ({}));
  if (!r.ok) {
    return {
      ok: false, status: r.status, details: corps.details,
      code: corps.code ?? (r.status === 401 ? "non_connecte" : r.status === 403 ? "non_autorise" : r.status === 404 ? "indisponible" : r.status === 409 ? "conflit" : "erreur_serveur"),
      message: corps.error ?? (r.status === 404 ? "Cette fonction n'est pas encore disponible." : "Un problème est survenu. Réessayez dans un instant."),
    };
  }
  return { ok: true, donnees: corps as T, rejoue: corps.rejoue === true };
}
