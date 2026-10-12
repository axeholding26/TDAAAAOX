"use client";
// Recherche d'un article du catalogue (GET /api/pos/articles) pour l'ajouter à
// un bon de commande ou à une réception. Un produit à variantes demande de
// choisir la variante (ou « toutes variantes » si l'écran l'accepte).
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { appelPos } from "@/components/pos/crm/appel";
import { FOCUS, Saisie } from "@/components/pos/ui";
import type { ArticleResolu, UniteVente } from "@/lib/pos/types";

export type ArticleAchat = {
  produitId: string; varianteId: string | null; nom: string; variante: string | null;
  uniteVente: UniteVente; suiviSerie: boolean; cout: number | null;
  /** Variantes du produit quand aucune n'est choisie (répartition à la réception). */
  variantes: { id: string; libelle: string }[];
};

export function versArticleAchat(a: ArticleResolu, varianteId: string | null = a.varianteId): ArticleAchat {
  const v = a.variantes.find((x) => x.id === varianteId) ?? null;
  return {
    produitId: a.produitId, varianteId: v?.id ?? null, nom: a.nom, variante: v ? `${v.nom}: ${v.valeur}` : null,
    uniteVente: a.uniteVente, suiviSerie: a.suiviSerie, cout: v?.cout ?? a.cout,
    variantes: v ? [] : a.variantes.map((x) => ({ id: x.id, libelle: `${x.nom}: ${x.valeur}` })),
  };
}

const CLASSE_CHOIX = `flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 text-left text-[13px] hover:bg-[#FFF7ED] ${FOCUS}`;

export function RechercheArticle({ onChoisir, varianteObligatoire, label = "Ajouter un produit" }: { onChoisir: (a: ArticleAchat) => void; varianteObligatoire?: boolean; label?: string }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [trouves, setTrouves] = useState<ArticleResolu[]>([]);
  const [etat, setEtat] = useState<"repos" | "charge" | "vide" | "erreur">("repos");
  const [message, setMessage] = useState("");
  const [ouvert, setOuvert] = useState<string | null>(null);

  useEffect(() => {
    const terme = q.trim();
    if (terme.length < 2) { setTrouves([]); setEtat("repos"); return; }
    const abandon = new AbortController();
    setEtat("charge");
    const minuterie = setTimeout(async () => {
      const r = await appelPos<{ articles: ArticleResolu[] }>(`/api/pos/articles?q=${encodeURIComponent(terme)}&limite=12`, { signal: abandon.signal });
      if (!r.ok) { if (r.code !== "annule") { setEtat("erreur"); setMessage(r.message); } return; }
      setTrouves(r.donnees.articles);
      setEtat(r.donnees.articles.length ? "repos" : "vide");
    }, 250);
    return () => { clearTimeout(minuterie); abandon.abort(); };
  }, [q]);

  const choisir = (a: ArticleResolu, varianteId: string | null) => { onChoisir(versArticleAchat(a, varianteId)); setQ(""); setOuvert(null); };

  return (
    <div>
      <Saisie label={label} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Nom, SKU ou code-barres")} suffixe={<Search size={15} aria-hidden />} autoComplete="off" />
      <div aria-live="polite">
        {etat === "charge" && <p className="mt-1 text-[12px] text-[#888888]">{t("Recherche…")}</p>}
        {etat === "vide" && <p className="mt-1 text-[12px] text-[#888888]">{t("Aucun produit ne correspond.")}</p>}
        {etat === "erreur" && <p role="alert" className="mt-1 text-[12px] text-[#B91C1C]">{t(message)}</p>}
      </div>
      {trouves.length > 0 && (
        <ul className="mt-1 max-h-64 overflow-y-auto rounded-xl border border-[#E8E8E8] bg-white p-1">
          {trouves.map((a) => (
            <li key={a.produitId}>
              <button type="button" className={CLASSE_CHOIX} aria-expanded={a.variantes.length ? ouvert === a.produitId : undefined}
                onClick={() => (a.variantes.length ? setOuvert(ouvert === a.produitId ? null : a.produitId) : choisir(a, null))}>
                <span className="min-w-0 truncate font-semibold">{a.nom}</span>
                <span className="flex-shrink-0 text-[11px] text-[#888888]">{a.variantes.length ? t("{0} variantes", a.variantes.length) : a.sku ?? a.codeBarres ?? ""}</span>
              </button>
              {ouvert === a.produitId && (
                <ul className="mb-1 ml-3 border-l border-[#F0F0F0] pl-2">
                  {!varianteObligatoire && <li><button type="button" className={CLASSE_CHOIX} onClick={() => choisir(a, null)}>{t("Toutes variantes (à répartir à la réception)")}</button></li>}
                  {a.variantes.map((v) => <li key={v.id}><button type="button" className={CLASSE_CHOIX} onClick={() => choisir(a, v.id)}>{v.nom}: {v.valeur}</button></li>)}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
