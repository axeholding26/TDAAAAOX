import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { formatMontant, formatDate } from "@/lib/utils";
import { ExternalLink, ArrowLeft, BadgeCheck, Package, ShoppingCart, Users, Wallet } from "lucide-react";
import { getAdminSession, estAdminComplet } from "@/lib/admin-auth";
import { getWalletResume } from "@/lib/wallet";
import { BoutiqueActionsPanel } from "@/components/admin/BoutiqueActionsPanel";

export default async function AdminBoutiqueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) redirect("/dashboard");
  const { id } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      _count: { select: { produits: true, commandes: true, clients: true } },
      commissions: { where: { statut: "captured" }, select: { montantCommission: true } },
    },
  });
  if (!tenant) notFound();

  const [wallet, badges] = await Promise.all([
    getWalletResume(id),
    prisma.badgeMarchand.findMany({ where: { tenantId: id }, orderBy: { obtenueAt: "desc" }, take: 10 }),
  ]);
  const revenuGenere = tenant.commissions.reduce((s, c) => s + c.montantCommission, 0);

  const statutBadge = { active: { l: "Active", c: "#16A34A" }, suspendu: { l: "Suspendue", c: "#F5A623" }, supprime: { l: "Supprimée", c: "#DC2626" } }[tenant.statut] ?? { l: tenant.statut, c: "#AAAAAA" };

  return (
    <div className="space-y-8">
      <Link href="/admin/boutiques" className="flex items-center gap-1.5 text-xs hover:underline w-fit" style={{ color: "#AAAAAA" }}>
        <ArrowLeft size={12} /> Retour aux boutiques
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold flex-shrink-0"
            style={{ background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.2)", color: "#F5A623" }}>
            {tenant.nomBoutique.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#ffffff" }}>{tenant.nomBoutique}</h1>
              {tenant.certifie && <BadgeCheck size={18} style={{ color: "#F5A623" }} />}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <a href={`/${tenant.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs flex items-center gap-1 hover:underline" style={{ color: "#F5A623" }}>
                {tenant.slug} <ExternalLink size={9} />
              </a>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${statutBadge.c}18`, color: statutBadge.c }}>{statutBadge.l}</span>
              <span className="text-xs" style={{ color: "#666666" }}>Inscrite le {formatDate(tenant.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Produits", value: tenant._count.produits, icon: Package, color: "#F5A623" },
          { label: "Commandes", value: tenant._count.commandes, icon: ShoppingCart, color: "#AAAAAA" },
          { label: "Clients", value: tenant._count.clients, icon: Users, color: "#AAAAAA" },
          { label: "Revenu généré", value: formatMontant(revenuGenere, tenant.devise), icon: Wallet, color: "#16A34A" },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="rounded-2xl p-5 border" style={{ background: "#1A1A1A", borderColor: "rgba(255,255,255,0.08)" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${s.color}15`, border: `1px solid ${s.color}25` }}>
                <Icon size={16} style={{ color: s.color }} />
              </div>
              <p className="text-xl font-bold" style={{ color: "#ffffff" }}>{s.value}</p>
              <p className="text-xs mt-1" style={{ color: "#AAAAAA" }}>{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Wallet marchand */}
      {wallet && (
        <div className="rounded-2xl p-5 border flex items-center gap-6 flex-wrap" style={{ background: "#1A1A1A", borderColor: "rgba(255,255,255,0.08)" }}>
          <div>
            <p className="text-lg font-bold" style={{ color: "#F5A623" }}>{formatMontant(wallet.solde, wallet.devise)}</p>
            <p className="text-xs mt-0.5" style={{ color: "#AAAAAA" }}>Solde wallet marchand</p>
          </div>
          <div>
            <p className="text-lg font-bold" style={{ color: "#ffffff" }}>{formatMontant(wallet.totalRecu, wallet.devise)}</p>
            <p className="text-xs mt-0.5" style={{ color: "#AAAAAA" }}>Total encaissé</p>
          </div>
          <div>
            <p className="text-lg font-bold" style={{ color: "#ffffff" }}>{formatMontant(wallet.totalRetire, wallet.devise)}</p>
            <p className="text-xs mt-0.5" style={{ color: "#AAAAAA" }}>Total retiré</p>
          </div>
        </div>
      )}

      {/* Badges */}
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {badges.map(b => (
            <span key={b.id} className="text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5" style={{ background: "rgba(245,166,35,0.1)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.2)" }}>
              {b.emoji} {b.titre}
            </span>
          ))}
        </div>
      )}

      {estAdminComplet(session) ? (
        <BoutiqueActionsPanel tenantId={tenant.id} statut={tenant.statut} planType={tenant.planType} certifie={tenant.certifie} devise={tenant.devise} />
      ) : (
        <p className="text-xs" style={{ color: "#666666" }}>Accès lecture seule — les actions de gestion sont réservées au super-admin.</p>
      )}
    </div>
  );
}
