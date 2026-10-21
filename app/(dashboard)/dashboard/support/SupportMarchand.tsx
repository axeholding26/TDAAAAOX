"use client";
// Formulaire « Signaler un problème » et suivi des signalements de la boutique (statut + réponse d'Axso).
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LifeBuoy, Loader2, Send, X } from "lucide-react";
import { MediaUpload } from "@/components/ui/MediaUpload";
import { useT } from "@/components/I18nProvider";
import { NOM_STATUT, CLE_DERNIERE_ERREUR, pageNormalisee, type StatutSignalement } from "@/lib/signalements";

interface Signalement { id: string; description: string; capture: string | null; page: string; statut: StatutSignalement; reponse: string | null; reponduLe: string | null; createdAt: string }
const COULEUR: Record<StatutSignalement, string> = { ouvert: "bg-red-50 text-red-600", en_cours: "bg-amber-50 text-amber-700", resolu: "bg-green-50 text-green-700" };

function derniereErreur(): string | null {
  try {
    const e = JSON.parse(sessionStorage.getItem(CLE_DERNIERE_ERREUR) ?? "null");
    return e && Date.now() - e.date < 3600_000 ? e.texte : null;
  } catch { return null; }
}

export function SupportMarchand({ depuis }: { depuis: string }) {
  const t = useT();
  const page = pageNormalisee(depuis) || "/dashboard";
  const [description, setDescription] = useState("");
  const [capture, setCapture] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [liste, setListe] = useState<Signalement[] | null>(null);

  const charger = () => fetch("/api/signalements").then((r) => r.json()).then((d) => setListe(d.signalements ?? [])).catch(() => setListe([]));
  useEffect(() => { setErreur(derniereErreur()); charger(); }, []);

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    const r = await fetch("/api/signalements", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, capture, page, erreur, ecran: `${screen.width}×${screen.height} (${innerWidth}×${innerHeight})` }),
    }).catch(() => null);
    const d = await r?.json().catch(() => ({}));
    setEnvoi(false);
    if (!r?.ok) return void toast.error(t(d?.error ?? "Envoi impossible, réessaie dans un instant."));
    toast.success(t("Merci ! L'équipe Axso a reçu ton signalement."));
    setDescription(""); setCapture(null); setErreur(null);
    try { sessionStorage.removeItem(CLE_DERNIERE_ERREUR); } catch {}
    charger();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-[#F5A623]/10 flex items-center justify-center"><LifeBuoy size={22} className="text-[#F5A623]" /></div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t("Signaler un problème")}</h1>
          <p className="text-sm text-gray-500">{t("Décris ce qui ne va pas : l'équipe Axso te répond ici.")}</p>
        </div>
      </div>

      <form onSubmit={envoyer} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <label className="block">
          <span className="text-sm font-semibold text-gray-800">{t("Que s'est-il passé ?")}</span>
          <textarea required minLength={10} maxLength={4000} rows={5} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder={t("Ce que tu faisais, ce que tu attendais, ce qui s'est passé à la place…")}
            className="mt-1.5 w-full rounded-xl border border-[#E8E8E8] p-3 text-[14px] outline-none focus:border-[#F5A623] focus:ring-2 focus:ring-[#F5A623]/20" />
        </label>
        <div>
          <span className="text-sm font-semibold text-gray-800">{t("Capture d'écran (facultatif)")}</span>
          {capture ? (
            <div className="mt-1.5 relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={capture} alt={t("Capture d'écran")} className="max-h-48 rounded-xl border border-gray-100" />
              <button type="button" onClick={() => setCapture(null)} aria-label={t("Retirer la capture")} className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center"><X size={14} /></button>
            </div>
          ) : <div className="mt-1.5"><MediaUpload type="image" onUrl={setCapture} /></div>}
        </div>
        <div className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3 space-y-1">
          <p className="font-semibold text-gray-600">{t("Joint automatiquement")}</p>
          <p>{t("Page : {0}", page)} · {t("ta boutique, ton compte, ton navigateur et ton appareil")}</p>
          {erreur && <p className="font-mono break-words">{t("Dernière erreur : {0}", erreur)} <button type="button" className="underline" onClick={() => setErreur(null)}>{t("ne pas joindre")}</button></p>}
        </div>
        <button disabled={envoi} className="flex items-center gap-2 px-5 py-2.5 bg-[#F5A623] text-[#111] font-semibold rounded-xl hover:bg-[#e8950f] disabled:opacity-60">
          {envoi ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}{t("Envoyer le signalement")}
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="text-base font-bold text-gray-900">{t("Mes signalements")}</h2>
        {liste == null ? <Loader2 size={18} className="animate-spin text-gray-400" /> : !liste.length ? <p className="text-sm text-gray-500">{t("Aucun signalement pour l'instant.")}</p> : liste.map((s) => (
          <div key={s.id} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-xs text-gray-400">{new Date(s.createdAt).toLocaleString(t.loc)} · {s.page}</span>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${COULEUR[s.statut] ?? ""}`}>{t(NOM_STATUT[s.statut] ?? s.statut)}</span>
            </div>
            <p className="text-sm text-gray-800 whitespace-pre-line break-words">{s.description}</p>
            {s.reponse && (
              <div className="mt-3 rounded-xl bg-[#F5A623]/8 border border-[#F5A623]/20 p-3">
                <p className="text-xs font-semibold text-[#b97a10] mb-1">{t("Réponse d'Axso")}{s.reponduLe ? ` · ${new Date(s.reponduLe).toLocaleDateString(t.loc)}` : ""}</p>
                <p className="text-sm text-gray-800 whitespace-pre-line break-words">{s.reponse}</p>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
