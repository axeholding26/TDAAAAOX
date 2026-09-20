import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Plus, Package, Search, TrendingUp, Tag, AlertTriangle,
  Star, ChevronRight, Eye, EyeOff,
} from "lucide-react";
import { formatMontant } from "@/lib/utils";
import { AgentActiveIndicator } from "@/components/dashboard/AgentActiveIndicator";
import { BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";
import { ProduitsTutorial } from "@/components/dashboard/tutorials/ProduitsTutorial";

const FILTER_TABS = [
  { key: "all",      label: "Tous"         },
  { key: "actif",    label: "Actifs"       },
  { key: "inactif",  label: "Inactifs"     },
  { key: "faible",   label: "Stock faible" },
  { key: "epuise",   label: "Épuisés"      },
];

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0)
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">Épuisé</span>;
  if (stock <= 5)
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]">{stock} restants</span>;
  if (stock <= 20)
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]">{stock} en stock</span>;
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]">{stock} en stock</span>;
}

export default async function ProduitsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtre?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/connexion");
  const { q, filtre } = await searchParams;

  const tenantId = (session.user as any)?.tenantId;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const devise = tenant?.devise || "XOF";

  const tous = await prisma.produit.findMany({
    where: { tenantId },
    include: { variantes: true, _count: { select: { avis: true } } },
    orderBy: { createdAt: "desc" },
  });

  const totalActifs  = tous.filter(p => p.actif).length;
  const totalVentes  = tous.reduce((s, p) => s + p.ventes, 0);
  const stockFaible  = tous.filter(p => p.stock <= 5 && p.stock > 0 && p.actif).length;
  const stockEpuise  = tous.filter(p => p.stock === 0 && p.actif).length;

  let produits = tous;
  if (filtre === "actif")   produits = tous.filter(p => p.actif);
  if (filtre === "inactif") produits = tous.filter(p => !p.actif);
  if (filtre === "faible")  produits = tous.filter(p => p.stock <= 5 && p.stock > 0 && p.actif);
  if (filtre === "epuise")  produits = tous.filter(p => p.stock === 0);
  if (q) produits = produits.filter(p => p.nom.toLowerCase().includes(q.toLowerCase()));

  const statCards = [
    { label: "Produits actifs",  value: totalActifs,    iconBg: "#F0FDF4", iconColor: "#16A34A", Icon: Package     },
    { label: "Ventes totales",   value: totalVentes,    iconBg: "#FFF8EC", iconColor: "#F5A623", Icon: TrendingUp, accent: true },
    { label: "Stock faible",     value: stockFaible,    iconBg: "#FFFBEB", iconColor: "#D97706", Icon: AlertTriangle },
    { label: "Épuisés",          value: stockEpuise,    iconBg: "#FEF2F2", iconColor: "#DC2626", Icon: AlertTriangle },
  ];

  return (
    <div className="space-y-5"
      style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <ProduitsTutorial />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 pt-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2 sm:gap-2.5 mb-1 flex-wrap">
            <h1 className="text-[18px] sm:text-[20px] font-bold text-[#111111] tracking-tight inline-flex items-center gap-2">Produits <AgentActiveIndicator label="Agent Produits actif" /></h1>
            <BoutonRevoirTutoriel moduleKey="produits" />
            <span className="text-[11px] font-bold bg-[#F5F5F7] text-[#888888] border border-[#E8E8E8] px-2.5 py-0.5 rounded-full">
              {tous.length}
            </span>
            {stockFaible > 0 && (
              <span className="text-[11px] font-bold bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle size={9} /> {stockFaible} stock faible
              </span>
            )}
          </div>
          <p className="text-[12px] sm:text-[12.5px] text-[#AAAAAA]">Gérez votre catalogue et suivez vos ventes</p>
        </div>
        <Link href="/dashboard/produits/nouveau"
          className="flex items-center justify-center gap-1.5 text-[12.5px] sm:text-[12px] font-semibold bg-[#111111] text-white rounded-2xl px-4 py-3 sm:py-2 hover:bg-[#2a2a2a] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm whitespace-nowrap w-full sm:w-auto flex-shrink-0">
          <Plus size={14} /> Nouveau produit
        </Link>
      </div>

      {/* ── Stat cards — défilement horizontal sur mobile, grille au-delà ── */}
      {tous.length > 0 && (
        <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory sm:overflow-visible"
          style={{ scrollbarWidth: "none" }}>
          {statCards.map((s, i) => {
            const Icon = s.Icon;
            return (
              <div key={i} className={`ax-card p-4 sm:p-5 relative overflow-hidden group cursor-default flex-shrink-0 w-[42%] min-w-[130px] sm:w-auto snap-start ${s.accent ? "border-[#F5A623]/20" : ""}`}>
                {s.accent && (
                  <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[20px]"
                    style={{ background: "linear-gradient(90deg, #F5A623, #FFD280, #F5A623)" }} />
                )}
                <div className="flex items-start justify-between gap-2 mb-3 sm:mb-4">
                  <span className="ax-label leading-tight">{s.label}</span>
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
                    style={{ background: s.iconBg, border: `1px solid ${s.iconColor}20` }}>
                    <Icon size={13} style={{ color: s.iconColor }} strokeWidth={1.8} />
                  </div>
                </div>
                <p className="text-[20px] sm:text-[24px] font-bold text-[#111111] leading-none tabular-nums tracking-tight">
                  {s.value}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Search + Filter tabs ── */}
      <div className="flex flex-col gap-3">
        {/* Search bar (form submit via GET) */}
        <form action="/dashboard/produits" method="GET" className="flex gap-2">
          {filtre && filtre !== "all" && <input type="hidden" name="filtre" value={filtre} />}
          <div className="flex-1 flex items-center gap-2.5 bg-white border border-[#E8E8E8] rounded-2xl px-4 py-3 sm:py-2.5 focus-within:border-[#CCCCCC] transition-colors">
            <Search size={14} className="text-[#CCCCCC] flex-shrink-0" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Rechercher un produit..."
              className="bg-transparent text-[13.5px] sm:text-[13px] text-[#111111] placeholder:text-[#CCCCCC] outline-none flex-1 min-w-0"
            />
          </div>
          {q && (
            <Link href={filtre ? `/dashboard/produits?filtre=${filtre}` : "/dashboard/produits"}
              className="flex items-center px-3 py-3 sm:py-2.5 rounded-2xl border border-[#E8E8E8] text-[12px] text-[#888] hover:text-[#111] hover:border-[#CCC] transition-all flex-shrink-0">
              Effacer
            </Link>
          )}
        </form>

        {/* Filter tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0" style={{ scrollbarWidth: "none" }}>
          {FILTER_TABS.map(tab => {
            const isActive = (filtre ?? "all") === tab.key;
            const count = tab.key === "all" ? tous.length
              : tab.key === "actif"   ? totalActifs
              : tab.key === "inactif" ? tous.filter(p => !p.actif).length
              : tab.key === "faible"  ? stockFaible
              : stockEpuise;
            const href = tab.key === "all"
              ? (q ? `/dashboard/produits?q=${q}` : "/dashboard/produits")
              : (q ? `/dashboard/produits?filtre=${tab.key}&q=${q}` : `/dashboard/produits?filtre=${tab.key}`);
            return (
              <Link key={tab.key} href={href}
                className="flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition-all flex-shrink-0"
                style={isActive
                  ? { background: "#111111", color: "#FFFFFF", border: "1px solid #111111" }
                  : { background: "#FFFFFF", color: "#888888", border: "1px solid #E8E8E8" }}>
                {tab.label}
                {count > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={isActive
                      ? { background: "rgba(255,255,255,0.15)", color: "#FFFFFF" }
                      : { background: "#F5F5F7", color: "#AAAAAA" }}>
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Grid ── */}
      {produits.length === 0 ? (
        <div className="ax-card p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] flex items-center justify-center mx-auto mb-4">
            <Package size={24} className="text-[#CCCCCC]" />
          </div>
          <p className="text-[14px] font-semibold text-[#111111] mb-1">
            {q ? `Aucun résultat pour « ${q} »` : "Aucun produit"}
          </p>
          <p className="text-[12px] text-[#AAAAAA] mb-6">
            {q
              ? "Essayez un autre terme ou modifiez le filtre"
              : "Votre catalogue est vide. Ajoutez votre premier produit pour commencer à vendre."}
          </p>
          {!q && (
            <Link href="/dashboard/produits/nouveau"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-4 py-2 rounded-2xl bg-[#111111] text-white hover:bg-[#2a2a2a] transition-colors">
              <Plus size={13} /> Ajouter un produit
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
          {produits.map(p => (
            <Link key={p.id} href={`/dashboard/produits/${p.id}`} className="group block">
              <div className="ax-card overflow-hidden h-full flex flex-col hover:shadow-[0_4px_24px_rgba(0,0,0,0.09)] hover:-translate-y-0.5 transition-all duration-200">

                {/* Image */}
                <div className="aspect-square bg-[#F5F5F7] relative overflow-hidden flex-shrink-0">
                  {p.images?.[0] ? (
                    <img src={p.images[0]} alt={p.nom}
                      className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package size={28} className="text-[#CCCCCC]" />
                    </div>
                  )}

                  {/* Inactive overlay */}
                  {!p.actif && (
                    <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                      <span className="flex items-center gap-1 text-white text-[9px] sm:text-[10px] font-bold bg-black/50 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full backdrop-blur-sm">
                        <EyeOff size={9} /> Inactif
                      </span>
                    </div>
                  )}

                  {/* Category badge — masqué sur les cartes très étroites (mobile), la place manque */}
                  {(p as any).categorie && (
                    <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 hidden sm:block">
                      <span className="inline-flex items-center gap-1 text-[9.5px] font-semibold px-2 py-0.5 rounded-full bg-white/95 text-[#666] border border-[#E8E8E8]">
                        <Tag size={7.5} />
                        {(p as any).categorie}
                      </span>
                    </div>
                  )}

                  {/* Stock overlay badge */}
                  {p.stock === 0 && (
                    <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2">
                      <span className="text-[8.5px] sm:text-[9.5px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">Épuisé</span>
                    </div>
                  )}
                  {p.stock > 0 && p.stock <= 5 && (
                    <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2">
                      <span className="text-[8.5px] sm:text-[9.5px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]">Stock faible</span>
                    </div>
                  )}

                  {/* Quick view icon on hover — souris uniquement */}
                  <div className="absolute inset-0 hidden sm:flex items-end justify-end p-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-8 h-8 rounded-xl bg-white/95 border border-[#E8E8E8] flex items-center justify-center shadow-sm">
                      <Eye size={13} className="text-[#666]" />
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="p-2.5 sm:p-4 flex flex-col flex-1">
                  <h3 className="text-[12px] sm:text-[13px] font-semibold text-[#111111] mb-1.5 sm:mb-2.5 line-clamp-2 leading-snug">
                    {p.nom}
                  </h3>

                  <div className="flex items-center justify-between gap-1.5 mb-1.5 sm:mb-2 flex-wrap">
                    <span className="text-[13.5px] sm:text-[16px] font-bold text-[#F5A623]"
                      style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatMontant(p.prix, devise)}
                    </span>
                    <StockBadge stock={p.stock} />
                  </div>

                  <div className="flex items-center justify-between mt-auto pt-2 sm:pt-3 border-t border-[#F5F5F7]">
                    <div className="flex items-center gap-1 text-[#BBBBBB] text-[10px] sm:text-[11px]">
                      <TrendingUp size={9} className="text-[#CCCCCC] flex-shrink-0" />
                      <span className="truncate">{p.ventes} vente{p.ventes !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
                      {p._count.avis > 0 && (
                        <div className="flex items-center gap-1 text-[#BBBBBB] text-[10px] sm:text-[11px]">
                          <Star size={9} className="text-[#F5A623]" fill="#F5A623" />
                          <span>{p._count.avis}</span>
                        </div>
                      )}
                      <div className="hidden sm:flex w-6 h-6 rounded-lg border border-[#EBEBEB] items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight size={11} className="text-[#999]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
