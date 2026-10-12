"use client";
// Analyse d'un article au scan (§44) — bloc réutilisable (fiche produit,
// caisse, écran de stock) :
//
//   <AnalyseArticle produitId={id} varianteId={varianteId} caisseId={caisseId} />
//
// Props :
// - produitId  : article analysé (obligatoire).
// - varianteId : variante précise ; absent = le produit entier.
// - caisseId   : caisse de travail (en-tête x-pos-caisse), facultatif.
// - hrefCommande : lien du bouton « Préparer une commande » (défaut : /dashboard/pos/achats).
// - compact    : version resserrée, sans la phrase de méthode.
// Tout est une ESTIMATION calculée par le serveur (lib/pos/analytics/article.ts)
// à partir des ventes des 30 derniers jours — l'écran le dit.
import { TrendingDown, TrendingUp } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { Badge, Bouton, EtatChargement, EtatPos } from "@/components/pos/ui";
import { useLecture } from "@/components/pos/finance/commun";
import type { AnalyseArticle as Analyse } from "@/lib/pos/analytics/article";

type Reponse = Analyse & { nom: string; unite: string; fournisseur: string | null };

const NIVEAUX: Record<Analyse["niveau"], { ton: "danger" | "attention" | "positif" | "neutre"; libelle: string }> = {
  rupture: { ton: "danger", libelle: "En rupture" },
  urgent: { ton: "danger", libelle: "Stock inférieur au délai fournisseur" },
  a_surveiller: { ton: "attention", libelle: "Stock à surveiller" },
  ok: { ton: "positif", libelle: "Stock suffisant" },
  sans_vente: { ton: "neutre", libelle: "Aucune vente sur 30 jours" },
};

export default function AnalyseArticle({ produitId, varianteId, caisseId, hrefCommande = "/dashboard/pos/achats", compact }: {
  produitId: string; varianteId?: string | null; caisseId?: string | null; hrefCommande?: string; compact?: boolean;
}) {
  const t = useT();
  const { donnees: a, erreur, recharger } = useLecture<Reponse>(`/api/pos/analytics/article?produitId=${encodeURIComponent(produitId)}${varianteId ? `&varianteId=${encodeURIComponent(varianteId)}` : ""}`, caisseId);
  if (erreur && !a) return <EtatPos compact code={erreur.code} message={erreur.message} onReessayer={recharger} />;
  if (!a) return <EtatChargement compact texte="Analyse de l'article…" />;
  const n = NIVEAUX[a.niveau];
  const unite = a.unite === "kg" ? "kg" : "";
  const q = (v: number) => `${Math.round(v * 100) / 100}${unite ? ` ${unite}` : ""}`;

  return (
    <section aria-label={t("Analyse de l'article")} className="rounded-2xl border border-[#E8E8E8] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-bold text-[#111111]">{t("Analyse")} <span className="font-normal text-[#888888]">· {t("estimation")}</span></h3>
        <Badge ton={n.ton}>{t(n.libelle)}</Badge>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
        <div>
          <dt className="text-[11.5px] text-[#666666]">{t("Ventes sur 7 jours")}</dt>
          <dd className="flex items-center gap-1.5 font-bold tabular-nums text-[#111111]">
            {q(a.ventes7)}
            {a.tendancePct !== null && (
              <span className={`inline-flex items-center gap-0.5 text-[12px] font-semibold ${a.tendancePct >= 0 ? "text-[#15803D]" : "text-[#B91C1C]"}`}>
                {a.tendancePct >= 0 ? <TrendingUp size={14} aria-hidden /> : <TrendingDown size={14} aria-hidden />}{a.tendancePct >= 0 ? "+" : ""}{a.tendancePct} %
              </span>
            )}
          </dd>
        </div>
        <div><dt className="text-[11.5px] text-[#666666]">{t("Jours de stock")}</dt><dd className="font-bold tabular-nums text-[#111111]">{a.joursDeStock === null ? "—" : t("{0} jour(s)", a.joursDeStock)}</dd></div>
        <div><dt className="text-[11.5px] text-[#666666]">{t("Stock")}</dt><dd className="font-bold tabular-nums text-[#111111]">{q(a.stock)}</dd></div>
        <div><dt className="text-[11.5px] text-[#666666]">{t("Délai fournisseur")}</dt><dd className="font-bold tabular-nums text-[#111111]">{t("{0} jour(s)", a.delaiJours)}{!a.delaiConnu && <span className="ml-1 text-[11.5px] font-normal text-[#888888]">{t("(par défaut)")}</span>}</dd></div>
      </dl>
      {a.reapproRecommande ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#FCD34D] bg-[#FFFBEB] p-3">
          <p className="min-w-0 flex-1 basis-48 text-[13px] text-[#111111]"><span className="font-bold">{t("Réapprovisionnement recommandé")}</span><span className="block text-[12.5px] text-[#666666]">{t("Quantité suggérée : {0}", q(a.quantiteSuggeree))}{a.fournisseur ? ` · ${a.fournisseur}` : ""}</span></p>
          <Bouton href={hrefCommande} variante="sombre" taille="compact">{t("Préparer une commande")}</Bouton>
        </div>
      ) : a.niveau === "sans_vente" && <p className="mt-3 text-[12.5px] text-[#666666]">{t("Aucune vente sur 30 jours : pas assez de données pour prévoir une rupture ou conseiller une commande.")}</p>}
      {!compact && <p className="mt-3 text-[11.5px] leading-relaxed text-[#888888]">{t(a.methode)}</p>}
    </section>
  );
}
