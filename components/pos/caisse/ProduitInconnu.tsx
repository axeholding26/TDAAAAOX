"use client";
// « Produit non reconnu » : le code lu ne correspond à aucun article.
// Trois issues : créer le produit (formulaire court, droit « creer_produit »),
// le chercher dans le catalogue, ou scanner à nouveau.
// La création passe par POST /api/pos/produits (droit, audit,
// stock initial par mouvement de stock) et ajoute l'article au panier.
import { useRef, useState } from "react";
import { PackagePlus, ScanLine, Search } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { Bouton, Champ, CLASSE_SAISIE, EtatPos, Modale, Saisie } from "@/components/pos/ui";
import { nouvelleCle } from "@/lib/pos/client/transport";
import type { ArticleResolu, UniteVente } from "@/lib/pos/types";
import { appelPos } from "./api";
import { kgVersGrammes, lireNombre } from "./logique";

export function ProduitInconnu({ code, caisseId, peutCreer, tauxTVABoutique, onCree, onRechercher, onFermer }: {
  code: string;
  caisseId: string | null;
  peutCreer: boolean;
  /** Fraction (0.1925) — proposée par défaut. */
  tauxTVABoutique: number;
  onCree: (article: ArticleResolu) => void;
  /** Ferme et place le focus dans la recherche. */
  onRechercher: () => void;
  /** Ferme : la caisse attend le prochain scan. */
  onFermer: () => void;
}) {
  const t = useT();
  const { devise } = useDevise();
  const [formulaire, setFormulaire] = useState(false);
  const [nom, setNom] = useState("");
  const [categorie, setCategorie] = useState("");
  const [prix, setPrix] = useState("");
  const [cout, setCout] = useState("");
  const [tva, setTva] = useState(tauxTVABoutique > 0 ? String(+(tauxTVABoutique * 100).toFixed(2)).replace(".", ",") : "");
  const [unite, setUnite] = useState<UniteVente>("piece");
  const [stock, setStock] = useState("");
  const [montre, setMontre] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<{ code: string; message: string } | null>(null);
  // Une clé par création : un second appui ou un nouvel essai ne crée pas deux produits.
  const cle = useRef(nouvelleCle());

  const prixLu = lireNombre(prix), coutLu = cout.trim() ? lireNombre(cout) : null, tvaLue = tva.trim() ? lireNombre(tva) : null;
  const stockLu = !stock.trim() ? 0 : unite === "kg" ? kgVersGrammes(stock) : (() => { const n = lireNombre(stock); return n !== null && Number.isInteger(n) ? n : null; })();
  const erreurs = {
    nom: nom.trim().length < 2 ? "Indiquez le nom du produit." : null,
    prix: prixLu === null || prixLu <= 0 ? "Indiquez le prix de vente." : null,
    cout: cout.trim() && coutLu === null ? "Ce coût n'est pas un montant valide." : null,
    tva: tva.trim() && (tvaLue === null || tvaLue > 100) ? "Indiquez un taux entre 0 et 100." : null,
    stock: stockLu === null ? (unite === "kg" ? "Indiquez le stock en kilos (ex. 12,5)." : "Indiquez un stock entier.") : null,
  };

  const creer = async () => {
    setMontre(true);
    if (Object.values(erreurs).some(Boolean) || envoi) return;
    setEnvoi(true); setErreur(null);
    const r = await appelPos<{ article: ArticleResolu }>("/api/pos/produits", {
      method: "POST", caisseId,
      corps: {
        cle: cle.current, nom: nom.trim(), codeBarres: code, categorie: categorie.trim() || null, prix: prixLu, cout: coutLu,
        tauxTVA: tvaLue === null ? null : tvaLue / 100, uniteVente: unite, stockInitial: stockLu,
      },
    });
    setEnvoi(false);
    if (!r.ok) return setErreur({ code: r.code, message: r.message });
    onCree(r.donnees.article);
  };

  if (!formulaire) {
    return (
      <Modale ouverte onFermer={onFermer} taille="sm" titre="Produit non reconnu" description="Ce code ne correspond à aucun article de votre catalogue.">
        <p className="rounded-xl bg-[#F5F5F5] px-3 py-2 text-center font-mono text-[15px] font-bold tracking-wide text-[#111111]">{code}</p>
        <div className="mt-4 grid gap-2">
          {peutCreer
            ? <Bouton large onClick={() => setFormulaire(true)} icone={<PackagePlus size={16} aria-hidden />}>{t("Créer produit")}</Bouton>
            : <p className="text-[12.5px] leading-snug text-[#666666]">{t("Votre compte ne peut pas créer de produit. Demandez à un responsable de l'ajouter au catalogue.")}</p>}
          <Bouton variante="secondaire" large onClick={onRechercher} icone={<Search size={16} aria-hidden />}>{t("Rechercher dans le catalogue")}</Bouton>
          <Bouton variante="secondaire" large onClick={onFermer} icone={<ScanLine size={16} aria-hidden />}>{t("Scanner à nouveau")}</Bouton>
        </div>
      </Modale>
    );
  }

  return (
    <Modale ouverte onFermer={onFermer} verrouillee={envoi} titre="Créer le produit" description={`Code-barres : ${code}`}
      actions={<><Bouton variante="secondaire" onClick={() => setFormulaire(false)} disabled={envoi}>{t("Retour")}</Bouton><Bouton onClick={creer} charge={envoi}>{t("Créer et ajouter au panier")}</Bouton></>}>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); creer(); }}>
        <Saisie className="sm:col-span-2" label="Nom du produit" autoFocus value={nom} onChange={(e) => setNom(e.target.value)} maxLength={120} autoComplete="off" erreur={montre ? erreurs.nom : null} />
        <Saisie label="Catégorie" value={categorie} onChange={(e) => setCategorie(e.target.value)} maxLength={80} autoComplete="off" aide="Facultative." />
        <Champ label="Unité de vente">
          {(attributs) => (
            <select {...attributs} value={unite} onChange={(e) => setUnite(e.target.value as UniteVente)} className={CLASSE_SAISIE}>
              <option value="piece">{t("À la pièce")}</option>
              <option value="kg">{t("Au poids (kg)")}</option>
            </select>
          )}
        </Champ>
        <Saisie label={unite === "kg" ? "Prix de vente au kilo" : "Prix de vente"} inputMode="decimal" value={prix} onChange={(e) => setPrix(e.target.value)} suffixe={devise} erreur={montre ? erreurs.prix : null} />
        <Saisie label={unite === "kg" ? "Coût d'achat au kilo" : "Coût d'achat"} inputMode="decimal" value={cout} onChange={(e) => setCout(e.target.value)} suffixe={devise} aide="Facultatif — sert au calcul de la marge." erreur={montre ? erreurs.cout : null} />
        <Saisie label="TVA" inputMode="decimal" value={tva} onChange={(e) => setTva(e.target.value)} suffixe="%" aide="Vide = taux de la boutique." erreur={montre ? erreurs.tva : null} />
        <Saisie label="Stock initial" inputMode="decimal" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" suffixe={unite === "kg" ? "kg" : undefined} erreur={montre ? erreurs.stock : null} />
        {erreur && <div className="sm:col-span-2"><EtatPos compact code={erreur.code} message={erreur.message} onReessayer={creer} /></div>}
        <button type="submit" hidden />
      </form>
    </Modale>
  );
}
