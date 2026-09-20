import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatMontant } from "@/lib/utils";
import {
  FileBarChart, TrendingUp, TrendingDown, Minus, ShoppingCart, Wallet,
  Users, XCircle,
} from "lucide-react";
import { PrintButton } from "@/components/dashboard/PrintButton";
import { BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";
import { RapportsTutorial } from "@/components/dashboard/tutorials/RapportsTutorial";

const PERIODES = [
  { v: "7", l: "7 jours" },
  { v: "30", l: "30 jours" },
  { v: "90", l: "90 jours" },
];

const STATUT_LABELS: Record<string, string> = {
  en_attente: "En attente", confirmee: "Confirmée", en_preparation: "En préparation",
  expediee: "Expédiée", livree: "Livrée", tentative_echouee: "Tentative échouée", annulee: "Annulée",
};

function variation(actuel: number, precedent: number): { pct: number; sens: "hausse" | "baisse" | "stable" } {
  if (precedent === 0) return actuel > 0 ? { pct: 100, sens: "hausse" } : { pct: 0, sens: "stable" };
  const pct = Math.round(((actuel - precedent) / precedent) * 1000) / 10;
  return { pct: Math.abs(pct), sens: pct > 0.5 ? "hausse" : pct < -0.5 ? "baisse" : "stable" };
}

function VariationBadge({ v }: { v: { pct: number; sens: "hausse" | "baisse" | "stable" } }) {
  const Icon = v.sens === "hausse" ? TrendingUp : v.sens === "baisse" ? TrendingDown : Minus;
  const couleur = v.sens === "hausse" ? "#10b981" : v.sens === "baisse" ? "#ef4444" : "#9ca3af";
  return (
    <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: couleur }}>
      <Icon size={11} /> {v.sens !== "stable" ? `${v.pct}%` : "stable"}
    </span>
  );
}

export default async function RapportsPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const session = await auth();
  if (!session) redirect("/connexion");
  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) redirect("/dashboard");

  const { periode: periodeParam } = await searchParams;
  const jours = ["7", "30", "90"].includes(periodeParam ?? "") ? Number(periodeParam) : 30;

  const now = new Date();
  const debutPeriode = new Date(now.getTime() - jours * 24 * 60 * 60 * 1000);
  const debutPrecedente = new Date(now.getTime() - jours * 2 * 24 * 60 * 60 * 1000);

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { nomBoutique: true, devise: true } });
  const devise = tenant?.devise ?? "XAF";

  const [
    aggPeriode, aggPrecedente,
    nouveauxClients, nouveauxClientsPrecedents,
    statutDistribution,
    lignesPeriode,
  ] = await Promise.all([
    prisma.commande.aggregate({
      where: { tenantId, createdAt: { gte: debutPeriode }, statut: { not: "annulee" } },
      _sum: { montantTotal: true }, _count: true,
    }),
    prisma.commande.aggregate({
      where: { tenantId, createdAt: { gte: debutPrecedente, lt: debutPeriode }, statut: { not: "annulee" } },
      _sum: { montantTotal: true }, _count: true,
    }),
    prisma.client.count({ where: { tenantId, createdAt: { gte: debutPeriode } } }),
    prisma.client.count({ where: { tenantId, createdAt: { gte: debutPrecedente, lt: debutPeriode } } }),
    prisma.commande.groupBy({
      by: ["statut"],
      where: { tenantId, createdAt: { gte: debutPeriode } },
      _count: true,
    }),
    prisma.ligneCommande.findMany({
      where: { commande: { tenantId, createdAt: { gte: debutPeriode }, statut: { not: "annulee" } } },
      select: { produitId: true, nom: true, prix: true, quantite: true },
    }),
  ]);

  const revenus = aggPeriode._sum.montantTotal ?? 0;
  const revenusPrecedents = aggPrecedente._sum.montantTotal ?? 0;
  const commandes = aggPeriode._count;
  const commandesPrecedentes = aggPrecedente._count;
  const panierMoyen = commandes > 0 ? revenus / commandes : 0;
  const panierMoyenPrecedent = commandesPrecedentes > 0 ? revenusPrecedents / commandesPrecedentes : 0;

  const totalStatuts = statutDistribution.reduce((s, d) => s + d._count, 0);
  const annulees = statutDistribution.find(d => d.statut === "annulee")?._count ?? 0;
  const tauxAnnulation = totalStatuts > 0 ? Math.round((annulees / totalStatuts) * 1000) / 10 : 0;

  const parProduit = new Map<string, { nom: string; quantite: number; revenu: number }>();
  for (const l of lignesPeriode) {
    const cur = parProduit.get(l.produitId) ?? { nom: l.nom, quantite: 0, revenu: 0 };
    cur.quantite += l.quantite;
    cur.revenu += l.prix * l.quantite;
    parProduit.set(l.produitId, cur);
  }
  const topProduits = [...parProduit.values()].sort((a, b) => b.revenu - a.revenu).slice(0, 5);

  const KPIS = [
    { label: "Revenus générés", valeur: formatMontant(revenus, devise), v: variation(revenus, revenusPrecedents), Icon: Wallet, couleur: "#F5A623" },
    { label: "Commandes traitées", valeur: commandes.toLocaleString("fr-FR"), v: variation(commandes, commandesPrecedentes), Icon: ShoppingCart, couleur: "#3b82f6" },
    { label: "Panier moyen", valeur: formatMontant(panierMoyen, devise), v: variation(panierMoyen, panierMoyenPrecedent), Icon: TrendingUp, couleur: "#10b981" },
    { label: "Nouveaux clients", valeur: nouveauxClients.toLocaleString("fr-FR"), v: variation(nouveauxClients, nouveauxClientsPrecedents), Icon: Users, couleur: "#8b5cf6" },
  ];

  return (
    <div className="space-y-6" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <RapportsTutorial />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:block">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileBarChart size={18} className="text-[#F5A623]" />
            <h1 className="text-2xl font-bold text-gray-900">Rapport de productivité</h1>
            <span className="print:hidden"><BoutonRevoirTutoriel moduleKey="rapports" /></span>
          </div>
          <p className="text-gray-400 text-sm">{tenant?.nomBoutique} · {jours} derniers jours · comparé aux {jours} jours précédents</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <div className="flex items-center bg-gray-100 rounded-xl p-1">
            {PERIODES.map(p => (
              <a key={p.v} href={`/dashboard/rapports?periode=${p.v}`}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={jours === Number(p.v) ? { background: "white", color: "#111", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" } : { color: "#9ca3af" }}>
                {p.l}
              </a>
            ))}
          </div>
          <PrintButton />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPIS.map(k => (
          <div key={k.label} className="ax-card p-4">
            <div className="flex items-center justify-between mb-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${k.couleur}15` }}>
                <k.Icon size={14} style={{ color: k.couleur }} />
              </div>
              <VariationBadge v={k.v} />
            </div>
            <p className="text-xl font-black text-gray-900">{k.valeur}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Répartition par statut */}
        <div className="ax-card p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Commandes par statut</h2>
          {statutDistribution.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucune commande sur cette période.</p>
          ) : (
            <div className="space-y-2.5">
              {statutDistribution.sort((a, b) => b._count - a._count).map(s => {
                const pct = totalStatuts > 0 ? Math.round((s._count / totalStatuts) * 100) : 0;
                return (
                  <div key={s.statut}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-600">{STATUT_LABELS[s.statut] ?? s.statut}</span>
                      <span className="text-xs font-bold text-gray-800">{s._count} · {pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: s.statut === "annulee" ? "#ef4444" : "#F5A623" }} />
                    </div>
                  </div>
                );
              })}
              {annulees > 0 && (
                <p className="flex items-center gap-1.5 text-[11px] text-red-500 pt-2">
                  <XCircle size={11} /> Taux d'annulation : {tauxAnnulation}%
                </p>
              )}
            </div>
          )}
        </div>

        {/* Top produits */}
        <div className="ax-card p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Top produits vendus</h2>
          {topProduits.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucune vente sur cette période.</p>
          ) : (
            <div className="space-y-3">
              {topProduits.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-gray-500">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{p.nom}</p>
                    <p className="text-[10.5px] text-gray-400">{p.quantite} vendu{p.quantite > 1 ? "s" : ""}</p>
                  </div>
                  <p className="text-xs font-bold text-gray-900 flex-shrink-0">{formatMontant(p.revenu, devise)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-[10.5px] text-gray-300 text-center print:block hidden">
        Généré le {new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })} · Axso
      </p>
    </div>
  );
}
