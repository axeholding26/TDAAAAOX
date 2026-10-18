import { redirect } from "next/navigation";
import { getAdminSessionPour, estAdminComplet } from "@/lib/admin-auth";
import { AdminEquipePanel } from "@/components/admin/AdminEquipePanel";
import { getT } from "@/lib/i18n/serveur";

export default async function AdminEquipePage() {
  const t = await getT();
  const session = await getAdminSessionPour("equipe");
  if (!session) redirect("/admin?refus=1");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#ffffff" }}>{t("Équipe")}</h1>
        <p className="text-sm mt-1" style={{ color: "#AAAAAA" }}>{t("Membres ayant accès au panneau d'administration Axso")}</p>
      </div>
      <AdminEquipePanel peutInviter={estAdminComplet(session)} monId={session.userId} />
    </div>
  );
}
