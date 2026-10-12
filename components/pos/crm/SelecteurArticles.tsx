"use client";
// Choix d'articles du catalogue (recherche serveur /api/pos/articles), avec ou
// sans quantité. Sert aux règles d'une promotion et à son panier d'exemple.
import { useEffect, useId, useState } from "react";
import { Search, X } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { CLASSE_SAISIE, FOCUS } from "@/components/pos/ui";
import { cn } from "@/lib/utils";
import type { ArticleResolu, UniteVente } from "@/lib/pos/types";
import { appelPos } from "./appel";

export type ArticleChoisi = { produitId: string; nom: string; prix: number; uniteVente: UniteVente; categorie: string | null; tauxTVA: number | null; quantite: number };

type Props = {
  label: string;
  aide?: string;
  valeur: ArticleChoisi[];
  onChange: (articles: ArticleChoisi[]) => void;
  /** Affiche un champ quantité par article (pièces, ou grammes pour un article au poids). */
  avecQuantite?: boolean;
  /** Un seul article au plus. */
  unique?: boolean;
};

export function SelecteurArticles({ label, aide, valeur, onChange, avecQuantite, unique }: Props) {
  const t = useT();
  const { fmt } = useDevise();
  const id = useId();
  const [q, setQ] = useState("");
  const [trouves, setTrouves] = useState<ArticleResolu[]>([]);
  const [etat, setEtat] = useState<"repos" | "charge" | "vide" | "erreur">("repos");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const terme = q.trim();
    if (terme.length < 2) { setTrouves([]); setEtat("repos"); return; }
    const abandon = new AbortController();
    setEtat("charge");
    const minuterie = setTimeout(async () => {
      const r = await appelPos<{ articles: ArticleResolu[] }>(`/api/pos/articles?q=${encodeURIComponent(terme)}&limite=8`, { signal: abandon.signal });
      if (abandon.signal.aborted) return;
      if (!r.ok) { setEtat("erreur"); setMessage(r.message); return; }
      const libres = r.donnees.articles.filter((a) => !valeur.some((v) => v.produitId === a.produitId));
      setTrouves(libres); setEtat(libres.length ? "repos" : "vide");
    }, 250);
    return () => { clearTimeout(minuterie); abandon.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function ajouter(a: ArticleResolu) {
    const choisi: ArticleChoisi = { produitId: a.produitId, nom: a.nom, prix: a.prix, uniteVente: a.uniteVente, categorie: a.categorie, tauxTVA: a.tauxTVA, quantite: a.uniteVente === "kg" ? 1000 : 1 };
    onChange(unique ? [choisi] : [...valeur, choisi]);
    setQ(""); setTrouves([]);
  }

  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-semibold uppercase tracking-wide text-[#666666]">{t(label)}</label>
      {valeur.length > 0 && (
        <ul className="mt-1 space-y-1">
          {valeur.map((a) => (
            <li key={a.produitId} className="flex items-center gap-2 rounded-xl border border-[#F0F0F0] bg-[#FAFAFA] py-1 pl-3 pr-1">
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{a.nom}{a.prix > 0 && <span className="ml-2 font-normal text-[#888888]">{fmt(a.prix)}{a.uniteVente === "kg" ? "/kg" : ""}</span>}</span>
              {avecQuantite && (
                <input type="number" inputMode="numeric" min={1} step={1} value={a.quantite} aria-label={`${t("Quantité")} — ${a.nom}${a.uniteVente === "kg" ? ` (${t("grammes")})` : ""}`}
                  onChange={(e) => onChange(valeur.map((v) => (v.produitId === a.produitId ? { ...v, quantite: Math.max(1, Math.floor(Number(e.target.value) || 1)) } : v)))}
                  className={cn(CLASSE_SAISIE, "w-24 text-right")} />
              )}
              {avecQuantite && a.uniteVente === "kg" && <span className="text-[11px] text-[#888888]">g</span>}
              <button type="button" aria-label={`${t("Retirer")} ${a.nom}`} onClick={() => onChange(valeur.filter((v) => v.produitId !== a.produitId))}
                className={cn("flex h-11 w-11 items-center justify-center rounded-xl text-[#666666] hover:bg-white", FOCUS)}><X size={15} aria-hidden /></button>
            </li>
          ))}
        </ul>
      )}
      {!(unique && valeur.length) && (
        <div className="relative mt-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#AAAAAA]" aria-hidden />
          <input id={id} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" placeholder={t("Rechercher un article (nom, code-barres, SKU)")} className={cn(CLASSE_SAISIE, "pl-9")} />
        </div>
      )}
      {etat === "charge" && <p role="status" className="mt-1 text-[12px] text-[#888888]">{t("Recherche…")}</p>}
      {etat === "vide" && <p role="status" className="mt-1 text-[12px] text-[#888888]">{t("Aucun article ne correspond.")}</p>}
      {etat === "erreur" && <p role="alert" className="mt-1 text-[12px] text-[#B91C1C]">{t(message)}</p>}
      {trouves.length > 0 && (
        <ul className="mt-1 max-h-56 space-y-1 overflow-y-auto">
          {trouves.map((a) => (
            <li key={a.produitId}>
              <button type="button" onClick={() => ajouter(a)} className={cn("flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-[#F0F0F0] bg-white px-3 text-left text-[13px] hover:border-[#F5A623]", FOCUS)}>
                <span className="min-w-0 truncate">{a.nom}{a.categorie && <span className="ml-2 text-[#888888]">{a.categorie}</span>}</span>
                <span className="font-semibold tabular-nums">{fmt(a.prix)}{a.uniteVente === "kg" ? "/kg" : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {aide && <p className="mt-1 text-[11px] leading-snug text-[#888888]">{t(aide)}</p>}
    </div>
  );
}
