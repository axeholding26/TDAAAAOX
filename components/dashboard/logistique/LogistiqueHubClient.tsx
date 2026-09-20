"use client";
import { useState } from "react";
import Link from "next/link";
import {
  LayoutGrid, Truck, Bike, RotateCcw, FileText, ShoppingCart,
  Warehouse, Bus, Wallet, ChevronRight,
} from "lucide-react";
import { LivraisonPanel } from "./LivraisonPanel";
import { LivreursPanel } from "./LivreursPanel";
import { RetoursPanel } from "./RetoursPanel";
import { FacturesPanel } from "./FacturesPanel";
import { POSPanel } from "./POSPanel";

interface Stats {
  enCours: number;
  livreursActifs: number;
  retoursOuverts: number;
  echecs: number;
  codEnAttente: number;
  facturesEnAttente: number;
}

const TABS = [
  { id: "apercu",    label: "Vue d'ensemble", Icon: LayoutGrid   },
  { id: "livraison", label: "Livraison",      Icon: Truck        },
  { id: "livreurs",  label: "Livreurs",       Icon: Bike         },
  { id: "retours",   label: "Retours",        Icon: RotateCcw    },
  { id: "factures",  label: "Factures",       Icon: FileText     },
  { id: "pos",       label: "Caisse POS",     Icon: ShoppingCart },
];

export function LogistiqueHubClient({ initialTab, stats }: { initialTab?: string; stats: Stats }) {
  const [onglet, setOnglet] = useState(TABS.some((t) => t.id === initialTab) ? initialTab! : "apercu");

  const cartes = [
    { tab: "livraison", label: "Livraison", desc: "Suivi des commandes en cours", Icon: Truck, valeur: stats.enCours, accent: "#3b82f6" },
    { tab: "livreurs",  label: "Livreurs",  desc: "Flotte & disponibilité",       Icon: Bike,  valeur: stats.livreursActifs, accent: "#F5A623" },
    { tab: "retours",   label: "Retours",   desc: "Demandes de retour / RMA",     Icon: RotateCcw, valeur: stats.retoursOuverts, accent: "#ef4444" },
    { tab: "factures",  label: "Factures",  desc: "Factures en attente",          Icon: FileText, valeur: stats.facturesEnAttente, accent: "#F5A623" },
  ];

  const liensExternes = [
    { href: "/dashboard/logistique/encaissements", label: "Encaissements COD", desc: "Cash à réconcilier avec vos livreurs", Icon: Wallet, valeur: stats.codEnAttente, accent: "#10b981" },
    { href: "/dashboard/logistique/entrepots", label: "Entrepôts", desc: "Stock par emplacement", Icon: Warehouse, valeur: null, accent: "#8b5cf6" },
    { href: "/dashboard/logistique/transporteurs", label: "Transporteurs", desc: "Agences & partenaires", Icon: Bus, valeur: null, accent: "#10b981" },
  ];

  return (
    <div className="space-y-5 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold text-[#111111]">Logistique</h1>
        <p className="text-sm text-gray-400 mt-0.5">Livraison, livreurs, retours, factures et caisse — tout en un seul endroit</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 overflow-x-auto">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setOnglet(id)}
            className={`flex-1 py-2 px-3 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all flex items-center justify-center gap-1.5 ${onglet === id ? "bg-white shadow-sm text-[#111]" : "text-gray-500 hover:text-gray-700"}`}>
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {onglet === "apercu" && (
        <div className="space-y-5">
          {stats.echecs > 0 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
              <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <Truck size={15} className="text-red-500" />
              </div>
              <p className="text-sm text-red-700">
                <span className="font-bold">{stats.echecs}</span> livraison{stats.echecs > 1 ? "s ont" : " a"} échoué et attend{stats.echecs > 1 ? "ent" : ""} une replanification
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cartes.map((c) => (
              <button
                key={c.tab}
                onClick={() => setOnglet(c.tab)}
                className="group flex items-start gap-3 bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md hover:-translate-y-0.5 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${c.accent}15` }}>
                  <c.Icon size={18} style={{ color: c.accent }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-[#111111]">{c.label}</p>
                    <span className="text-lg font-bold" style={{ color: c.accent }}>{c.valeur}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{c.desc}</p>
                </div>
              </button>
            ))}
          </div>

          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Autres modules</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {liensExternes.map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className="group flex items-start gap-3 bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${c.accent}15` }}>
                    <c.Icon size={16} style={{ color: c.accent }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-bold text-[#111111]">{c.label}</p>
                      {c.valeur !== null && <span className="text-[13px] font-bold" style={{ color: c.accent }}>{c.valeur}</span>}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">{c.desc}</p>
                  </div>
                  <ChevronRight size={13} className="text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0 mt-1" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {onglet === "livraison" && <LivraisonPanel />}
      {onglet === "livreurs"  && <LivreursPanel />}
      {onglet === "retours"   && <RetoursPanel />}
      {onglet === "factures"  && <FacturesPanel />}
      {onglet === "pos"       && <POSPanel />}
    </div>
  );
}
