import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { I18nProvider } from "@/components/I18nProvider";
import { getLangue, dico } from "@/lib/i18n/serveur";
import { AdminNav } from "@/components/admin/AdminNav";
import { AxiaAdmin } from "@/components/admin/AxiaAdmin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/dashboard");

  return (
    <I18nProvider langue={await getLangue()} dico={await dico("admin", "dashboard")}>
    <div className="min-h-screen flex" style={{ background: "#111111", fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <AdminNav email={session.email} role={session.role} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8 sm:p-10">
          {children}
        </div>
      </main>
      <AxiaAdmin />
    </div>
    </I18nProvider>
  );
}
