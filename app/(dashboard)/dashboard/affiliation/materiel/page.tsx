import { redirect } from "next/navigation";

export default function MaterielRedirect() {
  redirect("/dashboard/affiliation?tab=materiel");
}
