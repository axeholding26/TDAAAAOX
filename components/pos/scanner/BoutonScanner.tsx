"use client";
// Bouton « Scanner » du poste : ouvre la caméra de l'ordinateur ou de la
// tablette en lecture CONTINUE et émet chaque code sur le bus de scans
// (surScan), source « camera ». L'écran qui écoute décide quoi en faire.
//
//   <BoutonScanner contexte="inventaire" />
//
// Props :
// - contexte        : contexte donné aux scans (défaut "vente").
// - libelle         : texte du bouton (défaut « Scanner »).
// - variante, taille, large, className : transmis au Bouton du kit.
// - fermerApresScan : true = la fenêtre se ferme au premier code lu (défaut false : scan en continu).
// - antiRebondMs    : délai avant de relire un même code resté devant l'objectif (défaut 1 500 ms).
// - tracer          : false = ne pas tracer les scans côté serveur (défaut true).
// - caisseId        : caisse de travail, pour la trace.
// - onScan(scan)    : appelé après chaque émission ({ code, source, scanId, contexte }).
// - disabled
import { useState } from "react";
import { ScanLine } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { Bouton, Modale, type TailleBouton, type VarianteBouton } from "@/components/pos/ui";
import type { ScanEmis } from "@/lib/pos/client/bus";
import type { ContexteScan } from "@/lib/pos/types";
import { LecteurCamera } from "./LecteurCamera";
import { emettreLocal } from "./source";

export default function BoutonScanner({ contexte = "vente", libelle = "Scanner", variante = "sombre", taille, large, className, fermerApresScan = false, antiRebondMs, tracer, caisseId, onScan, disabled }: {
  contexte?: ContexteScan; libelle?: string; variante?: VarianteBouton; taille?: TailleBouton; large?: boolean; className?: string;
  fermerApresScan?: boolean; antiRebondMs?: number; tracer?: boolean; caisseId?: string | null; onScan?: (scan: ScanEmis) => void; disabled?: boolean;
}) {
  const t = useT();
  const [ouvert, setOuvert] = useState(false);
  const [lus, setLus] = useState<string[]>([]);

  const surCode = (code: string) => {
    const scan = emettreLocal(code, "camera", { contexte, tracer, caisseId });
    setLus((l) => [scan.code, ...l].slice(0, 3));
    onScan?.(scan);
    if (fermerApresScan) setOuvert(false);
  };

  return (
    <>
      <Bouton variante={variante} taille={taille} large={large} className={className} disabled={disabled} icone={<ScanLine size={16} aria-hidden />} onClick={() => { setLus([]); setOuvert(true); }}>
        {t(libelle)}
      </Bouton>
      <Modale
        ouverte={ouvert} onFermer={() => setOuvert(false)} titre="Scanner un code-barres" taille="sm"
        description={fermerApresScan ? "Placez le code-barres dans le cadre." : "Placez le code-barres dans le cadre. La lecture est continue : passez les articles l'un après l'autre."}
        actions={<Bouton variante="secondaire" onClick={() => setOuvert(false)}>{t("Terminer")}</Bouton>}
      >
        <LecteurCamera actif={ouvert} onCode={surCode} antiRebondMs={antiRebondMs} className="aspect-[4/3] w-full" />
        <div className="mt-3 min-h-11 text-[12.5px] text-[#666666]" aria-live="polite">
          {lus.length ? (
            <p><span className="font-bold text-[#111111]">{t("Dernier code lu :")}</span> <span className="font-mono">{lus[0]}</span>{lus.length > 1 && <span className="text-[#AAAAAA]"> · {lus.slice(1).join(" · ")}</span>}</p>
          ) : (
            <p>{t("Aucun code lu pour l'instant.")}</p>
          )}
        </div>
      </Modale>
    </>
  );
}
