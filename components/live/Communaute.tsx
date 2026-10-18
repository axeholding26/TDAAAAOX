"use client";
// Communauté d'un produit (formation, bootcamp, événement) + mentorat.
// Même composant côté formateur (session marchande, sans jeton) et côté inscrit (jeton x-acces).
// Les droits sont appliqués par le serveur (/api/live/communaute/[produitId]) ; l'interface ne fait que les refléter.
import { useCallback, useEffect, useState } from "react";
import { Loader2, Pin, CheckCircle2, Flag, EyeOff, Eye, CalendarClock } from "lucide-react";
import { useT } from "@/components/I18nProvider";

type Reaction = { emoji: string; n: number; moi: boolean };
type Message = { id: string; texte: string; auteurNom: string; auteurRole: string; masque: boolean; signalements?: number; createdAt: string; moi: boolean; reactions: Reaction[] };
type Fil = { id: string; type: string; titre: string; auteurNom: string; auteurRole: string; epingle: boolean; resolu: boolean; masque: boolean; createdAt: string; messages: Message[] };
type Creneau = { id: string; mentorNom: string; debut: string; dureeMin: number; reserve: boolean; moi: boolean; lien: string | null; reserveNom: string | null };
type Donnees = { moi: { role: "apprenant" | "mentor" | "formateur"; nom: string }; espace: { regles: string | null; actif: boolean }; fils: Fil[]; creneaux: Creneau[] };

const EMOJIS = ["👍", "❤️", "🎉", "🙏", "💡"] as const;
const BADGE: Record<string, string> = { formateur: "Formateur", mentor: "Mentor", apprenant: "" };

export function Communaute({ produitId, token, accent = "#111827" }: { produitId: string; token?: string; accent?: string }) {
  const t = useT();
  const [d, setD] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [nouveau, setNouveau] = useState({ type: "discussion", titre: "", texte: "" });
  const [reponses, setReponses] = useState<Record<string, string>>({});
  const [regles, setRegles] = useState<string | null>(null);
  const [creneau, setCreneau] = useState({ mentorNom: "", debut: "", dureeMin: 30, lien: "" });
  const entetes = { "Content-Type": "application/json", ...(token ? { "x-acces": token } : {}) };

  const charger = useCallback(async () => {
    const r = await fetch(`/api/live/communaute/${produitId}`, { headers: token ? { "x-acces": token } : {}, cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErreur(j.error ?? "Accès refusé"); return; }
    setErreur(""); setD(j);
  }, [produitId, token]);
  useEffect(() => { charger(); }, [charger]);

  async function agir(body: object) {
    setEnvoi(true);
    const r = await fetch(`/api/live/communaute/${produitId}`, { method: "POST", headers: entetes, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setEnvoi(false);
    if (!r.ok) { alert(t(j.error ?? "Erreur")); return false; }
    await charger();
    return true;
  }

  if (erreur) return <p className="text-sm opacity-70">{t(erreur)}</p>;
  if (!d) return <Loader2 className="animate-spin opacity-50" size={18} />;
  const formateur = d.moi.role === "formateur";

  return (
    <div className="space-y-5">
      {/* Règles */}
      <div className="rounded-xl border border-black/10 p-3 text-sm">
        <p className="font-semibold mb-1">{t("Règles de la communauté")}</p>
        {formateur && regles !== null ? (
          <div className="space-y-2">
            <textarea value={regles} onChange={(e) => setRegles(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900" />
            <div className="flex gap-2">
              <button disabled={envoi} onClick={async () => { if (await agir({ action: "regles", regles })) setRegles(null); }} className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold" style={{ background: accent }}>{t("Enregistrer")}</button>
              <button onClick={() => setRegles(null)} className="px-3 py-1.5 rounded-lg border text-xs">{t("Annuler")}</button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap opacity-80">{d.espace.regles || t("Bienveillance, pas de publicité, pas de partage des contenus payants. Le formateur peut masquer un message.")}</p>
        )}
        {formateur && regles === null && (
          <div className="flex gap-3 mt-2 text-xs">
            <button onClick={() => setRegles(d.espace.regles ?? "")} className="underline">{t("Modifier les règles")}</button>
            <button onClick={() => agir({ action: "regles", regles: d.espace.regles ?? "", actif: !d.espace.actif })} className="underline">{d.espace.actif ? t("Fermer la communauté") : t("Rouvrir la communauté")}</button>
          </div>
        )}
        {!d.espace.actif && <p className="text-xs mt-1 text-red-600">{t("Communauté fermée : lecture seule.")}</p>}
      </div>

      {/* Nouveau fil */}
      {(d.espace.actif || formateur) && (
        <form onSubmit={async (e) => { e.preventDefault(); if (await agir({ action: "fil", ...nouveau })) setNouveau({ type: "discussion", titre: "", texte: "" }); }} className="rounded-xl border border-black/10 p-3 space-y-2">
          <div className="flex gap-2">
            <select value={nouveau.type} onChange={(e) => setNouveau({ ...nouveau, type: e.target.value })} className="px-2 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white">
              <option value="discussion">{t("Discussion")}</option>
              <option value="question">{t("Question")}</option>
              {formateur && <option value="annonce">{t("Annonce")}</option>}
            </select>
            <input required value={nouveau.titre} onChange={(e) => setNouveau({ ...nouveau, titre: e.target.value })} placeholder={t("Titre")} maxLength={160} className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900" />
          </div>
          <textarea required value={nouveau.texte} onChange={(e) => setNouveau({ ...nouveau, texte: e.target.value })} rows={3} maxLength={5000} placeholder={t("Votre message")} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900" />
          <button disabled={envoi} className="px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50" style={{ background: accent }}>{t("Publier")}</button>
        </form>
      )}

      {/* Fils */}
      {d.fils.length === 0 && <p className="text-sm opacity-60">{t("Aucune discussion pour l'instant.")}</p>}
      {d.fils.map((f) => (
        <div key={f.id} className={`rounded-xl border p-3 space-y-2 ${f.masque ? "opacity-50" : ""} ${f.type === "annonce" ? "border-amber-300 bg-amber-50/40" : "border-black/10"}`}>
          <div className="flex flex-wrap items-center gap-2">
            {f.epingle && <Pin size={13} />}
            <span className="text-[11px] uppercase tracking-wide opacity-60">{t(f.type === "annonce" ? "Annonce" : f.type === "question" ? "Question" : "Discussion")}</span>
            <p className="font-semibold text-sm">{f.titre}</p>
            {f.resolu && <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 size={12} />{t("Résolu")}</span>}
          </div>
          {f.messages.map((m) => (
            <div key={m.id} className={`text-sm rounded-lg p-2 bg-black/[0.03] ${m.masque ? "opacity-50" : ""}`}>
              <p className="text-xs opacity-60">
                <b>{m.auteurNom}</b>{BADGE[m.auteurRole] ? ` · ${t(BADGE[m.auteurRole])}` : ""} · {new Date(m.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                {formateur && !!m.signalements && <span className="text-red-600"> · {m.signalements} {t("signalement(s)")}</span>}
              </p>
              <p className="whitespace-pre-wrap">{m.texte}</p>
              <div className="flex flex-wrap items-center gap-1 mt-1">
                {EMOJIS.map((e) => {
                  const r = m.reactions.find((x) => x.emoji === e);
                  return (
                    <button key={e} onClick={() => agir({ action: "reagir", messageId: m.id, emoji: e })} className={`px-1.5 py-0.5 rounded text-xs border ${r?.moi ? "border-black/40" : "border-transparent"}`}>
                      {e}{r ? ` ${r.n}` : ""}
                    </button>
                  );
                })}
                {!formateur && !m.moi && <button onClick={() => { const raison = prompt(t("Pourquoi signaler ce message ?")) ?? undefined; agir({ action: "signaler", messageId: m.id, raison }); }} className="ml-auto text-xs opacity-60 inline-flex items-center gap-1"><Flag size={11} />{t("Signaler")}</button>}
                {formateur && <button onClick={() => agir({ action: "masquer", messageId: m.id, masque: !m.masque })} className="ml-auto text-xs opacity-70 inline-flex items-center gap-1">{m.masque ? <Eye size={11} /> : <EyeOff size={11} />}{t(m.masque ? "Rétablir" : "Masquer")}</button>}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 items-center">
            {(d.espace.actif || formateur) && (
              <>
                <input value={reponses[f.id] ?? ""} onChange={(e) => setReponses({ ...reponses, [f.id]: e.target.value })} placeholder={t("Répondre…")} maxLength={5000} className="flex-1 min-w-[160px] px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900" />
                <button disabled={envoi || !reponses[f.id]?.trim()} onClick={async () => { if (await agir({ action: "repondre", filId: f.id, texte: reponses[f.id] })) setReponses({ ...reponses, [f.id]: "" }); }} className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold disabled:opacity-40" style={{ background: accent }}>{t("Envoyer")}</button>
              </>
            )}
            {f.type === "question" && d.moi.role !== "apprenant" && <button onClick={() => agir({ action: "resoudre", filId: f.id, resolu: !f.resolu })} className="text-xs underline">{t(f.resolu ? "Rouvrir" : "Marquer résolu")}</button>}
            {formateur && <button onClick={() => agir({ action: "epingler", filId: f.id, epingle: !f.epingle })} className="text-xs underline">{t(f.epingle ? "Désépingler" : "Épingler")}</button>}
            {formateur && <button onClick={() => agir({ action: "masquer", filId: f.id, masque: !f.masque })} className="text-xs underline">{t(f.masque ? "Rétablir le fil" : "Masquer le fil")}</button>}
          </div>
        </div>
      ))}

      {/* Mentorat */}
      <div className="rounded-xl border border-black/10 p-3 space-y-2">
        <p className="font-semibold text-sm flex items-center gap-2"><CalendarClock size={15} />{t("Mentorat : créneaux individuels")}</p>
        {d.creneaux.length === 0 && <p className="text-sm opacity-60">{t("Aucun créneau proposé.")}</p>}
        {d.creneaux.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span>{new Date(c.debut).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })} · {c.dureeMin} min · {c.mentorNom}</span>
            {c.lien && <a href={c.lien} target="_blank" rel="noopener noreferrer" className="underline text-xs">{t("Lien de l'entretien")}</a>}
            {formateur ? (
              <>
                <span className="text-xs opacity-60">{c.reserve ? `${t("Réservé par")} ${c.reserveNom ?? ""}` : t("Libre")}</span>
                <button onClick={() => agir({ action: "supprimer_creneau", creneauId: c.id })} className="text-xs text-red-600 underline">{t("Supprimer")}</button>
              </>
            ) : c.moi ? <span className="text-xs text-emerald-600">{t("Votre réservation")}</span>
              : c.reserve ? <span className="text-xs opacity-50">{t("Pris")}</span>
              : <button disabled={envoi} onClick={() => agir({ action: "reserver", creneauId: c.id })} className="px-3 py-1 rounded-lg text-white text-xs font-semibold" style={{ background: accent }}>{t("Réserver")}</button>}
          </div>
        ))}
        {formateur && (
          <form onSubmit={async (e) => { e.preventDefault(); if (await agir({ action: "creneau", mentorNom: creneau.mentorNom, debut: new Date(creneau.debut).toISOString(), dureeMin: creneau.dureeMin, lien: creneau.lien || undefined })) setCreneau({ ...creneau, debut: "" }); }} className="flex flex-wrap gap-2 pt-2 border-t border-black/5">
            <input required value={creneau.mentorNom} onChange={(e) => setCreneau({ ...creneau, mentorNom: e.target.value })} placeholder={t("Mentor")} className="w-32 px-2 py-1.5 rounded-lg border border-gray-200 text-sm" />
            <input required type="datetime-local" value={creneau.debut} onChange={(e) => setCreneau({ ...creneau, debut: e.target.value })} className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm" />
            <input type="number" min={10} max={240} value={creneau.dureeMin} onChange={(e) => setCreneau({ ...creneau, dureeMin: Number(e.target.value) })} className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-sm" />
            <input type="url" value={creneau.lien} onChange={(e) => setCreneau({ ...creneau, lien: e.target.value })} placeholder={t("Lien visio (https, facultatif)")} className="flex-1 min-w-[160px] px-2 py-1.5 rounded-lg border border-gray-200 text-sm" />
            <button disabled={envoi} className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold" style={{ background: accent }}>{t("Proposer")}</button>
          </form>
        )}
      </div>
    </div>
  );
}
