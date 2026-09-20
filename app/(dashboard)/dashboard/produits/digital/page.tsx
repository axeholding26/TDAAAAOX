"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Plus, Download, BookOpen, Monitor, FileText, Music, Video, Package,
  TrendingUp, Shield, MoreHorizontal, Copy, Archive, ArchiveRestore,
  ChevronDown, Search, X, Users, BarChart2, Send, Ban, ExternalLink,
  RefreshCw, Loader2, AlertCircle, Check, Eye, Tag, Clock, Infinity,
  FileDown, Key, ChevronRight, Sparkles,
} from "lucide-react";
import { formatMontant, formatDate } from "@/lib/utils";
import { ModuleTutorial, BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";

const DIGITAL_TUTORIAL_STEPS = [
  { Icon: Package,    titre: "4 types de produits digitaux", description: "Fichier téléchargeable, licence à clés, bundle ou formation — clique \"Nouveau produit digital\" pour créer le tien." },
  { Icon: TrendingUp, titre: "Suivi en un coup d'œil",         description: "Téléchargements, revenu total, licences actives et nombre de produits — tes stats clés tout en haut de la page." },
  { Icon: Search,     titre: "Recherche & filtres",             description: "Filtre par type ou statut, ou cherche un produit par nom. Les pastilles en dessous affichent le nombre de produits par type." },
  { Icon: Users,      titre: "Clients & Liens",                 description: "Depuis chaque produit, ouvre l'onglet \"Clients & Liens\" pour renvoyer un lien de téléchargement ou révoquer une clé de licence." },
];

// ─── Nouveau système : types digitaux avancés ─────────────────────────────────

type NouveauProduit = {
  id: string;
  nom: string;
  prix: number;
  actif: boolean;
  type: string;
  images: string[];
  createdAt: string;
  _count: { lignesCommande: number };
  produitFichier?: { _count: { fichiers: number } } | null;
  licenceProduit?: { _count: { cles: number }; cles: { id: string }[] } | null;
  bundleProduit?: { _count: { elements: number } } | null;
};

const NOUVEAU_TYPE_CONFIG: Record<string, { icon: any; label: string; color: string; bg: string }> = {
  fichier:   { icon: FileDown, label: "Fichier(s)",  color: "#1B2A4A", bg: "#1B2A4A12" },
  licence:   { icon: Key,      label: "Licence",     color: "#16a34a", bg: "#16a34a12" },
  bundle:    { icon: Package,  label: "Bundle",      color: "#F5A623", bg: "#F5A62312" },
  formation: { icon: BookOpen, label: "Formation",   color: "#0ea5e9", bg: "#0ea5e912" },
};

function NouveauxProduitsSection({ devise }: { devise: string }) {
  const [produits, setProduits] = useState<NouveauProduit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/produits/digitaux")
      .then((r) => r.json())
      .then((d) => { setProduits(d.produits ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!produits.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[#F5A623]" />
          <h2 className="text-sm font-semibold text-[#111111]">Nouveau système</h2>
          <span className="text-xs text-[#AAAAAA] bg-[#F5F5F5] px-2 py-0.5 rounded-full">
            {produits.length}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {produits.map((p) => {
          const cfg = NOUVEAU_TYPE_CONFIG[p.type] ?? NOUVEAU_TYPE_CONFIG.fichier;
          const Icone = cfg.icon;
          const thumb = p.images[0];

          let meta = "";
          if (p.type === "fichier" && p.produitFichier) {
            const n = p.produitFichier._count.fichiers;
            meta = `${n} fichier${n !== 1 ? "s" : ""}`;
          } else if (p.type === "licence" && p.licenceProduit) {
            const dispo = p.licenceProduit.cles.length;
            const total = p.licenceProduit._count.cles;
            meta = `${dispo > 0 ? dispo : 0} / ${total} clés dispo`;
          } else if (p.type === "bundle" && p.bundleProduit) {
            const n = p.bundleProduit._count.elements;
            meta = `${n} produit${n !== 1 ? "s" : ""}`;
          }

          return (
            <Link
              key={p.id}
              href={`/dashboard/produits/${p.id}`}
              className="bg-white border border-[#E8E8E8] rounded-2xl overflow-hidden hover:border-[#D0D0D0] hover:shadow-sm transition-all group flex flex-col"
            >
              <div className="aspect-video bg-[#F5F5F5] relative overflow-hidden flex-shrink-0">
                {thumb ? (
                  <img src={thumb} alt={p.nom} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1.5" style={{ background: cfg.bg }}>
                    <Icone size={28} style={{ color: cfg.color }} />
                    <span className="text-[10px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: cfg.color, background: cfg.bg }}>
                    <Icone size={9} /> {cfg.label}
                  </span>
                </div>
                {!p.actif && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="text-white text-xs font-bold px-3 py-1 rounded-full bg-black/50 border border-white/20">Brouillon</span>
                  </div>
                )}
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <p className="text-sm font-semibold text-[#111111] line-clamp-2 mb-1">{p.nom}</p>
                {meta && <p className="text-[11px] text-[#AAAAAA] mb-2">{meta}</p>}
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-base font-bold text-[#F5A623]">{formatMontant(p.prix, devise)}</span>
                  <div className="flex items-center gap-1 text-[11px] text-[#AAAAAA]">
                    <TrendingUp size={10} className="text-[#16A34A]" />
                    {p._count.lignesCommande} vente{p._count.lignesCommande !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
        <Link
          href="/dashboard/produits/digital/nouveau"
          className="border-2 border-dashed border-[#E8E8E8] rounded-2xl p-6 flex flex-col items-center justify-center gap-2 text-center hover:border-[#D0D0D0] hover:bg-[#F9F9F9] transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#F5F5F5] flex items-center justify-center group-hover:bg-[#EDEDED] transition-colors">
            <Plus size={18} className="text-[#AAAAAA]" />
          </div>
          <span className="text-xs font-medium text-[#AAAAAA]">Nouveau produit</span>
        </Link>
      </div>
      <div className="border-t border-[#F0F0F0] pt-4">
        <p className="text-xs text-[#AAAAAA] font-medium uppercase tracking-wider">Produits classiques</p>
      </div>
    </div>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

type DigitalMeta = {
  typeDigital: string;
  limiteTelechargement: number | null;
  expirationAcces: number | null;
  typeLicence: string;
  filigrane: boolean;
  liensUniques: boolean;
  messagePostAchat: string;
  instructions: string;
  previewUrl: string | null;
};

type Produit = {
  id: string;
  nom: string;
  prix: number;
  prixCompare: number | null;
  images: string[];
  actif: boolean;
  ventes: number;
  createdAt: string;
  fichierUrl: string | null;
  fichierNom: string | null;
  fichierTaille: number | null;
  meta: DigitalMeta;
  downloadCount: number;
  _count: { telechargements: number; lignesCommande: number };
};

type Stats = {
  totalTelechargements: number;
  revenuTotal: number;
  licencesActives: number;
  totalProduits: number;
};

type Client = {
  commandeId: string;
  commandeNumero: string;
  clientNom: string;
  clientEmail: string;
  paiementStatut: string;
  achatDate: string;
  telechargements: Array<{
    token: string;
    telecharge: boolean;
    expireAt: string;
    createdAt: string;
  }>;
};

type GraphData = { date: string; count: number }[];

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  ebook:    { label: "Ebook",     icon: BookOpen,  color: "#1B2A4A", bg: "#eef1f6" },
  cours:    { label: "Cours",     icon: Video,     color: "#0ea5e9", bg: "#f0f9ff" },
  logiciel: { label: "Logiciel",  icon: Monitor,   color: "#16a34a", bg: "#f0fdf4" },
  template: { label: "Template",  icon: FileText,  color: "#d97706", bg: "#fffbeb" },
  audio:    { label: "Audio",     icon: Music,     color: "#db2777", bg: "#fdf2f8" },
  video:    { label: "Vidéo",     icon: Video,     color: "#dc2626", bg: "#fef2f2" },
  autre:    { label: "Autre",     icon: Package,   color: "#6b7280", bg: "#f9fafb" },
};

const LICENCE_LABELS: Record<string, string> = {
  personnel:         "Licence personnelle",
  commercial:        "Licence commerciale",
  commercial_etendu: "Commerciale étendue",
  abonnement:        "Abonnement",
};

const STATUT_OPTIONS = [
  { value: "tous", label: "Tous les statuts" },
  { value: "actif", label: "Actifs" },
  { value: "archive", label: "Archivés" },
];

const TYPE_OPTIONS = [
  { value: "tous", label: "Tous les types" },
  ...Object.entries(TYPE_LABELS).map(([v, t]) => ({ value: v, label: t.label })),
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const t = TYPE_LABELS[type] ?? TYPE_LABELS.autre;
  const Icon = t.icon;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ color: t.color, background: t.bg }}
    >
      <Icon size={9} />
      {t.label}
    </span>
  );
}

function LicenceBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F4F4F4] text-[#666666] border border-[#E8E8E8]">
      <Shield size={8} />
      {LICENCE_LABELS[type] ?? type}
    </span>
  );
}

// Mini SVG bar chart for 30-day download graph
function MiniBarChart({ data }: { data: GraphData }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const w = 280;
  const h = 56;
  const barW = w / data.length - 1;

  return (
    <svg width={w} height={h} className="overflow-visible">
      {data.map((d, i) => {
        const barH = (d.count / max) * (h - 8);
        const x = i * (barW + 1);
        const y = h - barH;
        return (
          <g key={d.date}>
            <title>{d.date}: {d.count} téléchargement{d.count > 1 ? "s" : ""}</title>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={2}
              fill={d.count > 0 ? "#1B2A4A" : "#E8E8E8"}
              opacity={d.count > 0 ? 0.85 : 1}
            />
          </g>
        );
      })}
    </svg>
  );
}

// ─── Modals ──────────────────────────────────────────────────────────────────

function CustomersModal({
  produit,
  onClose,
}: {
  produit: Produit;
  onClose: () => void;
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData>([]);
  const [activeTab, setActiveTab] = useState<"clients" | "analytics">("clients");

  useEffect(() => {
    Promise.all([
      fetch(`/api/produits-digitaux?productId=${produit.id}&action=customers`).then((r) => r.json()),
      fetch(`/api/produits-digitaux?productId=${produit.id}&action=analytics`).then((r) => r.json()),
    ]).then(([c, a]) => {
      setClients(c.clients ?? []);
      setGraphData(a.graphData ?? []);
      setLoading(false);
    });
  }, [produit.id]);

  async function revokeAccess(token: string) {
    setActionLoading(token);
    try {
      const res = await fetch("/api/livraison-digitale", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke", token }),
      });
      if (res.ok) {
        setClients((prev) =>
          prev.map((c) => ({
            ...c,
            telechargements: c.telechargements.map((t) =>
              t.token === token ? { ...t, expireAt: new Date(0).toISOString() } : t
            ),
          }))
        );
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function resendLink(orderId: string) {
    setActionLoading(`resend-${orderId}`);
    try {
      const res = await fetch("/api/livraison-digitale", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resend", orderId, productId: produit.id }),
      });
      const data = await res.json();
      if (data.url) {
        await navigator.clipboard.writeText(data.url);
        setCopiedToken(`resend-${orderId}`);
        setTimeout(() => setCopiedToken(null), 2000);
      }
    } finally {
      setActionLoading(null);
    }
  }

  const totalDLs = graphData.reduce((s, d) => s + d.count, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-[#E8E8E8] shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-[#E8E8E8]">
          <div>
            <h2 className="text-base font-bold text-[#111111]">{produit.nom}</h2>
            <p className="text-xs text-[#AAAAAA] mt-0.5">
              {produit.ventes} vente{produit.ventes !== 1 ? "s" : ""} ·{" "}
              {produit._count.telechargements} lien{produit._count.telechargements !== 1 ? "s" : ""} généré{produit._count.telechargements !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={onClose} className="text-[#AAAAAA] hover:text-[#111111] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#E8E8E8]">
          {(["clients", "analytics"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-[#111111] text-[#111111]"
                  : "border-transparent text-[#AAAAAA] hover:text-[#666666]"
              }`}
            >
              {tab === "clients" ? <Users size={13} /> : <BarChart2 size={13} />}
              {tab === "clients" ? "Clients" : "Analytiques"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-[#AAAAAA]" />
            </div>
          ) : activeTab === "clients" ? (
            clients.length === 0 ? (
              <div className="text-center py-12">
                <Users size={32} className="text-[#AAAAAA] mx-auto mb-3" />
                <p className="text-[#666666] text-sm">Aucun client pour ce produit</p>
              </div>
            ) : (
              <div className="space-y-3">
                {clients.map((c) => {
                  const hasExpiredToken = c.telechargements.some(
                    (t) => new Date(t.expireAt) < new Date()
                  );
                  const hasTelecharge = c.telechargements.some((t) => t.telecharge);
                  return (
                    <div
                      key={c.commandeId}
                      className="bg-[#F5F5F5] rounded-xl p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#111111]">{c.clientNom}</p>
                          <p className="text-xs text-[#AAAAAA]">{c.clientEmail}</p>
                          <p className="text-[11px] text-[#AAAAAA] mt-1">
                            #{c.commandeNumero} · {formatDate(c.achatDate)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          {hasTelecharge ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#16A34A] bg-[#ECFDF5] px-2 py-0.5 rounded-full">
                              <Download size={9} /> Téléchargé
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#D97706] bg-[#FFFBEB] px-2 py-0.5 rounded-full">
                              <Clock size={9} /> Pas encore
                            </span>
                          )}
                          {hasExpiredToken && (
                            <span className="text-[10px] text-[#DC2626] bg-[#FEF2F2] px-2 py-0.5 rounded-full">
                              Lien expiré
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => resendLink(c.commandeId)}
                          disabled={!!actionLoading}
                          className="flex items-center gap-1.5 text-xs bg-white border border-[#E8E8E8] text-[#666666] px-3 py-1.5 rounded-lg hover:border-[#111111] hover:text-[#111111] transition-all disabled:opacity-50"
                        >
                          {actionLoading === `resend-${c.commandeId}` ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : copiedToken === `resend-${c.commandeId}` ? (
                            <Check size={11} className="text-[#16A34A]" />
                          ) : (
                            <Send size={11} />
                          )}
                          {copiedToken === `resend-${c.commandeId}` ? "Copié !" : "Nouveau lien"}
                        </button>

                        {c.telechargements.map((t) =>
                          new Date(t.expireAt) > new Date() ? (
                            <button
                              key={t.token}
                              onClick={() => revokeAccess(t.token)}
                              disabled={!!actionLoading}
                              className="flex items-center gap-1.5 text-xs bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] px-3 py-1.5 rounded-lg hover:bg-[#DC2626] hover:text-white transition-all disabled:opacity-50"
                            >
                              {actionLoading === t.token ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                <Ban size={11} />
                              )}
                              Révoquer
                            </button>
                          ) : null
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* Analytics tab */
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#F5F5F5] rounded-xl p-4">
                  <p className="text-xs text-[#AAAAAA]">Téléchargements (30j)</p>
                  <p className="text-2xl font-bold text-[#111111] mt-1">{totalDLs}</p>
                </div>
                <div className="bg-[#F5F5F5] rounded-xl p-4">
                  <p className="text-xs text-[#AAAAAA]">Total ventes</p>
                  <p className="text-2xl font-bold text-[#111111] mt-1">{produit.ventes}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-[#666666] mb-3">Téléchargements — 30 derniers jours</p>
                <div className="bg-[#F5F5F5] rounded-xl p-4 overflow-x-auto">
                  {graphData.length > 0 ? (
                    <MiniBarChart data={graphData} />
                  ) : (
                    <p className="text-xs text-[#AAAAAA] text-center py-4">
                      Aucune donnée analytique
                    </p>
                  )}
                </div>
                {graphData.length > 0 && (
                  <div className="flex justify-between mt-2 text-[10px] text-[#AAAAAA]">
                    <span>{graphData[0]?.date}</span>
                    <span>{graphData[graphData.length - 1]?.date}</span>
                  </div>
                )}
              </div>

              <div className="bg-[#F5F5F5] rounded-xl p-4 space-y-2">
                <p className="text-xs font-medium text-[#666666] mb-3">Paramètres de livraison</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-[#666666]">
                  <span>Limite DL</span>
                  <span className="text-[#111111] font-medium">
                    {produit.meta.limiteTelechargement ? `${produit.meta.limiteTelechargement}x` : "Illimité"}
                  </span>
                  <span>Expiration accès</span>
                  <span className="text-[#111111] font-medium">
                    {produit.meta.expirationAcces ? `${produit.meta.expirationAcces}j` : "Jamais"}
                  </span>
                  <span>Licence</span>
                  <span className="text-[#111111] font-medium">
                    {LICENCE_LABELS[produit.meta.typeLicence] ?? produit.meta.typeLicence}
                  </span>
                  <span>Filigrane</span>
                  <span className="text-[#111111] font-medium">{produit.meta.filigrane ? "Oui" : "Non"}</span>
                  <span>Liens uniques</span>
                  <span className="text-[#111111] font-medium">{produit.meta.liensUniques ? "Oui" : "Non"}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({
  produit,
  devise,
  onToggleStatus,
  onDuplicate,
  onOpenModal,
}: {
  produit: Produit;
  devise: string;
  onToggleStatus: (id: string, actif: boolean) => void;
  onDuplicate: (p: Produit) => void;
  onOpenModal: (p: Produit) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const meta = produit.meta;
  const thumbnail = produit.images[0];
  const typeInfo = TYPE_LABELS[meta.typeDigital] ?? TYPE_LABELS.autre;
  const TypeIcon = typeInfo.icon;

  async function handleToggle() {
    setToggling(true);
    setMenuOpen(false);
    await onToggleStatus(produit.id, !produit.actif);
    setToggling(false);
  }

  async function handleDuplicate() {
    setDuplicating(true);
    setMenuOpen(false);
    await onDuplicate(produit);
    setDuplicating(false);
  }

  return (
    <div className="bg-white border border-[#E8E8E8] rounded-2xl overflow-hidden flex flex-col group hover:border-[#D0D0D0] transition-colors">
      {/* Thumbnail */}
      <div className="aspect-video bg-[#F5F5F5] relative overflow-hidden flex-shrink-0">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={produit.nom}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center gap-2"
            style={{ background: typeInfo.bg }}
          >
            <TypeIcon size={32} style={{ color: typeInfo.color }} />
            <span className="text-xs font-medium" style={{ color: typeInfo.color }}>
              {typeInfo.label}
            </span>
          </div>
        )}

        {/* Statut overlay */}
        {!produit.actif && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white text-xs font-bold px-3 py-1 rounded-full bg-black/50 border border-white/20">
              Archivé
            </span>
          </div>
        )}

        {/* Type badge */}
        <div className="absolute top-2 left-2">
          <TypeBadge type={meta.typeDigital} />
        </div>

        {/* Action menu */}
        <div className="absolute top-2 right-2">
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              className="w-7 h-7 bg-white/90 rounded-lg flex items-center justify-center text-[#666666] hover:text-[#111111] opacity-0 group-hover:opacity-100 transition-all border border-[#E8E8E8]"
            >
              <MoreHorizontal size={14} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 z-40 bg-white border border-[#E8E8E8] rounded-xl shadow-lg py-1 min-w-[160px]">
                  <Link
                    href={`/dashboard/produits/${produit.id}`}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs text-[#666666] hover:text-[#111111] hover:bg-[#F5F5F5] transition-colors"
                  >
                    <Eye size={13} /> Modifier
                  </Link>
                  <button
                    onClick={handleDuplicate}
                    disabled={duplicating}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#666666] hover:text-[#111111] hover:bg-[#F5F5F5] transition-colors"
                  >
                    {duplicating ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                    Dupliquer
                  </button>
                  <button
                    onClick={handleToggle}
                    disabled={toggling}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#666666] hover:text-[#111111] hover:bg-[#F5F5F5] transition-colors"
                  >
                    {toggling ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : produit.actif ? (
                      <Archive size={13} />
                    ) : (
                      <ArchiveRestore size={13} />
                    )}
                    {produit.actif ? "Archiver" : "Réactiver"}
                  </button>
                  <div className="border-t border-[#E8E8E8] my-1" />
                  <button
                    onClick={() => { setMenuOpen(false); onOpenModal(produit); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#666666] hover:text-[#111111] hover:bg-[#F5F5F5] transition-colors"
                  >
                    <Users size={13} /> Clients & Liens
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="text-[#111111] font-semibold text-sm leading-snug line-clamp-2 mb-1">
          {produit.nom}
        </h3>
        <LicenceBadge type={meta.typeLicence} />

        <div className="flex items-center justify-between mt-3">
          <span className="text-base font-bold text-[#F5A623]">
            {formatMontant(produit.prix, devise)}
          </span>
          {produit.prixCompare && (
            <span className="text-xs text-[#AAAAAA] line-through">
              {formatMontant(produit.prixCompare, devise)}
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="mt-3 pt-3 border-t border-[#F0F0F0] grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5 text-[11px] text-[#AAAAAA]">
            <TrendingUp size={10} className="text-[#16A34A]" />
            <span className="text-[#111111] font-semibold">{produit.ventes}</span> vente{produit.ventes !== 1 ? "s" : ""}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#AAAAAA]">
            <Download size={10} className="text-[#1B2A4A]" />
            <span className="text-[#111111] font-semibold">{produit.downloadCount}</span> DL
          </div>
        </div>

        {/* Delivery info pills */}
        <div className="flex flex-wrap gap-1 mt-2">
          {meta.limiteTelechargement ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F0F0F0] text-[#666666]">
              Max {meta.limiteTelechargement} DL
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-[#F0F0F0] text-[#666666]">
              <Infinity size={8} /> DL
            </span>
          )}
          {meta.expirationAcces ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F0F0F0] text-[#666666]">
              Expire {meta.expirationAcces}j
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F0F0F0] text-[#666666]">
              Accès permanent
            </span>
          )}
          {meta.filigrane && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FFF7ED] text-[#D97706]">
              Filigrane
            </span>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={() => onOpenModal(produit)}
          className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-[#E8E8E8] text-[#666666] hover:text-[#111111] hover:border-[#D0D0D0] transition-all"
        >
          <Users size={12} /> Clients & Analytiques
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DigitalProduitsPage() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("tous");
  const [statutFilter, setStatutFilter] = useState("tous");
  const [search, setSearch] = useState("");
  const [selectedProduit, setSelectedProduit] = useState<Produit | null>(null);
  const [devise] = useState("XAF");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const params = new URLSearchParams({ type: typeFilter, statut: statutFilter });
      const res = await fetch(`/api/produits-digitaux?${params}`, { signal: controller.signal });
      if (!res.ok) throw new Error("Erreur de chargement");
      const data = await res.json();
      setProduits(data.produits ?? []);
      setStats(data.stats);
    } catch (e: any) {
      setError(e.name === "AbortError" ? "Délai dépassé — réessayez" : e.message);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [typeFilter, statutFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleToggleStatus(id: string, actif: boolean) {
    await fetch("/api/produits-digitaux", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, actif }),
    });
    setProduits((prev) => prev.map((p) => (p.id === id ? { ...p, actif } : p)));
    if (stats) {
      setStats({
        ...stats,
        licencesActives: actif
          ? stats.licencesActives + 1
          : Math.max(0, stats.licencesActives - 1),
      });
    }
  }

  async function handleDuplicate(p: Produit) {
    const payload = {
      nom: `${p.nom} (copie)`,
      description: "",
      prix: p.prix,
      prixCompare: p.prixCompare ?? undefined,
      images: p.images,
      actif: false,
      fichierUrl: p.fichierUrl ?? undefined,
      fichierNom: p.fichierNom ?? undefined,
      fichierTaille: p.fichierTaille ?? undefined,
      ...p.meta,
    };
    const res = await fetch("/api/produits-digitaux", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) fetchData();
  }

  const filtered = produits.filter((p) =>
    p.nom.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <ModuleTutorial moduleKey="produits-digital" titre="Produits digitaux" sousTitre="Fichiers, formations, licences" steps={DIGITAL_TUTORIAL_STEPS} />
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-[#111111] font-poppins">Produits Digitaux</h1>
            <BoutonRevoirTutoriel moduleKey="produits-digital" />
            {stats && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F4F4F4] text-[#717171] border border-[#E8E8E8]">
                {stats.totalProduits} au total
              </span>
            )}
          </div>
          <p className="text-[#717171] text-sm">
            Ebooks, cours, logiciels, templates, audio, vidéo — livrés instantanément
          </p>
        </div>
        <Link
          href="/dashboard/produits/digital/nouveau"
          className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl bg-[#111111] text-white whitespace-nowrap hover:bg-[#333333] transition-colors"
        >
          <Plus size={15} />
          Nouveau produit digital
        </Link>
      </div>

      {/* ── Produits nouveau système ── */}
      <NouveauxProduitsSection devise={devise} />

      {/* ── Stats cards ── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Téléchargements",
              value: stats.totalTelechargements,
              icon: Download,
              iconColor: "#1B2A4A",
              bgColor: "#eef1f6",
            },
            {
              label: "Revenu total",
              value: formatMontant(stats.revenuTotal, devise),
              icon: TrendingUp,
              iconColor: "#16A34A",
              bgColor: "#f0fdf4",
            },
            {
              label: "Licences actives",
              value: stats.licencesActives,
              icon: Shield,
              iconColor: "#F5A623",
              bgColor: "#fffbeb",
            },
            {
              label: "Produits",
              value: stats.totalProduits,
              icon: Package,
              iconColor: "#0ea5e9",
              bgColor: "#f0f9ff",
            },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-white border border-[#E8E8E8] rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: s.bgColor }}
                  >
                    <Icon size={15} style={{ color: s.iconColor }} />
                  </div>
                  <p className="text-xs text-[#AAAAAA]">{s.label}</p>
                </div>
                <p className="text-xl font-bold text-[#111111]">{s.value}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 bg-white border border-[#E8E8E8] rounded-xl px-3 py-2.5 min-w-[220px] flex-1">
          <Search size={14} className="text-[#AAAAAA] flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un produit..."
            className="bg-transparent text-sm text-[#111111] placeholder:text-[#AAAAAA] outline-none flex-1 min-w-0"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-[#AAAAAA] hover:text-[#666666]">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Type filter */}
        <div className="relative">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="appearance-none bg-white border border-[#E8E8E8] rounded-xl px-4 py-2.5 pr-8 text-sm text-[#666666] focus:outline-none focus:border-[#D0D0D0] cursor-pointer"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#AAAAAA] pointer-events-none" />
        </div>

        {/* Status filter */}
        <div className="relative">
          <select
            value={statutFilter}
            onChange={(e) => setStatutFilter(e.target.value)}
            className="appearance-none bg-white border border-[#E8E8E8] rounded-xl px-4 py-2.5 pr-8 text-sm text-[#666666] focus:outline-none focus:border-[#D0D0D0] cursor-pointer"
          >
            {STATUT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#AAAAAA] pointer-events-none" />
        </div>

        {/* Refresh */}
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 bg-white border border-[#E8E8E8] rounded-xl px-3 py-2.5 text-[#AAAAAA] hover:text-[#666666] transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* ── Type pills ── */}
      <div className="flex gap-2 flex-wrap">
        {TYPE_OPTIONS.slice(1).map((t) => {
          const info = TYPE_LABELS[t.value];
          const Icon = info.icon;
          const count = produits.filter((p) => p.meta.typeDigital === t.value).length;
          if (count === 0) return null;
          return (
            <button
              key={t.value}
              onClick={() => setTypeFilter(typeFilter === t.value ? "tous" : t.value)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all"
              style={
                typeFilter === t.value
                  ? { borderColor: info.color + "50", background: info.bg, color: info.color }
                  : { borderColor: "#E8E8E8", background: "white", color: "#666666" }
              }
            >
              <Icon size={11} />
              {t.label}
              <span
                className="px-1 py-0.5 rounded-full text-[10px] font-bold"
                style={
                  typeFilter === t.value
                    ? { background: info.color + "20" }
                    : { background: "#F0F0F0" }
                }
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="text-center space-y-3">
            <Loader2 size={28} className="animate-spin text-[#AAAAAA] mx-auto" />
            <p className="text-sm text-[#AAAAAA]">Chargement des produits…</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-2xl p-8 text-center">
          <AlertCircle size={28} className="text-[#DC2626] mx-auto mb-3" />
          <p className="text-[#DC2626] text-sm font-medium">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 text-xs text-[#DC2626] underline"
          >
            Réessayer
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#EEF1F6] border border-[#EDE9FE] flex items-center justify-center mx-auto mb-5">
            <Download size={32} className="text-[#1B2A4A]" />
          </div>
          <h3 className="text-[#111111] font-semibold text-base mb-2">
            {search || typeFilter !== "tous" || statutFilter !== "tous"
              ? "Aucun produit ne correspond à vos filtres"
              : "Votre catalogue digital est vide"}
          </h3>
          <p className="text-[#717171] text-sm mb-8 max-w-sm mx-auto">
            {search || typeFilter !== "tous" || statutFilter !== "tous"
              ? "Essayez d'élargir vos critères de recherche."
              : "Ajoutez des ebooks, cours, logiciels ou templates et commencez à vendre des produits digitaux."}
          </p>
          {!search && typeFilter === "tous" && statutFilter === "tous" && (
            <Link
              href="/dashboard/produits/digital/nouveau"
              className="inline-flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-xl bg-[#111111] text-white hover:bg-[#333333] transition-colors"
            >
              <Plus size={15} />
              Créer mon premier produit digital
            </Link>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-[#AAAAAA]">
            {filtered.length} produit{filtered.length !== 1 ? "s" : ""}
            {search && ` pour « ${search} »`}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((p) => (
              <ProductCard
                key={p.id}
                produit={p}
                devise={devise}
                onToggleStatus={handleToggleStatus}
                onDuplicate={handleDuplicate}
                onOpenModal={setSelectedProduit}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Customers modal ── */}
      {selectedProduit && (
        <CustomersModal
          produit={selectedProduit}
          onClose={() => setSelectedProduit(null)}
        />
      )}
    </div>
  );
}
