"use client";
// Branchement du moteur hors ligne (lib/pos/hors-ligne/moteur.ts) sur l'écran
// de caisse : lectures (appelPos), panier en cours (store/posStore), service
// worker. Tant que le drapeau `offline_pos` est éteint et que rien n'attend sur
// ce poste, rien n'est branché.
import { useSyncExternalStore } from "react";
import { definirRepliHorsLigne, type Demarrage } from "@/components/pos/caisse/api";
import { abonner, demarrer, lireEtat, lirePanier, preparer, repliLectures, sauverPanier, type EtatHorsLigne } from "@/lib/pos/hors-ligne/moteur";
import { usePosStore } from "@/store/posStore";

const PORTEE = "/dashboard/pos/caisse";
const SERVEUR: EtatHorsLigne = lireEtat();

/** État du poste : en ligne ?, ventes en attente, âge du catalogue local. */
export function useHorsLigne(): EtatHorsLigne {
  return useSyncExternalStore(abonner, lireEtat, () => SERVEUR);
}

let branche = false;
let panierSuivi = false;
let swDemande = false;

/** Les lectures de la caisse passent par l'instantané local dès que (et seulement quand) le mode est en service. */
function brancher() {
  if (branche) return;
  branche = true;
  const appliquer = () => definirRepliHorsLigne(lireEtat().actif ? repliLectures : null);
  abonner(appliquer);
  appliquer();
}

type PanierGarde = Pick<ReturnType<typeof usePosStore.getState>, "lignes" | "remise" | "codePromo" | "client" | "note" | "cleVente">;

/** Restaure le panier laissé avant un rechargement, puis le garde à chaque changement (avec sa clé de vente). */
async function suivrePanier(): Promise<boolean> {
  if (panierSuivi || !lireEtat().actif) return false;
  panierSuivi = true;
  let restaure = false;
  const garde = await lirePanier<PanierGarde>().catch(() => null);
  if (garde?.lignes?.length && usePosStore.getState().lignes.length === 0) {
    usePosStore.setState({ lignes: garde.lignes, remise: garde.remise ?? null, codePromo: garde.codePromo ?? "", client: garde.client ?? null, note: garde.note ?? "", cleVente: garde.cleVente });
    restaure = true;
  }
  let minuterie: ReturnType<typeof setTimeout> | null = null;
  usePosStore.subscribe((s) => {
    if (minuterie) clearTimeout(minuterie);
    minuterie = setTimeout(() => {
      void sauverPanier(s.lignes.length ? { lignes: s.lignes, remise: s.remise, codePromo: s.codePromo, client: s.client, note: s.note, cleVente: s.cleVente } : null).catch(() => {});
    }, 150);
  });
  return restaure;
}

/**
 * Service worker de la caisse : garde la page et ses fichiers pour qu'un
 * rechargement sans réseau rouvre la caisse. Portée limitée à l'écran de caisse.
 * Drapeau éteint : il est désinstallé et son cache effacé.
 */
async function gererServiceWorker(actif: boolean) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    if (!actif) {
      const r = await navigator.serviceWorker.getRegistration(PORTEE);
      if (r) { await r.unregister(); for (const c of await caches.keys()) if (c.startsWith("axso-pos-")) await caches.delete(c); }
      return;
    }
    if (swDemande || !window.location.pathname.startsWith(PORTEE)) return;
    swDemande = true;
    const r = await navigator.serviceWorker.register("/sw-pos.js", { scope: PORTEE, updateViaCache: "none" });
    const pret = r.active ?? (await new Promise<ServiceWorker | null>((fin) => {
      const sw = r.installing ?? r.waiting;
      if (!sw) return fin(null);
      sw.addEventListener("statechange", () => { if (sw.state === "activated") fin(sw); else if (sw.state === "redundant") fin(null); });
    }));
    // Lecteur caméra (chargé à la demande d'habitude) : téléchargé maintenant pour rester utilisable sans réseau.
    await Promise.allSettled([import("@zxing/browser"), import("@zxing/library"), import("@/components/pos/scanner/BoutonScanner")]);
    // La page a été chargée avant que le service worker ne la contrôle : on lui dit quoi garder.
    const fichiers = performance.getEntriesByType("resource").map((e) => e.name).filter((u) => u.startsWith(window.location.origin + "/_next/static/"));
    pret?.postMessage({ type: "amorcer", page: window.location.pathname, fichiers });
  } catch (e) {
    console.warn("[pos hors ligne] service worker", (e as Error)?.message);
  }
}

/** Avant le premier appel de l'écran : si ce poste a déjà servi hors ligne, la caisse peut démarrer sans réseau. */
export async function preparerHorsLigne(): Promise<void> {
  if (await preparer().catch(() => false)) brancher();
}

/** L'écran a ses réglages. Rend true si un panier laissé avant un rechargement vient d'être restauré. */
export async function demarrerHorsLigne(d: Demarrage, caisseId: string | null): Promise<boolean> {
  await demarrer(d, caisseId).catch(() => {});
  const { actif, enLigne } = lireEtat();
  if (actif) brancher();
  // En ligne seulement : hors ligne, on ne touche pas à ce qui est installé.
  if (enLigne) void gererServiceWorker(actif && d.flags.offline_pos);
  return suivrePanier();
}
