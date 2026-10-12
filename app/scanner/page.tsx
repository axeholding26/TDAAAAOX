// AXSO Scanner Mobile : l'écran du téléphone appairé à une caisse. Hors du
// tableau de bord (aucune session marchande requise) : le téléphone est reconnu
// par son jeton d'appareil, posé en cookie à l'appairage (/scanner?code=…).
import type { Metadata, Viewport } from "next";
import EcranScanner from "./EcranScanner";

export const metadata: Metadata = { title: "Scanner", robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#111111" };

export default function PageScanner() {
  return <EcranScanner />;
}
