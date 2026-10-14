import { auth } from "@/lib/auth";
import { exigerModule } from "@/lib/permissions-server";

// Adresse tapée à la main : même règle d'accès que le menu.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await exigerModule(await auth(), "finance");
  return children;
}
