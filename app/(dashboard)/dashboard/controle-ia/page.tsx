"use client";

// Contrôle IA : les assistants externes (Claude, ChatGPT, Gemini…) reliés à la boutique,
// ce qu'ils ont le droit de faire, ce qu'ils ont fait, et ce qui attend un accord.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Copy, ShieldOff, Check, X, Loader2, Pause, Play, Trash2, Lock, Unlock, ExternalLink, RotateCcw } from "lucide-react";
import { useT } from "@/components/I18nProvider";

interface Droit { libelle: string; niveau: string }
interface Connexion { id: string; client: string; fournisseur: string; droits: Droit[]; mode: string; variationPrixMax: number; budgetPubMax: number; transactionMax: number; risqueBuilderMax: string; utiliseLe: string | null; createdAt: string }
interface Action { id: string; client: string; outil: string; risque: string; entree: string; sortie: string; statut: string; avant: Record<string, unknown> | null; apres: Record<string, unknown> | null; annuleLe: string | null; createdAt: string }
interface Accord { id: string; type: string; message: string }
interface Activite { total: number; parStatut: Record<string, number>; outils: { outil: string; appels: number; dureeMoyenneMs: number }[] }
interface Automatisation { id: string; nom: string; actif: boolean; resume?: string; executions: number; derniereExecution: string | null; dernierResultat: string | null }
interface VersionB { numero: number; type: string; client: string | null; raison: string; createdAt: string; nbChangements: number }
interface Builder {
  verrou: boolean; peutDecider: boolean;
  brouillon: { changements: number; resume: string; enLigneAChange: boolean; apercu: string | null } | null;
  versions: VersionB[];
  activite: { id: string; client: string; outil: string; risque: string; statut: string; createdAt: string; sortie: string }[];
  metriques: Record<string, number>;
}
interface Webhook { id: string; url: string; evenements: string[]; actif: boolean; echecs: number }
interface Service { type: string; nom?: string; compte?: string | null; statut: string; expireLe?: string | null }

const FOURNISSEURS = [["claude", "Claude"], ["chatgpt", "ChatGPT"], ["gemini", "Gemini"]] as const;

const MODES: Record<string, { label: string; aide: string }> = {
  assistant: { label: "Assistant", aide: "Il consulte et prépare ; chaque modification attend ton accord." },
  copilot: { label: "Copilote", aide: "Il modifie le catalogue et la boutique ; les actions sensibles attendent ton accord." },
  autopilot: { label: "Autopilote", aide: "Il agit seul dans les limites ci-dessous. Au-delà, et pour tout ce qui engage de l'argent sans limite fixée, il attend ton accord." },
};

const STATUTS: Record<string, { label: string; couleur: string }> = {
  execute: { label: "Fait", couleur: "#10b981" },
  accord_demande: { label: "Accord demandé", couleur: "#F5A623" },
  refuse: { label: "Refusé", couleur: "#ef4444" },
  echec: { label: "Échec", couleur: "#ef4444" },
  en_cours: { label: "En cours", couleur: "#9ca3af" },
};

const date = (d: string | null | undefined) => (d ? new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—");
const json = (r: Response): Promise<any> => (r.ok ? r.json() : Promise.resolve({}));
const champ = "border border-gray-200 rounded-lg px-2 py-1.5 text-sm";

export default function ControleIAPage() {
  const tr = useT();
  const [connexions, setConnexions] = useState<Connexion[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [accords, setAccords] = useState<Accord[]>([]);
  const [activite, setActivite] = useState<Activite | null>(null);
  const [automatisations, setAutomatisations] = useState<Automatisation[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [builder, setBuilder] = useState<Builder | null>(null);
  const [secret, setSecret] = useState<{ id: string; valeur: string } | null>(null);
  const [urlMcp, setUrlMcp] = useState("");
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    const [c, p, a, s, b] = await Promise.all([
      fetch("/api/controle-ia").then(json),
      fetch("/api/axia/propositions").then(json).catch(() => ({})),
      fetch("/api/controle-ia/automatisations").then(json).catch(() => ({})),
      fetch("/api/controle-ia/services").then(json).catch(() => ({})),
      fetch("/api/controle-ia/builder").then(json).catch(() => ({})),
    ]);
    setBuilder(b.metriques ? b : null);
    setConnexions(c.connexions ?? []); setActions(c.actions ?? []); setUrlMcp(c.urlMcp ?? ""); setActivite(c.activite ?? null);
    setAccords((p.propositions ?? []).filter((x: Accord) => x.type === "confirmation"));
    setAutomatisations(a.automatisations ?? []); setWebhooks(a.webhooks ?? []); setServices(s.services ?? []);
    setChargement(false);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  async function appel(url: string, init: RequestInit, ok: string, ko: string) {
    const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
    if (r.ok) toast.success(tr(ok)); else toast.error(tr(ko));
    charger();
  }

  const regler = (c: Connexion, modif: Partial<Connexion>) => {
    const { id, mode, variationPrixMax, budgetPubMax, transactionMax, risqueBuilderMax } = { ...c, ...modif };
    return appel("/api/controle-ia", { method: "PATCH", body: JSON.stringify({ id, mode, variationPrixMax, budgetPubMax, transactionMax, risqueBuilderMax }) }, "Réglage enregistré", "Réglage refusé");
  };

  async function decider(id: string, decision: "accepter" | "refuser") {
    const r = await fetch("/api/axia/propositions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, decision }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.succes === false) toast.error(d.resultat ?? d.error ?? tr("L'action a échoué"));
    else toast.success(decision === "accepter" ? tr("Action autorisée") : tr("Action refusée"));
    charger();
  }

  // Le secret n'est montré qu'une fois : le serveur ne le renvoie plus jamais ensuite.
  async function nouveauSecret(id: string) {
    const r = await fetch("/api/controle-ia/automatisations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ webhook: id, action: "nouveau_secret" }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.secret) setSecret({ id, valeur: d.secret }); else toast.error(tr("Action refusée"));
    charger();
  }

  if (chargement) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" /></div>;

  const limite = (c: Connexion, cle: "variationPrixMax" | "budgetPubMax" | "transactionMax", label: string, max: number) => (
    <label className="text-sm text-gray-700 flex items-center gap-2">{tr(label)}
      <input type="number" min={0} max={max} defaultValue={c[cle]} className={`${champ} w-28`}
        onBlur={(e) => { const v = Math.min(max, Math.max(0, Number(e.target.value) || 0)); if (v !== c[cle]) regler(c, { [cle]: v }); }} />
    </label>
  );

  return (
    <div className="space-y-6" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={18} className="text-[#F5A623]" />
          <h1 className="text-2xl font-bold text-gray-900">{tr("Contrôle IA")}</h1>
        </div>
        <p className="text-gray-400 text-sm">{tr("Pilote ta boutique depuis Claude, ChatGPT ou un autre assistant, sans jamais lui donner ton mot de passe.")}</p>
      </div>

      <div className="ax-card p-6 space-y-4">
        <h2 className="font-bold text-gray-900">{tr("Relier un assistant")}</h2>
        <div className="grid grid-cols-3 gap-2">
          {FOURNISSEURS.map(([id, nom]) => {
            const relie = connexions.some((c) => c.fournisseur === id);
            return (
              <div key={id} className="border border-gray-100 rounded-xl p-3">
                <p className="font-semibold text-gray-900 text-sm">{nom}</p>
                <p className="text-xs" style={{ color: relie ? "#10b981" : "#9ca3af" }}>{relie ? tr("Relié") : tr("Non relié")}</p>
              </div>
            );
          })}
        </div>
        <p className="text-sm text-gray-500">{tr("Dans ton assistant, ajoute un connecteur personnalisé (serveur MCP) avec cette adresse. Il t'enverra ici pour choisir la boutique et les droits.")}</p>
        <div className="flex gap-2">
          <input readOnly value={urlMcp} aria-label={tr("Adresse du serveur MCP")} className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50" />
          <button onClick={() => navigator.clipboard.writeText(urlMcp).then(() => toast.success(tr("Adresse copiée")))} className="ax-btn ax-btn-secondary flex items-center gap-1.5"><Copy size={14} />{tr("Copier")}</button>
        </div>
      </div>

      <div className="ax-card p-6 space-y-4">
        <h2 className="font-bold text-gray-900">{tr("Assistants reliés")}</h2>
        {connexions.length === 0 && <p className="text-sm text-gray-400">{tr("Aucun assistant relié pour l'instant.")}</p>}
        {connexions.map((c) => (
          <div key={c.id} className="border border-gray-100 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 break-words">{c.client}</p>
                <p className="text-xs text-gray-400">{tr("Relié le")} {date(c.createdAt)} · {tr("dernière action")} {date(c.utiliseLe)}</p>
              </div>
              <button onClick={() => appel(`/api/controle-ia?id=${c.id}`, { method: "DELETE" }, "Accès coupé", "Impossible de couper l'accès")} className="flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:underline shrink-0"><ShieldOff size={14} />{tr("Couper l'accès")}</button>
            </div>
            <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
              {c.droits.map((d) => (
                <li key={d.libelle} className="flex items-start gap-2 text-xs" style={{ color: d.niveau === "aucun" ? "#9ca3af" : "#374151" }}>
                  {d.niveau === "aucun" ? <X size={13} className="mt-0.5 shrink-0" /> : <Check size={13} className="mt-0.5 shrink-0 text-emerald-500" />}
                  <span>{tr(d.libelle)}{d.niveau !== "aucun" && d.niveau !== "oui" ? ` — ${tr(d.niveau)}` : ""}</span>
                </li>
              ))}
            </ul>
            <label className="text-sm text-gray-700 flex items-center gap-2">{tr("Mode")}
              <select value={c.mode} onChange={(e) => regler(c, { mode: e.target.value })} className={champ}>
                {Object.entries(MODES).map(([m, { label }]) => <option key={m} value={m}>{tr(label)}</option>)}
              </select>
            </label>
            <p className="text-xs text-gray-400">{tr(MODES[c.mode]?.aide ?? "")}</p>
            {c.mode === "autopilot" && (
              <div className="flex flex-wrap gap-3">
                {limite(c, "variationPrixMax", "Variation de prix max (%)", 100)}
                {limite(c, "budgetPubMax", "Budget publicitaire max par action", 1_000_000_000)}
                {limite(c, "transactionMax", "Achat ou paiement max par action", 1_000_000_000)}
                <label className="text-sm text-gray-700 flex items-center gap-2">{tr("Publication de la boutique sans accord")}
                  <select value={c.risqueBuilderMax} onChange={(e) => regler(c, { risqueBuilderMax: e.target.value })} className={champ}>
                    <option value="faible">{tr("petits changements seulement")}</option>
                    <option value="moyen">{tr("jusqu'aux changements moyens")}</option>
                  </select>
                </label>
                <p className="text-xs text-gray-400 w-full">{tr("0 = toujours avec ton accord.")}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="ax-card p-6 space-y-3">
        <h2 className="font-bold text-gray-900">{tr("En attente de ton accord")} ({accords.length})</h2>
        {accords.length === 0 && <p className="text-sm text-gray-400">{tr("Rien à valider.")}</p>}
        {accords.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-xl p-3">
            <p className="text-sm text-gray-800 min-w-0 break-words">{a.message}</p>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => decider(a.id, "refuser")} aria-label={tr("Refuser")} className="ax-btn ax-btn-secondary"><X size={14} /></button>
              <button onClick={() => decider(a.id, "accepter")} className="ax-btn ax-btn-primary flex items-center gap-1.5"><Check size={14} />{tr("Autoriser")}</button>
            </div>
          </div>
        ))}
      </div>

      {builder && (
        <div className="ax-card p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-bold text-gray-900">{tr("Ta boutique et les IA")}</h2>
              <p className="text-sm text-gray-500">{tr("Les assistants préparent leurs changements dans un brouillon ; ta boutique en ligne ne change qu'à la publication.")}</p>
            </div>
            {builder.peutDecider && (
              <button onClick={() => appel("/api/controle-ia/builder", { method: "PATCH", body: JSON.stringify({ verrou: !builder.verrou }) }, builder.verrou ? "Modification par les IA réactivée" : "Modification par les IA bloquée", "Action refusée")}
                className={`ax-btn flex items-center gap-1.5 shrink-0 ${builder.verrou ? "ax-btn-primary" : "ax-btn-secondary"}`}>
                {builder.verrou ? <Unlock size={14} /> : <Lock size={14} />}{tr(builder.verrou ? "Débloquer" : "Bloquer les IA")}
              </button>
            )}
          </div>
          {builder.verrou && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{tr("Verrou actif : aucune IA ne peut modifier ta boutique.")}</p>}

          {builder.brouillon && (
            <div className="border border-amber-200 bg-amber-50 rounded-xl p-3 space-y-2">
              <p className="text-sm font-semibold text-gray-900">{tr("Brouillon en attente")} · {builder.brouillon.changements} {tr("changements")}</p>
              <pre className="text-xs text-gray-600 whitespace-pre-wrap break-words font-sans">{builder.brouillon.resume}</pre>
              {builder.brouillon.enLigneAChange && <p className="text-xs text-red-600">{tr("Tu as modifié la boutique en ligne depuis : la publication de ce brouillon sera refusée sans ton accord explicite.")}</p>}
              <div className="flex flex-wrap gap-2">
                {builder.brouillon.apercu && <a href={builder.brouillon.apercu} target="_blank" rel="noopener noreferrer" className="ax-btn ax-btn-secondary flex items-center gap-1.5"><ExternalLink size={14} />{tr("Voir l'aperçu")}</a>}
                {builder.peutDecider && <button onClick={() => appel("/api/controle-ia/builder", { method: "PATCH", body: JSON.stringify({ abandonner: true }) }, "Brouillon abandonné", "Action refusée")} className="ax-btn ax-btn-secondary">{tr("Abandonner")}</button>}
              </div>
            </div>
          )}

          {builder.activite.length > 0 && (
            <div className="space-y-1.5">
              <p className="ax-label">{tr("Activité")}</p>
              {builder.activite.map((x) => (
                <details key={x.id} className="text-sm">
                  <summary className="cursor-pointer flex flex-wrap gap-x-2">
                    <span className="font-medium text-gray-900">{x.client}</span>
                    <span className="text-gray-400">{date(x.createdAt)}</span>
                    <span className="text-gray-700">{x.outil.replace(/^axso_builder_/, "").replace(/_/g, " ")}</span>
                    <span className="text-gray-400">· {tr("risque")} {x.risque}</span>
                    <span style={{ color: STATUTS[x.statut]?.couleur }}>· {tr(STATUTS[x.statut]?.label ?? x.statut)}</span>
                  </summary>
                  <pre className="text-xs text-gray-500 whitespace-pre-wrap break-words font-sans mt-1">{x.sortie}</pre>
                </details>
              ))}
            </div>
          )}

          {builder.versions.length > 0 && (
            <div className="space-y-1.5">
              <p className="ax-label">{tr("Versions")}</p>
              {builder.versions.map((v) => (
                <div key={v.numero} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 break-words text-gray-700">v{v.numero} · {date(v.createdAt)} · {v.client ?? tr("toi")} — {v.raison}{v.nbChangements ? ` (${v.nbChangements})` : ""}</span>
                  {builder.peutDecider && (
                    <button onClick={() => appel("/api/controle-ia/builder", { method: "PATCH", body: JSON.stringify({ restaurer: v.numero }) }, "Version remise en ligne", "Restauration refusée")}
                      className="text-xs font-semibold text-gray-700 hover:underline flex items-center gap-1 shrink-0"><RotateCcw size={12} />{tr("Remettre")}</button>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-400">
            {tr("30 derniers jours")} : {builder.metriques.builder_actions_total} {tr("actions")} · {builder.metriques.builder_publish_total} {tr("publications")} · {builder.metriques.builder_approval_requests} {tr("accords demandés")} · {builder.metriques.builder_policy_blocks} {tr("refus")} · {builder.metriques.builder_actions_failed} {tr("échecs")} · {builder.metriques.builder_ai_sessions} {tr("sessions")} · {builder.metriques.builder_average_execution_time} ms {tr("en moyenne")}
          </p>
        </div>
      )}

      <div className="ax-card p-6 space-y-3">
        <h2 className="font-bold text-gray-900">{tr("Automatisations")}</h2>
        {automatisations.length === 0 && <p className="text-sm text-gray-400">{tr("Aucune automatisation. Demande à ton assistant d'en créer une, par exemple « préviens-moi et prépare une commande quand un stock est bas ».")}</p>}
        {automatisations.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-xl p-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 break-words">{a.nom} {!a.actif && <span className="text-xs font-normal text-gray-400">· {tr("en pause")}</span>}</p>
              <p className="text-xs text-gray-400 break-words">{a.resume ? `${a.resume} · ` : ""}{a.executions} {tr("exécutions")} · {tr("dernière")} {date(a.derniereExecution)}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => appel("/api/controle-ia/automatisations", { method: "PATCH", body: JSON.stringify({ id: a.id, actif: !a.actif }) }, a.actif ? "Automatisation en pause" : "Automatisation relancée", "Action refusée")} aria-label={tr(a.actif ? "Mettre en pause" : "Relancer")} className="ax-btn ax-btn-secondary">{a.actif ? <Pause size={14} /> : <Play size={14} />}</button>
              <button onClick={() => appel(`/api/controle-ia/automatisations?id=${a.id}`, { method: "DELETE" }, "Automatisation supprimée", "Suppression refusée")} aria-label={tr("Supprimer")} className="ax-btn ax-btn-secondary"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {webhooks.length > 0 && (
        <div className="ax-card p-6 space-y-3">
          <h2 className="font-bold text-gray-900">{tr("Webhooks")}</h2>
          <p className="text-sm text-gray-500">{tr("Adresses qui reçoivent les événements de ta boutique, signés avec un secret.")}</p>
          {webhooks.map((w) => (
            <div key={w.id} className="border border-gray-100 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 break-all">{w.url}</p>
                  <p className="text-xs text-gray-400 break-words">{w.evenements.join(", ")} · {w.actif ? tr("actif") : tr("désactivé après des échecs")}</p>
                </div>
                <div className="flex gap-3 shrink-0">
                  <button onClick={() => nouveauSecret(w.id)} className="text-sm font-semibold text-gray-700 hover:underline">{tr("Nouveau secret")}</button>
                  <button onClick={() => appel(`/api/controle-ia/automatisations?webhook=${w.id}`, { method: "DELETE" }, "Webhook supprimé", "Suppression refusée")} aria-label={tr("Supprimer")} className="text-red-600"><Trash2 size={14} /></button>
                </div>
              </div>
              {secret?.id === w.id && (
                <div className="flex gap-2">
                  <input readOnly value={secret.valeur} aria-label={tr("Secret du webhook")} className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-gray-50 font-mono" />
                  <button onClick={() => navigator.clipboard.writeText(secret.valeur).then(() => toast.success(tr("Secret copié")))} className="ax-btn ax-btn-secondary"><Copy size={14} /></button>
                </div>
              )}
              {secret?.id === w.id && <p className="text-xs text-amber-600">{tr("Copie-le maintenant : il ne sera plus affiché.")}</p>}
            </div>
          ))}
        </div>
      )}

      {services.length > 0 && (
        <div className="ax-card p-6 space-y-3">
          <h2 className="font-bold text-gray-900">{tr("Services reliés")}</h2>
          <p className="text-sm text-gray-500">{tr("Comptes que tes assistants peuvent utiliser à travers Axso. Ils n'en reçoivent jamais les accès.")}</p>
          {services.map((s) => (
            <div key={s.type} className="flex items-center justify-between gap-3 border border-gray-100 rounded-xl p-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{s.nom ?? s.type}</p>
                <p className="text-xs text-gray-400 break-words">{s.compte ? `${s.compte} · ` : ""}{tr(s.statut)}{s.expireLe ? ` · ${tr("expire le")} ${date(s.expireLe)}` : ""}</p>
              </div>
              <button onClick={() => appel(`/api/controle-ia/services?type=${encodeURIComponent(s.type)}`, { method: "DELETE" }, "Service déconnecté", "Déconnexion refusée")} className="text-sm font-semibold text-red-600 hover:underline shrink-0">{tr("Déconnecter")}</button>
            </div>
          ))}
        </div>
      )}

      {activite && (
        <div className="ax-card p-6 space-y-3">
          <h2 className="font-bold text-gray-900">{tr("Activité des 30 derniers jours")}</h2>
          <p className="text-sm text-gray-700">
            {activite.total} {tr("appels")} · {activite.parStatut.execute ?? 0} {tr("faits")} · {activite.parStatut.accord_demande ?? 0} {tr("accords demandés")} · {activite.parStatut.refuse ?? 0} {tr("refusés")} · {activite.parStatut.echec ?? 0} {tr("échecs")}
          </p>
          <ul className="text-xs text-gray-500 space-y-1">
            {activite.outils.map((o) => <li key={o.outil}>{o.outil.replace(/_/g, " ")} — {o.appels} {tr("appels")}, {o.dureeMoyenneMs} ms {tr("en moyenne")}</li>)}
          </ul>
        </div>
      )}

      <div className="ax-card p-6 space-y-3">
        <h2 className="font-bold text-gray-900">{tr("Historique des actions")}</h2>
        {actions.length === 0 && <p className="text-sm text-gray-400">{tr("Aucune action pour l'instant.")}</p>}
        <div className="divide-y divide-gray-100">
          {actions.map((a) => (
            <details key={a.id} className="py-2.5">
              <summary className="flex items-center gap-3 text-sm cursor-pointer">
                <span className="text-xs text-gray-400 w-28 shrink-0">{date(a.createdAt)}</span>
                <span className="font-medium text-gray-900 min-w-0 truncate">{a.client} · {a.outil.replace(/_/g, " ")}</span>
                <span className="ml-auto text-[11px] font-semibold shrink-0" style={{ color: STATUTS[a.statut]?.couleur }}>{a.annuleLe ? tr("Annulé") : tr(STATUTS[a.statut]?.label ?? a.statut)}</span>
              </summary>
              <p className="text-xs text-gray-500 mt-2 break-words">{tr("Risque")} {a.risque} · {a.entree}</p>
              <p className="text-xs text-gray-500 mt-1 break-words whitespace-pre-wrap">{a.sortie}</p>
              {a.avant && a.apres && Object.keys(a.apres).length > 0 && (
                <p className="text-xs text-gray-500 mt-1 break-words">{tr("Avant")} : {JSON.stringify(a.avant).slice(0, 300)} → {tr("après")} : {JSON.stringify(a.apres).slice(0, 300)}</p>
              )}
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
