"use client";
// Page « Achats & réassort » : ce qu'il faut commander (recommandations
// expliquées), les bons de commande, et la comparaison des fournisseurs d'un produit.
import { useState } from "react";
import { useT } from "@/components/I18nProvider";
import { Carte, EnTete, Page } from "@/components/pos/finance/commun";
import { Bouton, FOCUS, Tiroir } from "@/components/pos/ui";
import { BonsCommande } from "./BonsCommande";
import ComparateurFournisseursProduit from "./ComparateurFournisseursProduit";
import { Reappro } from "./Reappro";
import { RechercheArticle, type ArticleAchat } from "./RechercheArticle";

const ONGLETS = [["reappro", "À commander"], ["bons", "Bons de commande"], ["fournisseurs", "Fournisseurs par produit"]] as const;
type Onglet = (typeof ONGLETS)[number][0];

export function EcranAchats() {
  const t = useT();
  const [onglet, setOnglet] = useState<Onglet>("reappro");
  const [produit, setProduit] = useState<ArticleAchat | null>(null);

  return (
    <Page>
      <EnTete titre="Achats & réassort" sousTitre="Ce qu'il faut commander et pourquoi, vos bons de commande, et la comparaison de vos fournisseurs produit par produit.">
        <Bouton href="/dashboard/pos/receptions" variante="secondaire">{t("Réceptions")}</Bouton>
      </EnTete>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t("Sections des achats")}>
        {ONGLETS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={onglet === id} onClick={() => setOnglet(id)}
            className={`min-h-11 rounded-xl border px-4 text-[13px] font-bold ${FOCUS} ${onglet === id ? "border-[#111111] bg-[#111111] text-white" : "border-[#E8E8E8] bg-white text-[#111111]"}`}>
            {t(label)}
          </button>
        ))}
      </div>

      {onglet === "reappro" && <Reappro onBonsCrees={() => setOnglet("bons")} />}
      {onglet === "bons" && <BonsCommande />}
      {onglet === "fournisseurs" && (
        <Carte titre="Comparer les fournisseurs d'un produit">
          <p className="mb-3 text-[12px] leading-relaxed text-[#666666]">{t("Choisissez un produit : AXSO compare ses fournisseurs sur le prix, le délai, la fiabilité, la quantité et l'historique, et explique sa recommandation.")}</p>
          <RechercheArticle label="Produit" onChoisir={setProduit} />
        </Carte>
      )}
      <Tiroir ouverte={!!produit} onFermer={() => setProduit(null)} titre="Fournisseurs du produit" largeur="lg">
        {produit && <ComparateurFournisseursProduit key={produit.produitId} produitId={produit.produitId} />}
      </Tiroir>
    </Page>
  );
}
