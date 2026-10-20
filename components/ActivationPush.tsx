"use client";

// Active les notifications push sur CET appareil (téléphone, ordinateur) : enregistre
// public/sw.js, abonne le navigateur avec la clé VAPID d'Axso et l'envoie à /api/push.
// Ensuite les alertes s'affichent comme toute notification de l'appareil, onglet ou appli
// fermés. iPhone/iPad : seulement une fois Axso ajouté à l'écran d'accueil (règle d'Apple).
import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { useT } from "@/components/I18nProvider";

type Espace = "dashboard" | "admin" | "livreur";
type Etat = "chargement" | "absent" | "ios" | "refuse" | "inactif" | "actif";

function cleEnOctets(b64: string) {
  const s = (b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
const lire = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const ecrire = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* stockage indisponible */ } };

async function enregistrer(espace: Espace, sub: PushSubscription) {
  const r = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ espace, abonnement: sub.toJSON() }) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erreur ?? "Abonnement refusé");
}

/** Vrai si cet appareil reçoit déjà les push d'Axso. */
export async function abonnePush(): Promise<boolean> {
  try { return !!(await (await navigator.serviceWorker?.getRegistration("/"))?.pushManager.getSubscription()); } catch { return false; }
}

/** Rouvre la carte d'activation (bouton de la cloche). */
export const ouvrirReglagePush = () => window.dispatchEvent(new Event("axso:push"));

export function ActivationPush({ espace }: { espace: Espace }) {
  const t = useT();
  const [etat, setEtat] = useState<Etat>("chargement");
  const [ferme, setFerme] = useState(true);
  const [info, setInfo] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const cle = `axso_push_ferme_${espace}`;

  useEffect(() => {
    setFerme(lire(cle) === "1");
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const installee = matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setEtat(ios && !installee ? "ios" : "absent");
      if (Notification.permission === "denied") return setEtat("refuse");
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      const sub = await reg.pushManager.getSubscription();
      if (sub && Notification.permission === "granted") {
        await enregistrer(espace, sub).catch(() => {}); // garde le serveur à jour (clés renouvelées, autre compte)
        return setEtat("actif");
      }
      setEtat("inactif");
    })().catch(() => setEtat("absent"));
  }, [espace, cle]);

  // Rouvert depuis la cloche (ouvrirReglagePush) : même fermé, ou déjà actif.
  useEffect(() => {
    const ouvrir = () => { setFerme(false); setEtat((e) => { if (e === "actif") setInfo(t("Notifications actives sur cet appareil.")); return e; }); };
    window.addEventListener("axso:push", ouvrir);
    return () => window.removeEventListener("axso:push", ouvrir);
  }, [t]);

  async function activer() {
    setOccupe(true); setInfo(null);
    try {
      if ((await Notification.requestPermission()) !== "granted") { setEtat("refuse"); return; }
      const r = await fetch("/api/push");
      const { cle: vapid, erreur } = await r.json();
      if (!vapid) throw new Error(erreur ?? "Notifications indisponibles");
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cleEnOctets(vapid) });
      await enregistrer(espace, sub);
      setEtat("actif");
      await tester();
    } catch (e) {
      setInfo(e instanceof Error ? e.message : t("Activation impossible"));
    } finally { setOccupe(false); }
  }

  async function tester() {
    const r = await fetch("/api/push?test=1", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ espace }) });
    setInfo(r.ok ? t("Notification d'essai envoyée : elle doit apparaître sur cet appareil.") : t("L'essai n'a pas pu être envoyé."));
  }

  const fermer = () => { ecrire(cle, "1"); setFerme(true); };
  if (etat === "chargement" || etat === "absent" || (ferme && etat !== "actif") || (etat === "actif" && !info)) return null;

  const texte = etat === "ios" ? t("Sur iPhone : touche Partager puis « Sur l'écran d'accueil », ouvre Axso depuis l'icône, puis active les notifications.")
    : etat === "refuse" ? t("Notifications bloquées : autorise-les pour ce site dans les réglages du navigateur ou du téléphone.")
    : etat === "actif" ? info
    : t("Reçois tes alertes sur cet appareil, comme un SMS : même l'appli fermée.");

  return (
    <div role="status" className="fixed bottom-4 left-4 z-[9999] w-[330px] max-w-[calc(100vw-2rem)] rounded-2xl p-4 shadow-2xl border-2"
      style={{ background: "#111111", borderColor: "#F5A623", color: "#FFFFFF", fontFamily: "'Poppins',system-ui,sans-serif" }}>
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#F5A623", color: "#111111" }}><BellRing size={18} /></span>
        <p className="flex-1 text-[13px] leading-snug">{texte}</p>
        <button onClick={etat === "actif" ? () => setInfo(null) : fermer} aria-label={t("Fermer")} className="text-white/50 hover:text-white"><X size={16} /></button>
      </div>
      {info && etat !== "actif" && <p className="text-[12px] text-red-300 mt-2">{info}</p>}
      {etat === "inactif" && (
        <button onClick={activer} disabled={occupe} className="mt-3 w-full h-10 rounded-xl text-[13.5px] font-bold disabled:opacity-60" style={{ background: "#F5A623", color: "#111111" }}>
          {occupe ? t("Activation…") : t("Activer les notifications")}
        </button>
      )}
      {etat === "actif" && <button onClick={tester} className="mt-2 text-[12px] text-white/60 hover:text-white underline">{t("Renvoyer un essai")}</button>}
    </div>
  );
}
