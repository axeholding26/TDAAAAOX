import { redirect } from "next/navigation";

export default function CreerProduitRedirectPage() {
  redirect("/dashboard/produits/digital/nouveau");
}
