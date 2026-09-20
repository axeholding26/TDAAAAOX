"use client";

import { LogOut, Monitor } from "lucide-react";
import { signOut } from "next-auth/react";
import { POSPanel } from "@/components/dashboard/logistique/POSPanel";

// ─── Mode Caisse ────────────────────────────────────────────────────────────
// Écran plein écran dédié pour un caissier "pur" (voir estCaissierPur() dans
// lib/permissions.ts) : aucune sidebar, aucun header, aucune bottom nav — un
// kiosque de point de vente à but unique. La décision de rendre ce composant
// est prise dans DashboardShell (prop modeCaisse, calculée côté serveur dans
// layout.tsx), donc ce fichier n'a besoin d'aucune logique de permissions —
// s'il est monté, c'est que l'appelant a déjà décidé que l'utilisateur est un
// caissier pur.
//
// Contenu réutilisé tel quel : POSPanel (catalogue + panier + encaissement)
// porte déjà toute la logique de vente (chargement produits, ajout panier,
// validation /api/commandes/pos-creer). Ce composant est un simple wrapper
// plein écran autour, avec un habillage "kiosque" (grand header de marque,
// bouton de déconnexion discret) — voir consigne de la tâche : ne pas
// modifier POSPanel.tsx (édité en parallèle par une autre tâche).
export function CaisseKiosk({ boutiqueNom }: { boutiqueNom?: string }) {
  return (
    <div
      className="h-dvh w-screen flex flex-col overflow-hidden bg-[#f0f2f8] text-gray-900"
      style={{ fontFamily: "'Poppins', 'Century Gothic', system-ui, sans-serif" }}
    >
      {/* ─── Header kiosque ─── */}
      <header
        className="flex-shrink-0 flex items-center justify-between px-5 sm:px-8 h-16 sm:h-[72px]"
        style={{
          background: "linear-gradient(135deg,#F5A623 0%,#D4911A 100%)",
          boxShadow: "0 2px 16px rgba(245,166,35,0.3)",
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "rgba(255,255,255,0.18)" }}
          >
            <Monitor size={19} className="text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] sm:text-[16px] font-bold text-white leading-tight truncate">
              Mode Caisse
            </div>
            <div className="text-[11.5px] text-white/70 leading-none mt-1 truncate">
              {boutiqueNom || "Ma boutique"}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/connexion" })}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12.5px] font-semibold text-white/80 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">Se déconnecter</span>
        </button>
      </header>

      {/* ─── Contenu — POSPanel en plein écran, sans le cadrage max-w-7xl du dashboard classique ─── */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6">
        <div className="w-full max-w-[1600px] mx-auto">
          <POSPanel />
        </div>
      </main>
    </div>
  );
}
