// Composants de base du Command Center (sans état : utilisables côté serveur).
// Toutes les pages du Command Center les utilisent — ne pas recréer de carte,
// badge ou KPI à la main dans une page.
import type { ReactNode } from "react";
import { Info } from "lucide-react";
// Composants qui affichent du texte traduit ou des nombres formatés : client (langue via useT).
export { Delta, Sparkline, Kpi, Jauge, ListeBarres, EtatVide, Onglets, Tableau, Fraicheur } from "./ui-texte";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function EnTetePage({ titre, sousTitre, eyebrow, actions }: { titre: string; sousTitre?: ReactNode; eyebrow?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="cc-eyebrow mb-1">{eyebrow}</p>}
        <h1 className="cc-h1">{titre}</h1>
        {sousTitre && <p className="cc-muted text-[13px] mt-0.5">{sousTitre}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 cc-no-print">{actions}</div>}
    </header>
  );
}

export function Carte({ titre, sousTitre, actions, children, className, pad = true, id }: { titre?: ReactNode; sousTitre?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean; id?: string }) {
  return (
    <section id={id} className={cx("cc-card min-w-0 cc-fade scroll-mt-20", className)}>
      {(titre || actions) && (
        <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2">
          <div className="min-w-0">
            {titre && <h2 className="cc-h2">{titre}</h2>}
            {sousTitre && <p className="cc-faint text-[12px] mt-0.5">{sousTitre}</p>}
          </div>
          {actions && <div className="flex items-center gap-1.5 shrink-0 cc-no-print">{actions}</div>}
        </div>
      )}
      <div className={pad ? "px-4 pb-4" : ""}>{children}</div>
    </section>
  );
}

export type Ton = "good" | "bad" | "warn" | "info" | "violet" | "accent" | "neutre";
export function Badge({ ton = "neutre", children, titre }: { ton?: Ton; children: ReactNode; titre?: string }) {
  return <span className={cx("cc-badge", ton !== "neutre" && `cc-badge-${ton}`)} title={titre}>{children}</span>;
}

export function GrilleKpi({ children, colonnes = 4 }: { children: ReactNode; colonnes?: 3 | 4 | 6 }) {
  const c = colonnes === 6 ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-6" : colonnes === 3 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-2 lg:grid-cols-4";
  return <div className={cx("grid gap-3", c)}>{children}</div>;
}

export function Progression({ valeur, ton }: { valeur: number | null; ton?: "good" | "bad" | "warn" }) {
  const p = Math.max(0, Math.min(1, valeur ?? 0));
  return (
    <div className="cc-bar" role="progressbar" aria-valuenow={Math.round(p * 100)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${p * 100}%`, background: ton ? `var(--cc-${ton})` : undefined }} />
    </div>
  );
}

export const tonScore = (s: number | null): Ton => (s == null ? "neutre" : s >= 75 ? "good" : s >= 50 ? "warn" : "bad");

export function Note({ children, ton = "info" }: { children: ReactNode; ton?: "info" | "warn" }) {
  return (
    <p className={cx("flex items-start gap-2 text-[12px] rounded-lg px-3 py-2", ton === "warn" ? "cc-badge-warn" : "cc-badge-info")} style={{ height: "auto", fontWeight: 400 }}>
      <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export function Squelette({ className }: { className?: string }) {
  return <div className={cx("cc-skel", className)} aria-hidden />;
}

