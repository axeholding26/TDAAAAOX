"use client";
// Écran « Fiche produit » : scan → fiche (§10), et ses deux vues réduites,
// « contrôle prix » et « contrôle stock » (§9). Le mode choisi ici donne leur
// contexte aux scans du poste ; un scan du téléphone appairé impose le sien.
import { useState } from "react";
import { ScanLine } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { Bouton, EtatVide, Saisie } from "@/components/pos/ui";
import type { ContexteScan } from "@/lib/pos/types";
import FicheProduit, { type ModeFiche } from "./FicheProduit";
import { ChoixArticle, EnTete, Onglets, Page, PosteScan, useCaisse } from "./commun";

const CONTEXTE: Record<ModeFiche, ContexteScan> = { complete: "recherche", prix: "prix", stock: "stock" };
const MODE: Partial<Record<ContexteScan, ModeFiche>> = { recherche: "complete", prix: "prix", stock: "stock" };

export function EcranFiche() {
  const t = useT();
  const [caisseId] = useCaisse();
  const [mode, setMode] = useState<ModeFiche>("complete");
  const [cible, setCible] = useState<{ code?: string; produitId?: string; varianteId?: string | null } | null>(null);
  const [saisie, setSaisie] = useState("");

  return (
    <Page>
      <EnTete titre="Fiche produit" sousTitre="Scannez un article pour tout savoir de lui : prix, stock par lieu, ventes, lots, numéros de série, variantes.">
        <PosteScan contexte={CONTEXTE[mode]} contextes={["recherche", "prix", "stock"]} caisseId={caisseId}
          onScan={(s) => { setCible({ code: s.code }); const m = MODE[s.contexte ?? CONTEXTE[mode]]; if (m) setMode(m); }} />
      </EnTete>
      <Onglets label="Vue de la fiche" actif={mode} onChange={setMode} onglets={[{ id: "complete", libelle: "Fiche complète" }, { id: "prix", libelle: "Contrôle prix" }, { id: "stock", libelle: "Contrôle stock" }]} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (saisie.trim()) { setCible({ code: saisie.trim() }); setSaisie(""); } }}>
          <Saisie label="Code-barres, référence ou numéro de série" value={saisie} onChange={(e) => setSaisie(e.target.value)} className="flex-1" autoComplete="off" />
          <Bouton type="submit" variante="sombre">{t("Voir")}</Bouton>
        </form>
        <ChoixArticle label="Ou chercher par nom" caisseId={caisseId} onChoisir={(a) => setCible({ produitId: a.produitId, varianteId: a.varianteId })} />
      </div>
      {cible
        ? <FicheProduit code={cible.code} produitId={cible.produitId} varianteId={cible.varianteId} mode={mode} caisseId={caisseId} />
        : <EtatVide titre="Scannez un article" texte="Avec la caméra, une douchette ou le téléphone appairé (modes « Fiche produit », « Contrôle prix » ou « Contrôle stock »)."><ScanLine size={18} className="text-[#AAAAAA]" aria-hidden /></EtatVide>}
    </Page>
  );
}
