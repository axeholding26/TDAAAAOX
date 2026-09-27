// Taux de change du jour (server-only) : 1 XAF = x devise, même forme que
// XAF_TO. Réponse mise en cache 24 h par Next (un seul appel par jour et par
// instance) ; si la source ne répond pas, repli sur les taux fixes de
// lib/devise-convert.ts — la vitrine ne casse jamais pour une question de taux.
import { XAF_TO } from "./devise-convert";

export async function tauxDuJour(): Promise<Record<string, number>> {
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/XAF", { next: { revalidate: 86400 }, signal: AbortSignal.timeout(3000) });
    const d = await r.json();
    if (d?.result === "success" && d.rates) return { ...XAF_TO, ...d.rates, XAF: 1, XOF: 1 }; // XOF = XAF : parité fixe
  } catch {}
  return XAF_TO;
}
