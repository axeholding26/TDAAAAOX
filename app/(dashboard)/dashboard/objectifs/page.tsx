"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Target, Plus, X, Loader2, TrendingUp, ShoppingCart, Users, Wallet,
  Pause, Play, Trash2, CheckCircle2, XCircle, Clock,
} from "lucide-react";
import { ModuleTutorial, BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";

const OBJECTIFS_TUTORIAL_STEPS = [
  { Icon: Target,     titre: "4 types d'objectifs", description: "Chiffre d'affaires, commandes, nouveaux clients ou panier moyen — choisis le type qui compte le plus pour ta boutique." },
  { Icon: Plus,       titre: "Fixe ta cible",        description: "Donne un titre, une valeur à atteindre et une date limite, puis clique \"Nouvel objectif\" pour te lancer." },
  { Icon: TrendingUp, titre: "Progression en temps réel", description: "La barre de progression et le pourcentage se mettent à jour automatiquement en fonction de tes ventes." },
  { Icon: Pause,      titre: "Mets en pause ou supprime", description: "Un objectif atteint, dépassé ou plus pertinent ? Mets-le en pause ou supprime-le en un clic." },
];

type TypeObjectif = "ca" | "commandes" | "clients" | "panier_moyen";

interface Objectif {
  id: string;
  type: TypeObjectif;
  titre: string;
  cible: number;
  actuel: number;
  devise: string;
  deadline: string;
  statut: "actif" | "pause" | "atteint" | "echoue";
  createdAt: string;
}

const TYPE_META: Record<TypeObjectif, { label: string; Icon: any; couleur: string }> = {
  ca:           { label: "Chiffre d'affaires", Icon: Wallet,       couleur: "#F5A623" },
  commandes:    { label: "Commandes",          Icon: ShoppingCart, couleur: "#3b82f6" },
  clients:      { label: "Nouveaux clients",   Icon: Users,        couleur: "#8b5cf6" },
  panier_moyen: { label: "Panier moyen",       Icon: TrendingUp,   couleur: "#10b981" },
};

const STATUT_META: Record<string, { label: string; couleur: string; Icon: any }> = {
  actif:   { label: "En cours",  couleur: "#3b82f6", Icon: Clock },
  atteint: { label: "Atteint",   couleur: "#10b981", Icon: CheckCircle2 },
  echoue:  { label: "Échoué",    couleur: "#ef4444", Icon: XCircle },
  pause:   { label: "En pause",  couleur: "#9ca3af", Icon: Pause },
};

function formatValeur(v: number, type: TypeObjectif, devise: string) {
  if (type === "clients" || type === "commandes") return v.toLocaleString("fr-FR");
  return `${v.toLocaleString("fr-FR")} ${devise}`;
}

export default function ObjectifsPage() {
  const [objectifs, setObjectifs] = useState<Objectif[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: "ca" as TypeObjectif, titre: "", cible: "", devise: "XAF", deadline: "" });

  function charger() {
    fetch("/api/objectifs").then(r => r.json()).then(d => setObjectifs(d.objectifs ?? []));
  }
  useEffect(() => { charger(); }, []);

  async function creer() {
    if (!form.titre.trim() || !form.cible || !form.deadline) {
      toast.error("Remplissez tous les champs");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/objectifs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, cible: Number(form.cible) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      toast.success("Objectif créé");
      setShowForm(false);
      setForm({ type: "ca", titre: "", cible: "", devise: "XAF", deadline: "" });
      charger();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  }

  async function changerStatut(id: string, statut: string) {
    await fetch(`/api/objectifs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut }),
    });
    charger();
  }

  async function supprimer(id: string) {
    await fetch(`/api/objectifs/${id}`, { method: "DELETE" });
    charger();
  }

  return (
    <div className="space-y-6" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <ModuleTutorial moduleKey="objectifs" titre="Objectifs" sousTitre="Fixe et suis tes ambitions" steps={OBJECTIFS_TUTORIAL_STEPS} />
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Target size={18} className="text-[#F5A623]" />
            <h1 className="text-2xl font-bold text-gray-900">Objectifs</h1>
            <BoutonRevoirTutoriel moduleKey="objectifs" />
          </div>
          <p className="text-gray-400 text-sm">Fixez des objectifs pour votre boutique et suivez votre progression en temps réel</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
          style={{ background: "#F5A623", boxShadow: "0 4px 16px rgba(245,166,35,0.3)" }}>
          <Plus size={15} /> Nouvel objectif
        </button>
      </div>

      {/* Formulaire de création */}
      {showForm && (
        <div className="ax-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900">Nouvel objectif</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
          </div>

          <div>
            <label className="ax-label block mb-2">Type d'objectif</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(TYPE_META) as TypeObjectif[]).map(t => {
                const meta = TYPE_META[t];
                const active = form.type === t;
                return (
                  <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all"
                    style={active ? { borderColor: meta.couleur, background: `${meta.couleur}10` } : { borderColor: "#e5e7eb" }}>
                    <meta.Icon size={16} style={{ color: active ? meta.couleur : "#9ca3af" }} />
                    <span className="text-[11px] font-semibold text-center" style={{ color: active ? meta.couleur : "#6b7280" }}>{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="ax-label block mb-1.5">Titre</label>
            <input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
              placeholder="Ex : Atteindre 1M FCFA ce mois-ci"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#F5A623]" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="ax-label block mb-1.5">Cible</label>
              <input type="number" min="0" value={form.cible} onChange={e => setForm(f => ({ ...f, cible: e.target.value }))}
                placeholder="1000000"
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#F5A623]" />
            </div>
            <div>
              <label className="ax-label block mb-1.5">Date limite</label>
              <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                min={new Date().toISOString().slice(0, 10)}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#F5A623]" />
            </div>
          </div>

          <button onClick={creer} disabled={saving}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: "#F5A623" }}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            Créer l'objectif
          </button>
        </div>
      )}

      {/* Liste */}
      {objectifs === null ? (
        <div className="flex justify-center py-20"><Loader2 size={22} className="animate-spin text-gray-300" /></div>
      ) : objectifs.length === 0 ? (
        <div className="ax-card p-10 text-center">
          <Target size={32} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm text-gray-400">Aucun objectif pour le moment — créez-en un pour commencer à suivre votre progression.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {objectifs.map(o => {
            const meta = TYPE_META[o.type];
            const sMeta = STATUT_META[o.statut] ?? STATUT_META.actif;
            const pct = Math.min(100, Math.round((o.actuel / o.cible) * 100));
            return (
              <div key={o.id} className="ax-card p-5 space-y-3.5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${meta.couleur}15` }}>
                      <meta.Icon size={16} style={{ color: meta.couleur }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{o.titre}</p>
                      <p className="text-[11px] text-gray-400">{meta.label} · échéance {new Date(o.deadline).toLocaleDateString("fr-FR")}</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0"
                    style={{ color: sMeta.couleur, background: `${sMeta.couleur}15` }}>
                    <sMeta.Icon size={10} /> {sMeta.label}
                  </span>
                </div>

                <div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-sm font-black text-gray-900">{formatValeur(o.actuel, o.type, o.devise)}</span>
                    <span className="text-[11px] text-gray-400">sur {formatValeur(o.cible, o.type, o.devise)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: sMeta.couleur }} />
                  </div>
                  <p className="text-[10.5px] text-gray-400 mt-1">{pct}% atteint</p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  {o.statut === "actif" && (
                    <button onClick={() => changerStatut(o.id, "pause")}
                      className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-800 px-2.5 py-1.5 rounded-lg hover:bg-gray-50">
                      <Pause size={11} /> Mettre en pause
                    </button>
                  )}
                  {o.statut === "pause" && (
                    <button onClick={() => changerStatut(o.id, "actif")}
                      className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-800 px-2.5 py-1.5 rounded-lg hover:bg-gray-50">
                      <Play size={11} /> Reprendre
                    </button>
                  )}
                  <button onClick={() => supprimer(o.id)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-red-400 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-50 ml-auto">
                    <Trash2 size={11} /> Supprimer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
