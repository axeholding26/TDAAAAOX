"use client";
// Liste et formulaire des annonces. Enregistrement : /api/admin/annonces (validé par
// lib/annonces.ts côté serveur, journalisé). En lecture seule, aucun bouton d'action.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pause, Pencil, Play, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/components/I18nProvider";
import { ContenuAnnonce } from "@/components/dashboard/BannierePub";
import { Badge, Carte, EtatVide } from "@/components/command-center/ui";
import { PAYS } from "@/lib/command-center/types";
import { NOMS_PALIERS } from "@/lib/plans";
import { PLANS_ANNONCE } from "@/lib/annonces";

export interface AnnonceAdmin {
  id: string; marque: string; titre: string; texte: string; cta: string; lien: string; logo: string | null; fond: string; accent: string;
  ordre: number; active: boolean; debut: string | null; fin: string | null; pays: string[]; plans: string[]; affichages: number; clics: number;
}
type Champs = Omit<AnnonceAdmin, "id" | "affichages" | "clics">;

const VIDE: Champs = {
  marque: "", titre: "", texte: "", cta: "En savoir plus", lien: "https://", logo: null,
  fond: "linear-gradient(120deg,#111111 0%,#2A1E0A 100%)", accent: "#F5A623", ordre: 0, active: false, debut: null, fin: null, pays: [], plans: [],
};

// <input type="datetime-local"> parle en heure locale ; l'API reçoit de l'ISO.
const versLocal = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); };
const versIso = (v: string) => (v ? new Date(v).toISOString() : null);
const champs = ({ id: _i, affichages: _a, clics: _c, ...reste }: AnnonceAdmin): Champs => reste;

async function envoyer(url: string, method: string, corps?: unknown) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: corps ? JSON.stringify(corps) : undefined }).catch(() => null);
  const d = await r?.json().catch(() => ({}));
  return { ok: !!r?.ok, message: d?.message as string | undefined, erreur: (d?.erreur as string | undefined) ?? "Action impossible" };
}

function statut(a: AnnonceAdmin, t: ReturnType<typeof useT>) {
  const now = Date.now();
  if (!a.active) return <Badge>{t("En pause")}</Badge>;
  if (a.debut && new Date(a.debut).getTime() > now) return <Badge ton="info">{t("Programmée")}</Badge>;
  if (a.fin && new Date(a.fin).getTime() <= now) return <Badge ton="warn">{t("Terminée")}</Badge>;
  return <Badge ton="good">{t("En ligne")}</Badge>;
}

export function GestionAnnonces({ initial, lecture }: { initial: AnnonceAdmin[]; lecture: boolean }) {
  const t = useT();
  const router = useRouter();
  const [edition, setEdition] = useState<string | null>(null); // id, "nouvelle" ou null
  const [charge, setCharge] = useState<string | null>(null);

  const agir = async (id: string, url: string, method: string, corps?: unknown) => {
    setCharge(id);
    const r = await envoyer(url, method, corps);
    setCharge(null);
    if (!r.ok) { toast.error(t(r.erreur)); return false; }
    toast.success(t(r.message ?? "Enregistré"));
    router.refresh();
    return true;
  };
  const prochainOrdre = initial.length ? Math.max(...initial.map((a) => a.ordre)) + 1 : 0;

  return (
    <div className="space-y-3">
      {!lecture && edition !== "nouvelle" && (
        <button className="cc-btn cc-btn-primary cc-btn-sm" onClick={() => setEdition("nouvelle")}><Plus size={13} />{t("Nouvelle annonce")}</button>
      )}
      {edition === "nouvelle" && (
        <Carte titre={t("Nouvelle annonce")}>
          <Formulaire initial={{ ...VIDE, ordre: prochainOrdre }} charge={charge === "nouvelle"} onAnnuler={() => setEdition(null)}
            onEnregistrer={async (c) => { if (await agir("nouvelle", "/api/admin/annonces", "POST", c)) setEdition(null); }} />
        </Carte>
      )}
      {!initial.length && edition !== "nouvelle" && <Carte><EtatVide titre={t("Aucune annonce")} explication={t("Sans annonce active, la bannière n'apparaît pas chez les marchands.")} /></Carte>}
      {initial.map((a) => (
        <Carte key={a.id} titre={<span className="flex items-center gap-2">#{a.ordre} · {a.marque} {statut(a, t)}</span>}
          sousTitre={t("{0} affichages · {1} clics · taux de clic {2}", a.affichages.toLocaleString(t.loc), a.clics.toLocaleString(t.loc), a.affichages ? `${((a.clics / a.affichages) * 100).toLocaleString(t.loc, { maximumFractionDigits: 1 })} %` : "—")}
          actions={!lecture && edition !== a.id && (
            <>
              <button className="cc-btn cc-btn-sm" disabled={charge === a.id} onClick={() => agir(a.id, `/api/admin/annonces/${a.id}`, "PATCH", { ...champs(a), active: !a.active })}>
                {charge === a.id ? <Loader2 size={12} className="animate-spin" /> : a.active ? <Pause size={12} /> : <Play size={12} />}{t(a.active ? "Désactiver" : "Activer")}
              </button>
              <button className="cc-btn cc-btn-ghost cc-btn-sm" onClick={() => setEdition(a.id)} aria-label={t("Modifier")}><Pencil size={12} /></button>
              <button className="cc-btn cc-btn-ghost cc-btn-sm" disabled={charge === a.id} aria-label={t("Supprimer")}
                onClick={() => { if (confirm(t("Supprimer définitivement l'annonce « {0} » ? Ses compteurs seront perdus.", a.marque))) agir(a.id, `/api/admin/annonces/${a.id}`, "DELETE"); }}><Trash2 size={12} /></button>
            </>
          )}>
          {edition === a.id
            ? <Formulaire initial={champs(a)} charge={charge === a.id} onAnnuler={() => setEdition(null)}
                onEnregistrer={async (c) => { if (await agir(a.id, `/api/admin/annonces/${a.id}`, "PATCH", c)) setEdition(null); }} />
            : <>
                <Apercu a={a} />
                <p className="cc-faint text-[11.5px] mt-2">
                  {a.lien}
                  {" · "}{a.pays.length ? a.pays.map((p) => t(PAYS[p] ?? p)).join(", ") : t("tous pays")}
                  {" · "}{a.plans.length ? a.plans.map((p) => t(NOMS_PALIERS[p as keyof typeof NOMS_PALIERS] ?? p)).join(", ") : t("tous abonnements")}
                  {a.debut && <> · {t("dès le {0}", new Date(a.debut).toLocaleString(t.loc))}</>}
                  {a.fin && <> · {t("jusqu'au {0}", new Date(a.fin).toLocaleString(t.loc))}</>}
                </p>
              </>}
        </Carte>
      ))}
    </div>
  );
}

/** Aperçu fidèle à la bannière marchand (non cliquable). */
function Apercu({ a }: { a: Pick<AnnonceAdmin, "marque" | "titre" | "texte" | "cta" | "lien" | "logo" | "fond" | "accent"> }) {
  return (
    <div className="pointer-events-none rounded-3xl p-5 sm:p-6 text-white" style={{ background: a.fond }} aria-hidden>
      <ContenuAnnonce a={{ id: "apercu", ...a, marque: a.marque || "Marque", titre: a.titre || "Titre", texte: a.texte || "Texte", cta: a.cta || "Bouton", lien: a.lien || "/" }} />
    </div>
  );
}

function Formulaire({ initial, charge, onAnnuler, onEnregistrer }: { initial: Champs; charge: boolean; onAnnuler: () => void; onEnregistrer: (c: Champs) => void }) {
  const t = useT();
  const [c, setC] = useState(initial);
  const maj = (p: Partial<Champs>) => setC({ ...c, ...p });
  const bascule = (liste: string[], v: string) => (liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v]);
  const champ = (cle: "marque" | "titre" | "texte" | "cta" | "lien", nom: string, max: number) => (
    <label className="block text-[12px]">
      <span className="cc-muted">{t(nom)}</span>
      {cle === "texte"
        ? <textarea className="cc-input w-full mt-1 min-h-[64px] py-2" required maxLength={max} value={c[cle]} onChange={(e) => maj({ [cle]: e.target.value })} />
        : <input className="cc-input w-full mt-1" required maxLength={max} value={c[cle]} onChange={(e) => maj({ [cle]: e.target.value })} />}
    </label>
  );

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onEnregistrer(c); }}>
      <Apercu a={c} />
      <div className="grid gap-3 md:grid-cols-2">
        {champ("marque", "Marque / sur-titre", 60)}
        {champ("titre", "Titre", 90)}
        <div className="md:col-span-2">{champ("texte", "Texte", 220)}</div>
        {champ("cta", "Libellé du bouton", 30)}
        <div>
          {champ("lien", "Lien (https://… ouvre un nouvel onglet, /dashboard/… reste dans Axso)", 500)}
        </div>
        <label className="block text-[12px]"><span className="cc-muted">{t("Logo (URL https://…, facultatif)")}</span>
          <input className="cc-input w-full mt-1" maxLength={500} value={c.logo ?? ""} onChange={(e) => maj({ logo: e.target.value || null })} /></label>
        <label className="block text-[12px]"><span className="cc-muted">{t("Ordre (0 = en premier)")}</span>
          <input className="cc-input w-full mt-1" type="number" min={0} max={999} value={c.ordre} onChange={(e) => maj({ ordre: Math.max(0, Math.round(Number(e.target.value) || 0)) })} /></label>
        <label className="block text-[12px]"><span className="cc-muted">{t("Fond (#hex ou linear-gradient(120deg,#… 0%,#… 100%))")}</span>
          <input className="cc-input w-full mt-1 font-mono" required maxLength={200} value={c.fond} onChange={(e) => maj({ fond: e.target.value })} /></label>
        <label className="block text-[12px]"><span className="cc-muted">{t("Couleur d'accent")}</span>
          <span className="flex gap-2 mt-1">
            <input type="color" className="h-9 w-12 rounded cursor-pointer" value={/^#[0-9a-fA-F]{6}$/.test(c.accent) ? c.accent : "#F5A623"} onChange={(e) => maj({ accent: e.target.value })} aria-label={t("Couleur d'accent")} />
            <input className="cc-input flex-1 font-mono" required maxLength={9} value={c.accent} onChange={(e) => maj({ accent: e.target.value })} />
          </span></label>
        <label className="block text-[12px]"><span className="cc-muted">{t("Début (facultatif)")}</span>
          <input className="cc-input w-full mt-1" type="datetime-local" value={versLocal(c.debut)} onChange={(e) => maj({ debut: versIso(e.target.value) })} /></label>
        <label className="block text-[12px]"><span className="cc-muted">{t("Fin (facultatif)")}</span>
          <input className="cc-input w-full mt-1" type="datetime-local" value={versLocal(c.fin)} onChange={(e) => maj({ fin: versIso(e.target.value) })} /></label>
      </div>
      <fieldset className="text-[12px]">
        <legend className="cc-muted mb-1">{t("Abonnements ciblés (aucun coché = tous)")}</legend>
        <div className="flex flex-wrap gap-3">
          {PLANS_ANNONCE.map((p) => <label key={p} className="flex items-center gap-1.5"><input type="checkbox" checked={c.plans.includes(p)} onChange={() => maj({ plans: bascule(c.plans, p) })} />{t(NOMS_PALIERS[p])}</label>)}
        </div>
      </fieldset>
      <fieldset className="text-[12px]">
        <legend className="cc-muted mb-1">{t("Pays des boutiques ciblées (aucun coché = tous)")}</legend>
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {Object.entries(PAYS).map(([iso, nom]) => <label key={iso} className="flex items-center gap-1.5"><input type="checkbox" checked={c.pays.includes(iso)} onChange={() => maj({ pays: bascule(c.pays, iso) })} />{t(nom)}</label>)}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <label className="flex items-center gap-1.5 text-[12.5px]"><input type="checkbox" checked={c.active} onChange={(e) => maj({ active: e.target.checked })} />{t("Active (diffusée)")}</label>
        <span className="flex-1" />
        <button type="button" className="cc-btn cc-btn-ghost cc-btn-sm" onClick={onAnnuler}><X size={12} />{t("Annuler")}</button>
        <button className="cc-btn cc-btn-primary cc-btn-sm" disabled={charge}>{charge ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}{t("Enregistrer")}</button>
      </div>
    </form>
  );
}
