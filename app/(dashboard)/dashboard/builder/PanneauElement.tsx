"use client";

// Panneau de droite « élément sélectionné » — commun aux Constructeurs
// boutique (éléments d'un design) et digital (éléments de la vitrine). Chaque
// champ écrit dans ElementStyles (lib/element-styles.ts), rendu en CSS de la
// même façon dans l'aperçu et sur la boutique : aucune modification factice.
// L'appareil affiché dans l'aperçu décide de ce qu'on édite : ordinateur =
// style de base (+ survol), tablette/mobile = surcharge pour cet écran.
import { useState } from "react";
import { X, ArrowUpToLine, RotateCcw, Trash2, AlignLeft, AlignCenter, AlignRight, AlignJustify, Monitor, Tablet, Smartphone } from "lucide-react";
import { FONTS } from "@/lib/theme-fonts";
import type { ElementStyle, EtatStyle } from "@/lib/element-styles";

type Device = "desktop" | "tablet" | "mobile";

export interface ContenuElement {
  texte?: string | null;
  lien?: string | null;
  image?: string | null;
  alt?: string | null;
  placeholder?: string | null;
  texteEnLigne?: boolean; // texte mis en forme : modifiable directement dans l'aperçu
}

interface Props {
  titre: string;
  sousTitre?: string;
  contenu?: ContenuElement;
  onContenu?: (patch: ContenuElement) => void;
  styles: Partial<Record<EtatStyle, ElementStyle>>;
  device: Device;
  onStyle: (etat: EtatStyle, patch: Partial<ElementStyle>) => void;
  onReinitialiser: () => void;
  onParent?: () => void;
  onSupprimer?: () => void;
  onClose: () => void;
}

const APPAREIL: Record<Device, { etat: EtatStyle; label: string; Icon: typeof Monitor }> = {
  desktop: { etat: "base", label: "Ordinateur", Icon: Monitor },
  tablet: { etat: "tablet", label: "Tablette", Icon: Tablet },
  mobile: { etat: "mobile", label: "Mobile", Icon: Smartphone },
};

export function PanneauElement({ titre, sousTitre, contenu, onContenu, styles, device, onStyle, onReinitialiser, onParent, onSupprimer, onClose }: Props) {
  const [survol, setSurvol] = useState(false);
  const etat: EtatStyle = device === "desktop" && survol ? "hover" : APPAREIL[device].etat;
  const s = styles[etat] ?? {};
  const maj = (patch: Partial<ElementStyle>) => onStyle(etat, patch);
  const aContenu = contenu && Object.values(contenu).some((v) => v != null && v !== false);
  const { Icon: IconeAppareil } = APPAREIL[device];

  return (
    <aside aria-label={`Réglages : ${titre}`} className="w-[340px] flex-shrink-0 flex flex-col bg-white border-l border-[#E5E5E5] text-[#111111]">
      <div className="flex items-start justify-between gap-2 px-4 py-3.5 border-b border-[#EEEEEE] flex-shrink-0">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold truncate">{titre}</p>
          {sousTitre && <p className="text-[12.5px] text-[#888888] truncate">{sousTitre}</p>}
        </div>
        <button onClick={onClose} aria-label="Fermer" className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-[#888888] hover:text-[#111111] hover:bg-[#F5F5F5]"><X size={17} /></button>
      </div>

      <div className="px-4 py-2.5 border-b border-[#EEEEEE] flex-shrink-0 space-y-2">
        <p className="flex items-center gap-1.5 text-[12.5px] text-[#666666]">
          <IconeAppareil size={14} /> Réglages pour <strong className="text-[#111111]">{APPAREIL[device].label}</strong>
          {device !== "desktop" && <span className="text-[#999999]">(le reste hérite de l'ordinateur)</span>}
        </p>
        {device === "desktop" && (
          <div role="tablist" className="grid grid-cols-2 p-0.5 rounded-lg bg-[#F3F3F3]">
            {[["Normal", false], ["Au survol", true]].map(([label, v]) => (
              <button key={String(label)} role="tab" aria-selected={survol === v} onClick={() => setSurvol(v as boolean)}
                className={`h-8 rounded-md text-[13px] font-medium transition-all ${survol === v ? "bg-white shadow-sm text-[#111111]" : "text-[#777777] hover:text-[#111111]"}`}>
                {label as string}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-6">
        {aContenu && etat === "base" && onContenu && (
          <Groupe titre="Contenu">
            {contenu!.texteEnLigne && <p className="text-[13px] leading-relaxed text-[#666666] bg-[#F7F7F8] rounded-lg px-3 py-2.5">Ce texte contient une mise en forme : <strong className="text-[#111111]">clique dessus dans l'aperçu</strong> pour le modifier directement.</p>}
            {contenu!.texte != null && <Champ label="Texte"><textarea value={contenu!.texte} rows={3} onChange={(e) => onContenu({ texte: e.target.value })} className={INPUT + " h-auto py-2 resize-y"} /></Champ>}
            {contenu!.lien != null && <Champ label="Lien (URL ou page)"><input value={contenu!.lien} onChange={(e) => onContenu({ lien: e.target.value })} placeholder="/ma-boutique/produits" className={INPUT} /></Champ>}
            {contenu!.image != null && <Champ label="Image (URL)"><input value={contenu!.image} onChange={(e) => onContenu({ image: e.target.value })} placeholder="https://…" className={INPUT} /></Champ>}
            {contenu!.alt != null && <Champ label="Texte alternatif"><input value={contenu!.alt} onChange={(e) => onContenu({ alt: e.target.value })} className={INPUT} /></Champ>}
            {contenu!.placeholder != null && <Champ label="Texte indicatif"><input value={contenu!.placeholder} onChange={(e) => onContenu({ placeholder: e.target.value })} className={INPUT} /></Champ>}
          </Groupe>
        )}

        <Groupe titre="Typographie">
          <Champ label="Police">
            <select value={s.police ?? ""} onChange={(e) => maj({ police: e.target.value })} className={INPUT}>
              <option value="">Police du design</option>
              {[...new Set(FONTS.map((f) => f.cat))].map((cat) => (
                <optgroup key={cat} label={cat}>{FONTS.filter((f) => f.cat === cat).map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}</optgroup>
              ))}
            </select>
          </Champ>
          <div className="grid grid-cols-2 gap-2.5">
            <Champ label="Taille"><Mesure value={s.taille} onChange={(v) => maj({ taille: v })} placeholder="16px" /></Champ>
            <Champ label="Graisse">
              <select value={s.graisse ?? ""} onChange={(e) => maj({ graisse: e.target.value })} className={INPUT}>
                <option value="">Du design</option>
                {[["300", "Fine"], ["400", "Normale"], ["500", "Moyenne"], ["600", "Semi-grasse"], ["700", "Grasse"], ["800", "Très grasse"], ["900", "Noire"]].map(([v, l]) => <option key={v} value={v}>{l} ({v})</option>)}
              </select>
            </Champ>
            <Champ label="Interligne"><Mesure value={s.interligne} onChange={(v) => maj({ interligne: v })} placeholder="1.5" /></Champ>
            <Champ label="Espacement"><Mesure value={s.espacementLettres} onChange={(v) => maj({ espacementLettres: v })} placeholder="0.02em" /></Champ>
          </div>
          <Champ label="Casse">
            <select value={s.casse ?? ""} onChange={(e) => maj({ casse: (e.target.value || undefined) as ElementStyle["casse"] })} className={INPUT}>
              <option value="">Du design</option><option value="none">Normale</option><option value="uppercase">MAJUSCULES</option><option value="lowercase">minuscules</option><option value="capitalize">Première Lettre</option>
            </select>
          </Champ>
          <Champ label="Alignement">
            <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-[#F3F3F3]">
              {([["left", AlignLeft, "Gauche"], ["center", AlignCenter, "Centré"], ["right", AlignRight, "Droite"], ["justify", AlignJustify, "Justifié"]] as const).map(([v, Icon, l]) => (
                <button key={v} title={l} aria-label={l} aria-pressed={s.alignement === v} onClick={() => maj({ alignement: s.alignement === v ? undefined : v })}
                  className={`h-8 flex items-center justify-center rounded-md transition-all ${s.alignement === v ? "bg-white shadow-sm text-[#111111]" : "text-[#777777] hover:text-[#111111]"}`}>
                  <Icon size={15} />
                </button>
              ))}
            </div>
          </Champ>
          <Champ label="Couleur du texte"><Couleur value={s.couleur} onChange={(v) => maj({ couleur: v })} /></Champ>
        </Groupe>

        <Groupe titre="Arrière-plan">
          <Champ label="Couleur de fond"><Couleur value={s.fond} onChange={(v) => maj({ fond: v })} /></Champ>
          <Champ label="Dégradé (prioritaire)"><input value={s.degrade ?? ""} onChange={(e) => maj({ degrade: e.target.value })} placeholder="linear-gradient(135deg, #F5A623, #E8590C)" className={INPUT} /></Champ>
        </Groupe>

        <Groupe titre="Bordure">
          <div className="grid grid-cols-2 gap-2.5">
            <Champ label="Épaisseur"><Mesure value={s.bordureEpaisseur} onChange={(v) => maj({ bordureEpaisseur: v })} placeholder="1px" /></Champ>
            <Champ label="Arrondi"><Mesure value={s.rayon} onChange={(v) => maj({ rayon: v })} placeholder="8px" /></Champ>
          </div>
          <Champ label="Couleur de bordure"><Couleur value={s.bordureCouleur} onChange={(v) => maj({ bordureCouleur: v })} /></Champ>
        </Groupe>

        <Groupe titre="Espacements">
          <Quatre label="Intérieur (padding)" valeurs={[s.paddingHaut, s.paddingDroite, s.paddingBas, s.paddingGauche]}
            onChange={([h, d, b, g]) => maj({ paddingHaut: h, paddingDroite: d, paddingBas: b, paddingGauche: g })} />
          <Quatre label="Extérieur (marges)" valeurs={[s.margeHaut, s.margeDroite, s.margeBas, s.margeGauche]}
            onChange={([h, d, b, g]) => maj({ margeHaut: h, margeDroite: d, margeBas: b, margeGauche: g })} />
        </Groupe>

        <Groupe titre="Dimensions">
          <div className="grid grid-cols-3 gap-2">
            <Champ label="Largeur"><Mesure value={s.largeur} onChange={(v) => maj({ largeur: v })} placeholder="auto" /></Champ>
            <Champ label="Larg. max"><Mesure value={s.largeurMax} onChange={(v) => maj({ largeurMax: v })} placeholder="100%" /></Champ>
            <Champ label="Hauteur"><Mesure value={s.hauteur} onChange={(v) => maj({ hauteur: v })} placeholder="auto" /></Champ>
          </div>
        </Groupe>

        {etat !== "hover" && (
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="text-[14px]">Masquer {device === "desktop" ? "partout" : `sur ${APPAREIL[device].label.toLowerCase()}`}</span>
            <input type="checkbox" checked={!!s.masque} onChange={(e) => maj({ masque: e.target.checked })} className="w-4 h-4 accent-[#F5A623]" />
          </label>
        )}

        <div className="space-y-2 pt-1">
          {onParent && <Action onClick={onParent} Icon={ArrowUpToLine}>Sélectionner le bloc parent</Action>}
          <Action onClick={onReinitialiser} Icon={RotateCcw}>Réinitialiser le style</Action>
          {onSupprimer && <Action onClick={onSupprimer} Icon={Trash2} danger>Supprimer l'élément</Action>}
        </div>
      </div>
    </aside>
  );
}

const INPUT = "w-full h-9 px-2.5 text-[14px] rounded-lg border border-[#E0E0E0] bg-white text-[#111111] placeholder:text-[#BBBBBB] outline-none focus:border-[#F5A623] focus:ring-2 focus:ring-[#F5A623]/20";

function Groupe({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <p className="text-[12.5px] font-semibold uppercase tracking-wide text-[#999999]">{titre}</p>
      {children}
    </section>
  );
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[13px] text-[#555555] mb-1">{label}</span>
      {children}
    </label>
  );
}

// Valeur CSS libre ; un nombre seul reçoit « px » (ex. « 18 » → « 18px »), sauf l'interligne.
function Mesure({ value, onChange, placeholder }: { value?: string; onChange: (v: string) => void; placeholder: string }) {
  const [brouillon, setBrouillon] = useState<string | null>(null);
  const valider = (v: string) => { setBrouillon(null); onChange(/^\d+(\.\d+)?$/.test(v.trim()) && placeholder !== "1.5" ? `${v.trim()}px` : v.trim()); };
  return (
    <input value={brouillon ?? value ?? ""} placeholder={placeholder} className={INPUT}
      onChange={(e) => setBrouillon(e.target.value)} onBlur={(e) => valider(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") valider((e.target as HTMLInputElement).value); }} />
  );
}

function Couleur({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="relative w-9 h-9 flex-shrink-0 rounded-lg border border-[#E0E0E0] overflow-hidden" style={{ background: value || "repeating-conic-gradient(#EEE 0 25%, #FFF 0 50%) 0 0 / 10px 10px" }}>
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value ?? "") ? value : "#000000"} onChange={(e) => onChange(e.target.value)} aria-label="Choisir une couleur" className="absolute inset-0 opacity-0 cursor-pointer" />
      </span>
      <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="Couleur du design" className={INPUT} />
      {value && <button onClick={() => onChange("")} aria-label="Retirer la couleur" title="Revenir à la couleur du design" className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-[#999999] hover:text-[#111111] hover:bg-[#F5F5F5]"><X size={15} /></button>}
    </div>
  );
}

function Quatre({ label, valeurs, onChange }: { label: string; valeurs: (string | undefined)[]; onChange: (v: (string | undefined)[]) => void }) {
  const noms = ["Haut", "Droite", "Bas", "Gauche"];
  return (
    <div>
      <span className="block text-[13px] text-[#555555] mb-1">{label}</span>
      <div className="grid grid-cols-4 gap-1.5">
        {noms.map((n, i) => (
          <label key={n} className="block">
            <Mesure value={valeurs[i]} placeholder="0" onChange={(v) => { const next = [...valeurs]; next[i] = v; onChange(next); }} />
            <span className="block text-center text-[11px] text-[#999999] mt-0.5">{n}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function Action({ onClick, Icon, danger, children }: { onClick: () => void; Icon: typeof X; danger?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`w-full h-10 flex items-center justify-center gap-2 rounded-lg border text-[14px] font-medium transition-colors ${
      danger ? "border-[#FECACA] text-[#DC2626] hover:bg-[#FEF2F2]" : "border-[#E5E5E5] text-[#444444] hover:bg-[#F7F7F7]"}`}>
      <Icon size={15} /> {children}
    </button>
  );
}
