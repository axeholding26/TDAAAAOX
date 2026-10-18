"use client";

// Imports IA : les créations transmises par ChatGPT, Claude, Gemini (connexion Contrôle IA,
// lien de dépôt) ou par Axso, devenues produits numériques. Statut, fichiers, visuels,
// dernière erreur ; reprendre un import en échec ou publier un produit complet.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Sparkles, RotateCcw, Send, Loader2, FileText, Image as ImageIcon, ExternalLink } from "lucide-react";
import { useT } from "@/components/I18nProvider";

interface Fichier { name: string; status: string; size: number | null; error: string | null }
interface Visuel { name: string; status: string; url: string | null; error: string | null }
interface Import {
  import_id: string; status: string; name: string | null; source: string; provider: string; created_at: string;
  attempts: number; last_error: string | null; next_retry_at: string | null;
  files: Fichier[]; images: Visuel[]; product: { id: string; nom: string; actif: boolean; images: string[] } | null;
}

const STATUTS: Record<string, { label: string; couleur: string; fond: string }> = {
  received: { label: "Reçu", couleur: "#6B7280", fond: "#F3F4F6" },
  validated: { label: "Vérifié", couleur: "#6B7280", fond: "#F3F4F6" },
  stored: { label: "Fichiers stockés", couleur: "#2563EB", fond: "#EFF6FF" },
  product_created: { label: "Produit créé", couleur: "#2563EB", fond: "#EFF6FF" },
  assets_attached: { label: "Brouillon à compléter", couleur: "#D97706", fond: "#FFFBEB" },
  ready_for_review: { label: "Prêt à publier", couleur: "#92400E", fond: "#FFF7ED" },
  published: { label: "Publié", couleur: "#16A34A", fond: "#ECFDF5" },
  retrying: { label: "Nouvelle tentative prévue", couleur: "#D97706", fond: "#FFFBEB" },
  failed: { label: "Échec", couleur: "#DC2626", fond: "#FEF2F2" },
};
const SOURCES: Record<string, string> = { mcp: "Connexion IA (MCP)", rest: "API", depot: "Lien de dépôt", axso: "Axso" };
const taille = (o: number | null) => (o == null ? "" : o > 1048576 ? `${(o / 1048576).toFixed(1)} Mo` : `${Math.ceil(o / 1024)} Ko`);

export default function ImportsIAPage() {
  const t = useT();
  const [imports, setImports] = useState<Import[] | null>(null);
  const [action, setAction] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const r = await fetch("/api/produits/imports-ia");
    setImports(r.ok ? (await r.json()).imports : []);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  async function agir(id: string, quoi: "reprendre" | "publier") {
    setAction(`${quoi}-${id}`);
    const r = await fetch("/api/produits/imports-ia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: quoi }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) toast.success(quoi === "publier" ? t("Produit publié") : t("Import relancé"));
    else toast.error(j.error ?? t("Action impossible"));
    setAction(null);
    charger();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111111] flex items-center gap-2"><Sparkles size={20} className="text-[#F5A623]" />{t("Imports IA")}</h1>
        <p className="text-sm text-[#666666] mt-1">
          {t("Les créations envoyées par ton assistant (ChatGPT, Claude, Gemini…) deviennent des produits numériques. Relie un assistant dans")}{" "}
          <Link href="/dashboard/controle-ia" className="text-[#F5A623] font-medium hover:underline">{t("Contrôle IA")}</Link>.
        </p>
      </div>

      {imports === null ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : imports.length === 0 ? (
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-10 text-center text-sm text-[#666666]">
          {t("Aucun import pour l'instant. Demande à ton assistant : « Mets ce guide en vente sur ma boutique Axso ».")}
        </div>
      ) : (
        <ul className="space-y-3">
          {imports.map((i) => {
            const s = STATUTS[i.status] ?? STATUTS.received;
            return (
              <li key={i.import_id} className="bg-white border border-[#E8E8E8] rounded-2xl p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#111111] truncate">{i.product?.nom ?? i.name ?? t("Ajout à un produit")}</p>
                    <p className="text-xs text-[#AAAAAA] mt-0.5">
                      {t(SOURCES[i.source] ?? i.source)} · {i.provider} · {new Date(i.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                      {i.attempts > 1 && ` · ${i.attempts} ${t("tentatives")}`}
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ color: s.couleur, background: s.fond }}>{t(s.label)}</span>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  {i.files.map((f, k) => (
                    <span key={k} className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border ${f.status === "echec" ? "border-[#FECACA] text-[#DC2626]" : "border-[#E8E8E8] text-[#666666]"}`}>
                      <FileText size={12} />{f.name} {taille(f.size)}
                    </span>
                  ))}
                  {i.images.map((v, k) => v.url
                    ? <img key={k} src={v.url} alt={v.name} className="w-9 h-9 rounded-lg object-cover border border-[#E8E8E8]" />
                    : <span key={k} className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border ${v.status === "echec" ? "border-[#FECACA] text-[#DC2626]" : "border-[#E8E8E8] text-[#666666]"}`}><ImageIcon size={12} />{v.name}</span>)}
                </div>

                {i.last_error && <p className="text-xs text-[#DC2626] mt-3">{i.last_error}</p>}
                {i.status === "retrying" && i.next_retry_at && <p className="text-xs text-[#AAAAAA] mt-1">{t("Prochaine tentative")} : {new Date(i.next_retry_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>}

                <div className="flex flex-wrap gap-2 mt-4">
                  {i.product && (
                    <Link href={`/dashboard/produits/${i.product.id}`} className="flex items-center gap-1.5 text-xs bg-white border border-[#E8E8E8] text-[#666666] px-3 py-1.5 rounded-lg hover:border-[#111111] hover:text-[#111111]">
                      <ExternalLink size={11} />{t("Voir le produit")}
                    </Link>
                  )}
                  {(i.status === "failed" || i.status === "retrying") && (
                    <button onClick={() => agir(i.import_id, "reprendre")} disabled={!!action} className="flex items-center gap-1.5 text-xs bg-white border border-[#E8E8E8] text-[#666666] px-3 py-1.5 rounded-lg hover:border-[#111111] hover:text-[#111111] disabled:opacity-50">
                      {action === `reprendre-${i.import_id}` ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}{t("Reprendre")}
                    </button>
                  )}
                  {i.status === "ready_for_review" && (
                    <button onClick={() => agir(i.import_id, "publier")} disabled={!!action} className="flex items-center gap-1.5 text-xs bg-[#111111] text-white px-3 py-1.5 rounded-lg hover:bg-black disabled:opacity-50">
                      {action === `publier-${i.import_id}` ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}{t("Publier")}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
