"use client";
// Mode démo (§76) : visite guidée de la caisse, jouée ENTIÈREMENT dans le
// navigateur. Aucun appel au serveur, aucune écriture : les articles sont
// fictifs (lib/pos/demo.ts), le total est calculé par la vraie fonction
// `calculerPanier`. Fermer la fenêtre efface tout. Le bandeau « DÉMO » reste
// affiché du début à la fin. (Pourquoi pas de données de démonstration en
// base : voir l'en-tête de lib/pos/demo.ts.)
import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { Badge, Bouton, BoutonIcone, EtatVide, FOCUS, Modale } from "@/components/pos/ui";
import { ARTICLES_DEMO, ETAPES_DEMO, type ArticleDemo } from "@/lib/pos/demo";
import { TOUS_DROITS } from "@/lib/pos/droits";
import { calculerPanier, libelleQuantite } from "@/lib/pos/tarification";
import type { LignePanier } from "@/lib/pos/types";

type Ligne = LignePanier & { produitId: string };

export default function VisiteDemo({ ouverte, onFermer, tauxTVA = 0 }: { ouverte: boolean; onFermer: () => void; tauxTVA?: number }) {
  const t = useT();
  const { devise, fmt } = useDevise();
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [paye, setPaye] = useState<{ mode: string; recu: number } | null>(null);
  const panier = useMemo(() => calculerPanier(lignes, { tauxTVA, droits: TOUS_DROITS, devise, prixTTC: true }), [lignes, tauxTVA, devise]);
  const etape = paye ? 3 : lignes.length === 0 ? 0 : 1;

  // Un produit au poids s'ajoute par 500 g (quantités en grammes, comme la vraie caisse).
  const pas = (a: { uniteVente?: string }) => (a.uniteVente === "kg" ? 500 : 1);
  const ajouter = (a: ArticleDemo) => setLignes((l) => l.some((x) => x.produitId === a.produitId)
    ? l.map((x) => (x.produitId === a.produitId ? { ...x, quantite: x.quantite + pas(a) } : x))
    : [...l, { produitId: a.produitId, nom: a.nom, prixUnitaire: a.prixUnitaire, uniteVente: a.uniteVente, categorie: a.categorie, quantite: pas(a) }]);
  const changer = (id: string, sens: 1 | -1) => setLignes((l) => l.flatMap((x) => {
    if (x.produitId !== id) return [x];
    const quantite = x.quantite + sens * pas(x);
    return quantite > 0 ? [{ ...x, quantite }] : [];
  }));
  const recommencer = () => { setLignes([]); setPaye(null); };
  const fermer = () => { recommencer(); onFermer(); };
  // Espèces : le client « remet » le billet rond supérieur, pour montrer la monnaie à rendre.
  const billet = Math.ceil(panier.total / 1000) * 1000 || panier.total;

  return (
    <Modale ouverte={ouverte} onFermer={fermer} titre="Visite de la caisse" taille="xl"
      actions={<><Bouton variante="secondaire" onClick={recommencer}>{t("Recommencer")}</Bouton><Bouton variante="sombre" onClick={fermer}>{t("Terminer la visite")}</Bouton></>}>
      <div role="note" className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-[12.5px] text-[#1D4ED8]">
        <Badge ton="info">{t("DÉMO")}</Badge>
        <span className="min-w-0 flex-1 basis-56">{t("Articles et montants fictifs. Rien n'est enregistré : ni vente, ni stock, ni chiffre. Tout disparaît à la fermeture.")}</span>
      </div>

      <ol className="mb-4 grid gap-2 sm:grid-cols-4">
        {ETAPES_DEMO.map((e, i) => (
          <li key={e.id} aria-current={i === etape || (i === 2 && etape === 1) ? "step" : undefined} className={`rounded-xl border p-2.5 text-[12px] ${i <= etape ? "border-[#111111] bg-white" : "border-[#E8E8E8] bg-[#FAFAFA] text-[#888888]"}`}>
            <p className="font-bold">{t(e.titre)}</p><p className="mt-0.5 leading-snug text-[#666666]">{t(e.texte)}</p>
          </li>
        ))}
      </ol>

      {paye ? (
        <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-[#AAAAAA] bg-white p-4 text-[13px]">
          <p className="text-center text-[11px] font-bold tracking-widest text-[#1D4ED8]">{t("REÇU DE DÉMONSTRATION — SANS VALEUR")}</p>
          <ul className="mt-3 divide-y divide-[#F0F0F0]">
            {panier.lignes.map((l) => <li key={l.produitId} className="flex justify-between gap-3 py-1.5"><span className="min-w-0 truncate">{libelleQuantite(l.quantite, l.uniteVente)} × {l.nom}</span><span className="tabular-nums">{fmt(l.total)}</span></li>)}
          </ul>
          <p className="mt-2 flex justify-between border-t-2 border-[#111111] pt-2 text-[15px] font-bold"><span>{t("TOTAL")}</span><span className="tabular-nums">{fmt(panier.total)}</span></p>
          <p className="mt-1 flex justify-between text-[#666666]"><span>{t(paye.mode)}</span><span className="tabular-nums">{fmt(paye.recu)}</span></p>
          {paye.recu > panier.total && <p className="flex justify-between font-semibold"><span>{t("Monnaie rendue")}</span><span className="tabular-nums">{fmt(paye.recu - panier.total)}</span></p>}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#666666]">{t("Articles de démonstration")}</h3>
            <ul className="grid grid-cols-2 gap-2">
              {ARTICLES_DEMO.map((a) => (
                <li key={a.produitId}>
                  <button type="button" onClick={() => ajouter(a)} className={`min-h-16 w-full rounded-xl border border-[#E8E8E8] bg-white p-2.5 text-left transition-colors hover:border-[#F5A623] ${FOCUS}`}>
                    <span className="block text-[12.5px] font-semibold leading-snug text-[#111111]">{a.nom}</span>
                    <span className="block text-[12px] tabular-nums text-[#666666]">{fmt(a.prixUnitaire)}{a.uniteVente === "kg" ? ` / kg` : ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#666666]">{t("Panier")}</h3>
            {panier.lignes.length === 0 ? <EtatVide compact titre="Panier vide" texte="Touchez un article pour l'ajouter." /> : (
              <>
                <ul className="divide-y divide-[#F0F0F0]">
                  {panier.lignes.map((l) => (
                    <li key={l.produitId} className="flex items-center gap-2 py-2">
                      <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-[#111111]">{l.nom}</span><span className="text-[12px] tabular-nums text-[#666666]">{libelleQuantite(l.quantite, l.uniteVente)} · {fmt(l.total)}</span></span>
                      <BoutonIcone label={t("Retirer une unité de {0}", l.nom)} onClick={() => changer(l.produitId, -1)}><Minus size={16} aria-hidden /></BoutonIcone>
                      <BoutonIcone label={t("Ajouter une unité de {0}", l.nom)} onClick={() => changer(l.produitId, 1)}><Plus size={16} aria-hidden /></BoutonIcone>
                    </li>
                  ))}
                </ul>
                {panier.montantTaxes > 0 && <p className="mt-2 flex justify-between text-[12.5px] text-[#666666]"><span>{t("dont taxes")}</span><span className="tabular-nums">{fmt(panier.montantTaxes)}</span></p>}
                <p className="mt-1 flex justify-between text-[18px] font-bold text-[#111111]"><span>{t("TOTAL")}</span><span className="tabular-nums">{fmt(panier.total)}</span></p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Bouton taille="grand" large onClick={() => setPaye({ mode: "Espèces", recu: billet })}>{t("Espèces")}</Bouton>
                  <Bouton taille="grand" large variante="sombre" onClick={() => setPaye({ mode: "Mobile Money", recu: panier.total })}>{t("Mobile Money")}</Bouton>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Modale>
  );
}
