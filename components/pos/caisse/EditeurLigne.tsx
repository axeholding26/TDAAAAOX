"use client";
// Fenêtre d'une ligne de panier. Sert à deux moments :
// - à l'AJOUT, quand l'article demande une précision (variante à choisir,
//   poids à saisir pour un produit au kilo, numéro de série) ;
// - à la MODIFICATION : quantité ou poids, changement de variante, remise de
//   ligne, prix personnalisé, produit offert, commentaire.
// Remise, prix personnalisé et produit offert ne s'affichent qu'avec le droit
// correspondant ; le serveur les revérifie de toute façon.
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { Bouton, Champ, CLASSE_SAISIE, FOCUS, Modale, Saisie } from "@/components/pos/ui";
import { libelleQuantite, montantBrut } from "@/lib/pos/tarification";
import type { DroitsPos } from "@/lib/pos/types";
import { kgVersGrammes, lireNombre, type LigneCaisse } from "./logique";

export function EditeurLigne({ ligne, nouveau, droits, plafondRemisePct, modeSimple, onValider, onRetirer, onFermer, onFiche }: {
  ligne: LigneCaisse;
  /** true = l'article n'est pas encore dans le panier (précisions avant ajout). */
  nouveau: boolean;
  droits: DroitsPos;
  plafondRemisePct: number;
  modeSimple: boolean;
  onValider: (ligne: LigneCaisse) => void;
  onRetirer: () => void;
  onFermer: () => void;
  /** Mode pro : ouvre la fiche de l'article (stock par lieu, ventes, analyse). Absent = pas de lien. */
  onFiche?: () => void;
}) {
  const t = useT();
  const { fmt, devise } = useDevise();
  const kg = ligne.uniteVente === "kg";
  const [varianteId, setVarianteId] = useState(ligne.varianteId ?? null);
  const [quantite, setQuantite] = useState(kg ? (nouveau && !(ligne.quantite > 1) ? "" : String(ligne.quantite / 1000).replace(".", ",")) : String(ligne.quantite));
  const [serie, setSerie] = useState(ligne.numeroSerie ?? "");
  const [typeRemise, setTypeRemise] = useState<"pourcentage" | "montant">(ligne.remise?.type ?? "pourcentage");
  const [remise, setRemise] = useState(ligne.remise?.valeur ? String(ligne.remise.valeur) : "");
  const [prix, setPrix] = useState(ligne.prixPersonnalise != null ? String(ligne.prixPersonnalise) : "");
  const [offert, setOffert] = useState(!!ligne.offert);
  const [commentaire, setCommentaire] = useState(ligne.commentaire ?? "");
  const [montre, setMontre] = useState(false);

  const variante = varianteId ? ligne.variantes.find((v) => v.id === varianteId) ?? null : null;
  const prixCatalogue = variante ? variante.prix : ligne.prixUnitaire;
  const q = kg ? kgVersGrammes(quantite) : ligne.suiviSerie ? 1 : (() => { const n = lireNombre(quantite); return n !== null && Number.isInteger(n) && n >= 1 ? n : null; })();
  const prixSaisi = prix.trim() ? lireNombre(prix) : null;
  const remiseSaisie = remise.trim() ? lireNombre(remise) : null;
  // Le numéro déjà reconnu au scan (numeroSerieId) vaut numéro de série.
  const serieManquante = ligne.suiviSerie && !serie.trim() && !ligne.numeroSerieId;

  const erreurs = {
    variante: ligne.variantes.length > 0 && !variante ? "Choisissez une variante." : null,
    quantite: q === null ? (kg ? "Indiquez le poids en kilos (ex. 1,250)." : "Indiquez une quantité entière, au moins 1.") : null,
    serie: serieManquante ? "Scannez ou saisissez le numéro de série de cet article." : null,
    prix: prix.trim() && prixSaisi === null ? "Ce prix n'est pas un montant valide." : null,
    remise: remise.trim() && (remiseSaisie === null || (typeRemise === "pourcentage" && remiseSaisie > 100)) ? "Cette remise n'est pas valide." : null,
  };
  const invalide = Object.values(erreurs).some(Boolean);

  const valider = () => {
    setMontre(true);
    if (invalide || q === null) return;
    onValider({
      ...ligne, quantite: q,
      varianteId: variante?.id ?? null,
      ...(variante ? { variante: `${variante.nom}: ${variante.valeur}`, prixUnitaire: variante.prix, cout: variante.cout, image: variante.image ?? ligne.image, stock: variante.stockMagasin ?? variante.stock } : {}),
      numeroSerie: ligne.suiviSerie ? serie.trim() || null : null,
      // Un numéro retapé remplace celui reconnu au scan.
      numeroSerieId: ligne.suiviSerie && (!serie.trim() || serie.trim() === ligne.numeroSerie) ? ligne.numeroSerieId ?? null : null,
      remise: !offert && remiseSaisie ? { type: typeRemise, valeur: remiseSaisie } : null,
      prixPersonnalise: prixSaisi !== null && prixSaisi !== prixCatalogue ? prixSaisi : null,
      offert, commentaire: commentaire.trim() || null,
    });
  };

  const avance = (droits.remise || droits.prix_personnalise || droits.produit_offert) && (
    <div className="space-y-3">
      {droits.prix_personnalise && (
        <Saisie label={kg ? "Prix au kilo pour cette vente" : "Prix pour cette vente"} inputMode="decimal" value={prix} onChange={(e) => setPrix(e.target.value)} placeholder={String(prixCatalogue)} suffixe={devise}
          aide={`Prix catalogue : ${fmt(prixCatalogue)}. Laissez vide pour le garder.`} erreur={montre ? erreurs.prix : null} />
      )}
      {droits.remise && !offert && (
        <div className="grid grid-cols-[1fr_auto] items-start gap-2">
          <Saisie label="Remise sur la ligne" inputMode="decimal" value={remise} onChange={(e) => setRemise(e.target.value)} placeholder="0"
            aide={droits.remise_hors_plafond ? undefined : `Plafond sans validation d'un responsable : ${plafondRemisePct} %.`} erreur={montre ? erreurs.remise : null} />
          <Champ label="Type">
            {(attributs) => (
              <select {...attributs} value={typeRemise} onChange={(e) => setTypeRemise(e.target.value as "pourcentage" | "montant")} className={CLASSE_SAISIE}>
                <option value="pourcentage">%</option>
                <option value="montant">{devise}</option>
              </select>
            )}
          </Champ>
        </div>
      )}
      {droits.produit_offert && (
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[#E8E8E8] px-3 text-[13px] font-semibold">
          <input type="checkbox" checked={offert} onChange={(e) => setOffert(e.target.checked)} className="h-5 w-5 accent-[#F5A623]" />
          {t("Offrir cet article (montant à zéro)")}
        </label>
      )}
    </div>
  );

  return (
    <Modale ouverte onFermer={onFermer} titre={ligne.nom} description={nouveau ? "Précisez l'article avant de l'ajouter au panier." : undefined}
      actions={<>
        {!nouveau && <Bouton variante="danger" onClick={onRetirer} icone={<Trash2 size={15} aria-hidden />} className="mr-auto">{t("Supprimer")}</Bouton>}
        {onFiche && <Bouton variante="discret" onClick={onFiche}>{t("Fiche produit")}</Bouton>}
        <Bouton variante="secondaire" onClick={onFermer}>{t("Annuler")}</Bouton>
        <Bouton onClick={valider}>{nouveau ? t("Ajouter au panier") : t("Valider")}</Bouton>
      </>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); valider(); }}>
        {ligne.variantes.length > 0 && (
          <fieldset>
            <legend className="text-[11px] font-semibold uppercase tracking-wide text-[#666666]">{t("Variante")}</legend>
            <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ligne.variantes.map((v) => {
                const stock = v.stockMagasin ?? v.stock;
                return (
                  <button key={v.id} type="button" aria-pressed={varianteId === v.id} onClick={() => setVarianteId(v.id)}
                    className={cn("min-h-14 rounded-xl border px-3 py-2 text-left transition-colors", FOCUS, varianteId === v.id ? "border-[#111111] bg-[#111111] text-white" : "border-[#E8E8E8] bg-white hover:border-[#F5A623]")}>
                    <span className="block text-[13px] font-bold leading-tight">{v.valeur}</span>
                    <span className="block text-[11px] opacity-80">{fmt(v.prix)} · {stock > 0 ? `${t("Stock")} ${libelleQuantite(stock, ligne.uniteVente)}` : t("Rupture")}</span>
                  </button>
                );
              })}
            </div>
            {montre && erreurs.variante && <p role="alert" className="mt-1 text-[12px] text-[#B91C1C]">{t(erreurs.variante)}</p>}
          </fieldset>
        )}

        {kg ? (
          <Saisie label="Poids" inputMode="decimal" autoFocus value={quantite} onChange={(e) => setQuantite(e.target.value)} placeholder="0,000" suffixe="kg" erreur={montre ? erreurs.quantite : null}
            aide={q ? `${libelleQuantite(q, "kg")} × ${fmt(prixSaisi ?? prixCatalogue)} /kg = ${fmt(montantBrut(prixSaisi ?? prixCatalogue, q, "kg", 2))}` : `Prix au kilo : ${fmt(prixCatalogue)}. Pesez l'article puis saisissez le poids affiché par la balance.`} />
        ) : ligne.suiviSerie ? (
          <Saisie label="Numéro de série ou IMEI" autoFocus value={serie} onChange={(e) => setSerie(e.target.value)} maxLength={100} erreur={montre ? erreurs.serie : null}
            aide="Cet article se vend à l'unité : un numéro de série par ligne." />
        ) : (
          <Saisie label="Quantité" inputMode="numeric" autoFocus={!nouveau} value={quantite} onChange={(e) => setQuantite(e.target.value)} erreur={montre ? erreurs.quantite : null} />
        )}

        {avance && (modeSimple
          ? <details><summary className={cn("flex min-h-11 cursor-pointer items-center text-[12.5px] font-semibold text-[#555555]", FOCUS)}>{t("Prix, remise, article offert")}</summary><div className="pt-2">{avance}</div></details>
          : avance)}

        <Champ label="Commentaire">
          {(attributs) => <textarea {...attributs} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} maxLength={300} rows={2} placeholder={t("Facultatif — imprimé sur le reçu")} className={CLASSE_SAISIE} />}
        </Champ>
        {/* Entrée dans un champ valide la fenêtre. */}
        <button type="submit" hidden />
      </form>
    </Modale>
  );
}
