// Transferts de stock entre magasins et entrepôts.
// Tout se passe côté client (EcranTransferts) : les routes /api/pos authentifient et rendent les droits.
import { EcranTransferts } from "@/components/pos/stock/EcranTransferts";

export const metadata = { title: "Transferts de stock" };

export default function Page() {
  return <EcranTransferts />;
}
