import { auth } from "@/lib/auth";
import { exigerModule } from "@/lib/permissions-server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatMontant, formatDate } from "@/lib/utils";

const STATUT_COMMISSION: Record<string, { label: string; color: string }> = {
  pending:  { label: "En attente",   color: "#f59e0b" },
  captured: { label: "Capturée",     color: "#10b981" },
  paid:     { label: "Payée",        color: "#F5A623" },
  disputed: { label: "En litige",    color: "#ef4444" },
};

export default async function CommissionsPage() {
  const session = await auth();
  if (!session) redirect("/connexion");
  await exigerModule(session, "finance");

  const tenantId = (session.user as any)?.tenantId;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) redirect("/inscription");

  const commissions = await prisma.commission.findMany({
    where: { tenantId },
    include: { commande: { select: { numero: true, statut: true } } },
    orderBy: { createdAt: "desc" },
  });

  const totalCommissions  = commissions.reduce((s, c) => s + c.montantCommission, 0);
  const capturees         = commissions.filter((c) => c.statut === "captured" || c.statut === "paid").reduce((s, c) => s + c.montantCommission, 0);
  const montantMarchand   = commissions.filter((c) => c.statut === "captured" || c.statut === "paid").reduce((s, c) => s + c.montantMarchand, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-poppins">Commissions</h1>
        <p className="text-gray-400 text-sm mt-1">
          Taux Axso : {(tenant.commissionRate * 100).toFixed(0)}% · ajouté au prix payé par le client, jamais retiré de votre prix
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

      {/* Fonctionnement réel des commissions */}
      <div className="bg-[#F5A623]/10 border border-[#F5A623]/30 rounded-2xl p-5 space-y-3">
        <p className="text-[#B45309] text-sm font-semibold">Comment ça marche ?</p>
        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          {[
            { step: "1. Prix affiché", desc: `Le client voit votre prix + ${(tenant.commissionRate * 100).toFixed(0)}% de commission Axso.` },
            { step: "2. Paiement en ligne", desc: "Dès que le paiement est confirmé, votre wallet est crédité de votre prix, en entier." },
            { step: "3. Paiement à la livraison", desc: "Le livreur encaisse ; la commission est comptée quand la commande est marquée livrée." },
          ].map((s) => (
            <div key={s.step} className="bg-white rounded-xl p-3 border border-[#F5A623]/20">
              <p className="text-[#B45309] font-medium mb-1">{s.step}</p>
              <p className="text-gray-600">{s.desc}</p>
            </div>
          ))}
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

