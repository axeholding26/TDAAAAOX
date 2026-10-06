"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Copy, Trash2, X, Monitor, Tablet, Smartphone, ArrowUp, ArrowDown, Plus, Link2, FileText, FolderOpen, Search, ShoppingBag } from "lucide-react";
import type { BlockNode, BlockStyleOverrides } from "@/lib/theme-config";
import { genBlockId } from "@/lib/block-tree";
import { FONTS } from "@/lib/theme-fonts";
import { MediaUpload } from "@/components/ui/MediaUpload";
import { useT } from "@/components/I18nProvider";
import { PAGES } from "../pages/pages";

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
  "text.style": [{ value: "corps", label: "Corps de texte" }, { value: "sous-titre", label: "Sous-titre" }, { value: "majuscules", label: "Légende en majuscules" }],
  "text.align": [{ value: "left", label: "Gauche" }, { value: "center", label: "Centré" }, { value: "right", label: "Droite" }],
  "button.style": [{ value: "primary", label: "Plein" }, { value: "outline", label: "Contour" }, { value: "ghost", label: "Discret" }],
  "button.taille": [{ value: "sm", label: "Petit" }, { value: "md", label: "Moyen" }, { value: "lg", label: "Grand" }],
  "button.align": [{ value: "left", label: "Gauche" }, { value: "center", label: "Centré" }, { value: "right", label: "Droite" }],
  "image.ratio": [{ value: "auto", label: "Automatique" }, { value: "square", label: "Carré" }, { value: "video", label: "16:9" }, { value: "portrait", label: "Portrait" }],
  "products.tri": [{ value: "recent", label: "Plus récents" }, { value: "ventes", label: "Meilleures ventes" }, { value: "featured", label: "Mis en avant" }],
};

interface Props {
  node: BlockNode;
  titre?: string; // nom affiché (ex. « Bannière principale ») — défaut : type du bloc
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
  collections?: { slug: string; nom: string }[]; // destinations du sélecteur de lien
  bibliotheque?: string[]; // images déjà utilisées dans la boutique
  reglagesSection?: ReactNode; // réglages propres à une section (couleurs, Texte + Image…), en tête de Style
}

export function BlockStylePanel({ collections = [], bibliotheque = [], reglagesSection, node, titre, device, canMoveUp, canMoveDown, onMoveUp, onMoveDown, onChangeStyle, onChangeResponsiveStyle, onChangeConfig, onDuplicate, onDelete, onClose }: Props) {
  const t = useT();
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
          <p className="text-[15px] font-semibold text-[#111111] truncate max-w-[200px]">{t(titre) || t(LABELS[node.type]) || t(node.type)}</p>
          {titre && <p className="text-[12.5px] text-gray-400">{t(LABELS[node.type]) || t(node.type)}</p>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Position — boutons ↑/↓ façon Shopify : alternative fiable au
              glisser-déposer pour réordonner un bloc parmi ses frères
              (grip du canevas/plan de page toujours disponible en plus). */}
          <button onClick={onMoveUp} disabled={!canMoveUp} title={t("Monter")} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded disabled:opacity-30 disabled:hover:text-gray-400">
            <ArrowUp size={15} />
          </button>
          <button onClick={onMoveDown} disabled={!canMoveDown} title={t("Descendre")} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded disabled:opacity-30 disabled:hover:text-gray-400">
            <ArrowDown size={15} />
          </button>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded"><X size={15} /></button>
        </div>
      </div>

      <div className="flex border-b border-gray-200 flex-shrink-0">
        {(!estConteneur ? [["contenu", "Contenu"], ["style", "Style"], ["avance", "Avancé"]] : [["style", "Style"], ["avance", "Avancé"]]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as Tab)} className={`flex-1 py-2.5 text-[14px] font-semibold transition-colors ${tab === id ? "text-[#F5A623] border-b-2 border-[#F5A623]" : "text-gray-400 hover:text-gray-600"}`}>
            {t(label)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3.5 space-y-5">
        {tab === "contenu" && node.type === "embed-html" && (
          <p className="text-[14px] text-gray-500 leading-relaxed bg-gray-50 border border-gray-200 rounded-lg p-3.5">
            {t("Section issue de ton design.")}{" "}<strong>{t("Clique sur un texte dans l'aperçu")}</strong>{" "}{t("pour le modifier directement. Utilise l'onglet")}{" "}<strong>{t("Style")}</strong>{" "}{t("pour l'espacement et la visibilité, et le panneau de gauche pour la déplacer, la masquer ou la supprimer.")}
          </p>
        )}
        {tab === "contenu" && !estConteneur && node.type !== "embed-html" && <ContentEditor nodeType={node.type} config={node.config || {}} onChange={onChangeConfig} collections={collections} bibliotheque={bibliotheque} />}
        {tab === "style" && (
          <>
            {reglagesSection}
            {device !== "desktop" && (
              <p className="text-[13px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-2">
                {t("Modification pour")}{" "}<strong>{t(DEVICE_LABEL[device])}</strong>{" "}{t("uniquement — hérite du style Desktop pour tout ce qui n'est pas changé ici. Bascule l'aperçu en Desktop pour éditer le style de base.")}
              </p>
            )}
            <StyleEditor style={styleAppareil} onChange={handleStyleChange} />
          </>
        )}
        {tab === "avance" && (
          <div className="space-y-4">
            <Field label={t("Classe CSS personnalisée")}>
              <input type="text" value={style.customClass || ""} onChange={(e) => onChangeStyle({ customClass: e.target.value })}
                className="w-full px-2.5 py-2 text-[14px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none" placeholder="ma-classe" />
            </Field>
            <Field label={t("Visibilité par appareil")}>
              <div className="flex gap-2">
                {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as [keyof typeof visibility, any][]).map(([bp, Icon]) => {
                  const visible = visibility[bp] !== false;
                  return (
                    <button
                      key={bp}
                      onClick={() => onChangeStyle({ visibility: { ...visibility, [bp]: !visible } })}
                      title={visible ? t("Visible sur {0} — clique pour masquer", DEVICE_LABEL[bp as Device]) : t("Masqué sur {0} — clique pour afficher", DEVICE_LABEL[bp as Device])}
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
                <Copy size={14} />{" "}{t("Dupliquer")}
              </button>
              <button onClick={onDelete} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-red-200 text-[14px] font-medium text-red-500 hover:bg-red-50">
                <Trash2 size={14} />{" "}{t("Supprimer")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <div>
      <label className="block text-[14px] font-semibold text-gray-600 mb-1.5">{t(label)}</label>
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

function ContentEditor({ nodeType, config, onChange, collections, bibliotheque }: { nodeType: string; config: Record<string, any>; onChange: (patch: Record<string, any>) => void; collections: { slug: string; nom: string }[]; bibliotheque: string[] }) {
  const t = useT();
  // Choix fermés absents d'un bloc créé avant leur ajout : affichés avec leur
  // première valeur (celle du rendu par défaut).
  const manquants = Object.entries(CHAMPS_ENUM).filter(([k]) => k.startsWith(`${nodeType}.`) && !(k.slice(nodeType.length + 1) in config))
    .map(([k, opts]) => [k.slice(nodeType.length + 1), opts[0].value] as [string, string]);
  const simples = [...Object.entries(config), ...manquants].filter(([, v]) => typeof v === "string" || typeof v === "number" || typeof v === "boolean");
  const complexes = Object.entries(config).filter(([, v]) => typeof v === "object" && v !== null);

  return (
    <div className="space-y-4">
      {simples.map(([key, value]) => {
        const options = CHAMPS_ENUM[`${nodeType}.${key}`];
        return (
          <Field key={key} label={labelChamp(key)}>
            {nodeType === "image" && key === "url" ? (
              <ChampImage value={value as string} onChange={(url) => onChange({ url })} bibliotheque={bibliotheque} />
            ) : (key === "lien" || key === "ctaLien") && typeof value === "string" ? (
              <ChampLien value={value} onChange={(v) => onChange({ [key]: v })} collections={collections} />
            ) : typeof value === "boolean" ? (
              <button onClick={() => onChange({ [key]: !value })} className={`w-10 h-6 rounded-full relative transition-colors ${value ? "bg-[#F5A623]" : "bg-gray-200"}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${value ? "left-4" : "left-0.5"}`} />
              </button>
            ) : options ? (
              <select value={value as string} onChange={(e) => onChange({ [key]: e.target.value })}
                className="w-full px-2.5 py-2 text-[14px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none">
                {options.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
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
        <p className="text-[14px] text-gray-400">{t("Ce bloc n'a pas de champ de contenu.")}</p>
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
  const t = useT();
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
      <label className="block text-[14px] font-semibold text-gray-600 mb-1.5">{t(labelChamp(fieldKey))}</label>
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i} className="rounded-lg border border-gray-200 p-2.5 bg-gray-50/60">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-wide">#{i + 1}</span>
              <div className="flex items-center gap-0.5">
                <button onClick={() => moveAt(i, -1)} disabled={i === 0} title={t("Monter")} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowUp size={13} /></button>
                <button onClick={() => moveAt(i, 1)} disabled={i === value.length - 1} title={t("Descendre")} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowDown size={13} /></button>
                <button onClick={() => removeAt(i)} title={t("Supprimer")} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
              </div>
            </div>
            {typeof item === "object" && item !== null ? (
              <div className="space-y-2">
                {Object.entries(item)
                  .filter(([k, v]) => k !== "id" && (typeof v === "string" || typeof v === "number"))
                  .map(([k, v]) => (
                    <div key={k}>
                      <label className="block text-[12px] text-gray-500 mb-1">{t(labelChamp(k))}</label>
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
        <Plus size={14} />{" "}{t("Ajouter un élément")}
      </button>
    </div>
  );
}

// Image façon Shopify : aperçu + « Importer » depuis l'appareil, l'URL
// collée reste possible pour une image déjà en ligne.
function ChampImage({ value, onChange, bibliotheque }: { value: string; onChange: (url: string) => void; bibliotheque: string[] }) {
  const t = useT();
  return (
    <div className="space-y-2">
      {value && (
        <div className="relative rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
          <img src={value} alt="" className="w-full h-36 object-contain" />
          <button type="button" onClick={() => onChange("")} className="absolute top-1.5 right-1.5 text-[12px] px-2 py-1 rounded-md bg-white/90 text-red-500 shadow-sm hover:bg-white">{t("Retirer")}</button>
        </div>
      )}
      <MediaUpload type="image" onUrl={onChange} />
      <Bibliotheque images={bibliotheque} actuelle={value} onChoisir={onChange} />
      <input type="text" value={value.startsWith("data:") ? "" : value} onChange={(e) => onChange(e.target.value)} placeholder={t("ou colle l'URL d'une image")}
        className="w-full px-2.5 py-2 text-[14px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none" />
    </div>
  );
}

// « Bibliothèque » façon Shopify : les images de Fichiers (dossier de la
// boutique), celles des produits et celles déjà utilisées dans le constructeur
// (dont les imports antérieurs au rangement par boutique).
function Bibliotheque({ images, actuelle, onChoisir }: { images: string[]; actuelle: string; onChoisir: (url: string) => void }) {
  const t = useT();
  const [ouverte, setOuverte] = useState(false);
  const [produits, setProduits] = useState<string[]>([]);
  const [fichiers, setFichiers] = useState<string[]>([]);
  useEffect(() => {
    if (!ouverte) return;
    fetch("/api/fichiers?type=image").then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setFichiers((d.fichiers ?? []).map((f: { url: string }) => f.url))).catch(() => {});
    fetch("/api/produits?limit=50").then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setProduits((d.produits ?? []).flatMap((p: { images?: string[] }) => p.images ?? []))).catch(() => {});
  }, [ouverte]);
  const toutes = [...new Set([...fichiers, ...images, ...produits])].filter(Boolean);
  return (
    <div>
      <button type="button" onClick={() => setOuverte((o) => !o)}
        className="w-full h-9 rounded-lg border border-[#D8D8D8] text-[13px] font-medium text-[#555555] hover:border-[#F5A623] hover:text-[#111111] transition-colors">
        {ouverte ? t("Fermer la bibliothèque") : t("Choisir dans la bibliothèque")}
      </button>
      {ouverte && (
        toutes.length
          ? <div className="mt-2 grid grid-cols-3 gap-1.5 max-h-56 overflow-y-auto">
              {toutes.map((url) => (
                <button key={url} type="button" onClick={() => { onChoisir(url); setOuverte(false); }}
                  className={`aspect-square rounded-md overflow-hidden border-2 ${url === actuelle ? "border-[#F5A623]" : "border-transparent hover:border-gray-300"}`}>
                  <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          : <p className="mt-2 text-[13px] text-gray-400">{t("Aucune image dans la boutique pour l'instant.")}</p>
      )}
    </div>
  );
}

// Sélecteur de lien façon Shopify : une destination de la boutique choisie
// dans la liste (page, collection) s'affiche en pastille ; sinon on colle une
// URL. La valeur stockée est relative au slug (voir hrefBoutique).
function ChampLien({ value, onChange, collections }: { value: string; onChange: (v: string) => void; collections: { slug: string; nom: string }[] }) {
  const t = useT();
  const [saisie, setSaisie] = useState<string | null>(null); // null = liste fermée
  const [produits, setProduits] = useState<{ id: string; nom: string }[]>([]);
  // Recherche dans tout le catalogue, côté serveur, à chaque frappe (après une courte pause).
  const recherche = (saisie ?? "").trim();
  useEffect(() => {
    if (saisie === null) return;
    const ctrl = new AbortController();
    const minuteur = setTimeout(() => {
      fetch(`/api/produits?limit=20&actif=true&search=${encodeURIComponent(recherche)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null)).then((d) => d && setProduits(d.produits ?? [])).catch(() => {});
    }, 250);
    return () => { clearTimeout(minuteur); ctrl.abort(); };
  }, [recherche, saisie === null]); // eslint-disable-line react-hooks/exhaustive-deps
  // Nom du produit lié, pour la pastille, même s'il n'est pas dans les résultats.
  const idProduit = value.startsWith("produits/") ? value.slice("produits/".length) : "";
  const [produitLie, setProduitLie] = useState<{ id: string; nom: string } | null>(null);
  useEffect(() => {
    if (!idProduit || produitLie?.id === idProduit) return;
    fetch(`/api/produits/${encodeURIComponent(idProduit)}`).then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.produit && setProduitLie({ id: d.produit.id, nom: d.produit.nom })).catch(() => {});
  }, [idProduit]); // eslint-disable-line react-hooks/exhaustive-deps
  const destinations = [
    ...PAGES.filter((pg) => pg.id !== "produit" && pg.id !== "commande").map((pg) => ({ lien: pg.chemin.slice(1) || "/", label: pg.label, Icon: FileText })),
    ...collections.map((c) => ({ lien: `collections/${c.slug}`, label: c.nom, Icon: FolderOpen })),
    ...[...produits, ...(produitLie && !produits.some((pr) => pr.id === produitLie.id) ? [produitLie] : [])]
      .map((pr) => ({ lien: `produits/${pr.id}`, label: pr.nom, Icon: ShoppingBag })),
  ];
  const choisie = destinations.find((d) => d.lien === value);
  const q = (saisie ?? "").trim().toLowerCase();
  // Produits déjà filtrés par le serveur ; pages et collections filtrées ici.
  const filtrees = destinations.filter((d) => !q || d.Icon === ShoppingBag || t(d.label).toLowerCase().includes(q) || d.lien.includes(q));
  const valider = (v: string) => { onChange(v); setSaisie(null); };

  if (choisie && saisie === null) {
    return (
      <div className="flex items-center gap-2 h-10 pl-2.5 pr-1 rounded-md border border-gray-200">
        <choisie.Icon size={15} className="text-gray-500 flex-shrink-0" />
        <button type="button" onClick={() => setSaisie("")} className="flex-1 min-w-0 text-left text-[14px] text-[#111111] truncate">{t(choisie.label)}</button>
        <button type="button" onClick={() => onChange("")} aria-label={t("Retirer le lien")} className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"><X size={14} /></button>
      </div>
    );
  }

  return (
    <div className="relative">
      <label className="flex items-center gap-2 h-10 px-2.5 rounded-md border border-gray-200 focus-within:border-[#F5A623]">
        {saisie === null ? <Link2 size={15} className="text-gray-400" /> : <Search size={15} className="text-gray-400" />}
        <input type="text" value={saisie ?? value} placeholder={t("Rechercher ou coller un lien")}
          onFocus={() => setSaisie(choisie ? "" : value)}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setSaisie(null); }}
          onBlur={() => { if (saisie !== null) valider(saisie.trim()); }}
          className="flex-1 min-w-0 text-[14px] outline-none bg-transparent" />
      </label>
      {saisie !== null && (
        <ul className="absolute z-20 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)] py-1">
          {filtrees.map((d) => (
            <li key={d.lien}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => valider(d.lien)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-[14px] hover:bg-[#FFF7EA] ${d.lien === value ? "font-semibold" : ""}`}>
                <d.Icon size={15} className="text-gray-500 flex-shrink-0" />
                <span className="truncate">{t(d.label)}</span>
              </button>
            </li>
          ))}
          {!filtrees.length && <li className="px-3 py-2 text-[13px] text-gray-400">{t("Entrée pour utiliser ce lien")}</li>}
        </ul>
      )}
    </div>
  );
}

function JsonField({ fieldKey, value, onChange }: { fieldKey: string; value: any; onChange: (patch: Record<string, any>) => void }) {
  const t = useT();
  const [raw, setRaw] = useState(() => JSON.stringify(value, null, 2));
  const [erreur, setErreur] = useState(false);
  return (
    <Field label={t("{0} (édition avancée JSON)", labelChamp(fieldKey))}>
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
      {erreur && <p className="text-[11px] text-red-500 mt-1">{t("JSON invalide — non appliqué")}</p>}
    </Field>
  );
}

function StyleEditor({ style, onChange }: { style: BlockStyleOverrides; onChange: (patch: Partial<BlockStyleOverrides>) => void }) {
  const t = useT();
  const spacing = style.spacing || {};
  const background = style.background || {};
  const typography = style.typography || {};
  const border = style.border || {};

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[13px] font-bold text-gray-500 uppercase tracking-wide mb-2.5">{t("Espacement")}</p>
        <div className="grid grid-cols-2 gap-2.5">
          {(["pt", "pb", "pl", "pr", "mt", "mb", "ml", "mr"] as const).map((k) => (
            <Field key={k} label={{ pt: "Haut (remplissage)", pb: "Bas (remplissage)", pl: "Gauche (remplissage)", pr: "Droite (remplissage)", mt: "Haut (marge)", mb: "Bas (marge)", ml: "Gauche (marge)", mr: "Droite (marge)" }[k]}>
              {/* Curseur en px comme Shopify ; le champ accepte toute unité (%, rem…). */}
              <input type="range" min={0} max={100} step={4} value={parseInt(spacing[k] || "") || 0} aria-label={t("Valeur en pixels")}
                onChange={(e) => onChange({ spacing: { ...spacing, [k]: `${e.target.value}px` } })} className="w-full accent-[#F5A623]" />
              <input type="text" value={spacing[k] || ""} onChange={(e) => onChange({ spacing: { ...spacing, [k]: e.target.value } })}
                placeholder="24px" className="w-full px-2 py-1 text-[13px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none" />
            </Field>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[13px] font-bold text-gray-500 uppercase tracking-wide mb-2.5">{t("Fond")}</p>
        <div className="space-y-2.5">
          <Field label={t("Couleur")}>
            <CouleurEffacable value={background.color} onChange={(v) => onChange({ background: { ...background, color: v || undefined } })} />
          </Field>
          <Field label={t("Image de fond")}>
            <input type="text" value={background.image || ""} onChange={(e) => onChange({ background: { ...background, image: e.target.value } })}
              placeholder="https://..." className="w-full px-2.5 py-2 text-[14px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none" />
          </Field>
          <MediaUpload type="image" onUrl={(url) => onChange({ background: { ...background, image: url } })} />
          {background.image && <button onClick={() => onChange({ background: { ...background, image: undefined } })} className="text-[12px] text-red-500 hover:underline">{t("Retirer l'image de fond")}</button>}
          <Field label={t("Dégradé CSS (prioritaire sur couleur)")}>
            <input type="text" value={background.gradient || ""} onChange={(e) => onChange({ background: { ...background, gradient: e.target.value } })}
              placeholder="linear-gradient(...)" className="w-full px-2.5 py-2 text-[14px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none" />
          </Field>
        </div>
      </div>

      <div>
        <p className="text-[13px] font-bold text-gray-500 uppercase tracking-wide mb-2.5">{t("Typographie")}</p>
        <div className="space-y-2.5">
          <Field label={t("Couleur du texte")}>
            <CouleurEffacable value={typography.color} onChange={(v) => onChange({ typography: { ...typography, color: v || undefined } })} />
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label={t("Taille")}>
              <input type="text" value={typography.taille || ""} onChange={(e) => onChange({ typography: { ...typography, taille: e.target.value } })}
                placeholder="16px" className="w-full px-2.5 py-2 text-[14px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none" />
            </Field>
            <Field label={t("Alignement")}>
              <select value={typography.align || ""} onChange={(e) => onChange({ typography: { ...typography, align: (e.target.value || undefined) as "left" | "center" | "right" | undefined } })}
                className="w-full px-2.5 py-2 text-[14px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none">
                <option value="">{t("Hérité")}</option>
                <option value="left">{t("Gauche")}</option>
                <option value="center">{t("Centré")}</option>
                <option value="right">{t("Droite")}</option>
              </select>
            </Field>
          </div>
          <Field label={t("Police")}>
            <select value={typography.police || ""} onChange={(e) => onChange({ typography: { ...typography, police: e.target.value || undefined } })}
              className="w-full px-2.5 py-2 text-[14px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none">
              <option value="">{t("Police du thème")}</option>
              {[...new Set(FONTS.map((f) => f.cat))].map((cat) => (
                <optgroup key={cat} label={cat}>{FONTS.filter((f) => f.cat === cat).map((f) => <option key={f.v} value={f.v}>{t(f.label)}</option>)}</optgroup>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-2.5">
            <Field label={t("Graisse")}>
              <select value={typography.poids || ""} onChange={(e) => onChange({ typography: { ...typography, poids: e.target.value || undefined } })}
                className="w-full px-2 py-2 text-[14px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none">
                <option value="">{t("Hérité")}</option>
                {["300", "400", "500", "600", "700", "800", "900"].map((v) => <option key={v} value={v}>{t(v)}</option>)}
              </select>
            </Field>
            <Field label={t("Interligne")}>
              <input type="text" value={typography.interligne || ""} onChange={(e) => onChange({ typography: { ...typography, interligne: e.target.value } })}
                placeholder="1.5" className="w-full px-2.5 py-2 text-[14px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none" />
            </Field>
            <Field label={t("Lettres")}>
              <input type="text" value={typography.espacement || ""} onChange={(e) => onChange({ typography: { ...typography, espacement: e.target.value } })}
                placeholder="0.02em" className="w-full px-2.5 py-2 text-[14px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none" />
            </Field>
          </div>
        </div>
      </div>

      <div>
        <p className="text-[13px] font-bold text-gray-500 uppercase tracking-wide mb-2.5">{t("Au survol")}</p>
        <div className="space-y-2.5">
          <Field label={t("Couleur du texte")}><CouleurEffacable value={style.hover?.color} onChange={(v) => onChange({ hover: { ...style.hover, color: v || undefined } })} /></Field>
          <Field label={t("Fond")}><CouleurEffacable value={style.hover?.background} onChange={(v) => onChange({ hover: { ...style.hover, background: v || undefined } })} /></Field>
        </div>
      </div>

      <div>
        <p className="text-[13px] font-bold text-gray-500 uppercase tracking-wide mb-2.5">{t("Bordure")}</p>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label={t("Rayon")}>
            <input type="text" value={border.radius || ""} onChange={(e) => onChange({ border: { ...border, radius: e.target.value } })}
              placeholder="12px" className="w-full px-2.5 py-2 text-[14px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none" />
          </Field>
          <Field label={t("Épaisseur")}>
            <input type="text" value={border.width || ""} onChange={(e) => onChange({ border: { ...border, width: e.target.value } })}
              placeholder="1px" className="w-full px-2.5 py-2 text-[14px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none" />
          </Field>
        </div>
        <Field label={t("Couleur")}>
          <CouleurEffacable value={border.color} onChange={(v) => onChange({ border: { ...border, color: v || undefined } })} />
        </Field>
      </div>

      <Field label={t("Largeur (colonnes dans une ligne)")}>
        <input type="text" value={style.width || ""} onChange={(e) => onChange({ width: e.target.value })}
          placeholder="50%" className="w-full px-2.5 py-2 text-[14px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none" />
      </Field>
    </div>
  );
}

// Couleur facultative : vide = valeur héritée (un <input type="color"> seul ne
// peut pas être vide et affichait une fausse valeur par défaut).
export function CouleurEffacable({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const t = useT();
  return (
    <div className="flex items-center gap-2">
      <span className="relative w-9 h-9 flex-shrink-0 rounded-md border border-gray-200 overflow-hidden" style={{ background: value || "repeating-conic-gradient(#EEE 0 25%, #FFF 0 50%) 0 0 / 10px 10px" }}>
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value ?? "") ? value : "#000000"} onChange={(e) => onChange(e.target.value)} aria-label={t("Choisir une couleur")} className="absolute inset-0 opacity-0 cursor-pointer" />
      </span>
      <input type="text" value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={t("Héritée")}
        className="flex-1 min-w-0 px-2.5 py-2 text-[14px] rounded-md border border-gray-200 focus:border-[#F5A623] outline-none" />
      {value && <button type="button" onClick={() => onChange("")} aria-label={t("Retirer la couleur")} className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"><X size={14} /></button>}
    </div>
  );
}
