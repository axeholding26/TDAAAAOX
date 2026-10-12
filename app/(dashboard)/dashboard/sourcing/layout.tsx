import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { sourcingInclus } from "@/lib/sourcing/acces";

// AXSO Sourcing est réservé au palier 2 : l'adresse tapée à la main suit la même règle que le menu.
export default async function SourcingLayout({ children }: { children: React.ReactNode }) {
  const tenantId = ((await auth())?.user as any)?.tenantId as string | undefined;
  if (!tenantId || !(await sourcingInclus(tenantId))) redirect("/dashboard/abonnement");
  return children;
}
