import { redirect } from "next/navigation";

export default function PaiementsAffiliationRedirect() {
  redirect("/dashboard/affiliation?tab=paiements");
}
