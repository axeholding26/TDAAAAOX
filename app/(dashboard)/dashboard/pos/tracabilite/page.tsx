// Traçabilité : lots et expiration, numéros de série et garanties.
// Tout se passe côté client (EcranTracabilite) : les routes /api/pos authentifient et rendent les droits.
import { EcranTracabilite } from "@/components/pos/stock/EcranTracabilite";

export const metadata = { title: "Traçabilité" };

export default function Page() {
  return <EcranTracabilite />;
}
