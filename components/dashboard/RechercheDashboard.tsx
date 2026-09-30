"use client";
// Recherche globale du tableau de bord : pages du menu (filtrées côté client),
// produits / commandes / clients (GET /api/recherche, droits du membre respectés).
// Ctrl+K (⌘K) l'ouvre de n'importe où. Desktop : champ dans l'en-tête ;
// mobile : loupe qui ouvre la recherche en plein écran.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2, Package, ShoppingBag, User, Settings, CornerDownLeft } from "lucide-react";
import { formatMontant } from "@/lib/utils";
import { pagesDashboard } from "@/components/dashboard/Sidebar";
import type { ModuleKey, Niveau } from "@/lib/permissions";
import { useT } from "@/components/I18nProvider";

type Resultats = {
  devise: string;
  produits: { id: string; nom: string; type: string; prix: number; image: string | null; actif: boolean }[];
  commandes: { id: string; numero: string; clientNom: string; montantTotal: number; devise: string; statut: string }[];
  clients: { id: string; nom: string; telephone: string | null; email: string | null }[];
};
type Ligne = { cle: string; groupe: string; titre: string; detail?: string; href: string; Icone: React.ComponentType<{ size?: number; className?: string }>; image?: string | null };

const sansAccents = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const STATUTS: Record<string, string> = { en_attente: "En attente", confirmee: "Confirmée", en_preparation: "En préparation", expediee: "Expédiée", livree: "Livrée", annulee: "Annulée", tentative_echouee: "Tentative échouée" };

export function RechercheDashboard({ permissions, mobile = false }: { permissions?: Record<ModuleKey, Niveau>; mobile?: boolean }) {
  const tr = useT();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [res, setRes] = useState<Resultats | null>(null);
  const [chargement, setChargement] = useState(false);
  const [actif, setActif] = useState(0);
  const champ = useRef<HTMLInputElement>(null);
  const boite = useRef<HTMLDivElement>(null);

  // Ctrl+K / ⌘K depuis n'importe où
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (mobile !== window.matchMedia("(max-width: 767px)").matches) return; // seule la version visible répond
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOuvert(true); setTimeout(() => champ.current?.focus(), 0); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobile]);

  // Clic à l'extérieur (desktop)
  useEffect(() => {
    if (mobile || !ouvert) return;
    const onDown = (e: MouseEvent) => { if (!boite.current?.contains(e.target as Node)) setOuvert(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [ouvert, mobile]);

  // Données (anti-rebond ; une réponse périmée n'écrase jamais la plus récente)
  useEffect(() => {
    const terme = q.trim();
    if (terme.length < 2) { setRes(null); setChargement(false); return; }
    setChargement(true);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/recherche?q=${encodeURIComponent(terme)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setRes(d); })
        .catch(() => {}).finally(() => { if (!ctrl.signal.aborted) setChargement(false); });
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  const pages = useMemo(() => pagesDashboard(permissions), [permissions]);
  const lignes: Ligne[] = useMemo(() => {
    const terme = sansAccents(q.trim());
    if (!terme) return [];
    const l: Ligne[] = pages
      .filter((p) => sansAccents(`${p.label} ${p.groupe}`).includes(terme))
      .slice(0, 5)
      .map((p) => ({ cle: `page-${p.href}`, groupe: "Pages", titre: p.label, detail: p.groupe || undefined, href: p.href, Icone: p.Icon as Ligne["Icone"] }));
    for (const x of [{ label: "Paramètres", href: "/dashboard/parametres", Icone: Settings }, { label: "Mon profil", href: "/dashboard/profil", Icone: User }])
      if (sansAccents(x.label).includes(terme)) l.push({ cle: `page-${x.href}`, groupe: "Pages", titre: x.label, href: x.href, Icone: x.Icone });
    if (res) {
      l.push(...res.produits.map((p) => ({ cle: `p-${p.id}`, groupe: "Produits", titre: p.nom, detail: `${formatMontant(p.prix, res.devise)}${p.actif ? "" : " · masqué"}`, href: `/dashboard/produits/${p.id}`, Icone: Package, image: p.image })));
      l.push(...res.commandes.map((c) => ({ cle: `c-${c.id}`, groupe: "Commandes", titre: `#${c.numero} · ${c.clientNom}`, detail: `${formatMontant(c.montantTotal, c.devise)} · ${STATUTS[c.statut] ?? c.statut}`, href: `/dashboard/commandes/${c.id}`, Icone: ShoppingBag })));
      l.push(...res.clients.map((c) => ({ cle: `cl-${c.id}`, groupe: "Clients", titre: c.nom, detail: [c.telephone, c.email].filter(Boolean).join(" · ") || undefined, href: `/dashboard/clients?q=${encodeURIComponent(c.nom)}`, Icone: User })));
    }
    return l;
  }, [q, res, pages]);

  useEffect(() => setActif(0), [q, res]);

  const aller = (href: string) => { setOuvert(false); setQ(""); champ.current?.blur(); router.push(href); };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActif((i) => Math.min(i + 1, lignes.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActif((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && lignes[actif]) { e.preventDefault(); aller(lignes[actif].href); }
    else if (e.key === "Escape") { setOuvert(false); champ.current?.blur(); }
  };

  const liste = q.trim().length > 0 && (
    <div role="listbox" id="resultats-recherche" className="py-1.5 max-h-[min(70vh,460px)] overflow-y-auto overscroll-contain">
      {lignes.length === 0 && !chargement && (
        <p className="px-4 py-6 text-center text-[13px] text-[#999999]">{q.trim().length < 2 ? tr("Tapez au moins 2 caractères…") : tr("Aucun résultat pour « {0} »", q.trim())}</p>
      )}
      {lignes.map((l, i) => (
        <div key={l.cle}>
          {(i === 0 || lignes[i - 1].groupe !== l.groupe) && (
            <p className="px-4 pt-2.5 pb-1 text-[10.5px] font-bold uppercase tracking-wider text-[#AAAAAA]">{tr(l.groupe)}</p>
          )}
          <button type="button" role="option" aria-selected={i === actif} onMouseEnter={() => setActif(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => aller(l.href)}
            className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${i === actif ? "bg-[#FFF7ED]" : ""}`}>
            {l.image
              ? <img src={l.image} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
              : <span className="w-8 h-8 rounded-lg bg-[#F5F5F7] flex items-center justify-center flex-shrink-0 text-[#777777]"><l.Icone size={15} /></span>}
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-medium text-[#111111] truncate">{tr(l.titre)}</span>
              {l.detail && <span className="block text-[11.5px] text-[#999999] truncate">{tr(l.detail)}</span>}
            </span>
            {i === actif && !mobile && <CornerDownLeft size={13} className="text-[#F5A623] flex-shrink-0" />}
          </button>
        </div>
      ))}
      {chargement && <p className="px-4 py-2.5 flex items-center gap-2 text-[12px] text-[#999999]"><Loader2 size={13} className="animate-spin" />{" "}{tr("Recherche dans les produits, commandes et clients…")}</p>}
    </div>
  );

  const input = (
    <input ref={champ} type="search" value={q} placeholder={tr("Rechercher…")} aria-label={tr("Rechercher dans le tableau de bord")}
      role="combobox" aria-expanded={ouvert && !!q.trim()} aria-controls="resultats-recherche" autoComplete="off"
      onChange={(e) => { setQ(e.target.value); setOuvert(true); }} onFocus={() => setOuvert(true)} onKeyDown={onKeyDown}
      className="flex-1 min-w-0 bg-transparent border-none outline-none text-[13px] text-[#333333] placeholder:text-[#AAAAAA] [&::-webkit-search-cancel-button]:hidden" />
  );

  if (mobile) {
    return (
      <>
        <button type="button" onClick={() => { setOuvert(true); setTimeout(() => champ.current?.focus(), 0); }} aria-label={tr("Rechercher")}
          className="w-9 h-9 rounded-full flex items-center justify-center text-[#555555] bg-[#F5F5F7] flex-shrink-0"><Search size={16} /></button>
        {ouvert && (
          <div className="fixed inset-0 z-[60] bg-white flex flex-col">
            <div className="flex items-center gap-2 px-4 h-14 border-b border-[#F0F0F0]">
              <Search size={16} className="text-[#F5A623] flex-shrink-0" />
              {tr(input)}
              <button type="button" onClick={() => { setOuvert(false); setQ(""); }} className="text-[13px] font-semibold text-[#777777] px-1">{tr("Fermer")}</button>
            </div>
            <div className="flex-1 overflow-y-auto">{tr(liste) || <p className="px-4 py-6 text-[13px] text-[#999999]">{tr("Pages, produits, commandes, clients…")}</p>}</div>
          </div>
        )}
      </>
    );
  }

  return (
    <div ref={boite} className="relative flex-shrink-0">
      <div onClick={() => champ.current?.focus()}
        className={`flex items-center gap-2 rounded-full px-3.5 py-[7px] cursor-text transition-all duration-300 border ${ouvert ? "w-[260px] bg-white border-[#F5A623] shadow-[0_0_0_3px_rgba(245,166,35,.12)]" : "w-[190px] bg-black/[.042] border-black/[.09]"}`}>
        <Search size={13} className={`flex-shrink-0 transition-colors ${ouvert ? "text-[#F5A623]" : "text-[#BBBBBB]"}`} />
        {tr(input)}
        {q ? (
          <button type="button" aria-label={tr("Effacer")} onMouseDown={(e) => { e.preventDefault(); setQ(""); champ.current?.focus(); }} className="text-[#BBBBBB] hover:text-[#666666] flex"><X size={12} /></button>
        ) : (
          <kbd className="text-[10px] font-semibold text-[#BBBBBB] border border-[#E5E5E5] rounded px-1 leading-4 flex-shrink-0">{tr("Ctrl K")}</kbd>
        )}
      </div>
      {ouvert && liste && (
        <div className="absolute left-0 top-[calc(100%+8px)] w-[420px] max-w-[calc(100vw-32px)] bg-white rounded-2xl border border-black/[.07] shadow-[0_16px_48px_rgba(0,0,0,.12)] z-50 overflow-hidden">
          {tr(liste)}
        </div>
      )}
    </div>
  );
}
