"use client";
// « Donnez votre avis sur Axso » : carte de l'accueil marchand. L'avis part en
// validation (/admin/avis) puis s'affiche sur la landing, avec l'accord du marchand.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Star, X, Loader2, MessageSquareHeart, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/components/I18nProvider";

export interface AvisExistant { note: number; texte: string; auteurNom: string; auteurRole: string | null; ville: string | null; statut: string; motifRefus: string | null }

const CLE_PLUS_TARD = "axso-avis-plus-tard";

export function AvisAxsoCarte({ avis, nomParDefaut }: { avis: AvisExistant | null; nomParDefaut: string }) {
  const t = useT();
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [masque, setMasque] = useState(false);
  // « Plus tard » mémorisé 7 jours dans ce navigateur (lu après le montage : pas d'écart d'hydratation).
  useEffect(() => {
    if (avis) return;
    try { if (Number(localStorage.getItem(CLE_PLUS_TARD) ?? 0) > Date.now()) setMasque(true); } catch {}
  }, [avis]);
  const [note, setNote] = useState(avis?.note ?? 0);
  const [survol, setSurvol] = useState(0);
  const [form, setForm] = useState({ texte: avis?.texte ?? "", auteurNom: avis?.auteurNom ?? nomParDefaut, auteurRole: avis?.auteurRole ?? "", ville: avis?.ville ?? "", consentement: !!avis });
  const [charge, setCharge] = useState(false);

  if (masque) return null;

  const plusTard = () => { try { localStorage.setItem(CLE_PLUS_TARD, String(Date.now() + 7 * 86_400_000)); } catch {} setMasque(true); };
  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note) return toast.error(t("Choisissez une note de 1 à 5 étoiles"));
    setCharge(true);
    const r = await fetch("/api/avis-plateforme", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, note }) }).catch(() => null);
    const d = await r?.json().catch(() => ({}));
    setCharge(false);
    if (!r?.ok) return toast.error(d?.error ?? t("Envoi impossible"));
    toast.success(t("Merci ! Votre avis sera publié après relecture par l'équipe Axso."));
    setOuvert(false);
    router.refresh();
  };

  const statut = avis?.statut;
  const Etat = statut === "approuve" ? CheckCircle2 : statut === "refuse" ? AlertCircle : Clock;

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border" style={{ background: "#FFFFFF", borderColor: "rgba(0,0,0,0.08)" }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(245,166,35,0.14)" }}>
          {avis ? <Etat size={16} style={{ color: statut === "approuve" ? "#16A34A" : statut === "refuse" ? "#DC2626" : "#F5A623" }} /> : <MessageSquareHeart size={16} style={{ color: "#F5A623" }} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#111111]">
            {!avis ? t("Que pensez-vous d'Axso ?") : statut === "approuve" ? t("Votre avis est publié sur axsoafrica.com") : statut === "refuse" ? t("Votre avis n'a pas été publié") : t("Votre avis est en cours de relecture")}
          </p>
          <p className="text-xs leading-snug text-[#666666]">
            {!avis ? t("Votre avis aide d'autres commerçants à se lancer. Il est publié sur notre site après relecture, uniquement avec votre accord.")
              : statut === "refuse" ? `${t("Motif")} : ${avis.motifRefus ?? "—"}` : `${"★".repeat(avis.note)}${"☆".repeat(5 - avis.note)} · « ${avis.texte.slice(0, 90)}${avis.texte.length > 90 ? "…" : ""} »`}
          </p>
        </div>
        <button onClick={() => setOuvert(true)} className="flex-shrink-0 text-xs font-bold px-3.5 py-2 rounded-full text-white whitespace-nowrap" style={{ background: "#F5A623" }}>
          {avis ? t("Modifier") : t("Donner mon avis")}
        </button>
        {!avis && <button onClick={plusTard} className="flex-shrink-0 p-1.5 rounded-lg text-[#999999] hover:bg-black/5" aria-label={t("Plus tard")} title={t("Plus tard")}><X size={14} /></button>}
      </div>

      {ouvert && (
        <div className="fixed inset-0 z-[80] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && setOuvert(false)} role="dialog" aria-modal="true" aria-label={t("Donner mon avis sur Axso")}>
          <form onSubmit={envoyer} className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#111111]">{t("Votre avis sur Axso")}</h2>
                <p className="text-xs text-[#666666] mt-0.5">{t("Relu par l'équipe Axso avant publication. Toute modification repasse en relecture.")}</p>
              </div>
              <button type="button" onClick={() => setOuvert(false)} className="p-1.5 rounded-lg hover:bg-black/5" aria-label={t("Fermer")}><X size={16} /></button>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#333333] mb-1.5">{t("Votre note")}</p>
              <div className="flex gap-1" onMouseLeave={() => setSurvol(0)} role="radiogroup" aria-label={t("Note sur 5")}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={note === n} aria-label={`${n} / 5`} onMouseEnter={() => setSurvol(n)} onClick={() => setNote(n)} className="p-0.5">
                    <Star size={28} fill={(survol || note) >= n ? "#F5A623" : "none"} style={{ color: (survol || note) >= n ? "#F5A623" : "#CCCCCC" }} />
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="text-xs font-semibold text-[#333333]">{t("Votre expérience")}</span>
              <textarea required minLength={30} maxLength={600} rows={5} value={form.texte} onChange={(e) => setForm({ ...form, texte: e.target.value })}
                placeholder={t("Qu'est-ce qu'Axso a changé pour votre commerce ?")} className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-[#F5A623]" />
              <span className="text-[11px] text-[#999999]">{form.texte.trim().length}/600 · {t("30 caractères minimum")}</span>
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-semibold text-[#333333]">{t("Nom affiché")}</span>
                <input required minLength={2} maxLength={60} value={form.auteurNom} onChange={(e) => setForm({ ...form, auteurNom: e.target.value })} placeholder="Fatou N." className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-[#F5A623]" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[#333333]">{t("Fonction (facultatif)")}</span>
                <input maxLength={80} value={form.auteurRole} onChange={(e) => setForm({ ...form, auteurRole: e.target.value })} placeholder={t("Fondatrice")} className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-[#F5A623]" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold text-[#333333]">{t("Ville (facultatif)")}</span>
                <input maxLength={60} value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} placeholder="Douala" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-[#F5A623]" />
              </label>
            </div>
            <label className="flex items-start gap-2.5 text-xs text-[#444444]">
              <input type="checkbox" required checked={form.consentement} onChange={(e) => setForm({ ...form, consentement: e.target.checked })} className="mt-0.5 accent-[#F5A623]" />
              <span>{t("J'accepte qu'Axso publie cet avis sur son site avec le nom affiché, ma ville et le nom de ma boutique.")}</span>
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOuvert(false)} className="text-sm font-semibold px-4 py-2 rounded-full border border-black/10">{t("Annuler")}</button>
              <button disabled={charge} className="text-sm font-bold px-5 py-2 rounded-full text-white flex items-center gap-1.5 disabled:opacity-60" style={{ background: "#F5A623" }}>
                {charge && <Loader2 size={14} className="animate-spin" />}{t("Envoyer mon avis")}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
