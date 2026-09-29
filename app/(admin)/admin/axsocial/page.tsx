import { redirect } from "next/navigation";
import { getAdminSession, estAdminComplet } from "@/lib/admin-auth";
import { AdminAxsocialPanel } from "@/components/admin/AdminAxsocialPanel";
import { getT } from "@/lib/i18n/serveur";

export default async function AdminAxsocialPage() {
  const t = await getT();
  const session = await getAdminSession();
  if (!session) redirect("/dashboard");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#ffffff" }}>{t("Axsocial — Publications Axso")}</h1>
        <p className="text-sm mt-1" style={{ color: "#AAAAAA" }}>{t("Diffuse une annonce officielle à tous les marchands, visible dans leur fil Axsocial")}</p>
      </div>
      <AdminAxsocialPanel peutPublier={estAdminComplet(session)} />
    </div>
  );
}
