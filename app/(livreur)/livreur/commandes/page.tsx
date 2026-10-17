import { auth } from "@/lib/auth";
import { STATUTS_COURSE_ACTIVE } from "@/lib/commandes";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MapPin, ChevronRight } from "lucide-react";
import { formatDate, formatMontant } from "@/lib/utils";
import { getT } from "@/lib/i18n/serveur";

const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  confirmee:      { label: "À récupérer", color: "#d4d4d4", bg: "#d4d4d415" },
  en_preparation: { label: "En préparation", color: "#7c3aed", bg: "#7c3aed15" },
  expediee:       { label: "En livraison", color: "#F5A623", bg: "#F5A62315" },
  tentative_echouee: { label: "À retenter", color: "#f87171", bg: "#f8717115" },
  livree:         { label: "Livré", color: "#10b981", bg: "#10b98115" },
  annulee:        { label: "Annulé", color: "#ef4444", bg: "#ef444415" },
};

export default async function HistoriquePage() {
  const t = await getT();
  const session = await auth();
  if (!session) redirect("/connexion");

  const livreur = await prisma.livreur.findFirst({
    where: { userId: (session.user as any)?.id },
  });
  if (!livreur) redirect("/connexion");

  const commandes = await prisma.commande.findMany({
    where: { livreurId: livreur.id },
    include: { lignes: { take: 1 } },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const stats = {
    total: commandes.length,
    livrees: commandes.filter((c) => c.statut === "livree").length,
    enCours: commandes.filter((c) => STATUTS_COURSE_ACTIVE.includes(c.statut)).length,
  };

  return (
    <div className="space-y-5">
      <div>
        <Link href="/livreur" className="text-gray-400 text-sm hover:text-white">{t("← Retour")}</Link>
        <h1 className="text-xl font-bold text-white font-playfair mt-2">{t("Mes livraisons")}</h1>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-[#141414] to-[#0d0d0d] border border-white/5 rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-white">{stats.total}</p>
          <p className="text-gray-500 text-xs">{t("Total")}</p>
        </div>
        <div className="bg-gradient-to-br from-[#141414] to-[#0d0d0d] border border-white/5 rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-[#F5A623]">{t(stats.enCours)}</p>
          <p className="text-gray-500 text-xs">{t("En cours")}</p>
        </div>
        <div className="bg-gradient-to-br from-[#141414] to-[#0d0d0d] border border-white/5 rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-green-400">{t(stats.livrees)}</p>
          <p className="text-gray-500 text-xs">{t("Livrées")}</p>
        </div>
      </div>

      <div className="space-y-2">
        {commandes.length === 0 ? (
          <div className="text-center py-12 text-gray-500">{t("Aucune livraison assignée")}</div>
        ) : commandes.map((cmd) => {
          const st = STATUT_CONFIG[cmd.statut] || STATUT_CONFIG.confirmee;
          return (
            <Link
              key={cmd.id}
              href={`/livreur/commande/${cmd.id}`}
              className="flex items-center gap-4 bg-gradient-to-br from-[#141414] to-[#0d0d0d] border border-white/5 rounded-2xl p-4 hover:border-[#F5A623]/20 transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ color: st.color, backgroundColor: st.bg }}>
                    {t(st.label)}
                  </span>
                  <span className="text-gray-500 text-xs font-mono">{cmd.numero}</span>
                </div>
                <p className="text-white text-sm font-medium">{t(cmd.clientNom)}</p>
                <p className="text-gray-500 text-xs flex items-center gap-1 mt-0.5">
                  <MapPin size={10} />
                  {t(cmd.ville)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <p className="text-[#F5A623] text-sm font-bold">{formatMontant(cmd.montantTotal, cmd.devise)}</p>
                <p className="text-gray-500 text-xs">{formatDate(cmd.updatedAt)}</p>
              </div>
              <ChevronRight size={14} className="text-gray-500 flex-shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
