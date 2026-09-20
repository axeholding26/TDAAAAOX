"use client";
import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { Printer } from "lucide-react";

interface Props {
  value: string;
  nom: string;
  prix?: string;
}

// Aperçu + impression d'étiquette code-barres, pour les produits qui
// n'arrivent pas avec un code d'origine (voir genererEAN13() dans
// lib/barcode.ts) — le marchand imprime l'étiquette et la colle sur le
// produit physique. Format EAN-13 en priorité (scannable partout), repli
// CODE128 si la valeur n'est pas un EAN-13 valide (SKU libre, code scanné
// dans un autre format...) — CODE128 accepte n'importe quelle chaîne.
export function BarcodeLabelPreview({ value, nom, prix }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    const options = { width: 2, height: 55, fontSize: 13, margin: 8, background: "#ffffff", lineColor: "#111111" };
    try {
      JsBarcode(svgRef.current, value, { ...options, format: "EAN13" });
    } catch {
      try { JsBarcode(svgRef.current, value, { ...options, format: "CODE128" }); } catch { /* valeur non décodable — pas d'aperçu plutôt que planter */ }
    }
  }, [value]);

  function imprimer() {
    if (!svgRef.current) return;
    const svgMarkup = svgRef.current.outerHTML;
    const fenetre = window.open("", "_blank", "width=420,height=340");
    if (!fenetre) { alert("Autorise les pop-ups pour imprimer l'étiquette"); return; }
    fenetre.document.write(`<!DOCTYPE html><html><head><title>Étiquette produit</title>
      <style>
        @page { size: 60mm 40mm; margin: 2mm; }
        body { font-family: Arial, sans-serif; margin: 0; padding: 8px; display: flex; flex-direction: column; align-items: center; }
        p { margin: 2px 0; font-size: 12px; font-weight: 700; text-align: center; }
        svg { max-width: 100%; }
      </style>
      </head><body>
        <p>${nom}</p>
        ${svgMarkup}
        ${prix ? `<p>${prix}</p>` : ""}
      </body></html>`);
    fenetre.document.close();
    setTimeout(() => { try { fenetre.print(); } catch {} }, 350);
  }

  if (!value) return null;

  return (
    <div className="mt-2 p-3 bg-gray-50 border border-gray-100 rounded-xl flex flex-col items-center gap-2">
      <svg ref={svgRef} />
      <button
        type="button"
        onClick={imprimer}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold text-gray-600 border border-gray-200 hover:bg-white transition-all"
      >
        <Printer size={12} /> Imprimer l'étiquette
      </button>
    </div>
  );
}
