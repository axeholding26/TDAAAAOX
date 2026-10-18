"use client";

// AI Course Studio : liste des studios, nouveau brief, plafond IA du mois, fournisseurs configurés.
// Créer un studio ne coûte rien : chaque génération annonce son coût et attend l'accord du marchand.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GraduationCap, Loader2, Plus, Wallet, Cpu } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { STATUT_STUDIO } from "./statuts";

interface Studio { id: string; titre: string; statut: string; etape: number; produitId: string | null; updatedAt: string }
interface Budget { plafond: number; depense: number; reste: number; defaut: boolean }
interface Fournisseur { id: string; nom: string; configure: boolean; variables: string[]; remarque: string | null; capacites: string[] }
interface Donnees { studios: Studio[]; budget: Budget; fournisseurs: Fournisseur[]; formations: { id: string; nom: string }[] }

const champ = "w-full border border-[#E8E8E8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#111111]";

export default function StudioPage() {
  const t = useT();
  const router = useRouter();
  const [d, setD] = useState<Donnees | null>(null);
  const [nouveau, setNouveau] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [plafond, setPlafond] = useState("");
  const [f, setF] = useState({ theme: "", public: "", niveau: "debutant", objectifs: "", dureeHeures: "3", langue: "français", ton: "chaleureux et concret", prix: "", sources: "", formationExistanteId: "" });

  const charger = useCallback(async () => {
    const r = await fetch("/api/academie/studio");
    if (r.ok) { const j = await r.json(); setD(j); setPlafond(String(j.budget.plafond)); }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  async function creer(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    const r = await fetch("/api/academie/studio", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...f, dureeHeures: Number(f.dureeHeures) || 3, prix: f.prix ? Number(f.prix) : undefined,
        formationExistanteId: f.formationExistanteId || undefined,
      }),
    });
    const j = await r.json().catch(() => ({}));
    setEnvoi(false);
    if (!r.ok) return toast.error(j.details?.join(" · ") ?? j.error ?? t("Création impossible"));
    router.push(`/dashboard/produits/studio/${j.studio.id}`);
  }

  async function majPlafond() {
    const r = await fetch("/api/academie/studio", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plafond: plafond === "" ? null : Number(plafond) }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { toast.success(t("Plafond enregistré")); charger(); } else toast.error(j.error ?? t("Action impossible"));
  }

  if (!d) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#111111] flex items-center gap-2"><GraduationCap size={22} className="text-[#F5A623]" />{t("Studio de cours IA")}</h1>
          <p className="text-sm text-[#666666] mt-1">{t("Ton expertise devient une formation : curriculum, leçons, quiz, page de vente. Tu valides chaque étape, rien n'est publié sans toi.")}</p>
        </div>
        <button onClick={() => setNouveau((v) => !v)} className="flex items-center gap-1.5 text-sm bg-[#111111] text-white px-4 py-2 rounded-xl hover:bg-black"><Plus size={14} />{t("Nouvelle formation")}</button>
      </div>

      {nouveau && (
        <form onSubmit={creer} className="bg-white border border-[#E8E8E8] rounded-2xl p-5 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs font-medium text-[#666666] sm:col-span-2">{t("Thème de la formation")} *
              <input required minLength={3} maxLength={200} value={f.theme} onChange={(e) => setF({ ...f, theme: e.target.value })} className={champ} placeholder={t("Ex. : Lancer sa boutique de pagnes sur WhatsApp")} /></label>
            <label className="text-xs font-medium text-[#666666]">{t("Public visé")}
              <input maxLength={300} value={f.public} onChange={(e) => setF({ ...f, public: e.target.value })} className={champ} /></label>
            <label className="text-xs font-medium text-[#666666]">{t("Niveau")}
              <select value={f.niveau} onChange={(e) => setF({ ...f, niveau: e.target.value })} className={champ}>
                <option value="debutant">{t("Débutant")}</option><option value="intermediaire">{t("Intermédiaire")}</option><option value="avance">{t("Avancé")}</option>
              </select></label>
            <label className="text-xs font-medium text-[#666666] sm:col-span-2">{t("Objectifs : ce que l'apprenant saura faire")}
              <textarea maxLength={1500} rows={2} value={f.objectifs} onChange={(e) => setF({ ...f, objectifs: e.target.value })} className={champ} /></label>
            <label className="text-xs font-medium text-[#666666]">{t("Durée totale (heures)")}
              <input type="number" min={0.5} max={200} step={0.5} value={f.dureeHeures} onChange={(e) => setF({ ...f, dureeHeures: e.target.value })} className={champ} /></label>
            <label className="text-xs font-medium text-[#666666]">{t("Prix envisagé")}
              <input type="number" min={0} value={f.prix} onChange={(e) => setF({ ...f, prix: e.target.value })} className={champ} /></label>
            <label className="text-xs font-medium text-[#666666]">{t("Langue")}
              <input maxLength={30} value={f.langue} onChange={(e) => setF({ ...f, langue: e.target.value })} className={champ} /></label>
            <label className="text-xs font-medium text-[#666666]">{t("Ton")}
              <input maxLength={100} value={f.ton} onChange={(e) => setF({ ...f, ton: e.target.value })} className={champ} /></label>
            {d.formations.length > 0 && (
              <label className="text-xs font-medium text-[#666666] sm:col-span-2">{t("Améliorer une formation existante (facultatif)")}
                <select value={f.formationExistanteId} onChange={(e) => setF({ ...f, formationExistanteId: e.target.value })} className={champ}>
                  <option value="">{t("Non, nouvelle formation")}</option>
                  {d.formations.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}
                </select></label>
            )}
            <label className="text-xs font-medium text-[#666666] sm:col-span-2">{t("Tes sources (texte collé : notes, plan, extraits de tes documents)")}
              <textarea maxLength={40000} rows={5} value={f.sources} onChange={(e) => setF({ ...f, sources: e.target.value })} className={champ} />
              <span className="block mt-1 font-normal text-[#AAAAAA]">{t("Seules références que l'IA a le droit de citer. Les PDF/Word ne sont pas lus automatiquement : copie-colle leur texte.")} ({f.sources.length}/40000)</span></label>
          </div>
          <div className="flex justify-end">
            <button disabled={envoi} className="flex items-center gap-1.5 text-sm bg-[#111111] text-white px-4 py-2 rounded-xl disabled:opacity-50">
              {envoi && <Loader2 size={14} className="animate-spin" />}{t("Créer le studio (gratuit)")}
            </button>
          </div>
        </form>
      )}

      {d.studios.length === 0 ? (
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-10 text-center text-sm text-[#666666]">{t("Aucun studio pour l'instant.")}</div>
      ) : (
        <ul className="space-y-2">
          {d.studios.map((s) => {
            const st = STATUT_STUDIO[s.statut] ?? STATUT_STUDIO.brouillon;
            return (
              <li key={s.id}>
                <Link href={`/dashboard/produits/studio/${s.id}`} className="flex items-center justify-between gap-3 bg-white border border-[#E8E8E8] rounded-2xl p-4 hover:border-[#111111]">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#111111] truncate">{s.titre}</p>
                    <p className="text-xs text-[#AAAAAA]">{t("Étape")} {s.etape}/6 · {new Date(s.updatedAt).toLocaleDateString("fr-FR")}</p>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ color: st.couleur, background: st.fond }}>{t(st.label)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-5">
          <p className="font-semibold text-[#111111] flex items-center gap-2"><Wallet size={16} />{t("Budget IA du mois")}</p>
          <p className="text-sm text-[#666666] mt-2">{d.budget.depense} / {d.budget.plafond} FCFA {t("utilisés")} · {d.budget.reste} FCFA {t("restants")}{d.budget.defaut ? ` (${t("plafond par défaut")})` : ""}</p>
          <div className="h-1.5 rounded-full bg-[#F3F4F6] mt-2 overflow-hidden"><div className="h-full bg-[#F5A623]" style={{ width: `${Math.min(100, (d.budget.depense / Math.max(1, d.budget.plafond)) * 100)}%` }} /></div>
          <div className="flex gap-2 mt-3">
            <input type="number" min={0} max={200000} value={plafond} onChange={(e) => setPlafond(e.target.value)} className={champ} aria-label={t("Plafond mensuel (FCFA)")} />
            <button onClick={majPlafond} className="text-sm border border-[#E8E8E8] px-3 rounded-xl hover:border-[#111111]">{t("Enregistrer")}</button>
          </div>
          <p className="text-xs text-[#AAAAAA] mt-2">{t("Tuteur IA des apprenants et générations du studio sont décomptés de ce plafond.")}</p>
        </div>
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-5">
          <p className="font-semibold text-[#111111] flex items-center gap-2"><Cpu size={16} />{t("Fournisseurs IA")}</p>
          <ul className="mt-2 space-y-1.5 text-xs">
            {d.fournisseurs.map((x) => (
              <li key={x.id} className="flex items-start gap-2">
                <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${x.configure ? "bg-[#16A34A]" : "bg-[#D1D5DB]"}`} />
                <span><b>{x.nom}</b> — {x.configure ? `${t("configuré")}${x.capacites.length ? ` (${x.capacites.join(", ")})` : ""}` : `${t("non configuré")} : ${x.variables.join(", ")}`}{x.remarque ? <span className="text-[#AAAAAA]"> · {x.remarque}</span> : null}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
