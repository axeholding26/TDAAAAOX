import { paysVisiteur } from "@/lib/devise-visiteur";
import { FormulaireLivreur } from "./FormulaireLivreur";

// Pays du visiteur (cookie ou détection IP) → exemple de numéro avec le bon indicatif.
export default async function InscriptionLivreurPage() {
  return <FormulaireLivreur pays={await paysVisiteur()} />;
}
