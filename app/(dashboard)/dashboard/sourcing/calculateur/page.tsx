"use client";
// Calculateur libre : tester un prix fournisseur sans enregistrer de produit.
// Rien n'est sauvegardé — la fiche vit dans l'état de la page.
import { useState } from "react";
import { useT } from "@/components/I18nProvider";
import { MODES_APPRO, type ContexteCalcul } from "@/lib/sourcing/produit-source";
import { Page, Entete, Carte, Bouton, Onglets, Chargement, Erreur, useApi } from "@/components/dashboard/sourcing/ui";
import { Calculateur, type FicheCalcul } from "@/components/dashboard/sourcing/Calculateur";

export default function PageCalculateur() {
  const t = useT();
  const { data: contexte, erreur, chargement } = useApi<ContexteCalcul>("/api/sourcing/reglages");
  const [fiche, setFiche] = useState<FicheCalcul>({ prixFournisseur: 0, deviseFournisseur: "USD", modeAppro: "dropshipping", parametresCout: {}, tarification: {} });
  const mode = MODES_APPRO.find((m) => m.cle === fiche.modeAppro) ?? MODES_APPRO[0];

  return (
    <Page>
      <Entete badge="AXSO Sourcing" titre="Calculateur de rentabilité"
        sousTitre="Entrez le prix du fournisseur et vos frais : Axso calcule votre coût réel, le prix à afficher et votre bénéfice par commande."
        actions={<>
          <Bouton variante="secondaire" href="/dashboard/sourcing/reglages">{t("Changer les valeurs par défaut")}</Bouton>
          <Bouton href="/dashboard/sourcing/import">{t("Enregistrer un vrai produit")}</Bouton>
        </>} />
      {chargement && !contexte ? <Chargement /> : erreur || !contexte ? <Erreur message={erreur ?? "Erreur"} /> : (
        <>
          <Carte titre="Comment recevez-vous la marchandise ?" aide={mode.resume}>
            <Onglets onglets={MODES_APPRO.map((m) => ({ cle: m.cle, libelle: m.libelle }))} actif={mode.cle} onChange={(modeAppro) => setFiche((f) => ({ ...f, modeAppro }))} />
          </Carte>
          <Calculateur editionFiche fiche={fiche} contexte={contexte} onChange={(partiel) => setFiche((f) => ({ ...f, ...partiel }))} />
        </>
      )}
    </Page>
  );
}
