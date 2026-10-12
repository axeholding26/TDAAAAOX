// Fiche produit universelle : scan → fiche, contrôle prix, contrôle stock.
// Tout se passe côté client (EcranFiche) : les routes /api/pos authentifient et rendent les droits.
import { EcranFiche } from "@/components/pos/stock/EcranFiche";

export const metadata = { title: "Fiche produit" };

export default function Page() {
  return <EcranFiche />;
}
