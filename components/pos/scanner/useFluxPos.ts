"use client";
// Flux temps réel de la caisse côté navigateur (GET /api/pos/flux).
//
//   const { etat, enLigne } = useFluxPos({ caisseId, surEvenement: (e) => … });
//
// Options :
// - caisseId     : caisse écoutée (défaut : la caisse de travail résolue par le serveur).
// - portee       : "caisse" (défaut) ou "boutique" (supervision : tous les événements, droit voir_caisse).
// - actif        : false = ne pas se connecter (défaut true).
// - surEvenement : appelé pour CHAQUE événement reçu ({ seq, type, magasinId, caisseId, payload, createdAt }),
//                  dont `scan.created` (payload.article = article résolu, sans prix d'achat),
//                  `device.connected`, `device.disconnected`, `sale.created`, `cash.opened`…
// Rend :
// - etat    : "connexion" | "en_ligne" (SSE) | "repli" (interrogation périodique, ça marche) |
//             "hors_ligne" (réseau coupé, reprise automatique) | "refuse" (session expirée ou droit manquant).
// - enLigne : etat est "en_ligne" ou "repli".
//
// Ce que le hook fait seul :
// - Il réémet sur le bus local (lib/pos/client/bus → surScan) les scans des TÉLÉPHONES appairés à la
//   caisse : l'écran de caisse les reçoit comme ceux de la caméra ou du scanner USB, sans bouton
//   « envoyer ». Un code ambigu ou un article retiré de la vente n'est pas relayé (voir payload.etat).
// - Reconnexion automatique avec reprise au dernier événement reçu ; après 3 échecs de suite, repli
//   sur l'interrogation périodique (2 s), puis nouvel essai du flux toutes les 60 s.
// - Une seule connexion par caisse et par onglet, partagée entre tous les composants qui l'utilisent.
import { useEffect, useRef, useState } from "react";
import { emettreScan } from "@/lib/pos/client/bus";
import type { ContexteScan } from "@/lib/pos/types";
import { scanARelayer, type EvenementFlux } from "@/lib/pos/scanner/regles";

export type EtatFlux = "connexion" | "en_ligne" | "repli" | "hors_ligne" | "refuse";
export type { EvenementFlux };

const PAS_REPLI_MS = 2000;
const RETOUR_SSE_MS = 60_000;
const ECHECS_AVANT_REPLI = 3;

type Canal = {
  etat: EtatFlux;
  ecouteurs: Set<(e: EvenementFlux) => void>;
  observateurs: Set<() => void>;
  arreter: () => void;
};
const canaux = new Map<string, Canal>();

function ouvrirCanal(caisseId: string | null, portee: "caisse" | "boutique"): Canal {
  const params = new URLSearchParams();
  if (caisseId) params.set("caisseId", caisseId);
  if (portee === "boutique") params.set("portee", "boutique");
  const adresse = (plus: Record<string, string>) => `/api/pos/flux?${new URLSearchParams({ ...Object.fromEntries(params), ...plus })}`;

  let curseur: string | null = null;
  let source: EventSource | null = null;
  let minuterie: ReturnType<typeof setTimeout> | null = null;
  let echecs = 0;
  let arrete = false;
  let debutRepli = 0;

  const canal: Canal = { etat: "connexion", ecouteurs: new Set(), observateurs: new Set(), arreter: () => {} };
  const passer = (etat: EtatFlux) => {
    if (canal.etat === etat) return;
    canal.etat = etat;
    canal.observateurs.forEach((o) => o());
  };
  const recevoir = (e: EvenementFlux) => {
    if (e.seq) curseur = e.seq;
    if (e.type === "pret") return;
    if (e.type === "scan.created" && scanARelayer(e.payload)) {
      const p = e.payload as { code: string; scanId: string; contexte?: ContexteScan; appareilId?: string | null };
      emettreScan({ code: p.code, source: "mobile", scanId: p.scanId, contexte: p.contexte, appareilId: p.appareilId ?? undefined });
    }
    for (const ecouteur of [...canal.ecouteurs]) {
      try { ecouteur(e); } catch (err) { console.error("[pos/flux]", err); }
    }
  };

  const ecouter = () => {
    if (arrete) return;
    if (navigator.onLine === false) passer("hors_ligne");
    // Reprise manuelle : le navigateur n'envoie Last-Event-ID que sur SES reconnexions.
    source = new EventSource(adresse(curseur ? { depuis: curseur } : {}));
    source.onopen = () => { echecs = 0; passer("en_ligne"); };
    source.onmessage = (m) => { try { recevoir(JSON.parse(m.data)); } catch { /* trame illisible : ignorée */ } };
    source.onerror = () => {
      // Fin normale de la connexion (échéance serveur) comme vraie panne : le navigateur réessaie seul.
      // Une première coupure isolée (l'échéance, toutes les 4 min 30) ne fait pas clignoter l'état.
      echecs++;
      if (navigator.onLine === false) passer("hors_ligne");
      else if (echecs > 1) passer("connexion");
      if (source?.readyState === EventSource.CLOSED || echecs >= ECHECS_AVANT_REPLI) {
        source?.close();
        source = null;
        debutRepli = Date.now();
        void interroger();
      }
    };
  };

  const interroger = async () => {
    if (arrete) return;
    let attente = PAS_REPLI_MS;
    try {
      const r = await fetch(adresse({ mode: "poll", ...(curseur ? { depuis: curseur } : {}) }), { cache: "no-store" });
      if (arrete) return;
      if (r.status === 401 || r.status === 403) { passer("refuse"); return; }
      if (!r.ok) throw new Error(String(r.status));
      const corps = (await r.json()) as { evenements: EvenementFlux[]; curseur: string };
      curseur = corps.curseur;
      corps.evenements.forEach(recevoir);
      passer("repli");
      if (Date.now() - debutRepli > RETOUR_SSE_MS && typeof EventSource !== "undefined") { echecs = 0; ecouter(); return; }
    } catch {
      passer(navigator.onLine === false ? "hors_ligne" : "connexion");
      attente = 4000;
    }
    minuterie = setTimeout(interroger, attente);
  };

  // Retour du réseau : on n'attend pas la prochaine échéance.
  const auRetour = () => {
    if (arrete || canal.etat === "refuse" || source) return;
    if (minuterie) clearTimeout(minuterie);
    void interroger();
  };
  window.addEventListener("online", auRetour);

  canal.arreter = () => {
    arrete = true;
    source?.close();
    if (minuterie) clearTimeout(minuterie);
    window.removeEventListener("online", auRetour);
  };
  if (typeof EventSource === "undefined") { debutRepli = Date.now(); void interroger(); } else ecouter();
  return canal;
}

export function useFluxPos(options: {
  caisseId?: string | null; portee?: "caisse" | "boutique"; actif?: boolean; surEvenement?: (e: EvenementFlux) => void;
} = {}): { etat: EtatFlux; enLigne: boolean } {
  const { caisseId = null, portee = "caisse", actif = true } = options;
  const cle = `${portee}:${caisseId ?? ""}`;
  const [etat, setEtat] = useState<EtatFlux>("connexion");
  const surEvenement = useRef(options.surEvenement);
  useEffect(() => { surEvenement.current = options.surEvenement; });

  useEffect(() => {
    if (!actif) return;
    let canal = canaux.get(cle);
    if (!canal) canaux.set(cle, (canal = ouvrirCanal(caisseId, portee)));
    const c = canal;
    const ecouteur = (e: EvenementFlux) => surEvenement.current?.(e);
    const observateur = () => setEtat(c.etat);
    c.ecouteurs.add(ecouteur);
    c.observateurs.add(observateur);
    observateur();
    return () => {
      c.ecouteurs.delete(ecouteur);
      c.observateurs.delete(observateur);
      // Dernier abonné parti : on ferme, après un court délai pour survivre à un simple changement d'écran.
      setTimeout(() => {
        if (!c.ecouteurs.size && canaux.get(cle) === c) { c.arreter(); canaux.delete(cle); }
      }, 1000);
    };
  }, [cle, caisseId, portee, actif]);

  return { etat, enLigne: etat === "en_ligne" || etat === "repli" };
}
