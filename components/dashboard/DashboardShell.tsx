"use client";

import { usePathname } from "next/navigation";
import { Sparkles, ShoppingCart, Store, Users } from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { BoutiqueSwitcher } from "@/components/dashboard/BoutiqueSwitcher";
import { Header } from "@/components/dashboard/Header";
import { MobileBottomNav } from "@/components/dashboard/MobileBottomNav";
import { QuotaBanner } from "@/components/dashboard/QuotaBanner";
import { CaisseKiosk } from "@/components/dashboard/CaisseKiosk";
import { ModuleTutorial } from "@/components/dashboard/ModuleTutorial";
import type { Palier } from "@/lib/plans";
import type { ModuleKey, Niveau } from "@/lib/permissions";

const FULLBLEED_PREFIXES: string[] = ["/dashboard/builder", "/dashboard/themes"];

// Tour d'accueil combiné — UN SEUL tutoriel, affiché une seule fois à la
// toute première connexion sur une boutique donnée (clé localStorage
// scopée par tenantId), plutôt qu'un pop-up séparé à chaque nouveau module
// visité. Les tutoriels par module restent disponibles à la demande via
// leur bouton "?", mais ne s'auto-affichent plus jamais (voir ModuleTutorial.tsx).
const BIENVENUE_STEPS = [
  { Icon: Sparkles,      titre: "AXIA, ton assistant boutique", description: "Pose-lui n'importe quelle question ou demande-lui d'agir directement : créer un produit, lancer une promo, relancer un client." },
  { Icon: ShoppingCart,  titre: "Commandes & Produits",          description: "Gère tes ventes et ton catalogue depuis la sidebar — chaque module a son propre bouton \"?\" pour revoir son mode d'emploi à tout moment." },
  { Icon: Store,         titre: "Ma boutique & Point de vente",  description: "Personnalise ta boutique en ligne, ou bascule vers le module Point de vente pour encaisser directement en magasin." },
  { Icon: Users,         titre: "Ton équipe",                     description: "Invite des collaborateurs (gérant, caissier, comptable...) avec des accès précis depuis Paramètres > Équipe." },
];

// Toute la logique dépendant de la route vit ici, dans un composant client,
// plutôt que dans le layout serveur : les layouts Next.js ne se ré-exécutent
// pas à chaque navigation entre pages soeurs (c'est voulu, pour ne pas
// re-render la sidebar à chaque clic) — une décision "faut-il afficher la
// sidebar" basée sur headers() côté serveur restait donc figée sur l'état du
// tout premier chargement. usePathname() côté client, lui, se met à jour de
// façon fiable à chaque navigation.
export function DashboardShell({
  children, session, boutique, quotaAtteint, palier, permissions, modeCaisse,
}: {
  children: React.ReactNode;
  session: any;
  boutique: { slug: string; nomBoutique: string } | null;
  quotaAtteint: boolean;
  palier: Palier;
  permissions?: Record<ModuleKey, Niveau>;
  // Calculé une fois côté serveur dans layout.tsx (estCaissierPur), PAS
  // re-dérivé du pathname côté client : contrairement à fullBleed ci-dessous,
  // ce mode dépend du RÔLE de l'utilisateur, pas de la route visitée — un
  // caissier pur doit voir le kiosque plein écran sur n'importe quelle route
  // du dashboard, pas seulement /dashboard/logistique?tab=pos.
  modeCaisse?: boolean;
}) {
  const pathname = usePathname();
  const estAccueilAxia = pathname === "/dashboard";
  const fullBleed = estAccueilAxia || FULLBLEED_PREFIXES.some(r => pathname.startsWith(r));

  // Mode Caisse : un caissier pur n'a jamais accès au chrome du dashboard
  // (sidebar/header/bottom nav) — écran plein écran dédié à la place, sur
  // desktop comme sur mobile.
  if (modeCaisse) {
    return <CaisseKiosk boutiqueNom={boutique?.nomBoutique} />;
  }

  return (
    <>
      <ModuleTutorial
        moduleKey="bienvenue"
        storageKey={`bienvenue:${session?.user?.tenantId ?? "defaut"}`}
        autoOpen
        titre="Bienvenue sur AXSO"
        sousTitre="Un tour rapide pour démarrer"
        steps={BIENVENUE_STEPS}
      />

      {/* ─── Layout responsive UNIQUE ────────────────────────────────
          Auparavant : deux arborescences JSX sœurs complètes ("hidden
          md:flex" pour desktop, "md:hidden" pour mobile), chacune
          contenant sa propre copie de `children`. Tailwind ne fait que
          MASQUER visuellement (display:none) celle qui ne correspond pas
          au viewport — les DEUX restent montées en React en permanence,
          donc CHAQUE page du dashboard tournait en double : deux fetch
          initiaux, et pour le Constructeur (page la plus sensible, avec
          son auto-save débouncé) deux minuteries de sauvegarde
          indépendantes qui se chevauchaient et pouvaient s'écraser l'une
          l'autre — confirmé en observant deux `GET /api/tenants/moi-complet`
          et deux `PATCH /api/tenants` par chargement/édition dans les logs
          serveur. Ici, `children` n'est monté qu'UNE SEULE fois ; seuls les
          éléments de chrome sans état (Sidebar/Header vs MobileHeader/
          MobileBottomNav) sont togglés par CSS pur. */}
      {/* h-dvh (mobile) plutôt que min-h-screen/100vh : sur mobile, 100vh est
          calculé sur la hauteur de viewport barre d'adresse masquée — plus
          grand que ce qui est réellement visible au chargement. */}
      <div className="flex flex-col md:flex-row h-dvh md:h-screen bg-[#F5F5F5] text-gray-900 overflow-hidden" style={{ fontFamily: "'Poppins', 'Century Gothic', system-ui, sans-serif" }}>
        {/* Écran d'accueil AXIA = plein écran réel, la sidebar AXSO ne doit
            pas rester visible à côté — le retour au dashboard classique se
            fait via le bouton dédié dans la barre supérieure d'AXIA. */}
        {!estAccueilAxia && (
          <div className="hidden md:block">
            <Sidebar boutiqueNom={boutique?.nomBoutique} boutiqueSlug={boutique?.slug} palier={palier} permissions={permissions} />
          </div>
        )}
        <div className="flex flex-col flex-1 overflow-hidden">
          {!estAccueilAxia && (
            <div className="md:hidden flex-shrink-0">
              <MobileHeader boutiqueNom={boutique?.nomBoutique} />
            </div>
          )}
          {!fullBleed && !estAccueilAxia && (
            <div className="hidden md:block flex-shrink-0">
              <Header session={session} boutiqueSlug={boutique?.slug} boutiqueNom={boutique?.nomBoutique}/>
            </div>
          )}
          <main className={fullBleed || estAccueilAxia ? "flex-1 overflow-hidden flex flex-col" : "flex-1 overflow-y-auto pb-32 md:pb-0"}>
            {fullBleed || estAccueilAxia ? children : (
              <div key={pathname} className="ax-page-enter px-3 pt-3 md:px-6 md:pt-0 md:pb-8 max-w-lg md:max-w-7xl mx-auto w-full space-y-4 md:space-y-0">
                {quotaAtteint && <QuotaBanner />}
                {children}
              </div>
            )}
          </main>
          {!estAccueilAxia && (
            <div className="md:hidden flex-shrink-0">
              <MobileBottomNav />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Header mobile ────────────────────────────────────────────── */
function MobileHeader({ boutiqueNom }: { boutiqueNom?: string }) {
  return (
    <header className="sticky top-0 z-40 bg-white/96 backdrop-blur-xl border-b border-gray-100"
      style={{ boxShadow: "0 1px 12px rgba(0,0,0,0.04)" }}>
      <div className="flex items-center justify-between px-4 h-14">
        <img src="/logo.png" alt="axso" style={{ height: "32px", width: "auto", objectFit: "contain" }}/>
        {boutiqueNom && (
          <div className="flex items-center gap-1.5 bg-[#F5A623]/8 border border-[#F5A623]/20 rounded-full px-3 py-1 max-w-[150px]">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0"/>
            <span className="text-xs font-semibold text-[#F5A623] truncate">{boutiqueNom}</span>
          </div>
        )}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F5A623] to-[#e8950f] flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-bold">A</span>
        </div>
      </div>
      <div className="px-4 pb-2.5 empty:hidden"><BoutiqueSwitcher /></div>
    </header>
  );
}
