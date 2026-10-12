"use client";
// Socle des écrans « Stock » de la caisse (stock, inventaire, transferts,
// traçabilité, fiche produit) : poste de scan, choix d'un article, choix d'un
// lieu, affichage des quantités. Les appels, la caisse de travail et les cartes
// viennent du socle « Finance du magasin », pour que les écrans se ressemblent.
import { useEffect, useId, useRef, useState } from "react";
import { Package, Search } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { appelPos } from "@/components/pos/caisse/api";
import BoutonScanner from "@/components/pos/scanner/BoutonScanner";
import CapteurClavier from "@/components/pos/scanner/CapteurClavier";
import { useFluxPos } from "@/components/pos/scanner/useFluxPos";
import { BadgeConnexion, CLASSE_SAISIE, Champ, FOCUS } from "@/components/pos/ui";
import { surScan, type ScanEmis } from "@/lib/pos/client/bus";
import type { ArticleResolu, ContexteScan } from "@/lib/pos/types";
import { cn } from "@/lib/utils";

export { appelPos };
export { nouvelleCle } from "@/lib/pos/client/transport";
export { Carte, Chiffre, EnTete, Page, useCaisse, useLecture } from "@/components/pos/finance/commun";

export type Lieu = { id: string; nom: string; principal: boolean; actif: boolean; magasins: string[] };
export type Etats = { physique: number; reserve: number; bloque: number; endommage: number; disponible: number; enTransit: number; enCommande: number };
export type ArticleChoisi = { produitId: string; varianteId: string | null; nom: string; variante: string | null; uniteVente: string; suiviSerie: boolean; stock: number };

/** Quantité lisible : pièces, ou kilos pour un article au poids (le stock est tenu en grammes). */
export function qte(quantite: number | null | undefined, uniteVente?: string | null, loc = "fr-FR"): string {
  if (quantite === null || quantite === undefined) return "—";
  return uniteVente === "kg" ? `${(quantite / 1000).toLocaleString(loc, { maximumFractionDigits: 3 })} kg` : quantite.toLocaleString(loc);
}

/** Écart signé : « +3 », « −2 », « 0 ». */
export function signe(n: number, uniteVente?: string | null, loc = "fr-FR"): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${qte(Math.abs(n), uniteVente, loc)}`;
}

export function jour(iso: string | null | undefined, loc: string, heure = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return heure ? d.toLocaleString(loc, { dateStyle: "short", timeStyle: "short" }) : d.toLocaleDateString(loc);
}

export function Vignette({ src, taille = 40 }: { src?: string | null; taille?: number }) {
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt="" width={taille} height={taille} className="flex-shrink-0 rounded-xl object-cover" style={{ width: taille, height: taille }} />
    : <span className="flex flex-shrink-0 items-center justify-center rounded-xl bg-[#F5F5F5] text-[#AAAAAA]" style={{ width: taille, height: taille }} aria-hidden><Package size={taille * 0.4} /></span>;
}

/**
 * S'abonne aux scans des contextes donnés (caméra et douchette du poste,
 * téléphones appairés via le flux). `cb` reçoit le scan ; un scan d'un autre
 * contexte (la vente, par exemple) est ignoré.
 */
export function useScans(contextes: ContexteScan[], cb: (scan: ScanEmis) => void, actif = true) {
  const rappel = useRef(cb);
  useEffect(() => { rappel.current = cb; });
  const cle = contextes.join(",");
  useEffect(() => {
    if (!actif) return;
    const acceptes = cle.split(",");
    return surScan((scan) => { if (acceptes.includes(scan.contexte ?? "vente")) rappel.current(scan); });
  }, [cle, actif]);
}

/**
 * Poste de scan d'un écran : bouton caméra, douchette (clavier) et scans du
 * téléphone appairé à la caisse. `contexte` est celui donné aux scans du poste ;
 * `contextes` (défaut : [contexte]) ceux qu'on accepte du téléphone.
 */
export function PosteScan({ contexte, contextes, onScan, caisseId, actif = true, libelle = "Scanner", large }: {
  contexte: ContexteScan; contextes?: ContexteScan[]; onScan: (scan: ScanEmis) => void; caisseId?: string | null; actif?: boolean; libelle?: string; large?: boolean;
}) {
  const t = useT();
  const { etat } = useFluxPos({ caisseId, actif });
  useScans(contextes ?? [contexte], onScan, actif);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <BoutonScanner contexte={contexte} libelle={libelle} caisseId={caisseId} disabled={!actif} large={large} />
      <CapteurClavier contexte={contexte} actif={actif} caisseId={caisseId} />
      {actif && etat !== "refuse" && (
        <span title={t("Scans du téléphone appairé à cette caisse")}>
          <BadgeConnexion etat={etat === "hors_ligne" ? "hors_ligne" : etat === "connexion" ? "synchronisation" : "en_ligne"} />
        </span>
      )}
    </div>
  );
}

export function SelectLieu({ label, lieux, valeur, onChange, tous, exclure, className }: {
  label: string; lieux: Lieu[]; valeur: string; onChange: (id: string) => void; tous?: string; exclure?: string; className?: string;
}) {
  const t = useT();
  return (
    <Champ label={label} className={className}>
      {(a) => (
        <select {...a} value={valeur} onChange={(e) => onChange(e.target.value)} className={CLASSE_SAISIE}>
          {tous !== undefined && <option value="">{t(tous)}</option>}
          {lieux.filter((l) => (l.actif || l.id === valeur) && l.id !== exclure).map((l) => (
            <option key={l.id} value={l.id}>{l.nom}{l.magasins.length ? ` — ${l.magasins.join(", ")}` : ""}</option>
          ))}
        </select>
      )}
    </Champ>
  );
}

/**
 * Recherche d'un article du catalogue (serveur, /api/pos/articles) et choix de
 * sa variante quand il en a. `onChoisir` reçoit l'article précis.
 */
export function ChoixArticle({ label = "Ajouter un article", onChoisir, caisseId, aide }: { label?: string; onChoisir: (a: ArticleChoisi) => void; caisseId?: string | null; aide?: string }) {
  const t = useT();
  const id = useId();
  const [q, setQ] = useState("");
  const [trouves, setTrouves] = useState<ArticleResolu[]>([]);
  const [etat, setEtat] = useState<"repos" | "charge" | "vide" | "erreur">("repos");
  const [message, setMessage] = useState("");
  const [avecVariantes, setAvecVariantes] = useState<ArticleResolu | null>(null);

  useEffect(() => {
    const terme = q.trim();
    if (terme.length < 2) { setTrouves([]); setEtat("repos"); return; }
    const abandon = new AbortController();
    setEtat("charge");
    const minuterie = setTimeout(async () => {
      const r = await appelPos<{ articles: ArticleResolu[] }>(`/api/pos/articles?q=${encodeURIComponent(terme)}&limite=8`, { signal: abandon.signal, caisseId });
      if (!r.ok) { if (r.code !== "annule") { setEtat("erreur"); setMessage(r.message); } return; }
      setTrouves(r.donnees.articles); setEtat(r.donnees.articles.length ? "repos" : "vide");
    }, 250);
    return () => { clearTimeout(minuterie); abandon.abort(); };
  }, [q, caisseId]);

  const choisir = (a: ArticleResolu, v?: ArticleResolu["variantes"][number]) => {
    if (!v && a.variantes.length) { setAvecVariantes(a); return; }
    onChoisir({ produitId: a.produitId, varianteId: v?.id ?? null, nom: a.nom, variante: v ? `${v.nom}: ${v.valeur}` : null, uniteVente: a.uniteVente, suiviSerie: a.suiviSerie, stock: v ? v.stock : a.stock });
    setQ(""); setTrouves([]); setAvecVariantes(null);
  };
  const ligne = cn("flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] hover:bg-[#FFF7ED]", FOCUS);

  return (
    <div>
      <Champ label={label} aide={aide}>
        {(a) => (
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#AAAAAA]" aria-hidden />
            <input {...a} type="search" value={q} onChange={(e) => { setQ(e.target.value); setAvecVariantes(null); }} placeholder={t("Nom, référence ou code-barres")} className={cn(CLASSE_SAISIE, "pl-9")} aria-controls={`${id}-liste`} autoComplete="off" />
          </div>
        )}
      </Champ>
      <div id={`${id}-liste`} aria-live="polite">
        {etat === "charge" && <p className="mt-2 text-[12px] text-[#888888]">{t("Recherche…")}</p>}
        {etat === "vide" && <p className="mt-2 text-[12px] text-[#888888]">{t("Aucun article ne correspond.")}</p>}
        {etat === "erreur" && <p role="alert" className="mt-2 text-[12px] text-[#B91C1C]">{t(message)}</p>}
        {avecVariantes ? (
          <div className="mt-2 rounded-xl border border-[#E8E8E8] bg-white p-3">
            <p className="text-[12px] font-bold text-[#111111]">{t("Quelle variante de « {0} » ?", avecVariantes.nom)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {avecVariantes.variantes.map((v) => (
                <button key={v.id} type="button" onClick={() => choisir(avecVariantes, v)} className={cn("min-h-11 rounded-xl border border-[#E8E8E8] px-3 text-[12.5px] font-semibold hover:border-[#F5A623]", FOCUS)}>
                  {v.nom}: {v.valeur}
                </button>
              ))}
            </div>
          </div>
        ) : trouves.length > 0 && (
          <ul className="mt-2 divide-y divide-[#F0F0F0] overflow-hidden rounded-xl border border-[#E8E8E8] bg-white">
            {trouves.map((a) => (
              <li key={a.produitId}>
                <button type="button" onClick={() => choisir(a)} className={ligne}>
                  <span className="min-w-0 truncate font-semibold text-[#111111]">{a.nom}</span>
                  <span className="flex-shrink-0 text-[11.5px] text-[#888888]">{a.variantes.length ? t("{0} variantes", a.variantes.length) : a.sku ?? a.codeBarres ?? ""}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Onglets d'un écran (rôle tablist, navigable au clavier par Tab). */
export function Onglets<T extends string>({ onglets, actif, onChange, label }: { onglets: { id: T; libelle: string; compte?: number | null }[]; actif: T; onChange: (id: T) => void; label: string }) {
  const t = useT();
  return (
    <div role="tablist" aria-label={t(label)} className="flex w-full gap-1 overflow-x-auto rounded-2xl bg-[#F0F0F0] p-1 sm:w-fit">
      {onglets.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={actif === o.id} onClick={() => onChange(o.id)}
          className={cn("min-h-11 whitespace-nowrap rounded-xl px-3.5 text-[12.5px] font-semibold transition-colors", FOCUS, actif === o.id ? "bg-white text-[#111111] shadow-sm" : "text-[#666666] hover:text-[#111111]")}>
          {t(o.libelle)}{o.compte ? <span className="ml-1.5 rounded-full bg-[#111111] px-1.5 py-0.5 text-[10px] text-white">{o.compte}</span> : null}
        </button>
      ))}
    </div>
  );
}
