"use client";
// Colonne de gauche de la caisse : recherche / scan, catégories, articles.
// La recherche est faite par le SERVEUR (/api/pos/articles, anti-rebond, pages
// de 40 par curseur) : l'écran ne charge jamais tout le catalogue.
// Le champ capte aussi une douchette USB / Bluetooth en mode clavier (rafale de
// touches + Entrée) et publie le code sur le bus de scans (emettreLocal, qui le
// trace aussi côté serveur).
import { useEffect, useMemo, useRef, useState } from "react";
import { Package, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { Badge, Bouton, CLASSE_SAISIE, EtatChargement, EtatPos, EtatVide, FOCUS } from "@/components/pos/ui";
import { emettreLocal } from "@/components/pos/scanner/source";
import { libelleQuantite } from "@/lib/pos/tarification";
import type { ArticleResolu } from "@/lib/pos/types";
import { appelPos } from "./api";
import { creerDetecteurScan } from "./logique";

type Page = { articles: ArticleResolu[]; curseurSuivant: string | null; categories?: { nom: string; articles: number }[] };

export function Catalogue({ caisseId, modeSimple, champRef, onAjouter, actions, version }: {
  caisseId: string | null;
  modeSimple: boolean;
  /** Champ de recherche : la caisse y remet le focus après chaque vente (F2). */
  champRef: React.RefObject<HTMLInputElement | null>;
  onAjouter: (article: ArticleResolu) => void;
  /** Boutons à droite du champ (scanner). */
  actions?: React.ReactNode;
  /** Change après chaque vente : recharge les articles pour afficher le stock à jour. */
  version: number;
}) {
  const t = useT();
  const { fmt } = useDevise();
  const [q, setQ] = useState("");
  const [categorie, setCategorie] = useState<string | null>(null);
  const [categories, setCategories] = useState<{ nom: string; articles: number }[]>([]);
  const [articles, setArticles] = useState<ArticleResolu[]>([]);
  const [curseur, setCurseur] = useState<string | null>(null);
  const [etat, setEtat] = useState<"chargement" | "pret" | { code: string; message: string }>("chargement");
  const [suite, setSuite] = useState(false);
  const [essai, setEssai] = useState(0);
  const detecteur = useMemo(() => creerDetecteurScan(), []);
  const sentinelle = useRef<HTMLDivElement>(null);
  // Requête affichée : une page « suite » arrivée après un changement de recherche est ignorée.
  const requete = useRef("");

  const terme = q.trim();
  const base = `/api/pos/articles?q=${encodeURIComponent(terme)}${categorie ? `&categorie=${encodeURIComponent(categorie)}` : ""}`;

  useEffect(() => {
    const ctrl = new AbortController();
    requete.current = base;
    const minuterie = setTimeout(async () => {
      setEtat("chargement");
      const r = await appelPos<Page>(`${base}&categories=1`, { caisseId, signal: ctrl.signal });
      if (ctrl.signal.aborted || (!r.ok && r.code === "annule")) return;
      if (!r.ok) return setEtat({ code: r.code, message: r.message });
      setArticles(r.donnees.articles ?? []);
      setCurseur(r.donnees.curseurSuivant ?? null);
      if (r.donnees.categories) setCategories(r.donnees.categories);
      setEtat("pret");
    }, terme ? 250 : 0);
    return () => { clearTimeout(minuterie); ctrl.abort(); };
  }, [base, terme, caisseId, version, essai]);

  const chargerSuite = async () => {
    if (!curseur || suite) return;
    const pour = base;
    setSuite(true);
    const r = await appelPos<Page>(`${base}&curseur=${encodeURIComponent(curseur)}`, { caisseId });
    setSuite(false);
    if (requete.current !== pour) return;
    if (!r.ok) return setCurseur(null);
    // ponytail: pas de fenêtrage — le DOM grossit de 40 cartes par page défilée ;
    // la recherche reste le chemin normal. Fenêtrer si des caissiers font défiler des milliers d'articles.
    setArticles((a) => [...a, ...(r.donnees.articles ?? [])]);
    setCurseur(r.donnees.curseurSuivant ?? null);
  };
  const suiteRef = useRef(chargerSuite);
  suiteRef.current = chargerSuite;

  useEffect(() => {
    const el = sentinelle.current;
    if (!el || !curseur) return;
    const obs = new IntersectionObserver((entrees) => { if (entrees.some((e) => e.isIntersecting)) suiteRef.current(); }, { rootMargin: "300px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [curseur]);

  const surTouche = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const code = detecteur(e.key, e.timeStamp);
    if (code) {
      // Rafale d'une douchette : c'est un scan, pas une recherche.
      e.preventDefault();
      setQ("");
      emettreLocal(code, "clavier", { contexte: "vente", caisseId });
      return;
    }
    if (e.key !== "Enter" || !terme) return;
    e.preventDefault();
    // Saisie à la main puis Entrée : un seul résultat → on l'ajoute ; un code chiffré → on le cherche comme un scan.
    if (etat === "pret" && articles.length === 1) { onAjouter(articles[0]); setQ(""); }
    else if (/^\d{6,}$/.test(terme)) { setQ(""); emettreLocal(terme, "clavier", { contexte: "vente", caisseId }); }
  };

  return (
    <section aria-label={t("Catalogue")} className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={18} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]" />
          <input
            ref={champRef} type="search" inputMode="search" autoComplete="off" autoCorrect="off" spellCheck={false}
            value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={surTouche}
            aria-label={t("Rechercher ou scanner un article")} aria-keyshortcuts="F2"
            placeholder={t("Nom, référence ou code-barres…")}
            className={cn(CLASSE_SAISIE, "min-h-12 pl-10 pr-20 text-[15px] [&::-webkit-search-cancel-button]:hidden")}
          />
          {q
            ? <button type="button" onClick={() => { setQ(""); champRef.current?.focus(); }} aria-label={t("Effacer la recherche")} className={cn("absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-[#666666] hover:bg-[#F5F5F5]", FOCUS)}><X size={16} aria-hidden /></button>
            : <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md bg-[#F5F5F5] px-1.5 py-0.5 text-[10px] font-semibold text-[#888888] md:block">F2</kbd>}
        </div>
        {actions}
      </div>

      {!modeSimple && categories.length > 0 && (
        <div role="group" aria-label={t("Catégories")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {[{ nom: null as string | null, libelle: t("Tout") }, ...categories.map((c) => ({ nom: c.nom as string | null, libelle: `${c.nom} (${c.articles})` }))].map((c) => (
            <button key={c.nom ?? "__tout"} type="button" aria-pressed={categorie === c.nom} onClick={() => setCategorie(c.nom)}
              className={cn("min-h-11 flex-shrink-0 rounded-full border px-4 text-[12.5px] font-semibold transition-colors", FOCUS,
                categorie === c.nom ? "border-[#111111] bg-[#111111] text-white" : "border-[#E8E8E8] bg-white text-[#444444] hover:border-[#F5A623]")}>
              {c.libelle}
            </button>
          ))}
        </div>
      )}

      {etat === "chargement" && articles.length === 0 ? <EtatChargement texte="Chargement du catalogue…" />
        : typeof etat === "object" ? <EtatPos code={etat.code} message={etat.message} onReessayer={() => setEssai((n) => n + 1)} />
        : articles.length === 0 ? (
          <EtatVide titre={terme ? "Aucun article ne correspond" : "Aucun article à vendre"} texte={terme ? "Vérifiez l'orthographe, ou scannez le code-barres de l'article." : "Ajoutez des produits physiques à votre catalogue pour les vendre en caisse."}>
            {terme && <Bouton variante="secondaire" onClick={() => { setQ(""); champRef.current?.focus(); }}>{t("Effacer la recherche")}</Bouton>}
          </EtatVide>
        ) : (
          <>
            <ul className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5", etat === "chargement" && "opacity-60")} aria-busy={etat === "chargement"}>
              {articles.map((a) => {
                const stock = a.stockMagasin ?? a.stock;
                return (
                  <li key={a.produitId}>
                    <button type="button" onClick={() => onAjouter(a)}
                      className={cn("flex h-full w-full flex-col overflow-hidden rounded-xl border border-[#E8E8E8] bg-white text-left transition-colors hover:border-[#F5A623] active:bg-[#FFF7ED]", FOCUS)}>
                      <span className="flex aspect-[4/3] w-full items-center justify-center bg-[#F5F5F5]">
                        {a.image
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={a.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                          : <Package size={26} className="text-[#CCCCCC]" aria-hidden />}
                      </span>
                      <span className="flex flex-1 flex-col gap-1 p-2.5">
                        <span className="line-clamp-2 text-[12.5px] font-semibold leading-snug text-[#111111]">{a.nom}</span>
                        <span className="mt-auto flex flex-wrap items-center justify-between gap-1">
                          <span className="text-[13.5px] font-bold text-[#111111]">{fmt(a.prix)}{a.uniteVente === "kg" ? <span className="text-[11px] font-semibold text-[#666666]"> /kg</span> : null}</span>
                          {a.variantes.length > 0
                            ? <Badge>{t("{0} variantes", a.variantes.length)}</Badge>
                            : stock <= 0 ? <Badge ton="danger">{t("Rupture")}</Badge>
                            : <Badge>{t("Stock")} {libelleQuantite(stock, a.uniteVente)}</Badge>}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {curseur && (
              <div ref={sentinelle} className="flex justify-center py-2">
                <Bouton variante="secondaire" onClick={chargerSuite} charge={suite}>{t("Afficher plus d'articles")}</Bouton>
              </div>
            )}
          </>
        )}
    </section>
  );
}
