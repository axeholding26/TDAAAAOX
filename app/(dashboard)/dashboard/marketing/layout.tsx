import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { planActif } from "@/lib/abonnement";

// Marketing & campagnes : Palier Pro, comme le menu — l'adresse tapée à la main suit la même règle
// (les actions sont aussi refusées côté API, voir PALIERS_API dans lib/permissions-api.ts).
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const tenantId = ((await auth())?.user as any)?.tenantId as string | undefined;
  if (!tenantId || (await planActif(tenantId)).plan === "palier0") redirect("/dashboard/abonnement");
  return children;
}
