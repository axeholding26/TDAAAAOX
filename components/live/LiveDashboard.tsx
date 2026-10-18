"use client";
// Live Academy & Bootcamps — tableau de bord organisateur (API : /api/live/*).
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Video, GraduationCap, ArrowLeft, ExternalLink, Users } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { Communaute } from "@/components/live/Communaute";
import { versLocal } from "@/lib/live/regles";

const champ = "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white";
const carte = "bg-white rounded-2xl border border-gray-100 p-4 sm:p-5";
const bouton = "px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold disabled:opacity-50";
const bouton2 = "px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 disabled:opacity-50";
const TYPES: Record<string, string> = { webinaire: "Webinaire", masterclass: "Masterclass", atelier: "Atelier", qr: "Session Q&R", classe: "Classe récurrente", session: "Séance" };
const STATUTS: Record<string, string> = { programme: "Programmé", en_direct: "En direct", termine: "Terminé", annule: "Annulé" };
const date = (d: string) => new Date(d).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });

async function appel(url: string, body?: object) {
  const r = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, d };
}

function useDonnees<T>(url: string) {
  const [d, setD] = useState<T | null>(null);
  const [erreur, setErreur] = useState("");
  const charger = useCallback(async () => {
    const r = await appel(url);
    if (r.ok) setD(r.d); else setErreur(r.d.error ?? "Erreur");
  }, [url]);
  useEffect(() => { charger(); }, [charger]);
  return { d, erreur, charger };
}

/** Champs communs d'une séance (événement ou séance de bootcamp). */
function ChampsSeance({ v, set, fournisseurs, avecType }: { v: any; set: (v: any) => void; fournisseurs: any[]; avecType: boolean }) {
  const t = useT();
  const f = fournisseurs.find((x) => x.cle === v.fournisseur);
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {avecType && (
        <label className="text-xs text-gray-500">{t("Type")}
          <select className={champ} value={v.type} onChange={(e) => set({ ...v, type: e.target.value })}>
            {Object.entries(TYPES).filter(([k]) => k !== "session").map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}
          </select>
        </label>
      )}
      <label className="text-xs text-gray-500">{t("Titre")}<input required className={champ} value={v.titre} onChange={(e) => set({ ...v, titre: e.target.value })} /></label>
      <label className="text-xs text-gray-500 sm:col-span-2">{t("Description")}<textarea rows={3} className={champ} value={v.description} onChange={(e) => set({ ...v, description: e.target.value })} /></label>
      <label className="text-xs text-gray-500 sm:col-span-2">{t("Intervenants (un par ligne : Nom — rôle)")}<textarea rows={2} className={champ} value={v.intervenants} onChange={(e) => set({ ...v, intervenants: e.target.value })} /></label>
      <label className="text-xs text-gray-500">{t("Début (heure locale du fuseau)")}<input required type="datetime-local" className={champ} value={v.debut} onChange={(e) => set({ ...v, debut: e.target.value })} /></label>
      <label className="text-xs text-gray-500">{t("Fuseau horaire")}<input className={champ} value={v.fuseau} onChange={(e) => set({ ...v, fuseau: e.target.value })} /></label>
      <label className="text-xs text-gray-500">{t("Durée (minutes)")}<input type="number" min={10} max={600} className={champ} value={v.dureeMin} onChange={(e) => set({ ...v, dureeMin: Number(e.target.value) })} /></label>
      {v.type === "classe" && (
        <label className="text-xs text-gray-500">{t("Récurrence")}
          <div className="flex gap-2">
            <select className={champ} value={v.frequence} onChange={(e) => set({ ...v, frequence: e.target.value })}><option value="hebdomadaire">{t("Chaque semaine")}</option><option value="quotidienne">{t("Chaque jour")}</option></select>
            <input type="number" min={1} max={52} className={champ} value={v.occurrences} onChange={(e) => set({ ...v, occurrences: Number(e.target.value) })} title={t("Nombre de séances")} />
          </div>
        </label>
      )}
      <label className="text-xs text-gray-500">{t("Salle (visio)")}
        <select className={champ} value={v.fournisseur} onChange={(e) => set({ ...v, fournisseur: e.target.value })}>
          {fournisseurs.map((x) => <option key={x.cle} value={x.cle} disabled={!x.configure}>{t(x.nom)}{x.configure ? "" : ` — ${t("non configuré")}`}</option>)}
        </select>
      </label>
      {f?.exigeLien && <label className="text-xs text-gray-500">{t("Lien de la réunion (https)")}<input type="url" className={champ} value={v.lienSalle} onChange={(e) => set({ ...v, lienSalle: e.target.value })} placeholder="https://zoom.us/j/…" /></label>}
      {f && <p className="text-[11px] text-gray-400 sm:col-span-2">{t(f.limites)}</p>}
      <label className="text-xs text-gray-500">{t("Lien révélé aux inscrits (minutes avant)")}<input type="number" min={0} max={240} className={champ} value={v.ouvertureMin} onChange={(e) => set({ ...v, ouvertureMin: Number(e.target.value) })} /></label>
      <fieldset className="text-xs text-gray-500">{t("Rappels e-mail")}
        <div className="flex flex-wrap gap-3 mt-1">
          {[[10080, "J-7"], [1440, "J-1"], [60, "H-1"], [15, "15 min"]].map(([m, l]) => (
            <label key={m} className="inline-flex items-center gap-1 text-gray-700">
              <input type="checkbox" checked={v.rappels.includes(m)} onChange={(e) => set({ ...v, rappels: e.target.checked ? [...v.rappels, m] : v.rappels.filter((x: number) => x !== m) })} />{l}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

const seanceVide = () => ({ type: "webinaire", titre: "", description: "", intervenants: "", debut: "", fuseau: "Africa/Douala", dureeMin: 60, frequence: "hebdomadaire", occurrences: 4, fournisseur: "lien_externe", lienSalle: "", ouvertureMin: 15, rappels: [1440, 60] });
function versSeance(v: any) {
  return {
    type: v.type, titre: v.titre, description: v.description || null, debut: v.debut, fuseau: v.fuseau || "Africa/Douala", dureeMin: v.dureeMin,
    intervenants: String(v.intervenants).split("\n").map((l: string) => l.trim()).filter(Boolean).map((l: string) => { const [nom, role] = l.split(/\s+[—-]\s+/); return { nom: nom.slice(0, 80), ...(role ? { role: role.slice(0, 80) } : {}) }; }),
    recurrence: v.type === "classe" ? { frequence: v.frequence, occurrences: v.occurrences } : null,
    fournisseur: v.fournisseur, lienSalle: v.lienSalle || null, ouvertureMin: v.ouvertureMin, rappels: v.rappels,
  };
}

// ─── Liste + création ────────────────────────────────────────────────────────

export function LiveAccueil() {
  const t = useT();
  const router = useRouter();
  const { d, erreur, charger } = useDonnees<any>("/api/live/evenements");
  const [mode, setMode] = useState<"" | "evenement" | "bootcamp">("");
  const [ev, setEv] = useState<any>({ ...seanceVide(), prix: 0, capacite: "", certificat: false, publier: true });
  const [bc, setBc] = useState<any>({ nom: "", description: "", cohorte: "", dateDebut: "", dateFin: "", fuseau: "Africa/Douala", prix: 0, capacite: "", seuilPresence: 75, seuilMissions: 100, certificat: true, publier: false });
  const [envoi, setEnvoi] = useState(false);
  const [msg, setMsg] = useState("");

  async function creer(e: React.FormEvent) {
    e.preventDefault(); setEnvoi(true); setMsg("");
    const r = mode === "evenement"
      ? await appel("/api/live/evenements", { ...versSeance(ev), prix: Number(ev.prix) || 0, capacite: ev.capacite ? Number(ev.capacite) : null, certificat: ev.certificat, publier: ev.publier })
      : await appel("/api/live/bootcamps", { ...bc, description: bc.description || null, cohorte: bc.cohorte || null, prix: Number(bc.prix) || 0, capacite: bc.capacite ? Number(bc.capacite) : null });
    setEnvoi(false);
    if (!r.ok) { setMsg(t(r.d.error ?? "Erreur")); return; }
    router.push(mode === "evenement" ? `/dashboard/produits/live/evenements/${r.d.evenement.id}` : `/dashboard/produits/live/bootcamps/${r.d.bootcamp.id}`);
  }

  if (erreur) return <p className="text-sm text-red-600">{t(erreur)}</p>;
  if (!d) return <Loader2 className="animate-spin text-gray-400" />;
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t("Live & bootcamps")}</h1>
          <p className="text-sm text-gray-500">{t("Webinaires, masterclass, ateliers, classes et cohortes vendus depuis votre boutique (paiement en ligne, +10 % de commission AXSO payés par le client).")}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setMode("evenement")} className={bouton}><Plus size={12} className="inline" /> {t("Événement live")}</button>
          <button onClick={() => setMode("bootcamp")} className={bouton2}><Plus size={12} className="inline" /> {t("Bootcamp")}</button>
        </div>
      </div>

      {mode && (
        <form onSubmit={creer} className={`${carte} space-y-3`}>
          <p className="text-[13px] font-semibold text-gray-900">{t(mode === "evenement" ? "Nouvel événement" : "Nouveau bootcamp (une cohorte)")}</p>
          {mode === "evenement" ? (
            <>
              <ChampsSeance v={ev} set={setEv} fournisseurs={d.fournisseurs} avecType />
              <div className="grid sm:grid-cols-3 gap-3">
                <label className="text-xs text-gray-500">{t("Prix vendeur (0 = gratuit)")}<input type="number" min={0} className={champ} value={ev.prix} onChange={(e) => setEv({ ...ev, prix: e.target.value })} /></label>
                <label className="text-xs text-gray-500">{t("Places (vide = illimité)")}<input type="number" min={1} className={champ} value={ev.capacite} onChange={(e) => setEv({ ...ev, capacite: e.target.value })} /></label>
                <div className="flex flex-col gap-1 text-xs text-gray-700 pt-4">
                  <label className="inline-flex gap-1"><input type="checkbox" checked={ev.certificat} onChange={(e) => setEv({ ...ev, certificat: e.target.checked })} />{t("Attestation de participation")}</label>
                  <label className="inline-flex gap-1"><input type="checkbox" checked={ev.publier} onChange={(e) => setEv({ ...ev, publier: e.target.checked })} />{t("Publier sur la boutique")}</label>
                </div>
              </div>
            </>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs text-gray-500">{t("Nom du bootcamp")}<input required className={champ} value={bc.nom} onChange={(e) => setBc({ ...bc, nom: e.target.value })} /></label>
              <label className="text-xs text-gray-500">{t("Cohorte")}<input className={champ} value={bc.cohorte} onChange={(e) => setBc({ ...bc, cohorte: e.target.value })} placeholder={t("Ex : Cohorte 1 — Novembre")} /></label>
              <label className="text-xs text-gray-500 sm:col-span-2">{t("Description")}<textarea rows={3} className={champ} value={bc.description} onChange={(e) => setBc({ ...bc, description: e.target.value })} /></label>
              <label className="text-xs text-gray-500">{t("Début")}<input required type="datetime-local" className={champ} value={bc.dateDebut} onChange={(e) => setBc({ ...bc, dateDebut: e.target.value })} /></label>
              <label className="text-xs text-gray-500">{t("Fin")}<input required type="datetime-local" className={champ} value={bc.dateFin} onChange={(e) => setBc({ ...bc, dateFin: e.target.value })} /></label>
              <label className="text-xs text-gray-500">{t("Prix vendeur (0 = gratuit)")}<input type="number" min={0} className={champ} value={bc.prix} onChange={(e) => setBc({ ...bc, prix: e.target.value })} /></label>
              <label className="text-xs text-gray-500">{t("Places (vide = illimité)")}<input type="number" min={1} className={champ} value={bc.capacite} onChange={(e) => setBc({ ...bc, capacite: e.target.value })} /></label>
              <label className="text-xs text-gray-500">{t("Présence minimale pour l'attestation (%)")}<input type="number" min={0} max={100} className={champ} value={bc.seuilPresence} onChange={(e) => setBc({ ...bc, seuilPresence: Number(e.target.value) })} /></label>
              <label className="text-xs text-gray-500">{t("Missions validées minimales (%)")}<input type="number" min={0} max={100} className={champ} value={bc.seuilMissions} onChange={(e) => setBc({ ...bc, seuilMissions: Number(e.target.value) })} /></label>
              <div className="flex gap-4 text-xs text-gray-700">
                <label className="inline-flex gap-1"><input type="checkbox" checked={bc.certificat} onChange={(e) => setBc({ ...bc, certificat: e.target.checked })} />{t("Attestation conditionnelle")}</label>
                <label className="inline-flex gap-1"><input type="checkbox" checked={bc.publier} onChange={(e) => setBc({ ...bc, publier: e.target.checked })} />{t("Publier")}</label>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button disabled={envoi} className={bouton}>{envoi ? <Loader2 size={12} className="animate-spin" /> : t("Créer")}</button>
            <button type="button" onClick={() => setMode("")} className={bouton2}>{t("Annuler")}</button>
            {msg && <span className="text-xs text-red-600">{msg}</span>}
          </div>
        </form>
      )}

      <div className={carte}>
        <p className="text-[13px] font-semibold text-gray-900 flex items-center gap-2 mb-3"><Video size={15} />{t("Événements")}</p>
        {d.evenements.length === 0 ? <p className="text-sm text-gray-400">{t("Aucun événement.")}</p> : (
          <div className="divide-y divide-gray-50">
            {d.evenements.map((e: any) => (
              <Link key={e.id} href={`/dashboard/produits/live/evenements/${e.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm hover:bg-gray-50 rounded-lg px-2">
                <span className="font-medium text-gray-900 flex-1 min-w-[180px]">{e.titre}</span>
                <span className="text-xs text-gray-500">{t(TYPES[e.type] ?? e.type)} · {date(e.debut)}</span>
                <span className="text-xs text-gray-500"><Users size={11} className="inline" /> {e.placesPrises}{e.capacite ? `/${e.capacite}` : ""}</span>
                <span className="text-xs text-gray-500">{e.produit?.prix ? `${e.produit.prix}` : t("Gratuit")}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${e.statut === "annule" ? "bg-red-50 text-red-600" : e.statut === "en_direct" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{t(STATUTS[e.statut] ?? e.statut)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className={carte}>
        <p className="text-[13px] font-semibold text-gray-900 flex items-center gap-2 mb-3"><GraduationCap size={15} />{t("Bootcamps")}</p>
        {d.bootcamps.length === 0 ? <p className="text-sm text-gray-400">{t("Aucun bootcamp.")}</p> : (
          <div className="divide-y divide-gray-50">
            {d.bootcamps.map((b: any) => (
              <Link key={b.id} href={`/dashboard/produits/live/bootcamps/${b.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm hover:bg-gray-50 rounded-lg px-2">
                <span className="font-medium text-gray-900 flex-1 min-w-[180px]">{b.produit.nom}{b.cohorte ? ` · ${b.cohorte}` : ""}</span>
                <span className="text-xs text-gray-500">{date(b.dateDebut)} → {date(b.dateFin)}</span>
                <span className="text-xs text-gray-500">{b._count.sessions} {t("séances")} · {b._count.missions} {t("missions")}</span>
                <span className="text-xs text-gray-500"><Users size={11} className="inline" /> {b.placesPrises}{b.capacite ? `/${b.capacite}` : ""}</span>
                {!b.produit.actif && <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{t("Brouillon")}</span>}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className={carte}>
        <p className="text-[13px] font-semibold text-gray-900 mb-2">{t("Salles de visio disponibles")}</p>
        <p className="text-xs text-gray-500 mb-3">{t("Réunion interactive (tout le monde parle), webinaire (intervenants + public), diffusion (sens unique) et replay (vidéo enregistrée) sont des usages différents : AXSO n'annonce que ce que chaque service garantit. La capacité d'un événement est un nombre de places, pas une limite technique de la salle.")}</p>
        <div className="space-y-2">
          {d.fournisseurs.map((f: any) => (
            <div key={f.cle} className="text-xs border border-gray-100 rounded-lg p-2.5">
              <p className="font-semibold text-gray-800">{t(f.nom)} <span className={f.configure ? "text-emerald-600" : "text-gray-400"}>· {t(f.configure ? "disponible" : "non configuré")}</span></p>
              <p className="text-gray-500">{t(f.usage)} — {t(f.limites)}</p>
              {f.env.length > 0 && <p className="text-gray-400">{t("Variables")} : {f.env.join(", ")}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Console d'un événement ──────────────────────────────────────────────────

export function ConsoleEvenement({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const { d, erreur, charger } = useDonnees<any>(`/api/live/evenements/${id}`);
  const [envoi, setEnvoi] = useState(false);
  const [info, setInfo] = useState("");
  const [f, setF] = useState<Record<string, any>>({});
  const set = (k: string, v: any) => setF((x) => ({ ...x, [k]: v }));

  async function agir(body: object, message?: (d: any) => string) {
    setEnvoi(true); setInfo("");
    const r = await appel(`/api/live/evenements/${id}`, body);
    setEnvoi(false);
    if (!r.ok) { setInfo(t(r.d.error ?? "Erreur")); return null; }
    if (message) setInfo(message(r.d));
    await charger();
    return r.d;
  }

  if (erreur) return <p className="p-6 text-sm text-red-600">{t(erreur)}</p>;
  if (!d) return <Loader2 className="m-6 animate-spin text-gray-400" />;
  const ev = d.evenement;
  const presents = new Set(d.presences.map((p: any) => `${p.inscriptionId}:${p.occurrence}`));
  const inscritsActifs = d.inscrits.filter((i: any) => i.statut === "inscrite");
  const participants = new Set(d.presences.map((p: any) => p.inscriptionId)).size;
  const retour = ev.bootcamp ? `/dashboard/produits/live/bootcamps/${ev.bootcamp.id}` : "/dashboard/produits/live";
  const ressources: { titre: string; url: string }[] = f.ressources ?? ev.ressources ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      <Link href={retour} className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700"><ArrowLeft size={14} />{t("Retour")}</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500">{t(TYPES[ev.type] ?? ev.type)} · {t(d.fournisseur?.nom ?? ev.fournisseur)}</p>
          <h1 className="text-xl font-bold text-gray-900">{ev.titre}</h1>
          <p className="text-sm text-gray-500">{ev.seances.map((s: string) => date(s)).join(" · ")} ({ev.fuseau}, {ev.dureeMin} min)</p>
        </div>
        {ev.produit && d.slug && <a href={`/${d.slug}/evenements/${ev.produit.id}`} target="_blank" className={`${bouton2} inline-flex items-center gap-1`}><ExternalLink size={12} />{t("Page publique")}</a>}
      </div>
      {info && <p className="text-sm text-gray-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{info}</p>}

      {/* Statut de la salle */}
      <div className={`${carte} space-y-3`}>
        <p className="text-[13px] font-semibold text-gray-900">{t("Salle")} : <span className={ev.statut === "en_direct" ? "text-emerald-600" : ev.statut === "annule" ? "text-red-600" : "text-gray-600"}>{t(STATUTS[ev.statut])}</span></p>
        {ev.statut === "annule" && <p className="text-sm text-red-600">{t("Motif")} : {ev.raisonAnnulation}</p>}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div><p className="text-xl font-bold text-gray-900">{inscritsActifs.length}</p><p className="text-[11px] text-gray-400">{t("inscrits")}</p></div>
          <div><p className="text-xl font-bold text-gray-900">{participants}</p><p className="text-[11px] text-gray-400">{t("participants")}</p></div>
          <div><p className="text-xl font-bold text-gray-900">{ev.placesRestantes ?? "∞"}</p><p className="text-[11px] text-gray-400">{t("places restantes")}</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {ev.statut !== "annule" && ["programme", "en_direct", "termine"].filter((s) => s !== ev.statut).map((s) => (
            <button key={s} disabled={envoi} onClick={() => agir({ action: "statut", statut: s })} className={bouton2}>{t(s === "en_direct" ? "Ouvrir la salle (en direct)" : s === "termine" ? "Terminer" : "Repasser en programmé")}</button>
          ))}
          {ev.statut !== "annule" && <button disabled={envoi} onClick={() => { const raison = prompt(t("Motif de l'annulation (envoyé aux inscrits) :")); if (raison && raison.trim().length >= 3) agir({ action: "annuler", raison }, (r) => `${r.notifies} ${t("inscrit(s) prévenu(s)")}${r.aRembourser ? ` · ${r.aRembourser} ${t("place(s) payée(s) à rembourser depuis Commandes")}` : ""}`); }} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold">{t("Annuler l'événement")}</button>}
        </div>
        <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-gray-50">
          <label className="text-xs text-gray-500">{t("Reprogrammer au")}<input type="datetime-local" className={champ} value={f.nouveauDebut ?? ""} onChange={(e) => set("nouveauDebut", e.target.value)} /></label>
          <input className={`${champ} flex-1 min-w-[160px]`} placeholder={t("Message aux inscrits (facultatif)")} value={f.msgReprog ?? ""} onChange={(e) => set("msgReprog", e.target.value)} />
          <button disabled={envoi || !f.nouveauDebut} onClick={() => agir({ action: "reprogrammer", debut: f.nouveauDebut, message: f.msgReprog || undefined }, (r) => `${t("Reprogrammé")} · ${r.notifies} ${t("inscrit(s) prévenu(s)")}`)} className={bouton}>{t("Reprogrammer et prévenir")}</button>
        </div>
      </div>

      {/* Plan de secours */}
      <div className={`${carte} space-y-2`}>
        <p className="text-[13px] font-semibold text-gray-900">{t("Plan de secours")}</p>
        <p className="text-xs text-gray-500">{t("Si la salle principale tombe : un lien alternatif affiché dans l'espace des inscrits (jamais par e-mail) et un message envoyé à tous.")}</p>
        <input type="url" className={champ} placeholder="https://meet.google.com/…" value={f.lienSecours ?? ev.lienSecours ?? ""} onChange={(e) => set("lienSecours", e.target.value)} />
        <input className={champ} placeholder={t("Message (ex : la salle a changé, rejoignez le lien de secours)")} value={f.messageSecours ?? ev.messageSecours ?? ""} onChange={(e) => set("messageSecours", e.target.value)} />
        <button disabled={envoi} onClick={() => agir({ action: "secours", lienSecours: (f.lienSecours ?? ev.lienSecours) || null, messageSecours: (f.messageSecours ?? ev.messageSecours) || null, notifier: true }, (r) => `${t("Plan de secours enregistré")} · ${r.notifies} ${t("inscrit(s) prévenu(s)")}`)} className={bouton}>{t("Activer et prévenir")}</button>
      </div>

      {/* Inscrits */}
      <div className={carte}>
        <p className="text-[13px] font-semibold text-gray-900 mb-2">{t("Inscrits et présence")}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead><tr className="text-left text-xs text-gray-400"><th className="py-1">{t("Nom")}</th><th>{t("E-mail")}</th><th>{t("Place")}</th>{ev.seances.map((_: string, k: number) => <th key={k}>{ev.seances.length > 1 ? `S${k + 1}` : t("Présent")}</th>)}<th /></tr></thead>
            <tbody>
              {d.inscrits.map((i: any) => (
                <tr key={i.id} className={`border-t border-gray-50 ${i.statut !== "inscrite" ? "opacity-40" : ""}`}>
                  <td className="py-1.5">{i.nom}</td><td className="text-gray-500">{i.email}</td>
                  <td className="text-xs">{i.statut !== "inscrite" ? t(i.statut === "revoquee" ? "Remboursée" : "Annulée") : i.commandeId ? t("Payée") : t("Gratuite")}</td>
                  {ev.seances.map((_: string, k: number) => (
                    <td key={k}><input type="checkbox" disabled={envoi || i.statut !== "inscrite"} checked={presents.has(`${i.id}:${k}`)} onChange={(e) => agir({ action: "presence", inscriptionId: i.id, occurrence: k, present: e.target.checked })} /></td>
                  ))}
                  <td>{i.statut === "inscrite" && !ev.bootcamp && <button onClick={() => confirm(t("Désinscrire et libérer la place ?")) && agir({ action: "desinscrire", inscriptionId: i.id })} className="text-xs text-red-600 underline">{t("Désinscrire")}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!ev.bootcamp && (
          <div className="flex flex-wrap gap-2 mt-3">
            <input className={`${champ} w-40`} placeholder={t("Nom")} value={f.invNom ?? ""} onChange={(e) => set("invNom", e.target.value)} />
            <input type="email" className={`${champ} w-56`} placeholder={t("E-mail")} value={f.invEmail ?? ""} onChange={(e) => set("invEmail", e.target.value)} />
            <button disabled={envoi} onClick={async () => { if (await agir({ action: "inviter", nom: f.invNom, email: f.invEmail }, () => t("Invitation envoyée"))) setF((x) => ({ ...x, invNom: "", invEmail: "" })); }} className={bouton2}>{t("Inviter (place offerte)")}</button>
            {ev.certificat && <button disabled={envoi} onClick={() => agir({ action: "certificats" }, (r) => `${r.delivres} ${t("attestation(s) délivrée(s)")}`)} className={bouton2}>{t("Délivrer les attestations aux présents")}</button>}
          </div>
        )}
      </div>

      {/* Q&R */}
      <div className={`${carte} space-y-2`}>
        <p className="text-[13px] font-semibold text-gray-900">{t("Questions des participants")}</p>
        {d.questions.length === 0 && <p className="text-sm text-gray-400">{t("Aucune question.")}</p>}
        {d.questions.map((q: any) => (
          <div key={q.id} className={`border border-gray-100 rounded-lg p-2.5 text-sm ${q.statut === "masquee" ? "opacity-40" : ""}`}>
            <p><b>{q.auteurNom}</b> : {q.texte}</p>
            <div className="flex flex-wrap gap-2 mt-1">
              <input className={`${champ} flex-1 min-w-[160px]`} placeholder={t("Réponse publique")} value={f[`r_${q.id}`] ?? q.reponse ?? ""} onChange={(e) => set(`r_${q.id}`, e.target.value)} />
              <button disabled={envoi} onClick={() => agir({ action: "repondre", questionId: q.id, reponse: (f[`r_${q.id}`] ?? q.reponse) || null })} className={bouton}>{t("Répondre")}</button>
              <button disabled={envoi} onClick={() => agir({ action: "repondre", questionId: q.id, reponse: q.reponse, masquer: q.statut !== "masquee" })} className={bouton2}>{t(q.statut === "masquee" ? "Rétablir" : "Masquer")}</button>
            </div>
          </div>
        ))}
      </div>

      {/* Sondages */}
      <div className={`${carte} space-y-2`}>
        <p className="text-[13px] font-semibold text-gray-900">{t("Sondages")}</p>
        {d.sondages.map((s: any) => (
          <div key={s.id} className="border border-gray-100 rounded-lg p-2.5 text-sm">
            <p className="font-medium">{s.question} {!s.ouvert && <span className="text-xs text-gray-400">({t("fermé")})</span>}</p>
            {s.options.map((o: string, k: number) => <p key={k} className="text-xs text-gray-600">{o} — {s.resultats[k]}</p>)}
            <button disabled={envoi} onClick={() => agir({ action: "fermer_sondage", sondageId: s.id, ouvert: !s.ouvert })} className="text-xs underline mt-1">{t(s.ouvert ? "Fermer" : "Rouvrir")}</button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <input className={`${champ} flex-1 min-w-[180px]`} placeholder={t("Question du sondage")} value={f.sq ?? ""} onChange={(e) => set("sq", e.target.value)} />
          <input className={`${champ} flex-1 min-w-[180px]`} placeholder={t("Options séparées par des virgules")} value={f.so ?? ""} onChange={(e) => set("so", e.target.value)} />
          <button disabled={envoi} onClick={async () => { if (await agir({ action: "sondage", question: f.sq, options: String(f.so ?? "").split(",").map((x) => x.trim()).filter(Boolean) })) setF((x) => ({ ...x, sq: "", so: "" })); }} className={bouton}>{t("Lancer")}</button>
        </div>
      </div>

      {/* Ressources + replay */}
      <div className={`${carte} space-y-2`}>
        <p className="text-[13px] font-semibold text-gray-900">{t("Ressources jointes (visibles des inscrits)")}</p>
        {ressources.map((r, k) => (
          <div key={k} className="flex gap-2 text-sm items-center">
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="underline flex-1 truncate">{r.titre}</a>
            <button onClick={() => set("ressources", ressources.filter((_, j) => j !== k))} className="text-xs text-red-600">{t("Retirer")}</button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <input className={`${champ} w-48`} placeholder={t("Titre")} value={f.rt ?? ""} onChange={(e) => set("rt", e.target.value)} />
          <input type="url" className={`${champ} flex-1 min-w-[180px]`} placeholder="https://…" value={f.ru ?? ""} onChange={(e) => set("ru", e.target.value)} />
          <button onClick={() => { if (f.rt && f.ru) setF((x) => ({ ...x, ressources: [...ressources, { titre: x.rt, url: x.ru }], rt: "", ru: "" })); }} className={bouton2}>{t("Ajouter")}</button>
          <button disabled={envoi} onClick={() => agir({ action: "ressources", ressources }, () => t("Ressources enregistrées"))} className={bouton}>{t("Enregistrer")}</button>
        </div>
        <div className="pt-3 border-t border-gray-50 space-y-2">
          <p className="text-[13px] font-semibold text-gray-900">{t("Replay")}</p>
          <p className="text-xs text-gray-500">{t("Adresse https de la vidéo (YouTube non répertoriée, Vimeo, ou fichier de votre stockage). Visible des inscrits ; vendable ensuite comme formation.")}</p>
          <div className="flex flex-wrap gap-2">
            <input type="url" className={`${champ} flex-1 min-w-[200px]`} value={f.replay ?? ev.replayUrl ?? ""} onChange={(e) => set("replay", e.target.value)} />
            <button disabled={envoi} onClick={() => agir({ action: "replay", replayUrl: (f.replay ?? ev.replayUrl) || null }, () => t("Replay enregistré"))} className={bouton}>{t("Enregistrer")}</button>
          </div>
          {ev.replayUrl && (ev.replayProduitId
            ? <Link href={`/dashboard/produits/${ev.replayProduitId}`} className="text-xs underline">{t("Voir le produit replay")}</Link>
            : <div className="flex gap-2"><input type="number" min={1} className={`${champ} w-32`} placeholder={t("Prix")} value={f.prixReplay ?? ""} onChange={(e) => set("prixReplay", e.target.value)} /><button disabled={envoi || !f.prixReplay} onClick={() => agir({ action: "vendre_replay", prix: Number(f.prixReplay) }, () => t("Produit replay créé (en brouillon)"))} className={bouton2}>{t("Vendre le replay")}</button></div>)}
        </div>
      </div>

      {ev.produit && (
        <div className={carte}>
          <p className="text-[13px] font-semibold text-gray-900 mb-3">{t("Communauté de l'événement")}</p>
          <Communaute produitId={ev.produit.id} />
        </div>
      )}

      {!ev.bootcamp && <button onClick={async () => { if (confirm(t("Supprimer définitivement cet événement ?")) && await agir({ action: "supprimer" })) router.push("/dashboard/produits/live"); }} className="text-xs text-red-600 underline">{t("Supprimer l'événement")}</button>}
    </div>
  );
}

// ─── Console d'un bootcamp ───────────────────────────────────────────────────

export function ConsoleBootcamp({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const { d, erreur, charger } = useDonnees<any>(`/api/live/bootcamps/${id}`);
  const fournisseurs = useDonnees<any>("/api/live/evenements").d?.fournisseurs ?? [];
  const [envoi, setEnvoi] = useState(false);
  const [info, setInfo] = useState("");
  const [seance, setSeance] = useState<any>({ ...seanceVide(), type: "session" });
  const [mission, setMission] = useState({ titre: "", consigne: "", echeance: "" });
  const [f, setF] = useState<Record<string, any>>({});
  const set = (k: string, v: any) => setF((x) => ({ ...x, [k]: v }));

  async function agir(body: object, message?: (d: any) => string) {
    setEnvoi(true); setInfo("");
    const r = await appel(`/api/live/bootcamps/${id}`, body);
    setEnvoi(false);
    if (!r.ok) { setInfo(t(r.d.error ?? "Erreur")); return null; }
    if (message) setInfo(message(r.d));
    await charger();
    return r.d;
  }

  if (erreur) return <p className="p-6 text-sm text-red-600">{t(erreur)}</p>;
  if (!d) return <Loader2 className="m-6 animate-spin text-gray-400" />;
  const bc = d.bootcamp;
  const actifs = d.inscrits.filter((i: any) => i.statut === "inscrite");
  const aCorriger = d.missions.flatMap((m: any) => m.livrables.filter((l: any) => l.statut === "depose").map((l: any) => ({ ...l, mission: m.titre })));

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      <Link href="/dashboard/produits/live" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700"><ArrowLeft size={14} />{t("Retour")}</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{bc.produit.nom}{bc.cohorte ? ` · ${bc.cohorte}` : ""}</h1>
          <p className="text-sm text-gray-500">{date(bc.dateDebut)} → {date(bc.dateFin)} · {actifs.length}{bc.capacite ? `/${bc.capacite}` : ""} {t("inscrits")} · {bc.produit.actif ? t("Publié") : t("Brouillon")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {d.slug && <a href={`/${d.slug}/evenements/${bc.produitId}`} target="_blank" className={`${bouton2} inline-flex items-center gap-1`}><ExternalLink size={12} />{t("Page publique")}</a>}
          <button disabled={envoi} onClick={() => agir({ action: "modifier", publier: !bc.produit.actif })} className={bouton2}>{t(bc.produit.actif ? "Dépublier" : "Publier")}</button>
        </div>
      </div>
      {info && <p className="text-sm text-gray-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{info}</p>}

      {/* Progression */}
      <div className={carte}>
        <p className="text-[13px] font-semibold text-gray-900 mb-2">{t("Progression des participants")}</p>
        <p className="text-xs text-gray-500 mb-2">{t("Attestation si présence ≥")} {bc.seuilPresence} % {t("et missions validées ≥")} {bc.seuilMissions} %.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead><tr className="text-left text-xs text-gray-400"><th className="py-1">{t("Nom")}</th><th>{t("Présence")}</th><th>{t("Missions")}</th><th>{t("Attestation")}</th><th /></tr></thead>
            <tbody>
              {d.inscrits.map((i: any) => {
                const p = d.progression[i.id];
                return (
                  <tr key={i.id} className={`border-t border-gray-50 ${i.statut !== "inscrite" ? "opacity-40" : ""}`}>
                    <td className="py-1.5">{i.nom} <span className="text-xs text-gray-400">{i.email}</span>{i.role === "mentor" && <span className="text-xs text-indigo-600"> · {t("mentor")}</span>}</td>
                    <td>{p ? `${p.presences}/${p.seancesTotal} (${p.tauxPresence} %)` : "—"}</td>
                    <td>{p ? `${p.missionsValidees}/${p.missionsTotal}` : "—"}</td>
                    <td>{p ? (p.eligible ? <span className="text-emerald-600">{t("Éligible")}</span> : t("Pas encore")) : "—"}</td>
                    <td className="text-xs space-x-2">
                      {i.statut === "inscrite" && <button onClick={async () => { const r = await fetch(`/api/live/communaute/${bc.produitId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mentor", inscriptionId: i.id, mentor: i.role !== "mentor" }) }); if (r.ok) charger(); }} className="underline">{t(i.role === "mentor" ? "Retirer mentor" : "Nommer mentor")}</button>}
                      {i.statut === "inscrite" && <button onClick={() => confirm(t("Désinscrire et libérer la place ?")) && agir({ action: "desinscrire", inscriptionId: i.id })} className="text-red-600 underline">{t("Désinscrire")}</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <input className={`${champ} w-40`} placeholder={t("Nom")} value={f.invNom ?? ""} onChange={(e) => set("invNom", e.target.value)} />
          <input type="email" className={`${champ} w-56`} placeholder={t("E-mail")} value={f.invEmail ?? ""} onChange={(e) => set("invEmail", e.target.value)} />
          <button disabled={envoi} onClick={async () => { if (await agir({ action: "inviter", nom: f.invNom, email: f.invEmail }, () => t("Invitation envoyée"))) setF((x) => ({ ...x, invNom: "", invEmail: "" })); }} className={bouton2}>{t("Inviter")}</button>
          {bc.certificat && <button disabled={envoi} onClick={() => agir({ action: "certificats" }, (r) => `${r.delivres}/${r.inscrits} ${t("attestation(s) délivrée(s)")}`)} className={bouton2}>{t("Délivrer les attestations")}</button>}
        </div>
      </div>

      {/* Séances */}
      <div className={`${carte} space-y-3`}>
        <p className="text-[13px] font-semibold text-gray-900">{t("Calendrier des séances")}</p>
        {d.sessions.map((s: any) => (
          <div key={s.id} className="flex flex-wrap items-center gap-2 text-sm border-b border-gray-50 pb-2">
            <Link href={`/dashboard/produits/live/evenements/${s.id}`} className="font-medium underline flex-1 min-w-[160px]">{s.titre}</Link>
            <span className="text-xs text-gray-500">{date(s.debut)} · {s.dureeMin} min · {t(STATUTS[s.statut])}</span>
            <span className="text-xs text-gray-500">{s.presences.length} {t("présent(s)")}</span>
          </div>
        ))}
        <details>
          <summary className="text-xs font-semibold cursor-pointer">{t("Ajouter une séance")}</summary>
          <form onSubmit={async (e) => { e.preventDefault(); if (await agir({ action: "session", seance: { ...versSeance(seance), type: "session" } })) setSeance({ ...seanceVide(), type: "session" }); }} className="space-y-3 mt-3">
            <ChampsSeance v={seance} set={setSeance} fournisseurs={fournisseurs} avecType={false} />
            <button disabled={envoi} className={bouton}>{t("Ajouter")}</button>
          </form>
        </details>
      </div>

      {/* Missions */}
      <div className={`${carte} space-y-3`}>
        <p className="text-[13px] font-semibold text-gray-900">{t("Missions et livrables")}</p>
        {d.missions.map((m: any) => (
          <div key={m.id} className="text-sm border-b border-gray-50 pb-2">
            <p className="font-medium">{m.titre} {m.echeance && <span className="text-xs text-gray-400">· {t("échéance")} {date(m.echeance)}</span>} <span className="text-xs text-gray-400">· {m.livrables.length} {t("rendu(s)")}</span></p>
            {m.consigne && <p className="text-xs text-gray-500 whitespace-pre-wrap">{m.consigne}</p>}
            <button onClick={() => confirm(t("Supprimer cette mission et ses livrables ?")) && agir({ action: "supprimer_mission", missionId: m.id })} className="text-xs text-red-600 underline">{t("Supprimer")}</button>
          </div>
        ))}
        <div className="grid sm:grid-cols-3 gap-2">
          <input className={champ} placeholder={t("Titre de la mission")} value={mission.titre} onChange={(e) => setMission({ ...mission, titre: e.target.value })} />
          <input type="datetime-local" className={champ} value={mission.echeance} onChange={(e) => setMission({ ...mission, echeance: e.target.value })} />
          <button disabled={envoi || mission.titre.trim().length < 2} onClick={async () => { if (await agir({ action: "mission", titre: mission.titre, consigne: mission.consigne || null, echeance: mission.echeance || null })) setMission({ titre: "", consigne: "", echeance: "" }); }} className={bouton}>{t("Ajouter la mission")}</button>
          <textarea rows={2} className={`${champ} sm:col-span-3`} placeholder={t("Consigne")} value={mission.consigne} onChange={(e) => setMission({ ...mission, consigne: e.target.value })} />
        </div>
        {aCorriger.length > 0 && <p className="text-[13px] font-semibold text-gray-900 pt-2">{t("À corriger")} ({aCorriger.length})</p>}
        {aCorriger.map((l: any) => (
          <div key={l.id} className="border border-gray-100 rounded-xl p-3 space-y-2 text-sm">
            <p className="text-xs text-gray-500"><b className="text-gray-900">{l.inscription.nom}</b> · {l.mission} · {date(l.deposeAt)}</p>
            {l.texte && <p className="whitespace-pre-wrap bg-gray-50 rounded-lg p-2">{l.texte}</p>}
            {l.lien && <a href={l.lien} target="_blank" rel="noopener noreferrer" className="underline text-xs">{l.lien}</a>}
            {l.fichierUrl && <a href={l.fichierUrl} target="_blank" rel="noopener noreferrer" className="underline text-xs block">{l.fichierNom || t("Fichier")}</a>}
            <textarea rows={2} className={champ} placeholder={t("Retour du formateur")} value={f[`fb_${l.id}`] ?? ""} onChange={(e) => set(`fb_${l.id}`, e.target.value)} />
            <div className="flex gap-2">
              <input type="number" min={0} max={100} className={`${champ} w-28`} placeholder={t("Note /100")} value={f[`n_${l.id}`] ?? ""} onChange={(e) => set(`n_${l.id}`, e.target.value)} />
              <button disabled={envoi} onClick={() => agir({ action: "corriger", livrableId: l.id, statut: "valide", feedback: f[`fb_${l.id}`] || null, note: f[`n_${l.id}`] ? Number(f[`n_${l.id}`]) : null })} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold">{t("Valider")}</button>
              <button disabled={envoi} onClick={() => agir({ action: "corriger", livrableId: l.id, statut: "a_revoir", feedback: f[`fb_${l.id}`] || null, note: null })} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold">{t("À revoir")}</button>
            </div>
          </div>
        ))}
      </div>

      {/* Jalons + duplication */}
      <div className={`${carte} space-y-2`}>
        <p className="text-[13px] font-semibold text-gray-900">{t("Jalons")}</p>
        {(bc.jalons as any[]).map((j, k) => <p key={k} className="text-sm">{j.titre} — {j.date ? date(j.date) : ""}</p>)}
        <div className="flex flex-wrap gap-2">
          <input className={`${champ} w-48`} placeholder={t("Jalon")} value={f.jt ?? ""} onChange={(e) => set("jt", e.target.value)} />
          <input type="datetime-local" className={`${champ} w-56`} value={f.jd ?? ""} onChange={(e) => set("jd", e.target.value)} />
          <button disabled={envoi || !f.jt || !f.jd} onClick={() => agir({ action: "jalons", jalons: [...(bc.jalons as any[]).map((j) => ({ titre: j.titre, date: versLocal(new Date(j.date), bc.fuseau) })), { titre: f.jt, date: f.jd }] })} className={bouton2}>{t("Ajouter")}</button>
        </div>
        <div className="pt-3 border-t border-gray-50 flex flex-wrap items-end gap-2">
          <p className="w-full text-[13px] font-semibold text-gray-900">{t("Nouvelle cohorte à partir de ce modèle")}</p>
          <input className={`${champ} w-48`} placeholder={t("Nom de la cohorte")} value={f.cohorte ?? ""} onChange={(e) => set("cohorte", e.target.value)} />
          <input type="datetime-local" className={`${champ} w-56`} value={f.debutCopie ?? ""} onChange={(e) => set("debutCopie", e.target.value)} />
          <button disabled={envoi || !f.cohorte || !f.debutCopie} onClick={async () => { const r = await agir({ action: "dupliquer", cohorte: f.cohorte, dateDebut: f.debutCopie }); if (r?.id) router.push(`/dashboard/produits/live/bootcamps/${r.id}`); }} className={bouton}>{t("Dupliquer (séances, missions, jalons décalés)")}</button>
        </div>
      </div>

      <div className={carte}>
        <p className="text-[13px] font-semibold text-gray-900 mb-3">{t("Communauté du bootcamp")}</p>
        <Communaute produitId={bc.produitId} />
      </div>
    </div>
  );
}
