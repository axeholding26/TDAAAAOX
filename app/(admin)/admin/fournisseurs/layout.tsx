// La page fournisseurs est un composant client : le contrôle d'accès (RBAC) se fait ici.
import { redirect } from "next/navigation";
import { getAdminSessionPour } from "@/lib/admin-auth";

export default async function FournisseursLayout({ children }: { children: React.ReactNode }) {
  if (!(await getAdminSessionPour("fournisseurs"))) redirect("/admin?refus=1");
  return children;
}
