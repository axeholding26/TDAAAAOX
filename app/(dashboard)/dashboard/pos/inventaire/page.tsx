// Inventaires : démarrage, comptage au scan, validation des écarts.
// Tout se passe côté client (EcranInventaire) : les routes /api/pos authentifient et rendent les droits.
import { EcranInventaire } from "@/components/pos/stock/EcranInventaire";

export const metadata = { title: "Inventaires" };

export default function Page() {
  return <EcranInventaire />;
}
