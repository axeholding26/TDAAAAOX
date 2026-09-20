"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search, Globe, ShoppingBag, Package, ExternalLink,
  Star, MapPin, TrendingUp, Clock, ChevronRight,
  ShoppingCart, Factory, Link2, Moon, Zap, Lock, Sparkles,
} from "lucide-react";
import { aAcces, type Palier } from "@/lib/plans";
import { ModuleTutorial, BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";

const SOURCING_TUTORIAL_STEPS = [
  { Icon: Globe,        titre: "Fournisseurs vérifiés",     description: "AliExpress, Alibaba, CJ Dropshipping, Jumia, Spocket... une sélection de fournisseurs dropshipping vérifiés par l'équipe Axso." },
  { Icon: Search,       titre: "Recherche & filtres",        description: "Recherche par nom, pays ou catégorie, et filtre par catégorie (Mode, Tech, Maison...) pour trouver le bon fournisseur en un instant." },
  { Icon: ExternalLink, titre: "Note, délai et fiche",        description: "Chaque fournisseur affiche sa note, son délai de livraison et ses catégories. Clique \"Visiter\" pour ouvrir son site directement." },
  { Icon: Lock,         titre: "Sourcing mondial — Palier 2", description: "Les fournisseurs internationaux (AliExpress, Alibaba...) sont réservés au Palier 2. Les fournisseurs Afrique restent accessibles à tous." },
];

const FOURNISSEURS = [
  {
    id: "aliexpress",
    nom: "AliExpress",
    Logo: ShoppingCart,
    pays: "Chine → Monde",
    categories: ["Mode", "Tech", "Maison", "Beauté", "Sport"],
    tags: ["dropshipping", "petites-quantites", "worldwide"],
    couleur: "#e83e1a",
    description: "La plus grande marketplace dropshipping mondiale — expédition vers 220+ pays.",
    url: "https://www.aliexpress.com",
    note: 4.2,
    delai: "7–30 j",
    regions: ["Monde"],
  },
  {
    id: "alibaba",
    nom: "Alibaba",
    Logo: Factory,
    pays: "Chine",
    categories: ["Électronique", "Mode", "Industrie", "Alimentaire"],
    tags: ["grossiste", "import", "vrac"],
    couleur: "#ff6a00",
    description: "Fournisseurs grossistes B2B pour commandes en volume.",
    url: "https://www.alibaba.com",
    note: 4.0,
    delai: "15–45 j",
    regions: ["Monde"],
  },
  {
    id: "cjdropshipping",
    nom: "CJ Dropshipping",
    Logo: Zap,
    pays: "Chine → Monde",
    categories: ["Mode", "Bijoux", "Tech", "Maison"],
    tags: ["dropshipping", "auto-fulfillment", "branded"],
    couleur: "#6c47ff",
    description: "Dropshipping automatisé avec fulfillment et étiquetage marque blanche.",
    url: "https://cjdropshipping.com",
    note: 4.4,
    delai: "5–20 j",
    regions: ["Monde"],
  },
  {
    id: "jumia",
    nom: "Jumia Marketplace",
    Logo: Globe,
    pays: "Afrique",
    categories: ["Électronique", "Mode", "Alimentation", "Maison"],
    tags: ["afrique", "local", "marketplace"],
    couleur: "#ff8c00",
    description: "Marketplace leader en Afrique — accès aux fournisseurs locaux africains.",
    url: "https://www.jumia.com",
    note: 3.8,
    delai: "3–10 j",
    regions: ["NG", "KE", "GH", "CI", "SN", "EG", "MA", "TN"],
  },
  {
    id: "jiji",
    nom: "Jiji Afrique",
    Logo: ShoppingBag,
    pays: "Afrique de l'Ouest",
    categories: ["Mode", "Electronique", "Véhicules", "Services"],
    tags: ["afrique", "petites-annonces", "local"],
    couleur: "#00a651",
    description: "Annonces de grossistes locaux — Nigeria, Ghana, Kenya, Tanzanie.",
    url: "https://jiji.com.gh",
    note: 3.6,
    delai: "1–7 j",
    regions: ["NG", "GH", "KE", "TZ", "UG"],
  },
  {
    id: "bigbuy",
    nom: "BigBuy",
    Logo: Globe,
    pays: "Espagne → Europe",
    categories: ["Maison", "Tech", "Jouets", "Mode"],
    tags: ["europe", "dropshipping", "automatise"],
    couleur: "#003d99",
    description: "Fournisseur dropshipping n°1 en Europe, intégration API complète.",
    url: "https://www.bigbuy.eu",
    note: 4.3,
    delai: "2–7 j",
    regions: ["FR", "DE", "ES", "IT", "PT", "BE", "NL", "GB"],
  },
  {
    id: "spocket",
    nom: "Spocket",
    Logo: Link2,
    pays: "USA + Europe",
    categories: ["Mode", "Maison", "Beauté", "Tech"],
    tags: ["usa", "europe", "dropshipping", "marques"],
    couleur: "#1B2A4A",
    description: "Fournisseurs dropshipping US & EU avec livraison rapide 2–5 jours.",
    url: "https://www.spocket.co",
    note: 4.5,
    delai: "2–7 j",
    regions: ["US", "CA", "GB", "FR", "DE", "AU"],
  },
  {
    id: "noon",
    nom: "Noon",
    Logo: Moon,
    pays: "Moyen-Orient",
    categories: ["Tech", "Mode", "Maison", "Beauté"],
    tags: ["golfe", "eau", "ksa", "marketplace"],
    couleur: "#fecc00",
    description: "Marketplace leader au Moyen-Orient — UAE, Arabie Saoudite, Égypte.",
    url: "https://www.noon.com",
    note: 4.0,
    delai: "2–5 j",
    regions: ["AE", "SA", "EG", "QA", "KW"],
  },
];

const CATEGORIES = ["Toutes", "Mode", "Tech", "Maison", "Beauté", "Alimentation", "Sport", "Bijoux"];


function StarRating({ note }: { note: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <svg key={n} width="10" height="10" viewBox="0 0 10 10" fill={n <= Math.round(note) ? "#F5A623" : "#E8E8E8"}>
          <polygon points="5,1 6.2,4 9.5,4 7,6.2 8,9.5 5,7.5 2,9.5 3,6.2 0.5,4 3.8,4" />
        </svg>
      ))}
      <span className="text-[11px] font-semibold text-[#666666] ml-0.5">{note}</span>
    </div>
  );
}

export default function SourcingPage() {
  const [search, setSearch]       = useState("");
  const [categorie, setCategorie] = useState("Toutes");
  const [plan, setPlan] = useState<Palier>("palier2"); // optimiste — évite de flasher un verrou avant le chargement
  useEffect(() => {
    fetch("/api/tenants/moi").then(r => r.json()).then(d => {
      const p = d.tenant?.planType as Palier | undefined;
      if (p === "palier0" || p === "palier1" || p === "palier2") setPlan(p);
    }).catch(() => {});
  }, []);
  const sourcingMondialOk = aAcces(plan, "sourcing_mondial");
  const filtres = FOURNISSEURS.filter(f => {
    const q = search.toLowerCase();
    const ok = !q || f.nom.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)
      || f.pays.toLowerCase().includes(q) || f.tags.some(t => t.includes(q));
    return ok && (categorie === "Toutes" || f.categories.includes(categorie));
  });


  return (
    <div className="space-y-5" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <ModuleTutorial moduleKey="sourcing" titre="Sourcing" sousTitre="Trouve tes fournisseurs" steps={SOURCING_TUTORIAL_STEPS} />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="relative bg-white rounded-2xl border border-[#E8E8E8] shadow-sm overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 80% at 100% 50%, rgba(245,166,35,0.07) 0%, transparent 70%)" }} />
        <div className="relative p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold mb-3 tracking-wide"
                style={{ background: "#FFF7ED", color: "#D4911A", border: "1px solid #FDE68A" }}>
                <Globe size={10} strokeWidth={2.5} />
                SOURCING MONDIAL
              </div>
              <div className="flex items-center gap-2">
                <h1 className="text-[22px] font-bold text-[#111111] leading-tight tracking-tight">
                  Sourcing & Fournisseurs
                </h1>
                <BoutonRevoirTutoriel moduleKey="sourcing" />
              </div>
              <p className="text-[#AAAAAA] text-sm mt-1.5 max-w-md leading-relaxed">
                Les meilleurs fournisseurs dropshipping mondiaux, vérifiés par l'équipe Axso.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-5">
            {[
              { val: "220+", label: "Pays livrés", icon: Globe },
              { val: `${FOURNISSEURS.length}`, label: "Fournisseurs vérifiés", icon: ShoppingBag },
              { val: "0 %", label: "Commission Axso", icon: TrendingUp },
            ].map(s => {
              const Ic = s.icon;
              return (
                <div key={s.label} className="flex items-center gap-3 p-3.5 rounded-xl"
                  style={{ background: "#FFF7ED", border: "1px solid #FDE68A" }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(245,166,35,0.12)" }}>
                    <Ic size={15} style={{ color: "#F5A623" }} />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-[#111111] leading-none">{s.val}</p>
                    <p className="text-[#666666] text-[11px] mt-0.5">{s.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-4">

          {/* Filtres */}
          <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-sm p-4 space-y-3">
            <div className="flex items-center gap-2 bg-[#F5F5F5] border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 transition-all"
              style={{ outlineStyle: "solid", outlineWidth: 0 }}
              onFocusCapture={e => (e.currentTarget.style.borderColor = "#FDE68A")}
              onBlurCapture={e => (e.currentTarget.style.borderColor = "#E8E8E8")}>
              <Search size={14} className="text-[#AAAAAA] flex-shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un fournisseur, pays, catégorie…"
                className="flex-1 bg-transparent text-sm text-[#111111] placeholder-[#AAAAAA] outline-none"
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-[#CCCCCC] hover:text-[#666666] text-xs">✕</button>
              )}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCategorie(c)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={categorie === c
                    ? { background: "#F5A623", color: "#111111", boxShadow: "0 2px 8px rgba(245,166,35,0.25)" }
                    : { background: "#F5F5F5", color: "#666666" }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Résultats */}
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-[#AAAAAA] font-medium">
              {filtres.length} fournisseur{filtres.length !== 1 ? "s" : ""}
              {search && ` pour "${search}"`}
            </p>
          </div>

          {/* Grille fournisseurs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {filtres.map(f => {
              const verrouille = f.regions.includes("Monde") && !sourcingMondialOk;
              return (
              <div key={f.id}
                className="relative bg-white rounded-2xl border border-[#E8E8E8] shadow-sm p-5 group cursor-default transition-all duration-200 overflow-hidden"
                style={{ ["--hover-border" as any]: "#FDE68A" }}
                onMouseEnter={e => {
                  if (verrouille) return;
                  (e.currentTarget as HTMLElement).style.borderColor = "#FDE68A";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(245,166,35,0.08)";
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#E8E8E8";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
                  (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                }}>

                <div className={verrouille ? "pointer-events-none select-none opacity-50" : ""} style={verrouille ? { filter: "blur(2px)" } : undefined}>
                {/* Header */}
                <div className="flex items-start justify-between mb-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                      style={{ background: f.couleur + "12", border: `1.5px solid ${f.couleur}22` }}>
                      <f.Logo size={22} style={{ color: f.couleur }} />
                    </div>
                    <div>
                      <p className="font-bold text-[#111111] text-sm leading-tight">{f.nom}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <MapPin size={9} className="text-[#CCCCCC]" />
                        <p className="text-[#AAAAAA] text-[11px]">{f.pays}</p>
                      </div>
                    </div>
                  </div>
                  <StarRating note={f.note} />
                </div>

                {/* Description */}
                <p className="text-[#666666] text-xs leading-relaxed mb-3.5 line-clamp-2">{f.description}</p>

                {/* Catégories */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {f.categories.slice(0, 3).map(c => (
                    <span key={c} className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "#F5F5F5", color: "#666666", border: "1px solid #E8E8E8" }}>
                      {c}
                    </span>
                  ))}
                  {f.categories.length > 3 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "#F5F5F5", color: "#AAAAAA", border: "1px solid #E8E8E8" }}>
                      +{f.categories.length - 3}
                    </span>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-[#E8E8E8]">
                  <div className="flex items-center gap-1.5">
                    <Clock size={11} className="text-[#CCCCCC]" />
                    <span className="text-[11px] text-[#AAAAAA] font-medium">{f.delai}</span>
                  </div>
                  <a href={f.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                    style={{ color: "#F5A623", background: "#FFF7ED" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(245,166,35,0.15)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#FFF7ED")}>
                    Visiter <ExternalLink size={10} />
                  </a>
                </div>
                </div>

                {verrouille && (
                  <div className="absolute inset-0 flex items-center justify-center p-4" style={{ background: "rgba(255,255,255,0.5)" }}>
                    <Link href="/dashboard/abonnement"
                      className="flex flex-col items-center gap-2 text-center px-4 py-3 rounded-xl transition-all hover:opacity-90"
                      style={{ background: "white", border: "1px solid #FDE68A", boxShadow: "0 4px 16px rgba(245,166,35,0.15)" }}>
                      <Lock size={16} className="text-[#F5A623]" />
                      <span className="text-xs font-bold text-[#111111]">Sourcing mondial — Palier 2</span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#111111] px-3 py-1.5 rounded-full" style={{ background: "#F5A623" }}>
                        <Sparkles size={10} /> Débloquer
                      </span>
                    </Link>
                  </div>
                )}
              </div>
              );
            })}

            {filtres.length === 0 && (
              <div className="col-span-2 bg-white border border-dashed border-[#E8E8E8] rounded-2xl p-12 text-center">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: "#FFF7ED" }}>
                  <ShoppingBag size={22} style={{ color: "#FDE68A" }} />
                </div>
                <p className="text-[#666666] font-semibold text-sm">Aucun fournisseur trouvé</p>
                <p className="text-[#AAAAAA] text-xs mt-1">Modifiez votre recherche ou vos filtres</p>
              </div>
            )}
          </div>

      </div>
    </div>
  );
}
