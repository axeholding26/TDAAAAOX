import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { AdminNav } from "@/components/admin/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/dashboard");

  return (
    <div className="min-h-screen flex" style={{ background: "#111111", fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <AdminNav email={session.email} role={session.role} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8 sm:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}
