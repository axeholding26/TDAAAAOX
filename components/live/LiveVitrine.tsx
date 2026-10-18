"use client";
// Vitrine Live Academy : inscription (gratuite ou payante via le checkout existant) et espace
// personnel de l'inscrit (jeton). Mobile d'abord. Le lien de salle n'arrive qu'au clic « Rejoindre »,
// et seulement si le serveur juge la fenêtre d'accès ouverte.
import { useCallback, useEffect, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Loader2, Lock, Video, Download, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { usePrix } from "@/components/storefront/DeviseVitrine";
import { Communaute } from "@/components/live/Communaute";

const champ = "w-full h-11 px-3 rounded-xl border bg-white text-[15px] text-[#111] outline-none";
const date = (d: string | Date, fuseau?: string) => {
  try { return new Date(d).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short", timeZone: fuseau, timeZoneName: "short" }); }
  catch { return new Date(d).toLocaleString("fr-FR"); }
};

// ─── Inscription ─────────────────────────────────────────────────────────────

export function InscriptionLive({ slug, tenantId, produitId, prix, devise, accent, fermeture }: {
  slug: string; tenantId: string; produitId: string; prix: number; devise: string; accent: string; fermeture: string | null;
}) {
  const t = useT();
  const { aPayer } = usePrix();
  const [v, setV] = useState({ nom: "", email: "", telephone: "", codePromo: "" });
  const [envoi, setEnvoi] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null);
  const payant = prix > 0;

  async function valider(e: React.FormEvent) {
    e.preventDefault(); setEnvoi(true); setMsg(null);
    try {
      if (!payant) {
        const r = await fetch("/api/live/inscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ produitId, nom: v.nom, email: v.email }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error ?? "Inscription impossible");
        if (d.token) { window.location.assign(`/${slug}/live/${d.token}`); return; }
        setMsg({ ok: true, texte: t("Vous êtes déjà inscrit : votre lien personnel vient d'être renvoyé par e-mail.") });
      } else {
        const cmd = await fetch("/api/commandes/digital-creer", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId, client: { nom: v.nom.trim(), telephone: v.telephone.trim(), email: v.email.trim().toLowerCase() }, items: [{ produitId, quantite: 1 }], codePromo: v.codePromo.trim() || undefined, codeAffiliation: (() => { try { return localStorage.getItem("axso_ref") || undefined; } catch { return undefined; } })() }),
        });
        const c = await cmd.json().catch(() => ({}));
        if (!cmd.ok) throw new Error(c.error || "Commande impossible");
        const pay = await fetch("/api/paiements/notchpay/initier", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commandeId: c.commandeId }) });
        const p = await pay.json().catch(() => ({}));
        if (!pay.ok || !p.authorizationUrl) throw new Error(p.error || "Paiement indisponible");
        window.location.assign(p.authorizationUrl);
        return;
      }
    } catch (err) {
      setMsg({ ok: false, texte: t(err instanceof Error ? err.message : "Erreur") });
    }
    setEnvoi(false);
  }

  if (fermeture) return <p className="rounded-xl p-4 text-center font-semibold bg-black/5">{t(fermeture)}</p>;
  return (
    <form onSubmit={valider} className="space-y-2.5 rounded-2xl border p-4" style={{ borderColor: `${accent}40` }}>
      <input required minLength={2} placeholder={t("Nom complet")} autoComplete="name" className={champ} value={v.nom} onChange={(e) => setV({ ...v, nom: e.target.value })} />
      <input required type="email" placeholder={t("E-mail (votre lien d'accès y sera envoyé)")} autoComplete="email" className={champ} value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
      {payant && <input required type="tel" placeholder={t("Téléphone")} autoComplete="tel" className={champ} value={v.telephone} onChange={(e) => setV({ ...v, telephone: e.target.value })} />}
      {payant && <input placeholder={t("Code promo (facultatif)")} className={champ} value={v.codePromo} onChange={(e) => setV({ ...v, codePromo: e.target.value })} />}
      <button disabled={envoi} className="w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: accent }}>
        {envoi ? <Loader2 size={17} className="animate-spin" /> : payant ? <><Lock size={15} />{t("Réserver ma place")} · {aPayer(prix, devise)}</> : t("Je m'inscris gratuitement")}
      </button>
      {payant && <p className="text-[12px] text-center opacity-60">{t("Paiement sécurisé NotchPay · MTN MoMo, Orange Money, carte bancaire")}</p>}
      {msg && <p className={`text-sm text-center ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.texte}</p>}
    </form>
  );
}

// ─── Espace de l'inscrit ─────────────────────────────────────────────────────

type Seance = { id: string; titre: string; type: string; description: string | null; intervenants: { nom: string; role?: string }[]; debut: string; dureeMin: number; fuseau: string; seances: string[]; statut: string; raisonAnnulation: string | null; ouvertureMin: number; acces: { ouvert: boolean; raison?: string; ouvreA?: string | null }; messageSecours: string | null; ressources: { titre: string; url: string }[]; replayUrl: string | null };

function Salle({ token, s, accent, sessionId }: { token: string; s: Seance; accent: string; sessionId?: string }) {
  const t = useT();
  const [salle, setSalle] = useState<{ url: string; integrable: boolean } | null>(null);
  const [secours, setSecours] = useState<string | null>(null);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  async function rejoindre() {
    setEnvoi(true); setErreur("");
    const r = await fetch(`/api/live/acces/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rejoindre", sessionId }) });
    const d = await r.json().catch(() => ({}));
    setEnvoi(false);
    if (!r.ok) { setErreur(t(d.error ?? "Salle indisponible")); return; }
    setSecours(d.secours);
    if (!d.salle) { setErreur(t("Lien de salle pas encore fourni par l'organisateur.")); return; }
    if (d.salle.integrable) setSalle(d.salle); else window.open(d.salle.url, "_blank", "noopener");
  }
  if (s.statut === "annule") return <p className="text-sm text-red-600 flex items-center gap-1"><AlertTriangle size={14} />{t("Annulé")}{s.raisonAnnulation ? ` : ${s.raisonAnnulation}` : ""}</p>;
  return (
    <div className="space-y-2">
      {s.acces.ouvert ? (
        <button onClick={rejoindre} disabled={envoi} className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-white inline-flex items-center justify-center gap-2" style={{ background: accent }}>
          {envoi ? <Loader2 size={16} className="animate-spin" /> : <Video size={16} />}{t("Rejoindre la salle")}
        </button>
      ) : (
        <p className="text-sm opacity-70 flex items-center gap-1"><Clock size={14} />
          {s.acces.raison === "trop_tot" && s.acces.ouvreA ? `${t("Le lien s'affichera ici à partir du")} ${date(s.acces.ouvreA, s.fuseau)}` : t("Séance terminée")}
        </p>
      )}
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      {s.messageSecours && <p className="text-sm rounded-lg p-2 bg-amber-50 text-amber-900">{s.messageSecours}</p>}
      {secours && <a href={secours} target="_blank" rel="noopener noreferrer" className="text-sm underline">{t("Lien de secours")}</a>}
      {salle && <iframe src={salle.url} allow="camera; microphone; display-capture; fullscreen" className="w-full h-[70vh] rounded-xl border" title="Salle" />}
    </div>
  );
}

function BlocSeance({ token, s, accent, sessionId }: { token: string; s: Seance; accent: string; sessionId?: string }) {
  const t = useT();
  return (
    <div className="rounded-2xl border border-black/10 p-4 space-y-2">
      <p className="font-semibold">{s.titre}</p>
      <p className="text-sm opacity-70">{s.seances.map((d) => date(d, s.fuseau)).join(" · ")} · {s.dureeMin} min</p>
      {s.intervenants?.length > 0 && <p className="text-sm opacity-70">{t("Avec")} {s.intervenants.map((i) => i.nom + (i.role ? ` (${i.role})` : "")).join(", ")}</p>}
      <Salle token={token} s={s} accent={accent} sessionId={sessionId} />
      {s.ressources?.length > 0 && (
        <div className="text-sm"><p className="font-medium">{t("Ressources")}</p>{s.ressources.map((r, k) => <a key={k} href={r.url} target="_blank" rel="noopener noreferrer" className="block underline">{r.titre}</a>)}</div>
      )}
      {s.replayUrl && <a href={s.replayUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline block">{t("Voir le replay")}</a>}
    </div>
  );
}

export function EspaceLive({ token, accent }: { token: string; accent: string }) {
  const t = useT();
  const [d, setD] = useState<any>(null);
  const [erreur, setErreur] = useState("");
  const [onglet, setOnglet] = useState<"programme" | "communaute">("programme");
  const [question, setQuestion] = useState("");
  const [livrable, setLivrable] = useState<Record<string, { texte: string; lien: string; fichier: File | null }>>({});
  const [envoi, setEnvoi] = useState("");

  const charger = useCallback(async () => {
    const r = await fetch(`/api/live/acces/${token}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setErreur(j.error ?? "Accès invalide"); else setD(j);
  }, [token]);
  useEffect(() => { charger(); }, [charger]);

  async function agir(body: object, cle: string) {
    setEnvoi(cle);
    const r = await fetch(`/api/live/acces/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setEnvoi("");
    if (!r.ok) { alert(t(j.error ?? "Erreur")); return false; }
    await charger();
    return true;
  }

  async function deposer(missionId: string) {
    const l = livrable[missionId] ?? { texte: "", lien: "", fichier: null };
    setEnvoi(missionId);
    try {
      let fichierUrl: string | undefined, fichierNom: string | undefined;
      if (l.fichier) {
        const b = await upload(`${d.dossierDepot}${l.fichier.name.replace(/[\\/]/g, "-")}`, l.fichier, { access: "public", handleUploadUrl: `/api/live/acces/${token}`, contentType: l.fichier.type || "application/octet-stream" });
        fichierUrl = b.url; fichierNom = l.fichier.name;
      }
      if (await agir({ action: "livrable", missionId, texte: l.texte || undefined, lien: l.lien || undefined, fichierUrl, fichierNom }, missionId)) setLivrable({ ...livrable, [missionId]: { texte: "", lien: "", fichier: null } });
    } catch (e) {
      alert(t(e instanceof Error ? e.message : "Envoi impossible"));
    }
    setEnvoi("");
  }

  if (erreur) return <p className="p-6 text-center">{t(erreur)}</p>;
  if (!d) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin opacity-50" /></div>;

  const ev: Seance | undefined = d.evenement;
  const bc = d.bootcamp;
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div>
        <p className="text-sm opacity-60">{d.moi.boutique} · {t("Espace de")} {d.moi.nom}{d.moi.role === "mentor" ? ` · ${t("Mentor")}` : ""}</p>
        <h1 className="text-2xl font-bold">{ev ? ev.titre : `${bc.nom}${bc.cohorte ? ` · ${bc.cohorte}` : ""}`}</h1>
        {bc && <p className="text-sm opacity-70">{date(bc.dateDebut, bc.fuseau)} → {date(bc.dateFin, bc.fuseau)}</p>}
      </div>

      <div className="flex gap-2">
        {(["programme", "communaute"] as const).map((o) => (
          <button key={o} onClick={() => setOnglet(o)} className="px-4 py-2 rounded-full text-sm font-semibold border" style={onglet === o ? { background: accent, color: "#fff", borderColor: accent } : {}}>{t(o === "programme" ? "Programme" : "Communauté")}</button>
        ))}
      </div>

      {onglet === "communaute" ? <Communaute produitId={d.produitId} token={token} accent={accent} /> : (
        <>
          {d.attestation?.active && (
            <div className="rounded-2xl border border-black/10 p-4 text-sm flex flex-wrap items-center gap-3">
              {d.attestation.eligible
                ? <><CheckCircle2 size={16} className="text-emerald-600" /><span>{t("Votre attestation est disponible.")}</span><a href={`/api/live/acces/${token}?certificat=1`} className="px-3 py-1.5 rounded-lg text-white font-semibold inline-flex items-center gap-1" style={{ background: accent }}><Download size={14} />{t("Télécharger")}</a></>
                : <span className="opacity-70">{t(bc ? "Attestation : atteignez les seuils de présence et de missions." : "Attestation de participation délivrée après l'événement aux participants présents.")}</span>}
            </div>
          )}

          {ev && (
            <>
              {ev.description && <p className="text-sm whitespace-pre-wrap opacity-80">{ev.description}</p>}
              <BlocSeance token={token} s={ev} accent={accent} />
              {d.sondages.filter((s: any) => s.ouvert || s.resultats).map((s: any) => (
                <div key={s.id} className="rounded-2xl border border-black/10 p-4 space-y-2 text-sm">
                  <p className="font-semibold">{s.question}</p>
                  {s.options.map((o: string, k: number) => s.resultats
                    ? <p key={k}>{o} — {s.resultats[k]} {s.monVote === k && "✓"}</p>
                    : <button key={k} disabled={!!envoi} onClick={() => agir({ action: "voter", sondageId: s.id, option: k }, s.id)} className="block w-full text-left px-3 py-2 rounded-lg border">{o}</button>)}
                </div>
              ))}
              <div className="rounded-2xl border border-black/10 p-4 space-y-2">
                <p className="font-semibold text-sm">{t("Poser une question à l'intervenant")}</p>
                <div className="flex gap-2">
                  <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={1000} className={champ} placeholder={t("Votre question")} />
                  <button disabled={!!envoi || question.trim().length < 3} onClick={async () => { if (await agir({ action: "question", texte: question }, "q")) setQuestion(""); }} className="px-4 rounded-xl text-white font-semibold disabled:opacity-40" style={{ background: accent }}>{t("Envoyer")}</button>
                </div>
                {d.questions.map((q: any) => (
                  <div key={q.id} className="text-sm border-t border-black/5 pt-2">
                    <p><b>{q.moi ? t("Vous") : q.auteurNom}</b> : {q.texte}</p>
                    {q.reponse && <p className="opacity-80">↳ {q.reponse}</p>}
                  </div>
                ))}
              </div>
            </>
          )}

          {bc && (
            <>
              <div className="rounded-2xl border border-black/10 p-4 text-sm grid grid-cols-2 gap-3 text-center">
                <div><p className="text-xl font-bold">{d.progression.tauxPresence} %</p><p className="opacity-60">{t("présence")} ({d.progression.presences}/{d.progression.seancesTotal})</p></div>
                <div><p className="text-xl font-bold">{d.progression.missionsValidees}/{d.progression.missionsTotal}</p><p className="opacity-60">{t("missions validées")}</p></div>
              </div>
              {(bc.jalons as any[]).length > 0 && (
                <div className="rounded-2xl border border-black/10 p-4 text-sm"><p className="font-semibold mb-1">{t("Jalons")}</p>{(bc.jalons as any[]).map((j, k) => <p key={k}>{j.titre} — {j.date ? date(j.date, bc.fuseau) : ""}</p>)}</div>
              )}
              <p className="font-semibold">{t("Séances")}</p>
              {d.sessions.length === 0 && <p className="text-sm opacity-60">{t("Calendrier bientôt publié.")}</p>}
              {d.sessions.map((s: Seance) => <BlocSeance key={s.id} token={token} s={s} accent={accent} sessionId={s.id} />)}
              <p className="font-semibold">{t("Missions")}</p>
              {d.missions.map((m: any) => {
                const l = livrable[m.id] ?? { texte: "", lien: "", fichier: null };
                const r = m.livrable;
                return (
                  <div key={m.id} className="rounded-2xl border border-black/10 p-4 space-y-2 text-sm">
                    <p className="font-semibold">{m.titre}</p>
                    {m.echeance && <p className="opacity-60">{t("À rendre avant le")} {date(m.echeance, bc.fuseau)}</p>}
                    {m.consigne && <p className="whitespace-pre-wrap opacity-80">{m.consigne}</p>}
                    {r && (
                      <p className={r.statut === "valide" ? "text-emerald-600" : r.statut === "a_revoir" ? "text-amber-600" : "opacity-70"}>
                        {t(r.statut === "valide" ? "Validée" : r.statut === "a_revoir" ? "À revoir" : "Déposée, en attente de correction")}{r.note != null ? ` · ${r.note}/100` : ""}{r.feedback ? ` — ${r.feedback}` : ""}
                      </p>
                    )}
                    {r?.statut !== "valide" && (
                      <div className="space-y-2">
                        <textarea rows={3} value={l.texte} onChange={(e) => setLivrable({ ...livrable, [m.id]: { ...l, texte: e.target.value } })} placeholder={t("Votre réponse")} className="w-full px-3 py-2 rounded-xl border text-[#111]" />
                        <input type="url" value={l.lien} onChange={(e) => setLivrable({ ...livrable, [m.id]: { ...l, lien: e.target.value } })} placeholder={t("Lien (https, facultatif)")} className={champ} />
                        <input type="file" onChange={(e) => setLivrable({ ...livrable, [m.id]: { ...l, fichier: e.target.files?.[0] ?? null } })} className="text-sm" />
                        <button disabled={envoi === m.id} onClick={() => deposer(m.id)} className="px-4 py-2 rounded-xl text-white font-semibold" style={{ background: accent }}>{envoi === m.id ? <Loader2 size={15} className="animate-spin" /> : t(r ? "Déposer à nouveau" : "Déposer")}</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </>
      )}
    </div>
  );
}
