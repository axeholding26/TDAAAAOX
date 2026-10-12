import { redirect } from "next/navigation";

// « Caisse & magasin » s'ouvre sur l'écran de caisse.
export default function POSRedirect() {
  redirect("/dashboard/pos/caisse");
}
