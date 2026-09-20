import { redirect } from "next/navigation";

export default function LivreursRedirect() {
  redirect("/dashboard/logistique?tab=livreurs");
}
