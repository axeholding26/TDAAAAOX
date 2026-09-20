"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PCOnlyGate } from "@/components/dashboard/PCOnlyGate";
import { ModuleTutorial, BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";
import {
  Plus, Palette, Trash2, Edit2, ExternalLink,
  Sparkles, ArrowLeft,
} from "lucide-react";

const THEMES_TUTORIAL_STEPS = [
  { Icon: Palette,  titre: "Choisissez un design AXSO", description: "15 designs prêts à l'emploi, pensés pour différents univers : mode, artisanat, beauté... En choisir un branche directement vos vrais produits." },
  { Icon: Sparkles, titre: "Importez votre propre design", description: "Envoyez un fichier HTML de référence — notre IA en extrait le style pour créer un thème AXSO personnalisé." },
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface ThemeColors {
  fond: string;
  accent: string;
  texte: string;
  surface: string;
  texteMuted?: string;
  bordure?: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ThemesPage() {
  const router = useRouter();
  const [themes, setThemes] = useState<any[]>([]);
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/themes").then((r) => r.json()),
      fetch("/api/tenants/moi").then((r) => r.json()),
    ]).then(([td, te]) => {
      setThemes(td.themes || []);
      setTenant(te.tenant);
      setLoading(false);
    });
  }, []);

  // Thèmes perso (import manuel ou anciens thèmes créés avant la bibliothèque) —
  // un Theme existe déjà, on ne fait qu'assigner directement son id.
  async function activerCustom(id: string) {
    setActivating(id);
    try {
      await fetch("/api/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeId: id }),
      });
      setTenant((t: any) => ({ ...t, themeId: id }));
      toast.success("Thème activé !");
    } catch {
      toast.error("Erreur lors de l'activation");
    } finally {
      setActivating(null);
    }
  }

  // Bibliothèque AXSO Design — contrairement au thème perso ci-dessus (un id
  // déjà existant, assigné directement), chaque design de la bibliothèque
  // crée un vrai Theme propre à CE tenant (vos produits déjà branchés dans
  // la grille) — voir app/api/themes/provisionner.
  async function activerLibrairie(fichier: string, nom: string) {
    setActivating(fichier);
    try {
      const res = await fetch("/api/themes/provisionner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fichier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setTenant((t: any) => ({ ...t, themeId: data.theme.id }));
      // Le nouveau Theme (propre à ce tenant) doit apparaître dans "custom"
      // pour que isLibrairieActive() le détecte.
      const td = await fetch("/api/themes").then((r) => r.json());
      setThemes(td.themes || []);
      toast.success(`Design "${nom}" activé !`);
    } catch {
      toast.error("Erreur lors de l'activation");
    } finally {
      setActivating(null);
    }
  }

  function isLibrairieActive(fichier: string) {
    const actif = themes.find((t) => t.id === tenant?.themeId);
    return !!actif && typeof actif.slug === "string" && actif.slug.startsWith(`axso-design-${fichier}-`);
  }

  async function supprimer(id: string) {
    if (!confirm("Supprimer ce thème ?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/themes/${id}`, { method: "DELETE" });
      setThemes((ts) => ts.filter((t) => t.id !== id));
      toast.success("Thème supprimé");
    } catch {
      toast.error("Erreur");
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="w-6 h-6 border-2 border-[#F5A623] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const librairie = themes.filter((t) => t.axsoDesign);
  const custom = themes.filter((t) => !t.builtin);

  return (
    <div
      className="h-screen flex flex-col bg-[#F5F7FA] overflow-hidden"
      style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}
    >
      <ModuleTutorial moduleKey="themes" titre="Thèmes" sousTitre="Personnalise l'apparence de ta boutique" steps={THEMES_TUTORIAL_STEPS} />
      <PCOnlyGate label="Theme Studio" />

      {/* ── Header ── */}
      <header className="h-14 flex items-center gap-4 px-6 bg-white border-b border-gray-200 flex-shrink-0">
        <button
          onClick={() => router.push("/dashboard/boutique")}
          className="flex items-center gap-2 text-gray-400 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft size={15} />
          <span className="text-sm font-medium">Boutique</span>
        </button>
        <div className="h-5 w-px bg-gray-200" />
        <div className="flex items-center gap-2">
          <Palette size={16} className="text-[#F5A623]" />
          <h1 className="text-sm font-bold text-gray-800">Theme Studio</h1>
          <BoutonRevoirTutoriel moduleKey="themes" />
        </div>

        {tenant && (
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#FFF7ED] border border-[#F5A623]/20 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-[#F5A623]" />
              <span className="text-xs font-medium text-[#92400E]">
                {themes.find((t) => t.id === tenant.themeId || t.slug === tenant.themeId)?.nom || tenant.themeId}
              </span>
            </div>
            {tenant.slug && (
              <a
                href={`/${tenant.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-gray-400 hover:text-gray-700 transition-all"
              >
                <ExternalLink size={11} /> Voir la boutique
              </a>
            )}
            <button
              onClick={() => router.push("/dashboard/themes/creer")}
              className="flex items-center gap-2 bg-[#F5A623] text-white px-4 py-1.5 rounded-lg font-semibold text-xs hover:bg-[#d4820a] transition-all"
            >
              <Plus size={14} /> Créer un thème
            </button>
          </div>
        )}
      </header>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto px-6 py-6">

        {/* Bibliothèque AXSO Design */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={14} className="text-[#F5A623]" />
            <h2 className="text-sm font-bold text-gray-700">Bibliothèque AXSO Design</h2>
            <span className="text-[10px] bg-[#F5A623]/15 text-[#F5A623] px-2 py-0.5 rounded-full font-semibold">{librairie.length} designs</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {librairie.map((t) => (
              <SimpleThemeCard
                key={t.id}
                theme={t}
                actif={isLibrairieActive(t.fichier)}
                activating={activating === t.fichier}
                onActivate={() => activerLibrairie(t.fichier, t.nom)}
              />
            ))}
          </div>
        </section>

        {/* Thèmes perso */}
        {custom.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={14} className="text-[#F5A623]" />
              <h2 className="text-sm font-bold text-gray-700">Mes thèmes</h2>
              <span className="text-[10px] bg-[#F5A623]/15 text-[#F5A623] px-2 py-0.5 rounded-full font-semibold">{custom.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {custom.map((t) => (
                <SimpleThemeCard
                  key={t.id}
                  theme={t}
                  actif={tenant?.themeId === t.id}
                  activating={activating === t.id}
                  deleting={deleting === t.id}
                  onActivate={() => activerCustom(t.id)}
                  onDelete={() => supprimer(t.id)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ─── Preview mini d'un thème ─────────────────────────────────────────────────
function ThemePreview({ colors, radius }: { colors: ThemeColors; radius: string }) {
  const r = parseInt(radius) || 12;
  const rSm = `${Math.min(r, 8)}px`;
  const rMd = `${Math.min(r, 12)}px`;
  return (
    <div className="h-48 sm:h-full min-h-[160px] p-3 flex flex-col gap-2" style={{ backgroundColor: colors.fond }}>
      {/* Navbar */}
      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: colors.surface, borderRadius: rSm }}>
        <div className="h-2 w-14 rounded" style={{ backgroundColor: colors.accent, borderRadius: "4px" }} />
        <div className="flex gap-1">
          {[1,2,3].map(i => <div key={i} className="h-1.5 w-7 rounded-sm" style={{ backgroundColor: `${colors.texte}30` }} />)}
        </div>
        <div className="h-5 w-10 rounded-md" style={{ backgroundColor: colors.accent, borderRadius: rSm }} />
      </div>
      {/* Hero */}
      <div
        className="flex-1 flex items-center justify-center"
        style={{ backgroundColor: `${colors.accent}18`, borderRadius: rMd, border: `1px solid ${colors.accent}30` }}
      >
        <div className="text-center px-2">
          <div className="h-3 w-24 rounded mx-auto mb-2" style={{ backgroundColor: colors.texte, opacity: 0.8, borderRadius: "4px" }} />
          <div className="h-1.5 w-32 rounded mx-auto mb-3" style={{ backgroundColor: colors.texte, opacity: 0.3, borderRadius: "4px" }} />
          <div className="h-6 w-16 rounded-lg mx-auto" style={{ backgroundColor: colors.accent, borderRadius: rSm }} />
        </div>
      </div>
      {/* Products */}
      <div className="grid grid-cols-4 gap-1.5">
        {[1,2,3,4].map(i => (
          <div key={i} style={{ backgroundColor: colors.surface, borderRadius: rSm, border: `1px solid ${colors.accent}18` }}>
            <div className="h-8" style={{ backgroundColor: `${colors.accent}25`, borderRadius: `${rSm} ${rSm} 0 0` }} />
            <div className="h-1.5 w-8 rounded mx-auto my-1" style={{ backgroundColor: `${colors.texte}30` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Carte simple (thèmes custom) ────────────────────────────────────────────
function SimpleThemeCard({
  theme, actif, activating, deleting, onActivate, onEdit, onDelete,
}: {
  theme: any; actif: boolean; activating: boolean;
  deleting?: boolean; onActivate: () => void; onEdit?: () => void;
  onDelete?: () => void;
}) {
  const colors: ThemeColors = {
    fond:    theme.config?.colors?.fond    || "#fff8f0",
    accent:  theme.config?.colors?.accent  || "#F5A623",
    texte:   theme.config?.colors?.texte   || "#111111",
    surface: theme.config?.colors?.surface || "#fef3e8",
  };

  return (
    <div className={`rounded-2xl border-2 overflow-hidden transition-all ${actif ? "border-[#F5A623] shadow-lg shadow-[#F5A623]/15" : "border-gray-200 hover:border-gray-300"}`}>
      <ThemePreview colors={colors} radius={theme.config?.radius || "12px"} />
      <div className="bg-white p-3.5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold text-gray-800">{theme.nom}</p>
          <div className="flex gap-1">
            {[colors.fond, colors.accent, colors.texte].map((c, i) => (
              <div key={i} className="w-3.5 h-3.5 rounded-full border border-gray-200" style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
        {theme.description && <p className="text-gray-400 text-[11px] mb-3 leading-snug">{theme.description}</p>}
        <div className="flex gap-2">
          {actif ? (
            <div className="flex-1 text-center py-2 rounded-xl text-[11px] font-semibold text-[#F5A623] bg-[#FFF7ED] border border-[#F5A623]/20">
              Thème actif
            </div>
          ) : (
            <button
              onClick={onActivate}
              disabled={activating}
              className="flex-1 py-2 rounded-xl text-[11px] font-bold text-white disabled:opacity-50 hover:opacity-90 transition-all"
              style={{ backgroundColor: colors.accent }}
            >
              {activating ? "..." : "Activer"}
            </button>
          )}
          {onEdit && (
            <button onClick={onEdit} className="w-8 h-8 rounded-xl flex items-center justify-center border border-gray-200 hover:border-[#F5A623]/40 text-gray-400 hover:text-[#F5A623] transition-all">
              <Edit2 size={13} />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} disabled={deleting} className="w-8 h-8 rounded-xl flex items-center justify-center border border-gray-200 hover:border-red-200 text-gray-400 hover:text-red-400 transition-all">
              {deleting ? <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" /> : <Trash2 size={13} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
