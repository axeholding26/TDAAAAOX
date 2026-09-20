"use client";

import { useEffect, useState } from "react";
import { Trophy, Sparkles } from "lucide-react";
import { AgentActiveIndicator } from "@/components/dashboard/AgentActiveIndicator";

interface Badge {
  type: string;
  titre: string;
  description: string;
  emoji: string;
  obtenu: boolean;
  obtenueAt: string | null;
}

export default function GamificationPage() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [nouveaux, setNouveaux] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/badges")
      .then((r) => r.json())
      .then((d) => { setBadges(d.badges ?? []); setNouveaux(d.nouveaux ?? []); })
      .finally(() => setLoading(false));
  }, []);

  const obtenus = badges.filter((b) => b.obtenu);
  const restants = badges.filter((b) => !b.obtenu);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-[#F5A623] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[20px] font-bold text-[#111111] tracking-tight inline-flex items-center gap-2">Trophées & Badges <AgentActiveIndicator label="Agent Fidélité actif" /></h1>
        <p className="text-[12.5px] text-[#AAAAAA] mt-0.5">Récompenses obtenues et objectifs à atteindre</p>
      </div>

      {/* Nouveaux badges */}
      {nouveaux.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-[#F5A623]/30 rounded-xl p-5">
          <p className="text-[13px] font-bold text-[#111] mb-3 flex items-center gap-1.5"><Sparkles size={14} className="text-[#F5A623]" /> Nouveau{nouveaux.length > 1 ? "x" : ""} badge{nouveaux.length > 1 ? "s" : ""} obtenu{nouveaux.length > 1 ? "s" : ""} !</p>
          <div className="flex gap-3 flex-wrap">
            {nouveaux.map((b) => (
              <div key={b.type} className="flex items-center gap-2 bg-white rounded-xl px-4 py-2.5 border border-[#F5A623]/20">
                <span className="text-2xl">{b.emoji}</span>
                <div>
                  <p className="text-[13px] font-semibold text-[#111]">{b.titre}</p>
                  <p className="text-[10px] text-[#888]">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progression */}
      <div className="bg-white border border-[#F0F0F0] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-semibold text-[#111]">Progression</p>
          <p className="text-[12px] text-[#888]">{obtenus.length} / {badges.length}</p>
        </div>
        <div className="h-2 bg-[#F0F0F0] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${badges.length > 0 ? (obtenus.length / badges.length) * 100 : 0}%`, background: "#F5A623" }}
          />
        </div>
      </div>

      {/* Badges obtenus */}
      {obtenus.length > 0 && (
        <div>
          <p className="text-[13px] font-semibold text-[#111] mb-3">Obtenus ({obtenus.length})</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {obtenus.map((b) => (
              <div key={b.type} className="bg-white border border-[#F0F0F0] rounded-xl p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: "#FFF8EC" }}>
                  {b.emoji}
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[#111]">{b.titre}</p>
                  <p className="text-[11px] text-[#888]">{b.description}</p>
                  {b.obtenueAt && (
                    <p className="text-[10px] text-[#CCC] mt-0.5">
                      Obtenu le {new Date(b.obtenueAt).toLocaleDateString("fr")}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* À débloquer */}
      {restants.length > 0 && (
        <div>
          <p className="text-[13px] font-semibold text-[#111] mb-3">À débloquer ({restants.length})</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {restants.map((b) => (
              <div key={b.type} className="bg-[#FAFAFA] border border-dashed border-[#E5E5E5] rounded-xl p-4 flex items-center gap-3 opacity-60">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl grayscale" style={{ background: "#F5F5F5" }}>
                  {b.emoji}
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[#444]">{b.titre}</p>
                  <p className="text-[11px] text-[#AAA]">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {badges.length === 0 && (
        <div className="bg-white border border-dashed border-[#E5E5E5] rounded-xl p-10 text-center">
          <Trophy size={32} className="mx-auto mb-3 text-[#DDD]" />
          <p className="text-[13px] text-[#888]">Tes badges apparaîtront ici au fur et à mesure de tes performances.</p>
        </div>
      )}
    </div>
  );
}
