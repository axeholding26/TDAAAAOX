import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Wallet, Bike, Package } from "lucide-react";
import { MarquerRemisButton } from "@/components/dashboard/logistique/MarquerRemisButton";
import { formatMontant } from "@/lib/utils";

export default async function EncaissementsPage() {
  const session = await auth();
  if (!session) redirect("/connexion");
  const tenantId = (session.user as any)?.tenantId;

  const commandesNonRemises = await prisma.commande.findMany({
    where: {
      tenantId,
      methodePaiement: { in: ["whatsapp_cod", "direct_cod"] },
      statut: "livree",
      codRemis: false,
    },
    select: {
      id: true, numero: true, clientNom: true, montantTotal: true, devise: true, updatedAt: true,
      livreur: { select: { id: true, nom: true, telephone: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const parLivreur = new Map<string, { nom: string; telephone: string; commandes: typeof commandesNonRemises }>();
  for (const c of commandesNonRemises) {
    const cle = c.livreur?.id ?? "non_assigne";
    if (!parLivreur.has(cle)) {
      parLivreur.set(cle, { nom: c.livreur?.nom ?? "Non assigné", telephone: c.livreur?.telephone ?? "", commandes: [] });
    }
    parLivreur.get(cle)!.commandes.push(c);
  }

  const groupes = [...parLivreur.entries()];
  const totalGlobal = commandesNonRemises.reduce((s, c) => s + c.montantTotal, 0);
  const devise = commandesNonRemises[0]?.devise ?? "XAF";

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-[#111111] flex items-center gap-2"><Wallet size={20} className="text-[#F5A623]" /> Encaissements COD</h1>
        <p className="text-sm text-gray-400 mt-0.5">Cash collecté par vos livreurs, en attente de remise</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <p className="text-xs text-gray-400">Total en circulation chez vos livreurs</p>
        <p className="text-3xl font-bold text-[#F5A623] mt-1">{formatMontant(totalGlobal, devise)}</p>
      </div>

      {groupes.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center">
          <Package size={32} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm text-gray-400">Aucun encaissement en attente — tout est réconcilié.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupes.map(([id, g]) => {
            const total = g.commandes.reduce((s, c) => s + c.montantTotal, 0);
            return (
              <div key={id} className="bg-white border border-gray-100 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#FFF3DC] flex items-center justify-center">
                      <Bike size={16} className="text-[#F5A623]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#111111]">{g.nom}</p>
                      <p className="text-xs text-gray-400">{g.telephone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-[#111111]">{formatMontant(total, devise)}</p>
                    <p className="text-xs text-gray-400">{g.commandes.length} commande{g.commandes.length > 1 ? "s" : ""}</p>
                  </div>
                </div>

                <div className="space-y-1.5 mb-4">
                  {g.commandes.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                      <span className="font-mono text-gray-500">{c.numero}</span>
                      <span className="text-gray-500 truncate flex-1 mx-3">{c.clientNom}</span>
                      <span className="font-semibold text-[#111111]">{formatMontant(c.montantTotal, c.devise)}</span>
                    </div>
                  ))}
                </div>

                <MarquerRemisButton commandeIds={g.commandes.map((c) => c.id)} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
