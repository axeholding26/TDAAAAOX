"use client";

import { useState } from "react";
import { Copy, Trash2, X, Monitor, Tablet, Smartphone, ArrowUp, ArrowDown, Plus } from "lucide-react";
import type { BlockNode, BlockStyleOverrides } from "@/lib/theme-config";
import { genBlockId } from "@/lib/block-tree";

type Tab = "contenu" | "style" | "avance";
type Device = "desktop" | "tablet" | "mobile";

const DEVICE_LABEL: Record<Device, string> = { desktop: "Desktop", tablet: "Tablette", mobile: "Mobile" };

const LABELS: Record<string, string> = {
  section: "Section", row: "Ligne", column: "Colonne",
  features: "Avantages", stats: "Statistiques", countdown: "Compte à rebours", brands: "Logos",
  video: "Vidéo", gallery: "Galerie", "social-proof": "Preuve sociale", "cta-band": "Bande CTA",
  richtext: "Texte riche", spacer: "Espacement", tabs: "Onglets", columns: "Colonnes",
  heading: "Titre", text: "Texte", image: "Image", button: "Bouton", products: "Produits",
  "embed-html": "Design importé",
};

const CHAMPS_LONG_TEXTE = new Set(["texte", "description", "sousTitre"]);

// Champs à choix fermé connus, propres aux 5 atomes (vague 2) — rendus en
// <select> plutôt qu'en texte libre pour éviter une valeur invalide tapée à
// la main. Volontairement scopés par "type.champ" (pas juste par nom de
// champ) : plusieurs des 12 blocs existants ont aussi un champ "style" mais
// avec des valeurs valides différentes (ex. brands.style="carousel") — les
// mélanger casserait leur édition actuelle, qui reste en texte libre.
const CHAMPS_ENUM: Record<string, Array<{ value: string; label: string }>> = {
  "heading.niveau": [{ value: "h1", label: "H1 — très grand" }, { value: "h2", label: "H2 — grand" }, { value: "h3", label: "H3 — moyen" }, { value: "h4", label: "H4 — petit" }],
  "heading.align": [{ value: "left", label: "Gauche" }, { value: "center", label: "Centré" }, { value: "right", label: "Droite" }],
  "text.align": [{ value: "left", label: "Gauche" }, { value: "center", label: "Centré" }, { value: "right", label: "Droite" }],
  "button.style": [{ value: "primary", label: "Plein" }, { value: "outline", label: "Contour" }, { value: "ghost", label: "Discret" }],
  "button.taille": [{ value: "sm", label: "Petit" }, { value: "md", label: "Moyen" }, { value: "lg", label: "Grand" }],
  "button.align": [{ value: "left", label: "Gauche" }, { value: "center", label: "Centré" }, { value: "right", label: "Droite" }],
  "image.ratio": [{ value: "auto", label: "Automatique" }, { value: "square", label: "Carré" }, { value: "video", label: "16:9" }, { value: "portrait", label: "Portrait" }],
  "products.tri": [{ value: "recent", label: "Plus récents" }, { value: "ventes", label: "Meilleures ventes" }, { value: "featured", label: "Mis en avant" }],
};

interface Props {
  node: BlockNode;
  device: Device;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChangeStyle: (patch: Partial<BlockStyleOverrides>) => void;
  onChangeResponsiveStyle: (breakpoint: "tablet" | "mobile", patch: Partial<BlockStyleOverrides>) => void;
  onChangeConfig: (patch: Record<string, any>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function BlockStylePanel({ node, device, canMoveUp, canMoveDown, onMoveUp, onMoveDown, onChangeStyle, onChangeResponsiveStyle, onChangeConfig, onDuplicate, onDelete, onClose }: Props) {
  const [tab, setTab] = useState<Tab>(node.type === "section" || node.type === "row" || node.type === "column" ? "style" : "contenu");
  const estConteneur = node.type === "section" || node.type === "row" || node.type === "column";
  const style = node.style || {};
  const visibility = style.visibility || {};

  // Vague 3 — le panneau Style édite toujours l'appareil actuellement
  // affiché dans le canevas (barre d'outils Desktop/Tablette/Mobile déjà
  // existante) : en Desktop on modifie node.style directement (la base),
  // en Tablette/Mobile on modifie une surcharge qui hérite du reste.
  const styleAppareil: BlockStyleOverrides = device === "desktop" ? style : (style.responsive?.[device] ?? {});
  const handleStyleChange = (patch: Partial<BlockStyleOverrides>) => {
    if (device === "desktop") onChangeStyle(patch);
    else onChangeResponsiveStyle(device, patch);
  };

  return (
    <div className="w-[340px] flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0 gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-gray-500 uppercase tracking-wide">{LABELS[node.type] || node.type}</p>
          <p className="text-[12px] text-gray-400 font-mono truncate max-w-[180px]">{node.id}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Position — boutons ↑/↓ façon Shopify : alternative fiable au
              glisser-déposer pour réordonner un bloc parmi ses frères
              (grip du canevas/plan de page toujours disponible en plus). */}
          <button onClick={onMoveUp} disabled={!canMoveUp} title="Monter" className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded disabled:opacity-30 disabled:hover:text-gray-400">
            <ArrowUp size={15} />
          </button>
          <button onClick={onMoveDown} disabled={!canMoveDown} title="Descendre" className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded disabled:opacity-30 disabled:hover:text-gray-400">
            <ArrowDown size={15} />
          </button>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded"><X size={15} /></button>
        </div>
      </div>

      <div className="flex border-b border-gray-200 flex-shrink-0">
        {(!estConteneur ? [["contenu", "Contenu"], ["style", "Style"], ["avance", "Avancé"]] : [["style", "Style"], ["avance", "Avancé"]]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as Tab)} className={`flex-1 py-2.5 text-[14px] font-semibold transition-colors ${tab === id ? "text-[#F5A623] border-b-2 border-[#F5A623]" : "text-gray-400 hover:text-gray-600"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3.5 space-y-5">
        {tab === "contenu" && node.type === "embed-html" && (
          <p className="text-[14px] text-gray-500 leading-relaxed bg-gray-50 border border-gray-200 rounded-lg p-3.5">
            Ton design AXSO Design importé tel quel — pas encore décomposable en blocs individuels. Utilise l'onglet <strong>Style</strong> pour l'espacement/la visibilité, ou <strong>déplace</strong>-le et ajoute de nouveaux blocs autour depuis la bibliothèque à gauche.
          </p>
        )}
        {tab === "contenu" && !estConteneur && node.type !== "embed-html" && <ContentEditor nodeType={node.type} config={node.config || {}} onChange={onChangeConfig} />}
        {tab === "style" && (
          <>
            {device !== "desktop" && (
              <p className="text-[13px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-2">
                Modification pour <strong>{DEVICE_LABEL[device]}</strong> uniquement — hérite du style Desktop pour tout ce qui n'est pas changé ici. Bascule l'aperçu en Desktop pour éditer le style de base.
              </p>
            )}
            <StyleEditor style={styleAppareil} onChange={handleStyleChange} />
          </>
        )}
        {tab === "avance" && (
          <div className="space-y-4">
            <Field label="Classe CSS personnalisée">
              <input type="text" value={style.customClass || ""} onChange={(e) => onChangeStyle({ customClass: e.target.value })}
                className="w-full px-2.5 py-2 text-[14px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none" placeholder="ma-classe" />
            </Field>
            <Field label="Visibilité par appareil">
              <div className="flex gap-2">
                {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as [keyof typeof visibility, any][]).map(([bp, Icon]) => {
                  const visible = visibility[bp] !== false;
                  return (
                    <button
                      key={bp}
                      onClick={() => onChangeStyle({ visibility: { ...visibility, [bp]: !visible } })}
                      title={visible ? `Visible sur ${DEVICE_LABEL[bp as Device]} — clique pour masquer` : `Masqué sur ${DEVICE_LABEL[bp as Device]} — clique pour afficher`}
                      className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-md border text-[13px] font-medium transition-colors ${visible ? "border-gray-200 text-gray-600 hover:border-gray-300" : "border-red-200 bg-red-50 text-red-500"}`}
                    >
                      <Icon size={14} />
                    </button>
                  );
                })}
              </div>
            </Field>
            <div className="flex gap-2 pt-2">
              <button onClick={onDuplicate} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-gray-200 text-[14px] font-medium text-gray-600 hover:border-gray-300">
                <Copy size={14} /> Dupliquer
              </button>
              <button onClick={onDelete} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-red-200 text-[14px] font-medium text-red-500 hover:bg-red-50">
                <Trash2 size={14} /> Supprimer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[14px] font-semibold text-gray-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

// Noms de champs lisibles pour les types de blocs sans éditeur dédié
// (ContentEditor ci-dessous, générique) — sans cette table, le marchand
// voyait directement les clés JSON internes ("ctaLien", "ctaTexte") comme
// libellés, illisibles pour qui ne connaît pas le schéma de config.
const LABELS_CHAMPS: Record<string, string> = {
  titre: "Titre", texte: "Texte", style: "Style", ctaTexte: "Texte du bouton", ctaLien: "Lien du bouton",
  dateFin: "Date de fin", videoUrl: "URL de la vidéo", autoplay: "Lecture automatique",
  note: "Note", nbClients: "Nombre de clients", nbCommandes: "Nombre de commandes",
  layout: "Disposition", niveau: "Niveau de titre", align: "Alignement", url: "URL", alt: "Texte alternatif",
  lien: "Lien", taille: "Taille", nombre: "Nombre de produits", colonnes: "Colonnes", tri: "Tri", hauteur: "Hauteur",
};
function labelChamp(key: string): string {
  return LABELS_CHAMPS[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1");
}

function ContentEditor({ nodeType, config, onChange }: { nodeType: string; config: Record<string, any>; onChange: (patch: Record<string, any>) => void }) {
  const simples = Object.entries(config).filter(([, v]) => typeof v === "string" || typeof v === "number" || typeof v === "boolean");
  const complexes = Object.entries(config).filter(([, v]) => typeof v === "object" && v !== null);

  return (
    <div className="space-y-4">
      {simples.map(([key, value]) => {
        const options = CHAMPS_ENUM[`${nodeType}.${key}`];
        return (
          <Field key={key} label={labelChamp(key)}>
            {typeof value === "boolean" ? (
              <button onClick={() => onChange({ [key]: !value })} className={`w-10 h-6 rounded-full relative transition-colors ${value ? "bg-[#F5A623]" : "bg-gray-200"}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${value ? "left-4" : "left-0.5"}`} />
              </button>
            ) : options ? (
              <select value={value as string} onChange={(e) => onChange({ [key]: e.target.value })}
                className="w-full px-2.5 py-2 text-[14px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none">
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : CHAMPS_LONG_TEXTE.has(key) ? (
              <textarea value={value as string} onChange={(e) => onChange({ [key]: e.target.value })} rows={3}
                className="w-full px-2.5 py-2 text-[14px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none resize-none" />
            ) : (
              <input type={typeof value === "number" ? "number" : "text"} value={value as any} onChange={(e) => onChange({ [key]: typeof value === "number" ? Number(e.target.value) : e.target.value })}
                className="w-full px-2.5 py-2 text-[14px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none" />
            )}
          </Field>
        );
      })}
      {complexes.map(([key, value]) => (
        Array.isArray(value)
          ? <ArrayField key={key} fieldKey={key} value={value} onChange={onChange} />
          : <JsonField key={key} fieldKey={key} value={value} onChange={onChange} />
      ))}
      {simples.length === 0 && complexes.length === 0 && (
        <p className="text-[14px] text-gray-400">Ce bloc n'a pas de champ de contenu.</p>
      )}
    </div>
  );
}

// Éditeur de liste — ajoute/supprime/réordonne les éléments d'un tableau
// (features.items, gallery.images, brands.logos, social-proof.certifications,
// stats.items...) sans passer par du JSON brut, façon Shopify. Les éléments
// objets (ex: { icone, titre, texte }) affichent un champ par clé ; les
// éléments simples (chaînes, ex: logos/images) affichent un seul champ texte.
function ArrayField({ fieldKey, value, onChange }: { fieldKey: string; value: any[]; onChange: (patch: Record<string, any>) => void }) {
  const set = (next: any[]) => onChange({ [fieldKey]: next });
  const removeAt = (i: number) => set(value.filter((_, idx) => idx !== i));
  const moveAt = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
  };
  const addItem = () => {
    const derniere = value[value.length - 1];
    const nouveau = derniere && typeof derniere === "object"
      ? Object.fromEntries(Object.entries(derniere).map(([k, v]) => [k, k === "id" ? genBlockId("item") : typeof v === "string" ? "" : v]))
      : "";
    set([...value, nouveau]);
  };

  return (
    <div>
      <label className="block text-[14px] font-semibold text-gray-600 mb-1.5">{labelChamp(fieldKey)}</label>
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i} className="rounded-lg border border-gray-200 p-2.5 bg-gray-50/60">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-wide">#{i + 1}</span>
              <div className="flex items-center gap-0.5">
                <button onClick={() => moveAt(i, -1)} disabled={i === 0} title="Monter" className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowUp size={13} /></button>
                <button onClick={() => moveAt(i, 1)} disabled={i === value.length - 1} title="Descendre" className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowDown size={13} /></button>
                <button onClick={() => removeAt(i)} title="Supprimer" className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
              </div>
            </div>
            {typeof item === "object" && item !== null ? (
              <div className="space-y-2">
                {Object.entries(item)
                  .filter(([k, v]) => k !== "id" && (typeof v === "string" || typeof v === "number"))
                  .map(([k, v]) => (
                    <div key={k}>
                      <label className="block text-[12px] text-gray-500 mb-1">{labelChamp(k)}</label>
                      <input
                        type="text"
                        value={v as string}
                        onChange={(e) => { const next = [...value]; next[i] = { ...item, [k]: e.target.value }; set(next); }}
                        className="w-full px-2.5 py-1.5 text-[14px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none bg-white"
                      />
                    </div>
                  ))}
              </div>
            ) : (
              <input
                type="text"
                value={item as string}
                onChange={(e) => { const next = [...value]; next[i] = e.target.value; set(next); }}
                className="w-full px-2.5 py-1.5 text-[14px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none bg-white"
              />
            )}
          </div>
        ))}
      </div>
      <button onClick={addItem} className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-gray-300 text-[13px] font-semibold text-gray-500 hover:border-[#F5A623] hover:text-[#F5A623] hover:bg-[#F5A623]/5 transition-all">
        <Plus size={14} /> Ajouter un élément
      </button>
    </div>
  );
}

function JsonField({ fieldKey, value, onChange }: { fieldKey: string; value: any; onChange: (patch: Record<string, any>) => void }) {
  const [raw, setRaw] = useState(() => JSON.stringify(value, null, 2));
  const [erreur, setErreur] = useState(false);
  return (
    <Field label={`${labelChamp(fieldKey)} (édition avancée JSON)`}>
      <textarea
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          try { onChange({ [fieldKey]: JSON.parse(e.target.value) }); setErreur(false); }
          catch { setErreur(true); }
        }}
        rows={6}
        spellCheck={false}
        className={`w-full px-2 py-1.5 text-[12px] font-mono rounded-md border outline-none resize-y ${erreur ? "border-red-300" : "border-gray-200 focus:border-[#F5A623]"}`}
      />
      {erreur && <p className="text-[11px] text-red-500 mt-1">JSON invalide — non appliqué</p>}
    </Field>
  );
}

function StyleEditor({ style, onChange }: { style: BlockStyleOverrides; onChange: (patch: Partial<BlockStyleOverrides>) => void }) {
  const spacing = style.spacing || {};
  const background = style.background || {};
  const typography = style.typography || {};
  const border = style.border || {};

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[13px] font-bold text-gray-500 uppercase tracking-wide mb-2.5">Espacement</p>
        <div className="grid grid-cols-2 gap-2.5">
          {(["pt", "pb", "pl", "pr", "mt", "mb"] as const).map((k) => (
            <Field key={k} label={{ pt: "Haut (padding)", pb: "Bas (padding)", pl: "Gauche (padding)", pr: "Droite (padding)", mt: "Haut (marge)", mb: "Bas (marge)" }[k]}>
              <input type="text" value={spacing[k] || ""} onChange={(e) => onChange({ spacing: { ...spacing, [k]: e.target.value } })}
                placeholder="24px" className="w-full px-2.5 py-2 text-[14px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none" />
            </Field>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[13px] font-bold text-gray-500 uppercase tracking-wide mb-2.5">Fond</p>
        <div className="space-y-2.5">
          <Field label="Couleur">
            <input type="color" value={background.color || "#ffffff"} onChange={(e) => onChange({ background: { ...background, color: e.target.value } })} className="w-full h-9 rounded-md border border-gray-200" />
          </Field>
          <Field label="Image (URL)">
            <input type="text" value={background.image || ""} onChange={(e) => onChange({ background: { ...background, image: e.target.value } })}
              placeholder="https://..." className="w-full px-2.5 py-2 text-[14px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none" />
          </Field>
          <Field label="Dégradé CSS (prioritaire sur couleur)">
            <input type="text" value={background.gradient || ""} onChange={(e) => onChange({ background: { ...background, gradient: e.target.value } })}
              placeholder="linear-gradient(...)" className="w-full px-2.5 py-2 text-[14px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none" />
          </Field>
        </div>
      </div>

      <div>
        <p className="text-[13px] font-bold text-gray-500 uppercase tracking-wide mb-2.5">Typographie</p>
        <div className="space-y-2.5">
          <Field label="Couleur du texte">
            <input type="color" value={typography.color || "#000000"} onChange={(e) => onChange({ typography: { ...typography, color: e.target.value } })} className="w-full h-9 rounded-md border border-gray-200" />
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Taille">
              <input type="text" value={typography.taille || ""} onChange={(e) => onChange({ typography: { ...typography, taille: e.target.value } })}
                placeholder="16px" className="w-full px-2.5 py-2 text-[14px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none" />
            </Field>
            <Field label="Alignement">
              <select value={typography.align || ""} onChange={(e) => onChange({ typography: { ...typography, align: (e.target.value || undefined) as "left" | "center" | "right" | undefined } })}
                className="w-full px-2.5 py-2 text-[14px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none">
                <option value="">Hérité</option>
                <option value="left">Gauche</option>
                <option value="center">Centré</option>
                <option value="right">Droite</option>
              </select>
            </Field>
          </div>
        </div>
      </div>

      <div>
        <p className="text-[13px] font-bold text-gray-500 uppercase tracking-wide mb-2.5">Bordure</p>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Rayon">
            <input type="text" value={border.radius || ""} onChange={(e) => onChange({ border: { ...border, radius: e.target.value } })}
              placeholder="12px" className="w-full px-2.5 py-2 text-[14px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none" />
          </Field>
          <Field label="Épaisseur">
            <input type="text" value={border.width || ""} onChange={(e) => onChange({ border: { ...border, width: e.target.value } })}
              placeholder="1px" className="w-full px-2.5 py-2 text-[14px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none" />
          </Field>
        </div>
        <Field label="Couleur">
          <input type="color" value={border.color || "#e5e7eb"} onChange={(e) => onChange({ border: { ...border, color: e.target.value } })} className="w-full h-9 rounded-md border border-gray-200 mt-2.5" />
        </Field>
      </div>

      <Field label="Largeur (colonnes dans une ligne)">
        <input type="text" value={style.width || ""} onChange={(e) => onChange({ width: e.target.value })}
          placeholder="50%" className="w-full px-2.5 py-2 text-[14px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none" />
      </Field>
    </div>
  );
}
