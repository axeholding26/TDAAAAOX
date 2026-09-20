import { redirect } from "next/navigation";
import { getAdminSession, estAdminComplet } from "@/lib/admin-auth";
import { AdminAxsocialPanel } from "@/components/admin/AdminAxsocialPanel";

export default async function AdminAxsocialPage() {
  const session = await getAdminSession();
  if (!session) redirect("/dashboard");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#ffffff" }}>Axsocial — Publications Axso</h1>
        <p className="text-sm mt-1" style={{ color: "#AAAAAA" }}>Diffuse une annonce officielle à tous les marchands, visible dans leur fil Axsocial</p>
      </div>
      <AdminAxsocialPanel peutPublier={estAdminComplet(session)} />
    </div>
  );
}
