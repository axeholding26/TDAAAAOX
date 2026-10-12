// Stock de la caisse : les 7 états par lieu, ajustements, journal des mouvements.
// Tout se passe côté client (EcranStock) : les routes /api/pos authentifient et rendent les droits.
import { EcranStock } from "@/components/pos/stock/EcranStock";

export const metadata = { title: "Gestion des stocks" };

export default function Page() {
  return <EcranStock />;
}
