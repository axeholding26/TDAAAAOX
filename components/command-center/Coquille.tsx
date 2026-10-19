"use client";
// Coquille du Command Center : barre latérale, barre du haut (filtres globaux,
// recherche ⌘K, LIVE, alertes, Ask Axso, modes, thème), bandeau démo.
import { Suspense, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import * as Icones from "lucide-react";
import { Menu, X, Search, Sun, Moon, LogOut, Sparkles, SlidersHorizontal, FlaskConical } from "lucide-react";
import { NAV, estPageGestion } from "@/lib/command-center/navigation";
import { lireFiltres, qs, PERIODES, CLES_FILTRES, type Filtres } from "@/lib/command-center/contexte";
import { PAYS, NOM_PLAN, SOURCES_ACQ } from "@/lib/command-center/types";
import { NOM_ROLE, type RoleAdmin, type Section } from "@/lib/command-center/rbac";
import { CommandBar } from "./CommandBar";
import { LangueSelecteur } from "@/components/ui/LangueSelecteur";
import { Copilote } from "./Copilote";
import { Live } from "./Live";
import { Notifications } from "./Notifications";
import { useT } from "@/components/I18nProvider";

export type Mode = "standard" | "ceo" | "analyste";

function poserCookie(nom: string, valeur: string) {
  document.cookie = `${nom}=${valeur}; path=/admin; max-age=31536000; samesite=lax`;
}

export function Coquille(props: { email: string; role: RoleAdmin; sections: Section[]; theme: "dark" | "light"; mode: Mode; demo: boolean; children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <CoquilleInterne {...props} />
    </Suspense>
  );
}

function CoquilleInterne({ email, role, sections, theme: themeInitial, mode: modeInitial, demo, children }: { email: string; role: RoleAdmin; sections: Section[]; theme: "dark" | "light"; mode: Mode; demo: boolean; children: ReactNode }) {
  const t = useT();
  const chemin = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const filtres = lireFiltres(params);
  const [menu, setMenu] = useState(false);
  const [theme, setTheme] = useState(themeInitial);
  const [mode, setMode] = useState<Mode>(modeInitial);
  const [filtresMobile, setFiltresMobile] = useState(false);
  const gestion = estPageGestion(chemin);

  useEffect(() => setMenu(false), [chemin]);

  const changerTheme = () => { const th = theme === "dark" ? "light" : "dark"; setTheme(th); poserCookie("cc_theme", th); };
  const changerMode = (m: Mode) => { setMode(m); poserCookie("cc_mode", m); router.refresh(); };
  // Les paramètres propres à une page (ex. métrique de l'Explorer, ?statut=) survivent au changement de filtre global.
  const naviguer = (s: Partial<Record<keyof Filtres, string | null>>) => {
    const p = new URLSearchParams(qs(filtres, s).slice(1));
    params.forEach((v, k) => { if (!(CLES_FILTRES as readonly string[]).includes(k)) p.set(k, v); });
    router.push(chemin + (p.size ? `?${p}` : ""));
  };
  const contexte = qs(filtres);

  const autorise = NAV.filter((n) => sections.includes(n.section) && (mode !== "ceo" || n.ceo || n.gestion));
  const actif = (href: string) => (href === "/admin" ? chemin === "/admin" : chemin.startsWith(href));

  const lienNav = (n: (typeof NAV)[number]) => {
    const Icone = (Icones as unknown as Record<string, Icones.LucideIcon>)[n.icone] ?? Icones.Circle;
    return (
      <Link key={n.href} href={n.gestion ? n.href : n.href + contexte} aria-current={actif(n.href) ? "page" : undefined}
        className="flex items-center gap-2.5 px-2.5 h-8 rounded-md text-[13px] transition-colors"
        style={actif(n.href) ? { background: "var(--cc-surface-2)", color: "var(--cc-text)", boxShadow: "inset 2px 0 0 var(--cc-accent)" } : { color: "var(--cc-text-2)" }}>
        <Icone size={15} aria-hidden className="shrink-0" style={actif(n.href) ? { color: "var(--cc-accent)" } : undefined} />
        <span className="truncate">{t(n.nom)}</span>
      </Link>
    );
  };

  const selecteurs = (
    <>
      <select className="cc-select" aria-label={t("Période")} value={filtres.periode} onChange={(e) => naviguer({ periode: e.target.value })}>
        {PERIODES.map((p) => <option key={p.id} value={p.id}>{t(p.nom)}</option>)}
      </select>
      {filtres.periode === "perso" && (
        <>
          <input type="date" className="cc-input" aria-label={t("Du")} defaultValue={filtres.du} onChange={(e) => e.target.value && naviguer({ du: e.target.value })} />
          <input type="date" className="cc-input" aria-label={t("Au")} defaultValue={filtres.au} onChange={(e) => e.target.value && naviguer({ au: e.target.value })} />
        </>
      )}
      <select className="cc-select" aria-label={t("Comparaison")} value={filtres.comparer} onChange={(e) => naviguer({ comparer: e.target.value })}>
        <option value="prec">{t("vs période précédente")}</option>
        <option value="annee">{t("vs année précédente")}</option>
      </select>
      <select className="cc-select" aria-label={t("Pays")} value={filtres.pays ?? ""} onChange={(e) => naviguer({ pays: e.target.value || null })}>
        <option value="">{t("Tous les pays")}</option>
        {Object.entries(PAYS).filter(([k]) => k !== "FR").map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
      </select>
      <select className="cc-select" aria-label={t("Plan")} value={filtres.plan ?? ""} onChange={(e) => naviguer({ plan: e.target.value || null })}>
        <option value="">{t("Tous les plans")}</option>
        {Object.entries(NOM_PLAN).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
      </select>
      <select className="cc-select" aria-label={t("Segment")} value={filtres.taille ?? ""} onChange={(e) => naviguer({ taille: e.target.value || null })}>
        <option value="">{t("Tous les segments")}</option>
        <option value="grand">{t("Gros GMV (≥ 2 M / 90 j)")}</option>
        <option value="moyen">{t("GMV moyen")}</option>
        <option value="petit">{t("Petit GMV")}</option>
      </select>
      {mode === "analyste" && (
        <>
          <select className="cc-select" aria-label={t("Acquisition")} value={filtres.acq ?? ""} onChange={(e) => naviguer({ acq: e.target.value || null })}>
            <option value="">{t("Toutes acquisitions")}</option>
            {Object.entries(SOURCES_ACQ).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
          </select>
          <select className="cc-select" aria-label={t("Ancienneté")} value={filtres.anciennete ?? ""} onChange={(e) => naviguer({ anciennete: e.target.value || null })}>
            <option value="">{t("Toute ancienneté")}</option><option value="nouveau">{t("Nouveaux (< 30 j)")}</option><option value="etabli">{t("Établis")}</option>
          </select>
          <select className="cc-select" aria-label={t("Activité")} value={filtres.activite ?? ""} onChange={(e) => naviguer({ activite: e.target.value || null })}>
            <option value="">{t("Toute activité")}</option><option value="actif">{t("Actifs (14 j)")}</option><option value="dormant">{t("Dormants")}</option>
          </select>
        </>
      )}
      {demo && (
        <div className="inline-flex rounded-md p-0.5 border" style={{ borderColor: "var(--cc-border-strong)" }} role="group" aria-label={t("Environnement de données")}>
          {(["reel", "demo"] as const).map((s) => (
            <button key={s} onClick={() => naviguer({ source: s })} aria-pressed={filtres.source === s}
              className="px-2.5 h-[26px] rounded text-[12px] font-medium"
              style={filtres.source === s ? { background: s === "demo" ? "var(--cc-violet-bg)" : "var(--cc-surface-3)", color: s === "demo" ? "var(--cc-violet)" : "var(--cc-text)" } : { color: "var(--cc-text-3)" }}>
              {s === "reel" ? t("Réel") : t("Démo")}
            </button>
          ))}
        </div>
      )}
    </>
  );

  const nbSegments = [filtres.pays, filtres.plan, filtres.taille, filtres.acq, filtres.anciennete, filtres.activite].filter(Boolean).length;

  return (
    <div className="cc min-h-screen flex" data-cc-theme={gestion ? "dark" : theme} data-cc-mode={mode}>
      {menu && <div className="lg:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setMenu(false)} />}
      <aside className={`w-60 shrink-0 flex flex-col border-r cc-sep fixed inset-y-0 left-0 z-50 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 cc-no-print ${menu ? "translate-x-0" : "-translate-x-full"}`} style={{ background: "var(--cc-surface)" }}>
        <div className="h-14 px-4 flex items-center gap-2.5 border-b cc-sep">
          <img src={theme === "light" && !gestion ? "/logo.png" : "/logo-dark.png"} alt="Axso" className="h-6 w-auto" />
          <span className="cc-eyebrow" style={{ letterSpacing: "0.12em" }}>Command</span>
          <button className="lg:hidden ml-auto cc-btn cc-btn-ghost cc-btn-sm" onClick={() => setMenu(false)} aria-label={t("Fermer le menu")}><X size={15} /></button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5" aria-label={t("Navigation du Command Center")}>
          {autorise.filter((n) => !n.gestion).map(lienNav)}
          {autorise.some((n) => n.gestion) && <p className="cc-eyebrow px-2.5 pt-4 pb-1.5">{t("Gestion")}</p>}
          {autorise.filter((n) => n.gestion).map(lienNav)}
        </nav>
        <div className="p-2 border-t cc-sep">
          <div className="px-2 pt-1"><LangueSelecteur /></div>
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: "var(--cc-accent-bg)", color: "var(--cc-accent-text)" }}>{email.slice(0, 2).toUpperCase()}</div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium truncate">{email}</p>
              <p className="text-[11px] cc-faint">{t(NOM_ROLE[role])}</p>
            </div>
            <button onClick={() => signOut({ callbackUrl: "/connexion" })} className="cc-btn cc-btn-ghost cc-btn-sm" aria-label={t("Déconnexion")} title={t("Déconnexion")}><LogOut size={14} /></button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 border-b cc-sep cc-no-print" style={{ background: "color-mix(in srgb, var(--cc-bg) 88%, transparent)", backdropFilter: "blur(10px)" }}>
          <div className="h-14 px-3 sm:px-5 flex items-center gap-2">
            <button className="lg:hidden cc-btn cc-btn-ghost cc-btn-sm" onClick={() => setMenu(true)} aria-label={t("Ouvrir le menu")}><Menu size={17} /></button>
            <button onClick={() => window.dispatchEvent(new Event("cc:recherche"))} className="cc-btn flex-1 min-w-0 sm:flex-none sm:w-64 justify-start" style={{ color: "var(--cc-text-3)" }} aria-label={t("Recherche globale (Ctrl+K)")}>
              <Search size={14} /><span className="truncate">{t("Rechercher, demander…")}</span>
              <kbd className="ml-auto hidden sm:inline text-[10.5px] px-1.5 rounded border cc-sep">Ctrl K</kbd>
            </button>
            <div className="ml-auto flex items-center gap-1 shrink-0">
              {!gestion && (
                <button className="md:hidden cc-btn cc-btn-ghost cc-btn-sm relative" onClick={() => setFiltresMobile(!filtresMobile)} aria-expanded={filtresMobile} aria-label={t("Filtres")}>
                  <SlidersHorizontal size={15} />{nbSegments > 0 && <span className="cc-badge cc-badge-accent" style={{ height: 16, padding: "0 5px" }}>{nbSegments}</span>}
                </button>
              )}
              <Live source={filtres.source} />
              <Notifications contexte={contexte} />
              <button onClick={() => window.dispatchEvent(new CustomEvent("cc:copilote", { detail: "" }))} className="cc-btn cc-btn-sm" style={{ borderColor: "var(--cc-accent)", color: "var(--cc-accent-text)" }}>
                <Sparkles size={13} /><span className="hidden sm:inline">Ask Axso</span>
              </button>
              <select className="cc-select hidden md:block" style={{ height: 26, fontSize: 12 }} aria-label={t("Mode d'affichage")} value={mode} onChange={(e) => changerMode(e.target.value as Mode)}>
                <option value="standard">{t("Mode standard")}</option>
                <option value="ceo">CEO Mode</option>
                <option value="analyste">Analyst Mode</option>
              </select>
              {!gestion && <button onClick={changerTheme} className="cc-btn cc-btn-ghost cc-btn-sm" aria-label={theme === "dark" ? t("Passer en thème clair") : t("Passer en thème sombre")}>{theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}</button>}
            </div>
          </div>
          {!gestion && <div className="hidden md:flex flex-wrap items-center gap-1.5 px-5 pb-2.5">{selecteurs}</div>}
          {filtresMobile && !gestion && (
            <div className="md:hidden px-3 sm:px-5 pb-3 grid grid-cols-2 gap-1.5 [&>*]:w-full [&>*]:min-w-0">
              <p className="col-span-2 cc-eyebrow pt-1">{t("Filtres de toutes les pages")}</p>
              {selecteurs}
              <select className="cc-select md:hidden col-span-2" aria-label={t("Mode d'affichage")} value={mode} onChange={(e) => changerMode(e.target.value as Mode)}>
                <option value="standard">{t("Mode standard")}</option><option value="ceo">CEO Mode</option><option value="analyste">Analyst Mode</option>
              </select>
            </div>
          )}
        </header>
        {/* Hors démo autorisée (production), le serveur force la source réelle : ne pas annoncer des données fictives. */}
        {demo && filtres.source === "demo" && !gestion && (
          <div className="px-3 sm:px-5 py-1.5 text-[12px] flex items-center gap-2 cc-no-print" style={{ background: "var(--cc-violet-bg)", color: "var(--cc-violet)" }} role="status">
            <FlaskConical size={13} aria-hidden />
            <span><strong>{t("Données de démonstration")}</strong> — {t("fictives, générées pour présenter le Command Center. Elles ne sont jamais mélangées aux données réelles.")}</span>
            <button className="underline ml-auto shrink-0" onClick={() => naviguer({ source: "reel" })}>{t("Voir le réel")}</button>
          </div>
        )}
        <main className="flex-1 min-w-0">
          <div className={gestion ? "max-w-7xl mx-auto p-4 sm:p-8 lg:p-10" : "max-w-[1440px] mx-auto px-3 sm:px-5 py-5 sm:py-6"}>{children}</div>
        </main>
      </div>
      <CommandBar sections={sections} contexte={contexte} source={filtres.source} />
      <Copilote contexte={contexte} />
    </div>
  );
}
