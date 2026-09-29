"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Loader2, Package, Download, ArrowLeftRight, Plus, Lock, ArrowRight } from "lucide-react";
import { aAcces, type Palier } from "@/lib/plans";
import { basculerBoutique } from "@/components/dashboard/BoutiqueSwitcher";
import { NouvelleBoutiqueModal } from "@/components/dashboard/NouvelleBoutiqueModal";
import { useT } from "@/components/I18nProvider";

// Produit physique depuis une boutique DIGITALE : sa vitrine (achat direct,
// sans panier, variantes ni livraison) ne sait pas le vendre correctement.
// On propose plutôt : passer sur une boutique physique existante, en créer une
// (multi-boutique = Palier 2, condition inchangée), ou créer un produit digital.
interface Boutique { id: string; nomBoutique: string; logoUrl: string | null; planType: string; active: boolean; modeBoutique: "digital" | "physique" }

const PAGE_PRODUIT = "/dashboard/produits/nouveau";

export function GardeProduitPhysique({ children }: { children: ReactNode }) {
  const t = useT();
  const [boutiques, setBoutiques] = useState<Boutique[] | null>(null);
  const [modal, setModal] = useState(false);
  const [bascule, setBascule] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/boutiques").then((r) => r.json()).then((d) => setBoutiques(d.boutiques ?? [])).catch(() => setBoutiques([]));
  }, []);

  if (!boutiques) return <div className="flex items-center justify-center py-24 text-[#AAAAAA]"><Loader2 size={20} className="animate-spin" /></div>;
  const active = boutiques.find((b) => b.active);
  if (!active || active.modeBoutique !== "digital") return <>{children}</>;

  const physiques = boutiques.filter((b) => b.modeBoutique === "physique");
  const peutCreer = boutiques.some((b) => aAcces(b.planType as Palier, "multi_boutique"));
  const basculer = async (id: string) => { setBascule(id); if (!(await basculerBoutique(id, PAGE_PRODUIT))) setBascule(null); };

  return (
    <div className="max-w-2xl w-full mx-auto py-4 sm:py-8" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <div className="ax-card p-5 sm:p-8">
        <span className="w-12 h-12 rounded-2xl bg-[#FFF8EC] border border-[#FDE68A]/60 flex items-center justify-center mb-4"><Package size={22} className="text-[#F5A623]" /></span>
        <h1 className="text-[19px] sm:text-[21px] font-bold text-[#111111] leading-snug">{t("Les produits physiques se vendent dans une boutique physique")}</h1>
        <p className="text-[13.5px] text-[#777777] leading-relaxed mt-2">
          « {t(active.nomBoutique)}{" "}{t("» est une boutique digitale : sa vitrine est faite pour le téléchargement (achat immédiat, sans panier, tailles ni livraison). Un produit physique y serait mal présenté et tes clients ne pourraient pas choisir leur taille ni leur adresse.")}
        </p>

        <div className="mt-6 space-y-2.5">
          {physiques.map((b) => (
            <button key={b.id} onClick={() => basculer(b.id)} disabled={!!bascule}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-[#F5A623]/50 bg-[#FFFBF3] hover:bg-[#FFF3DC] text-left transition-colors disabled:opacity-60">
              <span className="w-10 h-10 rounded-xl overflow-hidden bg-[#111111] flex items-center justify-center flex-shrink-0 text-[14px] font-bold text-white">
                {b.logoUrl ? <img src={b.logoUrl} alt="" className="w-full h-full object-cover" /> : b.nomBoutique.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-[#111111] truncate">{t("Passer sur «")}{" "}{t(b.nomBoutique)} »</span>
                <span className="block text-[12px] text-[#999999]">{t("Ta boutique physique — le produit y sera créé")}</span>
              </span>
              {bascule === b.id ? <Loader2 size={17} className="animate-spin text-[#F5A623] flex-shrink-0" /> : <ArrowLeftRight size={17} className="text-[#F5A623] flex-shrink-0" />}
            </button>
          ))}

          {!physiques.length && (peutCreer ? (
            <button onClick={() => setModal(true)}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-[#F5A623] hover:bg-[#E8990F] text-left transition-colors">
              <span className="w-10 h-10 rounded-xl bg-white/40 flex items-center justify-center flex-shrink-0"><Plus size={18} className="text-[#111111]" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-[#111111]">{t("Créer une boutique physique")}</span>
                <span className="block text-[12px] text-[#111111]/70">{t("Tu y seras ensuite redirigé pour créer ton produit")}</span>
              </span>
              <ArrowRight size={17} className="text-[#111111] flex-shrink-0" />
            </button>
          ) : (
            <Link href="/dashboard/abonnement"
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-[#E8E8E8] bg-[#FAFAFA] hover:border-[#F5A623]/50 text-left transition-colors">
              <span className="w-10 h-10 rounded-xl bg-[#FFF8EC] border border-[#FDE68A]/60 flex items-center justify-center flex-shrink-0"><Lock size={16} className="text-[#F5A623]" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-[#111111]">{t("Créer une boutique physique — Palier 2")}</span>
                <span className="block text-[12px] text-[#999999]">{t("Avoir plusieurs boutiques est inclus à partir du Palier 2")}</span>
              </span>
              <ArrowRight size={17} className="text-[#999999] flex-shrink-0" />
            </Link>
          ))}

          <Link href="/dashboard/produits/digital/nouveau"
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-[#E8E8E8] bg-white hover:border-[#F5A623]/50 text-left transition-colors">
            <span className="w-10 h-10 rounded-xl bg-[#F5F5F5] flex items-center justify-center flex-shrink-0"><Download size={17} className="text-[#555555]" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-[#111111]">{t("Créer plutôt un produit digital")}</span>
              <span className="block text-[12px] text-[#999999]">{t("Fichier, licence, formation ou pack — dans «")}{" "}{t(active.nomBoutique)} »</span>
            </span>
            <ArrowRight size={17} className="text-[#999999] flex-shrink-0" />
          </Link>
        </div>
      </div>

      {modal && <NouvelleBoutiqueModal onClose={() => setModal(false)} onCree={(id) => { setModal(false); basculer(id); }} />}
    </div>
  );
}
