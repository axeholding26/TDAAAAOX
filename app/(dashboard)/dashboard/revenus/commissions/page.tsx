import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatMontant, formatDate } from "@/lib/utils";
import { Lock, Unlock, CheckCircle, Clock } from "lucide-react";

const STATUT_COMMISSION: Record<string, { label: string; color: string }> = {
  pending:  { label: "En attente",   color: "#f59e0b" },
  captured: { label: "Capturée",     color: "#10b981" },
  paid:     { label: "Payée",        color: "#F5A623" },
  disputed: { label: "En litige",    color: "#ef4444" },
};

const STATUT_ESCROW: Record<string, { label: string; color: string; icon: any }> = {
  held:     { label: "Fonds retenus",  color: "#f59e0b", icon: Lock },
  released: { label: "Fonds libérés",  color: "#10b981", icon: Unlock },
  disputed: { label: "En litige",      color: "#ef4444", icon: Lock },
};

export default async function CommissionsPage() {
  const session = await auth();
  if (!session) redirect("/connexion");

  const tenantId = (session.user as any)?.tenantId;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) redirect("/inscription");

  const [commissions, escrows] = await Promise.all([
    prisma.commission.findMany({
      where: { tenantId },
      include: { commande: { select: { numero: true, statut: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.escrow.findMany({
      where: { commande: { tenantId } },
      include: { commande: { select: { numero: true, statut: true, clientNom: true } } },
      orderBy: { heldAt: "desc" },
      take: 20,
    }),
  ]);

  const totalCommissions  = commissions.reduce((s, c) => s + c.montantCommission, 0);
  const capturees         = commissions.filter((c) => c.statut === "captured" || c.statut === "paid").reduce((s, c) => s + c.montantCommission, 0);
  const montantMarchand   = commissions.filter((c) => c.statut === "captured" || c.statut === "paid").reduce((s, c) => s + c.montantMarchand, 0);

  const escrowEnCours    = escrows.filter((e) => e.statut === "held").reduce((s, e) => s + e.montant, 0);
  const escrowLiberes    = escrows.filter((e) => e.statut === "released").reduce((s, e) => s + e.montant, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-poppins">Commissions & Escrow</h1>
        <p className="text-gray-400 text-sm mt-1">
          Taux Axso : {(tenant.commissionRate * 100).toFixed(0)}% · Fonds sécurisés 48h après paiement
        </p>
      </div>

      {/* KPIs commissions */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-gray-400 text-xs mb-2">Total commissions Axso</p>
          <p className="text-xl font-bold text-red-400">{formatMontant(totalCommissions, tenant.devise)}</p>
          <p className="text-gray-600 text-xs mt-1">{commissions.length} transactions</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-gray-400 text-xs mb-2">Vos revenus nets</p>
          <p className="text-xl font-bold text-green-400">{formatMontant(montantMarchand, tenant.devise)}</p>
          <p className="text-gray-600 text-xs mt-1">Après déduction commission</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-5 col-span-2 lg:col-span-1">
          <p className="text-gray-400 text-xs mb-2">Commissions capturées</p>
          <p className="text-xl font-bold text-[#F5A623]">{formatMontant(capturees, tenant.devise)}</p>
          <p className="text-gray-600 text-xs mt-1">Livraisons confirmées</p>
        </div>
      </div>

      {/* Escrow en cours */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#1a1000] border border-[#f59e0b]/30 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Lock size={14} className="text-[#f59e0b]" />
            <p className="text-[#f59e0b] text-xs font-medium">Fonds en escrow</p>
          </div>
          <p className="text-xl font-bold text-[#f59e0b]">{formatMontant(escrowEnCours, tenant.devise)}</p>
          <p className="text-gray-500 text-xs mt-1">Bloqués en attente de livraison</p>
        </div>
        <div className="bg-[#001a0a] border border-[#10b981]/30 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Unlock size={14} className="text-[#10b981]" />
            <p className="text-[#10b981] text-xs font-medium">Fonds libérés</p>
          </div>
          <p className="text-xl font-bold text-[#10b981]">{formatMontant(escrowLiberes, tenant.devise)}</p>
          <p className="text-gray-500 text-xs mt-1">Livraisons confirmées</p>
        </div>
      </div>

      {/* Explication escrow */}
      <div className="bg-[#F5A623]/10 border border-[#F5A623]/30 rounded-2xl p-5 space-y-3">
        <p className="text-[#F5A623] text-sm font-semibold">Comment fonctionne l'escrow ?</p>
        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          {[
            { icon: "??", step: "1. Paiement", desc: "Le client paie. Les fonds sont retenus en escrow." },
            { icon: "??", step: "2. Livraison", desc: "Le livreur confirme la livraison. Escrow libéré." },
            { icon: "??", step: "3. Virement", desc: `${(tenant.commissionRate * 100).toFixed(0)}% Axso déduit. Le reste vous est versé.` },
          ].map((s) => (
            <div key={s.step} className="bg-black/20 rounded-xl p-3">
              <p className="text-lg mb-1">{s.icon}</p>
              <p className="text-[#F5A623] font-medium mb-1">{s.step}</p>
              <p className="text-gray-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tableau escrow récents */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-gray-800 font-semibold">Historique escrow</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {["Commande", "Client", "Montant", "Escrow", "Libéré le"].map((h) => (
                  <th key={h} className="text-left text-gray-400 font-medium px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {escrows.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-gray-500 py-12">Aucune transaction escrow</td></tr>
              ) : escrows.map((e) => {
                const st = STATUT_ESCROW[e.statut] || STATUT_ESCROW.held;
                const Icone = st.icon;
                return (
                  <tr key={e.id} className="border-b border-[#111] hover:bg-[#151515]">
                    <td className="px-5 py-4 text-[#F5A623] font-mono text-xs">{e.commande.numero}</td>
                    <td className="px-5 py-4 text-gray-700 text-sm">{e.commande.clientNom}</td>
                    <td className="px-5 py-4 text-gray-800 font-semibold">{formatMontant(e.montant, tenant.devise)}</td>
                    <td className="px-5 py-4">
                      <span className="flex items-center gap-1.5 text-xs" style={{ color: st.color }}>
                        <Icone size={12} />
                        {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-400 text-xs">
                      {e.releasedAt ? formatDate(e.releasedAt) : (
                        <span className="text-gray-600">
                          {new Date() > e.releaseAt ? "Eligible" : `Après ${formatDate(e.releaseAt)}`}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tableau commissions */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-gray-800 font-semibold">Détail des commissions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {["Commande", "Vente brute", `Commission (${(tenant.commissionRate * 100).toFixed(0)}%)`, "Votre part", "Statut", "Date"].map((h) => (
                  <th key={h} className="text-left text-gray-400 font-medium px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {commissions.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-gray-500 py-12">Aucune commission</td></tr>
              ) : commissions.map((c) => {
                const st = STATUT_COMMISSION[c.statut] || STATUT_COMMISSION.pending;
                return (
                  <tr key={c.id} className="border-b border-[#111] hover:bg-[#151515]">
                    <td className="px-5 py-4 text-[#F5A623] font-mono text-xs">{c.commande.numero}</td>
                    <td className="px-5 py-4 text-gray-700">{formatMontant(c.montantCommande, tenant.devise)}</td>
                    <td className="px-5 py-4 text-red-400 font-semibold">{formatMontant(c.montantCommission, tenant.devise)}</td>
                    <td className="px-5 py-4 text-green-400 font-semibold">{formatMontant(c.montantMarchand, tenant.devise)}</td>
                    <td className="px-5 py-4">
                      <span className="text-xs px-2 py-1 rounded-lg" style={{ color: st.color, backgroundColor: `${st.color}15`, border: `1px solid ${st.color}30` }}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-400">{formatDate(c.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

