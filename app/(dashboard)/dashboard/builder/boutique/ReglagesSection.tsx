"use client";

import type { BlockNode } from "@/lib/theme-config";
import { moveNode, updateNodeConfig, updateNodeStyle } from "@/lib/block-tree";
import { CouleurEffacable } from "../canvas/BlockStylePanel";
import { texteImage } from "@/components/storefront/blocks/styleUtils";
import { useT } from "@/components/I18nProvider";

type SetTree = (u: (t: BlockNode[]) => BlockNode[]) => void;

// Largeurs façon Shopify ; le « - 12px » compense la moitié de l'espace (gap-6) entre colonnes.
const LARGEURS = { petite: 33, moyenne: 50, grande: 66 } as const;
const largeur = (pct: number) => `calc(${pct}% - 12px)`;
const REMPLISSAGE_CONTENEUR = "40px";

// Réglages de section façon Shopify, en tête de l'onglet Style : schéma de
// couleurs pour toute section, et pour une section Texte + Image les réglages
// de « Image avec texte » (position, largeur, contenu, conteneur).
export function ReglagesSection({ section, setTree }: { section: BlockNode; setTree: SetTree }) {
  const t = useT();
  const couleurs = section.config?.couleurs ?? {};
  const setSection = (patch: Record<string, any>) => setTree((tr) => updateNodeConfig(tr, section.id, patch));
  const setCouleur = (k: string, v: string) => setSection({ couleurs: { ...couleurs, [k]: v || undefined } });

  const ti = texteImage(section);
  const { ligne, colImage, colTexte } = ti ?? {};
  const blocsTexte = colTexte?.children ?? [];
  // Largeur libre (poignée, champ Largeur) : aucun préréglage n'est mis en avant.
  const lImage = colImage?.style?.width;
  const tailleImage = !lImage ? "moyenne" : (Object.entries(LARGEURS).find(([, p]) => lImage === largeur(p) || lImage === `${p}%`)?.[0] ?? "");
  const align = blocsTexte[0]?.config?.align ?? "left";
  const fondConteneur = colTexte?.style?.background?.color;
  // Remplissage ajouté avec la couleur du conteneur : retiré avec elle, sauf
  // s'il a été modifié à la main entre-temps.
  const COTES = ["pt", "pb", "pl", "pr"] as const;
  const majConteneur = (v: string) => {
    if (!colTexte) return;
    const sp = { ...colTexte.style?.spacing };
    if (v && COTES.every((k) => !sp[k])) COTES.forEach((k) => { sp[k] = REMPLISSAGE_CONTENEUR; });
    if (!v && COTES.every((k) => sp[k] === REMPLISSAGE_CONTENEUR)) COTES.forEach((k) => { sp[k] = ""; });
    setTree((tr) => updateNodeStyle(tr, colTexte.id, { background: { ...colTexte.style?.background, color: v || undefined }, spacing: sp }));
  };

  return (
    <div className="space-y-4 pb-5 mb-1 border-b border-gray-200">
      {ligne && colImage && colTexte && (
        <>
          <Choix label={t("Position de l'image sur ordinateur")} valeur={ti!.imageAvant ? "gauche" : "droite"}
            options={[["gauche", "Image en premier"], ["droite", "Image en second"]]}
            onChange={(v) => setTree((tr) => moveNode(tr, colImage.id, ligne.id, v === "gauche" ? 0 : 1))} />
          <Choix label={t("Hauteur de l'image")} valeur={section.config?.hauteurImage ?? ""}
            options={[["adapter", "Adapter à l'image"], ["petite", "Petite"], ["moyenne", "Moyenne"], ["grande", "Grande"]]}
            onChange={(v) => setSection({ hauteurImage: v })} />
          <Choix label={t("Largeur de l'image sur ordinateur")} valeur={tailleImage}
            options={[["petite", "Petite"], ["moyenne", "Moyenne"], ["grande", "Grande"]]}
            onChange={(v) => {
              const p = LARGEURS[v as keyof typeof LARGEURS];
              setTree((tr) => updateNodeStyle(updateNodeStyle(tr, colImage.id, { width: largeur(p) }), colTexte.id, { width: largeur(100 - p) }));
            }} />
          <Choix label={t("Position du contenu sur ordinateur")} valeur={colTexte.config?.position ?? "haut"}
            options={[["haut", "Haut"], ["milieu", "Milieu"], ["bas", "Bas"]]}
            onChange={(v) => setTree((tr) => updateNodeConfig(tr, colTexte.id, { position: v }))} />
          <Choix label={t("Disposition du contenu")} valeur={section.config?.chevauchement ? "oui" : "non"}
            options={[["non", "Sans chevauchement"], ["oui", "Chevauchement"]]}
            onChange={(v) => setSection({ chevauchement: v === "oui" })} />
          <Choix label={t("Alignement du contenu sur ordinateur")} valeur={align}
            options={[["left", "Gauche"], ["center", "Centre"], ["right", "Droite"]]}
            onChange={(v) => setTree((tr) => blocsTexte.filter((b) => b.config && "align" in b.config).reduce((acc, b) => updateNodeConfig(acc, b.id, { align: v }), tr))} />
          <Choix label={t("Alignement du contenu sur mobile")} valeur={section.config?.alignMobile ?? align}
            options={[["left", "Gauche"], ["center", "Centre"], ["right", "Droite"]]}
            onChange={(v) => setSection({ alignMobile: v })} />
          <div>
            <p className="text-[14px] font-semibold text-gray-600 mb-1.5">{t("Couleur du conteneur")}</p>
            <CouleurEffacable value={fondConteneur} onChange={majConteneur} />
          </div>
        </>
      )}
      <div>
        <p className="text-[13px] font-bold text-gray-500 uppercase tracking-wide mb-2.5">{t("Couleurs de la section")}</p>
        <div className="space-y-2.5">
          {([["fond", "Arrière-plan"], ["texte", "Texte"], ["accent", "Arrière-plan des boutons"], ["texteBouton", "Texte des boutons"], ["contourBouton", "Boutons contour"]] as const).map(([k, label]) => (
            <div key={k}>
              <p className="text-[14px] font-semibold text-gray-600 mb-1.5">{t(label)}</p>
              <CouleurEffacable value={couleurs[k]} onChange={(v) => setCouleur(k, v)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Choix({ label, valeur, options, onChange }: { label: string; valeur: string; options: [string, string][]; onChange: (v: string) => void }) {
  const t = useT();
  return (
    <div>
      <p className="text-[14px] font-semibold text-gray-600 mb-1.5">{t(label)}</p>
      <div className="flex rounded-md border border-gray-200 p-0.5">
        {options.map(([v, l]) => (
          <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={valeur === v}
            className={`flex-1 py-1.5 rounded text-[13.5px] font-medium transition-colors ${valeur === v ? "bg-[#FFF1D6] text-[#C77C0A]" : "text-gray-500 hover:text-gray-800"}`}>
            {t(l)}
          </button>
        ))}
      </div>
    </div>
  );
}
