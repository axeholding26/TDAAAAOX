import { redirect } from "next/navigation";
import { getAdminSession, estAdminComplet } from "@/lib/admin-auth";
import { AdminEquipePanel } from "@/components/admin/AdminEquipePanel";

export default async function AdminEquipePage() {
  const session = await getAdminSession();
  if (!session) redirect("/dashboard");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#ffffff" }}>Équipe</h1>
        <p className="text-sm mt-1" style={{ color: "#AAAAAA" }}>Membres ayant accès au panneau d'administration Axso</p>
      </div>
      <AdminEquipePanel peutInviter={estAdminComplet(session)} monId={session.userId} />
    </div>
  );
}
