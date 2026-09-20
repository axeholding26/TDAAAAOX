import { redirect } from "next/navigation";

export default function FacturesRedirect() {
  redirect("/dashboard/logistique?tab=factures");
}
