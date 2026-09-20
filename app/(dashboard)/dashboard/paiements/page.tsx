// Dashboard Paiements — wallet, escrow, transactions, commissions, retraits
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatMontant, formatDate } from "@/lib/utils";
import {
  CreditCard, TrendingUp, Clock, CheckCircle2,
  Wallet, ArrowDownLeft, ArrowUpRight, Lock, AlertCircle
} from "lucide-react";
import { BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";
import { PaiementsTutorial } from "@/components/dashboard/tutorials/PaiementsTutorial";

const STATUT_PAIEMENT: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: "En attente", color: "#d97706", bg: "#fffbeb" },
  completed: { label: "Complété",   color: "#059669", bg: "#ecfdf5" },
  failed:    { label: "Échoué",     color: "#dc2626", bg: "#fef2f2" },
  refunded:  { label: "Remboursé",  color: "#6b7280", bg: "#f9fafb" },
};

const METHODE_LABEL: Record<string, string> = {
  card: "Carte",
  mobilemoney: "Mobile Money",
  banktransfer: "Virement",
  notchpay: "NotchPay",
  whatsapp_cod: "Paiement à la livraison (WhatsApp)",
  direct_cod: "Paiement à la livraison",
  en_attente: "En attente de paiement",
};

function methodeLabel(m: string | null) {
  if (!m) return "—";
  if (m.startsWith("campay:")) return `Campay · ${m.split(":")[1]?.toUpperCase() ?? ""}`;
  if (m.startsWith("cinetpay:")) return `CinetPay · ${m.split(":")[1]?.toUpperCase() ?? ""}`;
  return METHODE_LABEL[m] ?? m;
}

export default async function PaiementsPage() {
  const session = await auth();
  if (!session) redirect("/connexion");
  const tenantId = (session.user as any)?.tenantId;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) redirect("/inscription");

  const [commandes, wallet, escrows, commissions, retraits] = await Promise.all([
    prisma.commande.findMany({
      where: { tenantId },
      include: { client: { select: { nom: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.wallet.findUnique({ where: { tenantId } }),
    prisma.escrow.findMany({
      where: { tenantId, statut: "held" },
      include: { commande: { select: { numero: true, clientNom: true, montantTotal: true } } },
      orderBy: { releaseAt: "asc" },
      take: 10,
    }),
    prisma.commission.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.retrait.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const completed  = commandes.filter(c => c.paiementStatut === "completed");
  const pending    = commandes.filter(c => c.paiementStatut === "pending");
  const totalPercu = completed.reduce((s, c) => s + c.montantTotal, 0);
  const enEscrow   = escrows.reduce((s, e) => s + e.montant, 0);
  const totalComm  = commissions.reduce((s, c) => s + c.montantCommission, 0);

  const devise = tenant.devise;

  return (
    <div className="space-y-6">
      <PaiementsTutorial />
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900">Paiements & Finances</h1>
          <BoutonRevoirTutoriel moduleKey="paiements" />
        </div>
        <p className="text-gray-400 text-sm mt-0.5">Wallet, escrow, transactions et retraits</p>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Solde wallet", value: formatMontant(wallet?.solde ?? 0, devise), icon: Wallet, color: "#F5A623", bg: "#fffbeb" },
          { label: "En séquestre (48h)", value: formatMontant(enEscrow, devise), icon: Lock, color: "#6366f1", bg: "#eef2ff" },
          { label: "Total perçu", value: formatMontant(totalPercu, devise), icon: CheckCircle2, color: "#059669", bg: "#ecfdf5" },
          { label: "Commissions Axso", value: formatMontant(totalComm, devise), icon: TrendingUp, color: "#dc2626", bg: "#fef2f2" },
        ].map((m) => (
          <div key={m.label} className="bg-white border border-gray-100 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: m.bg, border: `1px solid ${m.color}20` }}>
                <m.icon size={16} style={{ color: m.color }} />
              </div>
              <span className="text-gray-400 text-xs font-medium">{m.label}</span>
            </div>
            <p className="text-gray-900 text-xl font-bold">{m.value}</p>
          </div>
        ))}
      </div>

      {/* ── Wallet + Escrow ── */}
      <div className="grid lg:grid-cols-2 gap-5">

        {/* Wallet */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Wallet size={16} className="text-[#F5A623]" />
            <h2 className="font-bold text-gray-900">Mon Wallet Axso</h2>
          </div>
          <div className="bg-gradient-to-br from-[#F5A623] to-[#e8950f] rounded-2xl p-5 text-white mb-4">
            <p className="text-sm opacity-75 mb-1">Solde disponible</p>
            <p className="text-3xl font-bold">{formatMontant(wallet?.solde ?? 0, devise)}</p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Reçu", value: formatMontant(wallet?.totalRecu ?? 0, devise), icon: ArrowDownLeft, color: "#059669" },
              { label: "Retiré", value: formatMontant(wallet?.totalRetire ?? 0, devise), icon: ArrowUpRight, color: "#6366f1" },
              { label: "Commission", value: formatMontant(wallet?.totalCommission ?? 0, devise), icon: TrendingUp, color: "#dc2626" },
            ].map((s) => (
              <div key={s.label} className="bg-gray-50 rounded-xl p-3">
                <s.icon size={14} style={{ color: s.color }} className="mx-auto mb-1" />
                <p className="text-xs text-gray-400">{s.label}</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Escrow */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lock size={16} className="text-indigo-500" />
            <h2 className="font-bold text-gray-900">Séquestre (Escrow)</h2>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
              Libération auto · 48h
            </span>
          </div>
          {escrows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <CheckCircle2 size={24} className="mb-2 text-green-400" />
              <p className="text-sm">Aucun fonds en séquestre</p>
            </div>
          ) : (
            <div className="space-y-2">
              {escrows.map((e) => {
                const releaseIn = Math.max(0, Math.ceil((new Date(e.releaseAt).getTime() - Date.now()) / 3600000));
                return (
                  <div key={e.id} className="flex items-center justify-between p-3 rounded-xl bg-indigo-50/60 border border-indigo-100">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{e.commande.clientNom}</p>
                      <p className="text-xs text-gray-400">#{e.commande.numero}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-indigo-700">{formatMontant(e.montant, devise)}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 justify-end">
                        <Clock size={10} />
                        {releaseIn > 0 ? `${releaseIn}h` : "Libération imminente"}
                      </p>
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-gray-400 text-center pt-1">
                Total bloqué : <span className="font-bold text-indigo-600">{formatMontant(enEscrow, devise)}</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Transactions récentes ── */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Transactions</h2>
          <span className="text-xs text-gray-400">{completed.length} complétées · {pending.length} en attente</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {["Référence", "Client", "Montant", "Méthode", "Statut", "Date"].map(h => (
                  <th key={h} className="text-left text-xs text-gray-500 font-medium px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {commandes.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-gray-400 py-12 text-sm">
                  <CreditCard size={24} className="mx-auto mb-2 opacity-30" />
                  Aucune transaction
                </td></tr>
              ) : commandes.map((cmd) => {
                const st = STATUT_PAIEMENT[cmd.paiementStatut] ?? { label: cmd.paiementStatut, color: "#6b7280", bg: "#f9fafb" };
                return (
                  <tr key={cmd.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs text-indigo-600">{cmd.numero}</td>
                    <td className="px-5 py-3.5 text-gray-700 font-medium">{cmd.client?.nom ?? cmd.clientNom}</td>
                    <td className="px-5 py-3.5 font-bold text-gray-900">{formatMontant(cmd.montantTotal, devise)}</td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">{methodeLabel(cmd.methodePaiement)}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ color: st.color, backgroundColor: st.bg }}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">{formatDate(cmd.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Commissions + Retraits ── */}
      <div className="grid lg:grid-cols-2 gap-5">

        {/* Commissions */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Commissions Axso (6%)</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {commissions.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">Aucune commission</p>
            ) : commissions.map((c) => (
              <div key={c.id} className="px-5 py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{formatMontant(c.montantCommande, c.devise)}</p>
                  <p className="text-xs text-gray-400">{formatDate(c.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-600">-{formatMontant(c.montantCommission, c.devise)}</p>
                  <p className="text-xs text-green-600">+{formatMontant(c.montantMarchand, c.devise)} net</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Retraits */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">Retraits</h2>
            <a href="/dashboard/revenus" className="text-xs text-[#F5A623] font-semibold hover:underline">
              Demander un retrait →
            </a>
          </div>
          <div className="divide-y divide-gray-50">
            {retraits.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">Aucun retrait effectué</p>
            ) : retraits.map((r) => (
              <div key={r.id} className="px-5 py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 capitalize">{r.methode.replace("_", " ")} · {r.operateur ?? ""}</p>
                  <p className="text-xs text-gray-400">{r.destinataire} · {formatDate(r.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-indigo-600">{formatMontant(r.montant, r.devise)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.statut === "complete" ? "bg-green-100 text-green-700" : r.statut === "echoue" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                    {r.statut === "complete" ? "Complété" : r.statut === "echoue" ? "Échoué" : "En cours"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
