"use client";

import { useEffect, useState } from "react";
import { Loader2, LogOut, Monitor, RotateCcw, ShoppingCart, Wallet } from "lucide-react";
import { signOut } from "next-auth/react";
import { POSPanel } from "@/components/dashboard/logistique/POSPanel";
import { EcranCaisse } from "@/components/pos/caisse/EcranCaisse";
import { DeviseProvider } from "@/components/dashboard/DeviseProvider";
import { Retours } from "@/components/pos/finance/Retours";
import { SessionCaisse } from "@/components/pos/finance/SessionCaisse";
import { useT } from "@/components/I18nProvider";

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
//
// POS 2.0 : quand le drapeau `caisse_v2` de la boutique est actif
// (ReglagesPos.flags, lu par GET /api/pos/reglages), le kiosque affiche le
// nouvel écran de caisse (EcranCaisse) à la place de POSPanel. Drapeau éteint,
// ou réglages illisibles : l'ancienne caisse reste en service, inchangée.
// Le kiosque remplace toutes les pages du tableau de bord : les écrans dont un
// caissier a besoin (session de caisse, retours) y sont donc des ONGLETS. La
// synchronisation hors ligne s'ouvre depuis le badge de connexion de la caisse.
type Onglet = "caisse" | "session" | "retours";

export function CaisseKiosk({ boutiqueNom }: { boutiqueNom?: string }) {
  const t = useT();
  // null = drapeau pas encore lu.
  const [v2, setV2] = useState<boolean | null>(null);
  const [onglet, setOnglet] = useState<Onglet>("caisse");
  const [infos, setInfos] = useState<{ devise: string; retour: boolean }>({ devise: "XAF", retour: false });
  useEffect(() => {
    let annule = false;
    fetch("/api/pos/reglages", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!annule) { setV2(d?.flags?.caisse_v2 === true); setInfos({ devise: d?.boutique?.devise || "XAF", retour: d?.droits?.retour === true }); } })
      .catch(() => { if (!annule) setV2(false); });
    return () => { annule = true; };
  }, []);

  if (v2) {
    const onglets: { id: Onglet; libelle: string; Icone: typeof Wallet }[] = [
      { id: "caisse", libelle: "Caisse", Icone: ShoppingCart },
      { id: "session", libelle: "Session de caisse", Icone: Wallet },
      // Sans le droit « retour », l'écran Retours ne ferait qu'afficher un refus.
      ...(infos.retour ? [{ id: "retours" as const, libelle: "Retours", Icone: RotateCcw }] : []),
    ];
    return (
      <div className="h-dvh w-screen overflow-y-auto bg-[#F5F5F5] p-2 text-gray-900 sm:p-3" style={{ fontFamily: "'Poppins', 'Century Gothic', system-ui, sans-serif" }}>
        <nav aria-label={t("Écrans de la caisse")} className="mb-2 flex items-center gap-2">
          {onglets.map(({ id, libelle, Icone }) => (
            <button key={id} type="button" onClick={() => setOnglet(id)} aria-current={onglet === id ? "page" : undefined}
              className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-[12.5px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5A623] ${onglet === id ? "border-[#111111] bg-[#111111] text-white" : "border-[#E8E8E8] bg-white text-[#444444] hover:border-[#F5A623]"}`}>
              <Icone size={15} aria-hidden />
              <span className={onglet === id ? "" : "hidden sm:inline"}>{t(libelle)}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/connexion" })}
            aria-label={t("Se déconnecter")}
            className="ml-auto flex min-h-11 items-center gap-2 rounded-xl px-3 text-[12.5px] font-semibold text-[#444444] transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5A623]"
          >
            <LogOut size={15} aria-hidden />
            <span className="hidden sm:inline">{t("Se déconnecter")}</span>
          </button>
        </nav>
        {/* Un seul écran monté à la fois : revenir sur « Caisse » la recharge (session ouverte ou fermée entre-temps) ; le panier, lui, vit dans le store. */}
        {onglet === "caisse" ? <EcranCaisse kiosque onNaviguer={setOnglet} /> : (
          <DeviseProvider devise={infos.devise}>
            {onglet === "session" ? <SessionCaisse /> : <Retours />}
          </DeviseProvider>
        )}
      </div>
    );
  }

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
              {t("Mode Caisse")}
            </div>
            <div className="text-[11.5px] text-white/70 leading-none mt-1 truncate">
              {t(boutiqueNom) || t("Ma boutique")}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/connexion" })}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12.5px] font-semibold text-white/80 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">{t("Se déconnecter")}</span>
        </button>
      </header>

      {/* ─── Contenu — POSPanel en plein écran, sans le cadrage max-w-7xl du dashboard classique ─── */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6">
        <div className="w-full max-w-[1600px] mx-auto">
          {v2 === null
            ? <div className="flex justify-center py-16" role="status" aria-label={t("Chargement…")}><Loader2 size={24} className="animate-spin text-[#F5A623]" aria-hidden /></div>
            : <POSPanel />}
        </div>
      </main>
    </div>
  );
}
