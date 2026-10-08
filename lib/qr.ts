// QR codes (SVG) — facture, boutique, lien livreur. Fonctionne côté serveur et navigateur.
// Le SVG remplit son conteneur : la taille se règle sur l'élément parent.
import QRCode from "qrcode";

export async function qrSvg(texte: string): Promise<string> {
  const svg = await QRCode.toString(texte, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#ffffff" } });
  return svg.replace("<svg ", '<svg width="100%" height="100%" ');
}
