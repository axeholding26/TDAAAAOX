"use client";
// Briques d'interface communes aux pages AXSO Sourcing — mêmes codes visuels
// que le reste du tableau de bord (cartes blanches arrondies, accent #F5A623).
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Info } from "lucide-react";
import { useT } from "@/components/I18nProvider";

export const POLICE = { fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" } as const;

/** Lecture d'une route /api/sourcing : données, chargement, erreur, rechargement. */
export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(!!url);
  const recharger = useCallback(async () => {
    if (!url) return;
    setChargement(true);
    try {
      const r = await fetch(url);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? d.message ?? "Erreur");
      setData(d); setErreur(null);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setChargement(false);
    }
  }, [url]);
  useEffect(() => { recharger(); }, [recharger]);
  return { data, setData, erreur, chargement, recharger };
}

/** Appel d'écriture : renvoie le JSON, ou lève l'erreur renvoyée par l'API (message en français). */
export async function envoyer<T = any>(url: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? d.message ?? "Erreur");
  return d as T;
}

export function Page({ children, etroite }: { children: React.ReactNode; etroite?: boolean }) {
  return <div className={`space-y-5 ${etroite ? "max-w-3xl mx-auto" : ""}`} style={POLICE}>{children}</div>;
}

export function Entete({ badge, titre, sousTitre, actions }: { badge?: string; titre: string; sousTitre?: string; actions?: React.ReactNode }) {
  const t = useT();
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        {badge && (
          <div className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold mb-2 tracking-wide"
            style={{ background: "#FFF7ED", color: "#D4911A", border: "1px solid #FDE68A" }}>{t(badge)}</div>
        )}
        <h1 className="text-[20px] sm:text-[22px] font-bold text-[#111111] leading-tight tracking-tight">{t(titre)}</h1>
        {sousTitre && <p className="text-[#666666] text-sm mt-1 max-w-2xl leading-relaxed">{t(sousTitre)}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function Carte({ titre, aide, actions, children, className = "" }: { titre?: string; aide?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  const t = useT();
  return (
    <section className={`bg-white rounded-2xl border border-[#E8E8E8] shadow-sm p-4 sm:p-5 ${className}`}>
      {(titre || actions) && (
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            {titre && <h2 className="text-[14px] font-bold text-[#111111]">{t(titre)}</h2>}
            {aide && <p className="text-[12px] text-[#666666] mt-0.5 leading-relaxed">{t(aide)}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const TONS = {
  neutre: { background: "#F5F5F5", color: "#666666", border: "1px solid #E8E8E8" },
  accent: { background: "#FFF7ED", color: "#B45309", border: "1px solid #FDE68A" },
  positif: { background: "#ECFDF5", color: "#15803D", border: "1px solid #BBF7D0" },
  attention: { background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" },
  info: { background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" },
} as const;
export type Ton = keyof typeof TONS;

export function Pastille({ ton = "neutre", children }: { ton?: Ton; children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={TONS[ton]}>{children}</span>;
}

/** Statut d'une intégration : ne jamais laisser croire qu'un service non branché fonctionne. */
export function PastilleIntegration({ statut }: { statut: "actif" | "sandbox" | "a_connecter" }) {
  const t = useT();
  return statut === "actif" ? <Pastille ton="positif">{t("Actif")}</Pastille>
    : statut === "sandbox" ? <Pastille ton="info">{t("Sandbox — données fictives")}</Pastille>
    : <Pastille ton="neutre">{t("À connecter")}</Pastille>;
}

/** Étiquette obligatoire à côté de tout chiffre qui n'est pas mesuré. */
export function Estimation({ children }: { children?: React.ReactNode }) {
  const t = useT();
  return <Pastille ton="accent"><Info size={9} />{children ?? t("Estimation")}</Pastille>;
}

export function Bouton({ children, onClick, href, variante = "primaire", disabled, charge, type = "button", petit }: {
  children: React.ReactNode; onClick?: () => void; href?: string; variante?: "primaire" | "secondaire" | "discret";
  disabled?: boolean; charge?: boolean; type?: "button" | "submit"; petit?: boolean;
}) {
  const classes = `inline-flex items-center justify-center gap-1.5 rounded-xl font-bold transition-all disabled:opacity-50 ${petit ? "px-3 py-1.5 text-[11px]" : "px-4 py-2.5 text-[13px]"} ${
    variante === "primaire" ? "bg-[#F5A623] text-[#111111] hover:bg-[#D4911A] shadow-sm"
    : variante === "secondaire" ? "bg-white text-[#111111] border border-[#E8E8E8] hover:border-[#F5A623]"
    : "text-[#B45309] bg-[#FFF7ED] hover:bg-[#FDE68A]/60"}`;
  if (href) return <Link href={href} className={classes}>{children}</Link>;
  return <button type={type} onClick={onClick} disabled={disabled || charge} className={classes}>{charge && <Loader2 size={13} className="animate-spin" />}{children}</button>;
}

export const CLASSE_CHAMP = "w-full border border-[#E8E8E8] rounded-xl px-3 py-2 text-[13px] text-[#111111] outline-none focus:border-[#F5A623] bg-white";

export function Champ({ label, aide, children }: { label: string; aide?: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-[#666666] uppercase tracking-wide">{t(label)}</span>
      <div className="mt-1">{children}</div>
      {aide && <span className="block text-[11px] text-[#AAAAAA] mt-1 leading-snug">{t(aide)}</span>}
    </label>
  );
}

/** Champ numérique ; vide = « non renseigné » (undefined), pour laisser jouer la valeur par défaut. */
export function ChampNombre({ label, aide, valeur, onChange, suffixe, placeholder, pas }: {
  label: string; aide?: string; valeur: number | undefined; onChange: (v: number | undefined) => void; suffixe?: string; placeholder?: string; pas?: number;
}) {
  return (
    <Champ label={label} aide={aide}>
      <div className="flex items-center gap-2">
        <input type="number" inputMode="decimal" min={0} step={pas ?? "any"} value={valeur ?? ""} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)))} className={CLASSE_CHAMP} />
        {suffixe && <span className="text-[12px] text-[#666666] whitespace-nowrap">{suffixe}</span>}
      </div>
    </Champ>
  );
}

/** Champ en pourcentage adossé à une part (0,3 ↔ 30 %). */
export function ChampPourcent({ label, aide, valeur, onChange, placeholder }: { label: string; aide?: string; valeur: number | undefined; onChange: (v: number | undefined) => void; placeholder?: string }) {
  return <ChampNombre label={label} aide={aide} suffixe="%" placeholder={placeholder}
    valeur={valeur === undefined ? undefined : Math.round(valeur * 1000) / 10}
    onChange={(v) => onChange(v === undefined ? undefined : Math.min(95, v) / 100)} />;
}

export function EtatVide({ titre, texte, children }: { titre: string; texte?: string; children?: React.ReactNode }) {
  const t = useT();
  return (
    <div className="bg-white border border-dashed border-[#E8E8E8] rounded-2xl p-8 sm:p-10 text-center">
      <p className="text-[#111111] font-semibold text-sm">{t(titre)}</p>
      {texte && <p className="text-[#666666] text-xs mt-1.5 max-w-md mx-auto leading-relaxed">{t(texte)}</p>}
      {children && <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">{children}</div>}
    </div>
  );
}

export function Chargement() {
  return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#F5A623]" size={22} /></div>;
}

export function Erreur({ message }: { message: string }) {
  const t = useT();
  return <div className="rounded-2xl p-4 border bg-[#FEF2F2] border-[#FECACA] text-[13px] text-[#B91C1C]">{t(message)}</div>;
}

export function Onglets<T extends string>({ onglets, actif, onChange }: { onglets: { cle: T; libelle: string; nombre?: number }[]; actif: T; onChange: (c: T) => void }) {
  const t = useT();
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
      {onglets.map((o) => (
        <button key={o.cle} onClick={() => onChange(o.cle)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all"
          style={actif === o.cle ? { background: "#F5A623", color: "#111111" } : { background: "#F5F5F5", color: "#666666" }}>
          {t(o.libelle)}{o.nombre !== undefined ? ` · ${o.nombre}` : ""}
        </button>
      ))}
    </div>
  );
}

/** Tuile de chiffre clé. */
export function Kpi({ libelle, valeur, detail, ton }: { libelle: string; valeur: string; detail?: string; ton?: "positif" | "attention" }) {
  const t = useT();
  return (
    <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-sm p-4">
      <p className="text-[11px] font-semibold text-[#666666] uppercase tracking-wide">{t(libelle)}</p>
      <p className="text-[19px] font-bold leading-tight mt-1 tabular-nums" style={{ color: ton === "positif" ? "#15803D" : ton === "attention" ? "#B91C1C" : "#111111" }}>{valeur}</p>
      {detail && <p className="text-[11px] text-[#AAAAAA] mt-0.5">{t(detail)}</p>}
    </div>
  );
}

export const pourcent = (n: number | null | undefined, decimales = 0) => (n === null || n === undefined ? "—" : `${(n * 100).toFixed(decimales)} %`);
