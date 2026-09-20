"use client";

import { useEffect, useState, useCallback } from "react";
import { dateRelative, formatMontant } from "@/lib/utils";
import {
  Sparkles, TrendingUp, Radar, Rocket, Package, Heart, Megaphone,
  BarChart3, Users, ShoppingBag, Truck, Loader2, Filter, Zap,
} from "lucide-react";

interface Decision {
  id: string;
  agentId: string;
  type: string;
  description: string;
  donnees: Record<string, any>;
  impactEstime: number | null;
  impactReel: number | null;
  statut: string;
  createdAt: string;
}

const AGENT_META: Record<string, { label: string; Icon: any; couleur: string }> = {
  orchestrator:      { label: "Orchestrateur", Icon: Sparkles,    couleur: "#1B2A4A" },
  "agent-revenue":    { label: "Agent Revenue", Icon: TrendingUp,  couleur: "#F5A623" },
  "agent-veille":     { label: "Agent Veille",  Icon: Radar,       couleur: "#0ea5e9" },
  "agent-growth":     { label: "Agent Growth",  Icon: Rocket,      couleur: "#ef4444" },
  "agent-stock":      { label: "Agent Stock",   Icon: Package,     couleur: "#8b5cf6" },
  "agent-fidelite":   { label: "Agent Fidélité",Icon: Heart,       couleur: "#ec4899" },
  "agent-marketing":  { label: "Agent Marketing", Icon: Megaphone, couleur: "#f97316" },
  "agent-analytics":  { label: "Agent Analytics", Icon: BarChart3, couleur: "#3b82f6" },
  "agent-clients":    { label: "Agent Clients", Icon: Users,       couleur: "#10b981" },
  "agent-produits":   { label: "Agent Produits", Icon: ShoppingBag, couleur: "#F5A623" },
  "agent-livraison":  { label: "Agent Livraison", Icon: Truck,     couleur: "#0ea5e9" },
};

function metaPour(agentId: string) {
  return AGENT_META[agentId] ?? { label: agentId, Icon: Zap, couleur: "#9ca3af" };
}

function grouperParJour(decisions: Decision[]): Array<{ jour: string; items: Decision[] }> {
  const groupes = new Map<string, Decision[]>();
  for (const d of decisions) {
    const jour = new Date(d.createdAt).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    if (!groupes.has(jour)) groupes.set(jour, []);
    groupes.get(jour)!.push(d);
  }
  return [...groupes.entries()].map(([jour, items]) => ({ jour, items }));
}

export default function JournalAxiaPage() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [agents, setAgents] = useState<string[]>([]);
  const [filtre, setFiltre] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPlus, setLoadingPlus] = useState(false);

  const charger = useCallback((agent: string | null, curseur: string | null, append: boolean) => {
    const params = new URLSearchParams();
    if (agent) params.set("agent", agent);
    if (curseur) params.set("cursor", curseur);
    (append ? setLoadingPlus : setLoading)(true);
    fetch(`/api/agent-decisions?${params}`)
      .then(r => r.json())
      .then(d => {
        setDecisions(prev => append ? [...prev, ...(d.decisions ?? [])] : (d.decisions ?? []));
        setCursor(d.nextCursor ?? null);
        setAgents(d.agents ?? []);
      })
      .finally(() => { setLoading(false); setLoadingPlus(false); });
  }, []);

  useEffect(() => { charger(filtre, null, false); }, [filtre, charger]);

  const groupes = grouperParJour(decisions);

  return (
    <div className="space-y-6" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#1B2A4A,#2c4270)" }}>
            <Sparkles size={15} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Journal d'activité AXIA</h1>
        </div>
        <p className="text-gray-400 text-sm">Chaque action prise par AXIA et les agents spécialisés, en un coup d'œil.</p>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1 text-[11px] font-bold text-gray-400 uppercase tracking-wide"><Filter size={11} /> Filtrer</span>
        <button onClick={() => setFiltre(null)}
          className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
          style={filtre === null ? { background: "#1B2A4A", color: "white" } : { background: "#F3F4F6", color: "#6b7280" }}>
          Tout
        </button>
        {agents.map(a => {
          const meta = metaPour(a);
          const active = filtre === a;
          return (
            <button key={a} onClick={() => setFiltre(a)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={active ? { background: meta.couleur, color: "white" } : { background: "#F3F4F6", color: "#6b7280" }}>
              <meta.Icon size={11} /> {meta.label}
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={22} className="animate-spin text-gray-300" /></div>
      ) : groupes.length === 0 ? (
        <div className="ax-card p-10 text-center">
          <Sparkles size={32} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm text-gray-400">Aucune action enregistrée pour le moment — AXIA journalisera ici chaque décision prise pour votre boutique.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupes.map(({ jour, items }) => (
            <div key={jour}>
              <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.12em] mb-3 capitalize">{jour}</p>
              <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-gray-100">
                {items.map(d => {
                  const meta = metaPour(d.agentId);
                  return (
                    <div key={d.id} className="relative ax-card p-4 hover:!translate-y-0">
                      <span className="absolute -left-6 top-5 w-3.5 h-3.5 rounded-full border-2 border-white" style={{ background: meta.couleur }} />
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${meta.couleur}15` }}>
                          <meta.Icon size={16} style={{ color: meta.couleur }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-[11px] font-bold" style={{ color: meta.couleur }}>{meta.label}</span>
                            <span className="text-[10.5px] text-gray-300">{dateRelative(d.createdAt)}</span>
                          </div>
                          <p className="text-sm text-gray-800 mt-1 leading-relaxed">{d.description}</p>
                          {(d.impactEstime != null || d.impactReel != null) && (
                            <div className="flex items-center gap-2 mt-2">
                              {d.impactEstime != null && (
                                <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                                  Impact estimé : {formatMontant(d.impactEstime)}
                                </span>
                              )}
                              {d.impactReel != null && (
                                <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-[#F5A623]/10 text-[#111111] border border-[#F5A623]/25">
                                  Impact réel : {formatMontant(d.impactReel)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {cursor && (
            <div className="flex justify-center pt-2">
              <button onClick={() => charger(filtre, cursor, true)} disabled={loadingPlus}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all flex items-center gap-2 disabled:opacity-60">
                {loadingPlus && <Loader2 size={12} className="animate-spin" />}
                Charger plus
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
