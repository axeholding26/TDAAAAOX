import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { MenusDeroulants } from "@/components/ui/MenusDeroulants";
import { getAdminSession } from "@/lib/admin-auth";
import { I18nProvider } from "@/components/I18nProvider";
import { getLangue, dico } from "@/lib/i18n/serveur";
import { AxiaAdmin } from "@/components/admin/AxiaAdmin";
import { Coquille, type Mode } from "@/components/command-center/Coquille";
import { SECTIONS, peutVoir } from "@/lib/command-center/rbac";
import { demoAutorisee } from "@/lib/command-center/serveur";
import "./command-center.css";

export const metadata = { title: "Axso Command Center" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/dashboard");
  const c = await cookies();
  const theme = c.get("cc_theme")?.value === "light" ? "light" : "dark";
  const mode = (["ceo", "analyste"].includes(c.get("cc_mode")?.value ?? "") ? c.get("cc_mode")!.value : "standard") as Mode;

  return (
    <I18nProvider langue={await getLangue()} dico={await dico("admin", "dashboard")}>
      <Coquille email={session.email} role={session.role} sections={SECTIONS.filter((s) => peutVoir(session.role, s))} theme={theme} mode={mode} demo={demoAutorisee()}>
        {children}
      </Coquille>
      <MenusDeroulants />
      {peutVoir(session.role, "finances") && <AxiaAdmin />}
    </I18nProvider>
  );
}
