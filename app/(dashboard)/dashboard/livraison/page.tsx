import { redirect } from "next/navigation";

export default function LivraisonRedirect() {
  redirect("/dashboard/logistique?tab=livraison");
}
