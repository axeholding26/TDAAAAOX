"use client";
// Reçu de caisse imprimable — formats 58 mm, 80 mm (imprimantes thermiques) et
// A4, selon ReglagesPos.reglages.recu.format.
// Le reçu a SA feuille de style (cssRecu) : elle habille l'aperçu à l'écran et
// sert seule à l'impression, faite dans un cadre isolé (imprimerRecu) — jamais
// l'impression de toute la page de caisse.
// Un paiement déclaratif (Mobile Money, carte…) y est écrit « non vérifié ».
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";

export type FormatRecu = "58mm" | "80mm" | "A4";

export type DonneesRecu = {
  numero: string;
  /** ISO. */
  date: string;
  boutique: { nom: string; adresse?: string | null; telephone?: string | null };
  magasin?: string | null;
  caisse?: string | null;
  caissier: string;
  client?: string | null;
  /** null = détail indisponible (vente déjà enregistrée par un envoi précédent). */
  lignes: { nom: string; variante?: string | null; quantite: string; prix: number; unite?: string; montant: number; remise: number; offert: boolean; commentaire?: string | null; numeroSerie?: string | null }[] | null;
  sousTotal: number;
  totalRemises: number;
  taxes: { taux: number; base: number; montant: number }[];
  prixTTC: boolean;
  total: number;
  paiements: { libelle: string; montant: number; nonVerifie: boolean; reference?: string | null; recu?: number | null }[];
  /** Part portée au crédit du client. */
  du: number;
  monnaie: number;
  entete: string;
  piedDePage: string;
  afficherTVA: boolean;
  format: FormatRecu;
};

const LARGEUR: Record<FormatRecu, string> = { "58mm": "48mm", "80mm": "72mm", A4: "180mm" };

/** Feuille de style du reçu, pour un format. Toutes les règles sont sous `.recu-pos`. */
export function cssRecu(format: FormatRecu): string {
  const ticket = format !== "A4";
  return `
@page { size: ${ticket ? `${format} auto` : "A4"}; margin: ${ticket ? "0" : "15mm"}; }
.recu-pos { box-sizing: border-box; width: ${LARGEUR[format]}; max-width: 100%; margin: 0 auto; padding: ${ticket ? "3mm 2mm" : "0"}; background: #fff; color: #000;
  font-family: ${ticket ? "'Courier New', ui-monospace, monospace" : "system-ui, 'Segoe UI', sans-serif"}; font-size: ${format === "58mm" ? "9.5px" : format === "80mm" ? "11px" : "12.5px"}; line-height: 1.35; }
.recu-pos * { box-sizing: border-box; margin: 0; padding: 0; }
.recu-pos .centre { text-align: center; }
.recu-pos .titre { font-size: 1.35em; font-weight: 700; }
.recu-pos .fin { white-space: pre-line; }
.recu-pos hr { border: 0; border-top: 1px dashed #000; margin: 1.5mm 0; }
.recu-pos .rang { display: flex; justify-content: space-between; gap: 2mm; }
.recu-pos .rang > :first-child { min-width: 0; overflow-wrap: anywhere; }
.recu-pos .rang > :last-child { flex-shrink: 0; text-align: right; white-space: nowrap; }
.recu-pos .detail { padding-left: 2mm; opacity: .85; }
.recu-pos .total { font-size: 1.3em; font-weight: 700; }
.recu-pos .gras { font-weight: 700; }
.recu-pos .ligne { margin-bottom: 1mm; }
`;
}

/**
 * Imprime UNIQUEMENT le reçu : son HTML et sa feuille de style sont copiés dans
 * un cadre invisible, imprimé puis retiré. Rend false si le navigateur refuse.
 */
export function imprimerRecu(element: HTMLElement | null, format: FormatRecu): boolean {
  if (!element) return false;
  const cadre = document.createElement("iframe");
  cadre.setAttribute("aria-hidden", "true");
  cadre.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(cadre);
  const fenetre = cadre.contentWindow, doc = cadre.contentDocument;
  if (!fenetre || !doc) { cadre.remove(); return false; }
  doc.open();
  doc.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${(element.dataset.titre ?? "Reçu").replace(/[<>&]/g, "")}</title><style>html,body{margin:0;padding:0;background:#fff}${cssRecu(format)}</style></head><body>${element.outerHTML}</body></html>`);
  doc.close();
  // Le cadre est retiré après la fermeture de la boîte d'impression (ou au bout d'une minute si l'événement manque).
  const retirer = () => cadre.remove();
  fenetre.addEventListener("afterprint", retirer, { once: true });
  setTimeout(retirer, 60_000);
  fenetre.focus();
  fenetre.print();
  return true;
}

export function Recu({ recu, ref }: { recu: DonneesRecu; ref?: React.Ref<HTMLDivElement> }) {
  const t = useT();
  const { fmt } = useDevise();
  const date = new Date(recu.date);
  return (
    <>
      <style>{cssRecu(recu.format)}</style>
      <div ref={ref} className="recu-pos" data-titre={`${t("Reçu")} ${recu.numero}`}>
        <div className="centre">
          <p className="titre">{recu.boutique.nom}</p>
          {recu.magasin && recu.magasin !== recu.boutique.nom && <p>{recu.magasin}</p>}
          {recu.boutique.adresse && <p>{recu.boutique.adresse}</p>}
          {recu.boutique.telephone && <p>{t("Tél.")} {recu.boutique.telephone}</p>}
          {recu.entete && <p className="fin">{recu.entete}</p>}
        </div>
        <hr />
        <p className="rang"><span>{t("Reçu")} {recu.numero}</span><span>{date.toLocaleDateString(t.loc)} {date.toLocaleTimeString(t.loc, { hour: "2-digit", minute: "2-digit" })}</span></p>
        <p className="rang"><span>{recu.caisse ?? t("Caisse")}</span><span>{recu.caissier}</span></p>
        {recu.client && <p>{t("Client")} : {recu.client}</p>}
        <hr />
        {recu.lignes ? recu.lignes.map((l, i) => (
          <div key={i} className="ligne">
            <p className="rang"><span className="gras">{l.nom}{l.variante ? ` (${l.variante})` : ""}</span><span>{l.offert ? t("OFFERT") : fmt(l.montant)}</span></p>
            <p className="detail">{l.quantite} × {fmt(l.prix)}{l.unite ?? ""}{!l.offert && l.remise > 0 ? ` · ${t("remise")} −${fmt(l.remise)}` : ""}</p>
            {l.numeroSerie && <p className="detail">{t("N° de série")} {l.numeroSerie}</p>}
            {l.commentaire && <p className="detail">{l.commentaire}</p>}
          </div>
        )) : <p className="centre">{t("Détail des articles : voir la vente {0}", recu.numero)}</p>}
        <hr />
        {recu.lignes && <p className="rang"><span>{t("Sous-total")}</span><span>{fmt(recu.sousTotal)}</span></p>}
        {recu.lignes && recu.totalRemises > 0 && <p className="rang"><span>{t("Remises")}</span><span>−{fmt(recu.totalRemises)}</span></p>}
        {recu.afficherTVA && recu.taxes.map((x) => (
          <p key={x.taux} className="rang"><span>{recu.prixTTC ? t("dont TVA {0} %", +(x.taux * 100).toFixed(2)) : t("TVA {0} %", +(x.taux * 100).toFixed(2))}</span><span>{fmt(x.montant)}</span></p>
        ))}
        <p className="rang total"><span>{t("TOTAL")}</span><span>{fmt(recu.total)}</span></p>
        <hr />
        {recu.paiements.map((p, i) => (
          <div key={i}>
            <p className="rang"><span>{t(p.libelle)}{p.nonVerifie ? ` (${t("non vérifié")})` : ""}</span><span>{fmt(p.recu ?? p.montant)}</span></p>
            {p.reference && <p className="detail">{t("Réf.")} {p.reference}</p>}
          </div>
        ))}
        {recu.monnaie > 0 && <p className="rang gras"><span>{t("Monnaie rendue")}</span><span>{fmt(recu.monnaie)}</span></p>}
        {recu.du > 0 && <p className="rang gras"><span>{t("Reste dû (crédit)")}</span><span>{fmt(recu.du)}</span></p>}
        {recu.piedDePage && <><hr /><p className="centre fin">{recu.piedDePage}</p></>}
      </div>
    </>
  );
}
