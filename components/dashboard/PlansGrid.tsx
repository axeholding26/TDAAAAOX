"use client";

import { Check, X, CreditCard, HelpCircle, Globe } from "lucide-react";
import { PlanBadge } from "@/components/dashboard/PlanBadge";
import AbonnementActions from "@/app/(dashboard)/dashboard/abonnement/AbonnementActions";
import { PLANS_CATALOGUE, ABONNEMENT_FAQ, type PlanCatalogueId } from "@/lib/plans-catalogue";
import { convertirDepuisXAF } from "@/lib/devise-convert";

interface PlansGridProps {
  planActuel: string;
  nomPlan: string;
  devise: string;
  compact?: boolean;
}

export function PlansGrid({ planActuel, nomPlan, devise, compact }: PlansGridProps) {
  const afficherXAF = devise === "XAF" || devise === "XOF";

  return (
    <div className={compact ? "space-y-6" : "space-y-8 max-w-4xl"} style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CreditCard size={18} className="text-[#F5A623]" />
            <h1 className="text-2xl font-bold text-gray-900">
              Abonnement · <span style={{ color: "#F5A623" }}>{nomPlan}</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-gray-400 text-sm">Choisissez votre palier Axso</p>
            {devise !== "XAF" && devise !== "XOF" && (
              <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F5A623]/10 text-[#111111] border border-[#F5A623]/25">
                <Globe size={9} /> Prix en {devise}
              </span>
            )}
          </div>
        </div>
        <PlanBadge plan={planActuel} />
      </div>

      {/* ── Cards plans ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {PLANS_CATALOGUE.map((plan) => {
          const estActuel = plan.id === planActuel;
          const Icone = plan.icone;
          const prixLocal = convertirDepuisXAF(plan.prixXAF, devise);

          return (
            <div key={plan.id}
              className="relative flex flex-col rounded-3xl bg-white border transition-all"
              style={{
                borderColor: plan.recommande ? plan.border : estActuel ? plan.border : "#e5e7eb",
                boxShadow: plan.recommande
                  ? `0 12px 40px ${plan.couleur}18`
                  : estActuel ? `0 4px 20px ${plan.couleur}15` : "0 1px 6px #0000000a",
                transform: plan.recommande ? "scale(1.02)" : "none",
              }}>

              {plan.recommande && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-lg whitespace-nowrap"
                  style={{ background: `linear-gradient(135deg, ${plan.couleur}, #c97a10)` }}>
                  ⚡ Recommandé
                </div>
              )}
              {estActuel && !plan.recommande && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap"
                  style={{ background: plan.couleur }}>
                  Plan actuel
                </div>
              )}

              <div className="p-6 flex-1 flex flex-col">
                {/* Label palier */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[9px] font-black tracking-widest uppercase px-2.5 py-1 rounded-full"
                    style={{ background: plan.bg, color: plan.couleur, border: `1px solid ${plan.border}` }}>
                    {plan.palier}
                  </span>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: plan.bg, border: `1px solid ${plan.border}` }}>
                    <Icone size={15} style={{ color: plan.couleur }} />
                  </div>
                </div>

                {/* Nom + description */}
                <h3 className="text-xl font-black text-gray-900 mb-0.5">{plan.nom}</h3>
                <p className="text-gray-400 text-xs mb-4 leading-snug">{plan.description}</p>

                {/* Prix */}
                <div className="mb-5">
                  {plan.prixXAF === 0 ? (
                    <div className="flex items-baseline gap-1">
                      <p className="text-4xl font-black" style={{ color: plan.couleur }}>Gratuit</p>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <p className="text-4xl font-black" style={{ color: plan.couleur }}>
                        {afficherXAF
                          ? plan.prixXAF.toLocaleString("fr-FR")
                          : prixLocal.toLocaleString("fr-FR")}
                      </p>
                      <span className="text-gray-400 text-sm font-semibold">
                        {afficherXAF ? "FCFA" : devise}/mois
                      </span>
                    </div>
                  )}
                  {plan.prixXAF !== 0 && !afficherXAF && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      ≈ {plan.prixXAF.toLocaleString("fr-FR")} FCFA/mois
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      {f.ok ? (
                        <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: plan.bg, border: `1px solid ${plan.border}` }}>
                          <Check size={9} style={{ color: plan.couleur }} />
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-gray-50 border border-gray-100">
                          <X size={9} className="text-gray-300" />
                        </div>
                      )}
                      <span className={`text-xs leading-tight ${f.ok ? "text-gray-700 font-medium" : "text-gray-400"}`}>
                        {f.label}
                      </span>
                    </li>
                  ))}
                </ul>

                <AbonnementActions planId={plan.id} planActuel={planActuel} couleur={plan.couleur} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-5">
          <HelpCircle size={16} className="text-[#F5A623]" />
          <h2 className="font-bold text-gray-900">Questions fréquentes</h2>
        </div>
        <div className="space-y-4">
          {ABONNEMENT_FAQ.map((item, i) => (
            <div key={i} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
              <p className="font-semibold text-gray-800 text-sm mb-1">{item.q}</p>
              <p className="text-gray-500 text-sm leading-relaxed">{item.r}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
