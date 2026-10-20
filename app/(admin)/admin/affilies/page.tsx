import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatMontant, formatDate } from "@/lib/utils";
import { Handshake, Users, Clock, CheckCircle } from "lucide-react";
import { getAdminSessionPour, estAdminComplet } from "@/lib/admin-auth";
import { AdminRetraitsManuels } from "@/components/admin/AdminRetraitsManuels";
import { getT } from "@/lib/i18n/serveur";

// Affiliés de toutes les boutiques : versements de commissions à faire dans NotchPay (validation
// par Axso, lib/affiliation.ts), vue d'ensemble des affiliés et derniers versements.
export default async function AdminAffiliesPage() {
  const tx = await getT();
  const session = await getAdminSessionPour("affilies");
  if (!session) redirect("/admin?refus=1");

  const [nbAffilies, nbActifs, nbBoutiques, enAttente, affilies, historique] = await Promise.all([
    prisma.affilie.count(),
    prisma.affilie.count({ where: { statut: "actif" } }),
    prisma.affilie.groupBy({ by: ["tenantId"] }).then((g) => g.length),
    prisma.paiementCommission.count({ where: { statut: "en_attente", reference: null } }),
    prisma.affilie.findMany({
      orderBy: [{ commissionTotal: "desc" }, { createdAt: "desc" }], take: 100,
      select: { id: true, nom: true, email: true, telephone: true, statut: true, clics: true, conversions: true, commissionTotal: true, commissionPending: true, tenant: { select: { nomBoutique: true, devise: true } } },
    }),
    prisma.paiementCommission.findMany({ where: { statut: { in: ["traite", "echec"] } }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const lies = await Promise.all([
    prisma.tenant.findMany({ where: { id: { in: historique.map((p) => p.tenantId) } }, select: { id: true, nomBoutique: true, devise: true } }),
    prisma.affilie.findMany({ where: { id: { in: historique.map((p) => p.affilieurId) } }, select: { id: true, nom: true } }),
  ]);
  const boutique = new Map(lies[0].map((t) => [t.id, t]));
  const affilie = new Map(lies[1].map((a) => [a.id, a.nom]));

  const carte = { background: "#1A1A1A", borderColor: "rgba(255,255,255,0.08)" };
  const STATUTS: Record<string, string> = { actif: "#16A34A", en_attente: "#D97706", suspendu: "#DC2626" };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--cc-text)" }}>{tx("Affiliés")}</h1>
        <p className="text-sm mt-1" style={{ color: "#AAAAAA" }}>{tx("Versements de commissions à valider et affiliés de toutes les boutiques")}</p>
      </div>

      <AdminRetraitsManuels peutTraiter={estAdminComplet(session)} commissions />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Affiliés", value: nbAffilies, icon: Users, color: "#F5A623" },
          { label: "Actifs", value: nbActifs, icon: CheckCircle, color: "#16A34A" },
          { label: "Boutiques avec affiliés", value: nbBoutiques, icon: Handshake, color: "#3B82F6" },
          { label: "Versements à faire", value: enAttente, icon: Clock, color: enAttente ? "#DC2626" : "#AAAAAA" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl p-5 border" style={carte}>
            <div className="flex items-center gap-2 mb-2"><k.icon size={15} style={{ color: k.color }} /><span className="text-xs" style={{ color: "#AAAAAA" }}>{tx(k.label)}</span></div>
            <p className="text-xl font-bold" style={{ color: "#ffffff" }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl p-6 border overflow-x-auto" style={carte}>
        <h2 className="font-semibold mb-4" style={{ color: "#ffffff" }}>{tx("Affiliés (les 100 qui ont le plus gagné)")}</h2>
        {affilies.length === 0 ? <p className="text-sm" style={{ color: "#AAAAAA" }}>{tx("Aucun affilié pour l'instant.")}</p> : (
          <table className="w-full text-sm min-w-[720px]">
            <thead><tr className="text-left text-xs" style={{ color: "#888888" }}>
              {["Affilié", "Boutique", "Statut", "Clics", "Ventes", "Gagné", "À payer"].map((h) => <th key={h} className="pb-2 pr-3 font-medium">{tx(h)}</th>)}
            </tr></thead>
            <tbody>
              {affilies.map((a) => (
                <tr key={a.id} className="border-t" style={{ borderColor: "rgba(255,255,255,0.06)", color: "#DDDDDD" }}>
                  <td className="py-2 pr-3"><p className="font-medium" style={{ color: "#ffffff" }}>{a.nom}</p><p className="text-xs" style={{ color: "#888888" }}>{a.email}{a.telephone ? ` · ${a.telephone}` : ""}</p></td>
                  <td className="py-2 pr-3">{a.tenant.nomBoutique}</td>
                  <td className="py-2 pr-3"><span className="text-xs font-semibold" style={{ color: STATUTS[a.statut] ?? "#AAAAAA" }}>{tx(a.statut === "en_attente" ? "En attente" : a.statut === "actif" ? "Actif" : "Suspendu")}</span></td>
                  <td className="py-2 pr-3">{a.clics}</td>
                  <td className="py-2 pr-3">{a.conversions}</td>
                  <td className="py-2 pr-3">{formatMontant(a.commissionTotal, a.tenant.devise)}</td>
                  <td className="py-2 pr-3">{a.commissionPending > 0 ? formatMontant(a.commissionPending, a.tenant.devise) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-2xl p-6 border" style={carte}>
        <h2 className="font-semibold mb-4" style={{ color: "#ffffff" }}>{tx("Derniers versements traités")}</h2>
        {historique.length === 0 ? <p className="text-sm" style={{ color: "#AAAAAA" }}>{tx("Aucun versement traité pour l'instant.")}</p> : (
          <div className="space-y-2">
            {historique.map((p) => (
              <div key={p.id} className="flex items-center justify-between flex-wrap gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: "rgba(255,255,255,0.02)", color: "#DDDDDD" }}>
                <span>{formatMontant(p.montant, boutique.get(p.tenantId)?.devise ?? "XAF")} · {boutique.get(p.tenantId)?.nomBoutique ?? "?"} → {affilie.get(p.affilieurId) ?? "?"} ({p.telephone})</span>
                <span className="text-xs" style={{ color: p.statut === "traite" ? "#16A34A" : "#DC2626" }}>{tx(p.statut === "traite" ? "Payé" : "Refusé / échoué")} · {formatDate(p.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
