"use client";
// Socle des écrans de pilotage (pilotage, analytics, supervision, journal) :
// période et filtres, panneau d'alertes, libellés des faits du magasin.
// Les cartes, l'en-tête et la lecture des routes viennent de
// components/pos/finance/commun (même allure que les écrans de finance).
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Info, OctagonAlert, X } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { Badge, Bouton, CLASSE_SAISIE, Champ, EtatPos, EtatVide, FOCUS, Saisie, TONS } from "@/components/pos/ui";
import { appelPos, useLecture } from "@/components/pos/finance/commun";
import type { Alerte } from "@/lib/pos/alertes";

export type ListesFiltres = {
  magasins: { id: string; nom: string; demo: boolean; actif: boolean; caisses: { id: string; nom: string; actif: boolean; ouverte: boolean }[] }[];
  vendeurs: { id: string; nom: string }[];
  categories: string[];
};

// ─── Période et filtres ───────────────────────────────────────────────────────

export type Preset = "aujourdhui" | "semaine" | "mois" | "periode";
export type Filtres = { preset: Preset; du: string; au: string; magasinId: string; caisseId: string; vendeurId: string; categorie: string; produitId: string; produitNom: string };
export const FILTRES_VIDES: Filtres = { preset: "aujourdhui", du: "", au: "", magasinId: "", caisseId: "", vendeurId: "", categorie: "", produitId: "", produitNom: "" };

const minuit = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Bornes de la période, à l'heure du navigateur. La fin est le lendemain à minuit : la requête reste la même toute la journée. */
export function bornes(f: Pick<Filtres, "preset" | "du" | "au">, maintenant = new Date()): { debut: Date; fin: Date } | null {
  const aujourdhui = minuit(maintenant);
  const demain = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() + 1);
  if (f.preset === "aujourdhui") return { debut: aujourdhui, fin: demain };
  if (f.preset === "semaine") return { debut: new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() - ((aujourdhui.getDay() + 6) % 7)), fin: demain };
  if (f.preset === "mois") return { debut: new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1), fin: demain };
  if (!f.du || !f.au) return null;
  const debut = new Date(`${f.du}T00:00:00`), dernier = new Date(`${f.au}T00:00:00`);
  if (Number.isNaN(debut.getTime()) || Number.isNaN(dernier.getTime()) || dernier < debut) return null;
  return { debut, fin: new Date(dernier.getFullYear(), dernier.getMonth(), dernier.getDate() + 1) };
}

/** Paramètres d'URL des routes de pilotage, ou null tant que la période saisie est incomplète. */
export function requeteFiltres(f: Filtres): string | null {
  const b = bornes(f);
  if (!b) return null;
  const p = new URLSearchParams({ debut: b.debut.toISOString(), fin: b.fin.toISOString() });
  try { p.set("tz", Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { /* fuseau inconnu : le serveur découpe en UTC */ }
  for (const cle of ["magasinId", "caisseId", "vendeurId", "categorie", "produitId"] as const) if (f[cle]) p.set(cle, f[cle]);
  return p.toString();
}

const PRESETS: [Preset, string][] = [["aujourdhui", "Aujourd'hui"], ["semaine", "Cette semaine"], ["mois", "Ce mois"], ["periode", "Période"]];

/** Recherche d'un produit du catalogue pour le filtre « produit » (route /api/pos/articles). */
function FiltreProduit({ valeur, nom, onChoisir }: { valeur: string; nom: string; onChoisir: (id: string, nom: string) => void }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [resultats, setResultats] = useState<{ produitId: string; nom: string }[]>([]);
  const tour = useRef(0);
  useEffect(() => {
    if (q.trim().length < 2) { setResultats([]); return; }
    const moi = ++tour.current;
    const minuterie = setTimeout(async () => {
      const r = await appelPos<{ articles: { produitId: string; nom: string }[] }>(`/api/pos/articles?q=${encodeURIComponent(q.trim())}&limite=8`);
      if (moi === tour.current && r.ok) setResultats([...new Map(r.donnees.articles.map((a) => [a.produitId, a])).values()]);
    }, 250);
    return () => clearTimeout(minuterie);
  }, [q]);

  if (valeur) {
    return (
      <div>
        <p className="mb-1 text-[12px] font-semibold text-[#111111]">{t("Produit")}</p>
        <button type="button" onClick={() => onChoisir("", "")} className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-[#FDE68A] bg-[#FFF7ED] px-3 text-left text-[13px] font-semibold text-[#111111] ${FOCUS}`}>
          <span className="truncate">{nom}</span><X size={15} aria-hidden /><span className="sr-only">{t("Retirer ce filtre")}</span>
        </button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Saisie label="Produit" placeholder={t("Chercher un produit…")} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      {resultats.length > 0 && (
        <ul className="absolute left-0 right-0 z-10 mt-1 max-h-60 overflow-y-auto rounded-xl border border-[#E8E8E8] bg-white p-1 shadow-lg">
          {resultats.map((a) => (
            <li key={a.produitId}>
              <button type="button" onClick={() => { onChoisir(a.produitId, a.nom); setQ(""); setResultats([]); }} className={`min-h-11 w-full rounded-lg px-3 text-left text-[13px] hover:bg-[#F5F5F5] ${FOCUS}`}>{a.nom}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Barre de filtres : aujourd'hui / semaine / mois / période, magasin, caisse,
 * catégorie, produit, vendeur. `sans` retire des filtres (la supervision n'a
 * besoin que de la période).
 */
export function BarreFiltres({ filtres, onChange, listes, sans = [] }: { filtres: Filtres; onChange: (f: Filtres) => void; listes: ListesFiltres | null; sans?: ("vendeur" | "categorie" | "produit" | "caisse")[] }) {
  const t = useT();
  const regler = (modif: Partial<Filtres>) => onChange({ ...filtres, ...modif });
  const magasins = listes?.magasins.filter((m) => !m.demo) ?? [];
  const caisses = magasins.filter((m) => !filtres.magasinId || m.id === filtres.magasinId).flatMap((m) => m.caisses.map((c) => ({ id: c.id, nom: magasins.length > 1 ? `${c.nom} — ${m.nom}` : c.nom })));
  const incomplete = filtres.preset === "periode" && !bornes(filtres);
  return (
    <section aria-label={t("Filtres")} className="rounded-2xl border border-[#E8E8E8] bg-white p-3 sm:p-4">
      <div role="group" aria-label={t("Période")} className="flex flex-wrap gap-2">
        {PRESETS.map(([id, libelle]) => (
          <button key={id} type="button" aria-pressed={filtres.preset === id} onClick={() => regler({ preset: id })}
            className={`min-h-11 rounded-xl px-4 text-[13px] font-bold transition-colors ${FOCUS} ${filtres.preset === id ? "bg-[#111111] text-white" : "border border-[#E8E8E8] bg-white text-[#111111] hover:bg-[#F5F5F5]"}`}>
            {t(libelle)}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {filtres.preset === "periode" && (
          <>
            <Saisie label="Du" type="date" value={filtres.du} max={filtres.au || undefined} onChange={(e) => regler({ du: e.target.value })} />
            <Saisie label="Au" type="date" value={filtres.au} min={filtres.du || undefined} onChange={(e) => regler({ au: e.target.value })} erreur={incomplete && filtres.du && filtres.au ? t("La date de fin précède la date de début.") : null} />
          </>
        )}
        {magasins.length > 1 && (
          <Champ label="Magasin">{(a) => (
            <select {...a} className={CLASSE_SAISIE} value={filtres.magasinId} onChange={(e) => regler({ magasinId: e.target.value, caisseId: "" })}>
              <option value="">{t("Tous les magasins")}</option>
              {magasins.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
            </select>
          )}</Champ>
        )}
        {!sans.includes("caisse") && caisses.length > 1 && (
          <Champ label="Caisse">{(a) => (
            <select {...a} className={CLASSE_SAISIE} value={filtres.caisseId} onChange={(e) => regler({ caisseId: e.target.value })}>
              <option value="">{t("Toutes les caisses")}</option>
              {caisses.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          )}</Champ>
        )}
        {!sans.includes("vendeur") && (listes?.vendeurs.length ?? 0) > 0 && (
          <Champ label="Vendeur">{(a) => (
            <select {...a} className={CLASSE_SAISIE} value={filtres.vendeurId} onChange={(e) => regler({ vendeurId: e.target.value })}>
              <option value="">{t("Tous les vendeurs")}</option>
              {listes!.vendeurs.map((v) => <option key={v.id} value={v.id}>{v.nom}</option>)}
            </select>
          )}</Champ>
        )}
        {!sans.includes("categorie") && (listes?.categories.length ?? 0) > 0 && (
          <Champ label="Catégorie">{(a) => (
            <select {...a} className={CLASSE_SAISIE} value={filtres.categorie} onChange={(e) => regler({ categorie: e.target.value })}>
              <option value="">{t("Toutes les catégories")}</option>
              {listes!.categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}</Champ>
        )}
        {!sans.includes("produit") && <FiltreProduit valeur={filtres.produitId} nom={filtres.produitNom} onChoisir={(produitId, produitNom) => regler({ produitId, produitNom })} />}
      </div>
      {incomplete && !(filtres.du && filtres.au) && <p className="mt-2 text-[12px] text-[#666666]">{t("Choisissez la date de début et la date de fin.")}</p>}
    </section>
  );
}

/** Filtres + URL prête pour une route de pilotage (`null` tant que la période est incomplète). */
export function useFiltres(route: string) {
  const [filtres, setFiltres] = useState<Filtres>(FILTRES_VIDES);
  const url = useMemo(() => { const q = requeteFiltres(filtres); return q ? `${route}?${q}` : null; }, [route, filtres]);
  return { filtres, setFiltres, url };
}

// ─── Alertes ──────────────────────────────────────────────────────────────────

const GRAVITES = {
  critique: { ton: "danger", libelle: "Critique", Icone: OctagonAlert },
  attention: { ton: "attention", libelle: "À surveiller", Icone: AlertTriangle },
  info: { ton: "info", libelle: "Information", Icone: Info },
} as const;
const CATEGORIES: Record<Alerte["categorie"], string> = { stock: "Stock", finance: "Finance", commerce: "Commerce", operationnel: "Opérationnel" };

export function ListeAlertes({ alertes }: { alertes: Alerte[] }) {
  const t = useT();
  if (!alertes.length) return <EtatVide compact titre="Aucune alerte en cours" texte="Stock, caisse, ventes et appareils : rien à signaler pour l'instant." />;
  return (
    <ul className="space-y-2">
      {alertes.map((a) => {
        const g = GRAVITES[a.gravite];
        return (
          <li key={a.cle} className="rounded-xl p-3" style={TONS[g.ton]}>
            <div className="flex items-start gap-3">
              <g.Icone size={18} className="mt-0.5 flex-shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-[#111111]">{t(a.titre)} <span className="sr-only">— {t(g.libelle)}</span></p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#333333]">{a.message}</p>
                <details className="mt-1">
                  <summary className={`cursor-pointer rounded text-[11.5px] font-semibold text-[#666666] ${FOCUS}`}>{t("Pourquoi cette alerte ?")}</summary>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-[#666666]">{a.explication}</p>
                </details>
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-2">
                <Badge ton="neutre">{t(CATEGORIES[a.categorie])}</Badge>
                <Link href={a.lien} className={`rounded text-[12px] font-bold text-[#111111] underline underline-offset-2 ${FOCUS}`}>{t("Voir")}</Link>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Alertes du magasin, relues à l'ouverture et à la demande (`version` change → relecture). */
export function PanneauAlertes({ version = 0 }: { version?: number }) {
  const { donnees, erreur, charge, recharger } = useLecture<{ alertes: Alerte[] }>("/api/pos/alertes");
  const premiere = useRef(true);
  useEffect(() => { if (premiere.current) { premiere.current = false; return; } void recharger(); }, [version, recharger]);
  if (erreur && !donnees) return <EtatPos compact code={erreur.code} message={erreur.message} onReessayer={recharger} />;
  if (!donnees) return <p role="status" className="py-4 text-center text-[12.5px] text-[#666666]">{charge ? "…" : ""}</p>;
  return <ListeAlertes alertes={donnees.alertes} />;
}

// ─── Faits du magasin (flux temps réel et journal) ────────────────────────────

export type Fait = { seq: string | null; type: string; magasinId: string | null; caisseId: string | null; payload: Record<string, unknown>; createdAt: string };

const TITRES_FAITS: Record<string, string> = {
  "sale.created": "Vente", "sale.cancelled": "Vente annulée", "return.created": "Retour", "scan.created": "Scan",
  "cash.opened": "Caisse ouverte", "cash.closed": "Caisse fermée", "cash.movement": "Mouvement de caisse",
  "device.connected": "Scanner connecté", "device.disconnected": "Scanner déconnecté", "alert.created": "Alerte", "payment.updated": "Paiement pointé", "inventory.updated": "Stock mis à jour",
};
export const titreFait = (type: string) => TITRES_FAITS[type] ?? type;
export const tonFait = (type: string): keyof typeof TONS =>
  type === "sale.created" ? "positif" : type === "sale.cancelled" || type === "return.created" ? "danger" : type === "alert.created" ? "attention" : type.startsWith("cash.") ? "accent" : "neutre";

const texteDe = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");

/** Montant porté par un fait (vente, retour, mouvement), s'il y en a un. */
export function montantFait(f: Fait): number | null {
  const p = f.payload;
  const v = p.total ?? p.montant ?? p.rembourse;
  return typeof v === "number" ? v : null;
}

/** Précision courte : numéro de vente, article scanné, nom de l'appareil… */
export function detailFait(f: Fait): string {
  const p = f.payload;
  if (f.type === "scan.created") return [(p.article as { nom?: string } | null)?.nom ?? texteDe(p.message), texteDe(p.code)].filter(Boolean).join(" · ");
  return [texteDe(p.numero), texteDe(p.vendeur) || texteDe(p.auteur), texteDe(p.titre) || texteDe(p.nom) || texteDe(p.motif)].filter(Boolean).join(" · ");
}

export const heure = (iso: string, loc?: string) => new Date(iso).toLocaleTimeString(loc ?? "fr-FR", { hour: "2-digit", minute: "2-digit" });
export const dateHeure = (iso: string, loc?: string) => new Date(iso).toLocaleString(loc ?? "fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** Bouton « Actualiser » commun. */
export function Actualiser({ onClick, charge }: { onClick: () => void; charge: boolean }) {
  const t = useT();
  return <Bouton variante="secondaire" taille="compact" onClick={onClick} charge={charge}>{t("Actualiser")}</Bouton>;
}
