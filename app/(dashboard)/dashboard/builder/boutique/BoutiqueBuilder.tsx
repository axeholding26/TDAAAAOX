"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  LogOut, LayoutList, Settings2, LayoutTemplate, Home, Monitor, Tablet, Smartphone,
  Undo2, Redo2, ExternalLink, Save, Check, RefreshCw, Rocket, ChevronRight, ArrowLeft, type LucideIcon,
} from "lucide-react";
import type { BlockNode, ThemeConfig } from "@/lib/theme-config";
import {
  ZONES, zoneDe, ordonnerParZone, insertNode, moveNode, removeNode, duplicateNode, toggleNodeActif,
  updateNodeConfig, updateNodeStyle, updateNodeResponsiveStyle, findNode, getSiblingPosition, genBlockId, type Zone,
} from "@/lib/block-tree";
import { MANIFESTE_LIBRAIRIE } from "@/lib/axso-design-manifest";
import { PCOnlyGate } from "@/components/dashboard/PCOnlyGate";
import { BlockStylePanel } from "../canvas/BlockStylePanel";
import { AxiaBuilderPanel } from "../canvas/AxiaBuilderPanel";
import { createDefaultNode, STARTER_TEMPLATES } from "../canvas/blockDefaults";
import { PanneauSections } from "./PanneauSections";
import { MenuAjout, type ChoixAjout } from "./MenuAjout";
import { Apercu } from "./Apercu";
import { ApercuFiche } from "./ApercuFiche";
import { ApercuPage } from "../pages/ApercuPage";
import { PanneauPage } from "../pages/PanneauPage";
import { PAGES, type PageEditee } from "../pages/pages";
import { nomNoeud } from "./libelles";
import { convertirDesignEnSections } from "./decoupage";
import { lireElement, modifierElement, appliquerContenu, selectionnerParent } from "./elements-dom";
import { PanneauElement } from "../PanneauElement";
import { majStyleElement, type ElementStyles } from "@/lib/element-styles";

type Device = "desktop" | "tablet" | "mobile";
type Onglet = "sections" | "parametres" | "modeles";
export interface Reglage { id: string; label: string; desc: string; Icon: LucideIcon; contenu: ReactNode }

interface Props {
  tenant: any;
  config: ThemeConfig;
  set: (u: (p: ThemeConfig) => ThemeConfig) => void;
  device: Device;
  setDevice: (d: Device) => void;
  undo: () => void;
  redo: () => void;
  peutAnnuler: boolean;
  peutRetablir: boolean;
  handleSave: () => void;
  saving: boolean;
  saved: boolean;
  hasChanges: boolean;
  publier: () => void;
  publishing: boolean;
  criteresManquants: { label: string }[];
  bandeaux: ReactNode;
  reglages: Reglage[];
  modeles: ReactNode;
  // Panneaux des pages à sections (fiche produit, À propos, Contact).
  panneauxPages: Partial<Record<PageEditee, ReactNode>>;
  onSyncWithServer: () => Promise<void>;
}

// Constructeur des boutiques physiques (catalogue), sur le modèle de l'éditeur
// de thème Shopify : barre du haut fixe (jamais stylée par le design de la
// boutique — son CSS est confiné à l'aperçu, voir lib/scope-css.ts), sections
// En-tête / Modèle / Pied de page à gauche, aperçu en direct au centre,
// réglages de l'élément sélectionné à droite.
export function BoutiqueBuilder(p: Props) {
  const { config, set, tenant, device } = p;
  const [onglet, setOnglet] = useState<Onglet>("sections");
  // Page de la boutique en cours d'édition (sélecteur de la barre du haut).
  const [page, setPageBrute] = useState<PageEditee>("accueil");
  const setPage = (pg: PageEditee) => { setPageBrute(pg); setOnglet("sections"); setReglageOuvert(null); setAjout(null); };
  // Aperçus en cadre (catalogue, panier…) : rechargés à chaque enregistrement.
  const [versionApercu, setVersionApercu] = useState(0);
  useEffect(() => { if (p.saved) setVersionApercu((v) => v + 1); }, [p.saved]);
  const pageEnCadre = !["accueil", "produit"].includes(page);
  // Sur ces pages, enregistrement rapide pour que l'aperçu suive sans attendre.
  useEffect(() => {
    if (!pageEnCadre || !p.hasChanges || p.saving) return;
    const t = setTimeout(p.handleSave, 800);
    return () => clearTimeout(t);
  }, [pageEnCadre, p.hasChanges, p.saving, config, p.handleSave]);
  const [reglageOuvert, setReglageOuvert] = useState<string | null>(null);
  const [selectedId, setSelectedIdBrut] = useState<string | null>(null);
  // Élément d'une section de design (titre, bouton, image…) sélectionné dans
  // l'aperçu ; selectedId est alors le bloc embed-html qui le contient.
  const [selectedEl, setSelectedEl] = useState<string | null>(null);
  const setSelectedId = useCallback((id: string | null | ((s: string | null) => string | null)) => { setSelectedEl(null); setSelectedIdBrut(id); }, []);
  const [ajout, setAjout] = useState<{ mode: "section"; zone: Zone; index: number } | { mode: "bloc"; sectionId: string } | null>(null);

  const tree = ordonnerParZone(config.builderTree ?? []);
  const setTree = useCallback(
    (u: (t: BlockNode[]) => BlockNode[]) => set((c) => ({ ...c, builderTree: ordonnerParZone(u(ordonnerParZone(c.builderTree ?? []))) })),
    [set],
  );

  // Design importé → sections éditables une à une (voir decoupage.ts). Une
  // vraie modification (enregistrée automatiquement), pas une conversion en
  // mémoire : sinon AXIA, qui écrit l'arbre en base, repartirait d'un arbre
  // vide et ferait disparaître le design. Idempotent (setter fonctionnel).
  const aConvertir = (!config.builderTree?.length && !!config.builderHtml)
    || !!config.builderTree?.some((n) => n.children?.[0]?.children?.[0]?.children?.[0]?.config?.css);
  useEffect(() => { if (aConvertir) set(convertirDesignEnSections); }, [aConvertir, set]);

  const deplacer = (id: string, conteneur: string, versIndex: number) => {
    setTree((t) => {
      if ((ZONES as string[]).includes(conteneur)) {
        const cible = t.filter((n) => zoneDe(n) === conteneur)[versIndex];
        return cible ? moveNode(t, id, null, t.indexOf(cible)) : t;
      }
      return moveNode(t, id, conteneur, versIndex);
    });
  };

  const supprimer = (id: string) => { setTree((t) => removeNode(t, id)); setSelectedId((s) => (s === id ? null : s)); };

  const choisirAjout = (choix: ChoixAjout) => {
    if (!ajout) return;
    if (ajout.mode === "section") {
      const noeud: BlockNode = choix.kind === "modele"
        ? STARTER_TEMPLATES.find((m) => m.id === choix.id)!.build()
        : envelopperEnSection(createDefaultNode(choix.type));
      if (ajout.zone !== "template") noeud.config = { ...noeud.config, zone: ajout.zone };
      setTree((t) => insertNode(t, null, indexGlobal(t, ajout.zone, ajout.index), noeud));
      setSelectedId(noeud.id);
    } else if (choix.kind === "bloc") {
      const bloc = createDefaultNode(choix.type);
      setTree((t) => {
        const section = findNode(t, ajout.sectionId);
        const colonne = section && premiereColonne(section);
        return colonne ? insertNode(t, colonne.id, (colonne.children ?? []).length, bloc) : t;
      });
      setSelectedId(bloc.id);
    }
    setAjout(null);
  };

  const selection = selectedId ? findNode(tree, selectedId) : null;
  const estSection = !!selection && tree.some((n) => n.id === selection.id);
  const position = (() => {
    if (!selection) return null;
    if (!estSection) return getSiblingPosition(tree, selection.id);
    const liste = tree.filter((n) => zoneDe(n) === zoneDe(selection));
    return { index: liste.indexOf(selection), total: liste.length };
  })();
  const decaler = (sens: -1 | 1) => {
    if (!selection || !position) return;
    if (estSection) deplacer(selection.id, zoneDe(selection), position.index + sens);
    else {
      const parent = trouverParent(tree, selection.id);
      if (parent) deplacer(selection.id, parent.id, position.index + sens);
    }
  };

  // ── Élément sélectionné dans une section de design ─────────────────────
  const embed = selectedEl && selection?.type === "embed-html" ? selection : null;
  const infoEl = useMemo(() => (embed && selectedEl ? lireElement(embed.config?.html || "", selectedEl) : null), [embed, selectedEl]);
  const majEmbed = (fn: (cfg: Record<string, any>) => Record<string, any>) => {
    if (!embed) return;
    const id = embed.id;
    setTree((t) => { const n = findNode(t, id); return n ? updateNodeConfig(t, id, fn(n.config ?? {})) : t; });
  };
  const sectionDe = (id: string) => tree.find((n) => n.id === id || !!findNode(n.children ?? [], id)) ?? null;

  const design = MANIFESTE_LIBRAIRIE.find((e) => typeof tenant.themeSlug === "string" && tenant.themeSlug.startsWith(`axso-design-${e.fichier.replace(".html", "")}-`));
  const reglage = p.reglages.find((r) => r.id === reglageOuvert);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#F1F2F4] text-[#111111] overflow-hidden" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <PCOnlyGate label="Le Constructeur de boutique" />

      {/* ── Barre du haut : fixe, identique quel que soit le design ── */}
      <header className="h-[60px] flex-shrink-0 grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-3 bg-white border-b border-[#E5E5E5]">
        <div className="flex items-center gap-1.5 min-w-0">
          <Link href="/dashboard" title="Quitter le constructeur" aria-label="Quitter le constructeur"
            className="w-10 h-10 flex items-center justify-center rounded-lg text-[#555555] hover:text-[#111111] hover:bg-[#F5F5F5] transition-colors">
            <LogOut size={18} className="rotate-180" />
          </Link>
          <span className="w-px h-6 bg-[#E5E5E5] mx-1" />
          {([["sections", LayoutList, "Sections"], ["parametres", Settings2, "Paramètres du thème"], ["modeles", LayoutTemplate, "Modèles"]] as [Onglet, LucideIcon, string][]).map(([id, Icon, label]) => (
            <button key={id} onClick={() => { setOnglet(id); setReglageOuvert(null); setAjout(null); }} title={label} aria-label={label} aria-pressed={onglet === id}
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${onglet === id ? "bg-[#FFF1D6] text-[#C77C0A]" : "text-[#555555] hover:text-[#111111] hover:bg-[#F5F5F5]"}`}>
              <Icon size={18} />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-[14px] min-w-0">
          <span className="flex items-center gap-2 font-medium text-[#111111] truncate">
            <LayoutTemplate size={16} className="text-[#777777] flex-shrink-0" />
            {design?.nom ?? "Mon thème"}
          </span>
          {tenant.statut === "brouillon"
            ? <span className="px-2 py-0.5 rounded-md text-[12.5px] font-semibold bg-[#FFF1D6] text-[#B45309]">Brouillon</span>
            : <span className="px-2 py-0.5 rounded-md text-[12.5px] font-semibold bg-[#DCFCE7] text-[#15803D]">Actif</span>}
          <span className="w-px h-5 bg-[#E5E5E5]" />
          <label className="flex items-center gap-2 text-[#333333]">
            <Home size={16} className="text-[#777777]" />
            <select value={page} onChange={(e) => setPage(e.target.value as PageEditee)} aria-label="Page à modifier"
              className="h-9 pl-2 pr-7 rounded-lg border border-[#E5E5E5] bg-white text-[14px] font-medium hover:border-[#CCCCCC] focus:outline-none focus:border-[#F5A623] cursor-pointer">
              {PAGES.map((pg) => <option key={pg.id} value={pg.id}>{pg.label}</option>)}
            </select>
          </label>
        </div>

        <div className="flex items-center justify-end gap-1.5 min-w-0">
          <span className="hidden xl:block text-[13px] text-[#888888] mr-1 truncate">
            {p.saving ? "Enregistrement…" : p.saved ? "Enregistré" : p.hasChanges ? "Modifications non enregistrées" : ""}
          </span>
          <div className="flex items-center rounded-lg bg-[#F3F3F3] p-0.5">
            {([["desktop", Monitor, "Ordinateur"], ["tablet", Tablet, "Tablette"], ["mobile", Smartphone, "Mobile"]] as [Device, LucideIcon, string][]).map(([d, Icon, label]) => (
              <button key={d} onClick={() => p.setDevice(d)} title={label} aria-label={label} aria-pressed={device === d}
                className={`w-9 h-9 flex items-center justify-center rounded-md transition-all ${device === d ? "bg-white text-[#111111] shadow-sm" : "text-[#777777] hover:text-[#111111]"}`}>
                <Icon size={16} />
              </button>
            ))}
          </div>
          <BoutonBarre titre="Annuler (Ctrl+Z)" onClick={p.undo} disabled={!p.peutAnnuler}><Undo2 size={17} /></BoutonBarre>
          <BoutonBarre titre="Rétablir (Ctrl+Y)" onClick={p.redo} disabled={!p.peutRetablir}><Redo2 size={17} /></BoutonBarre>
          {tenant.statut !== "brouillon" && (
            <a href={`/${tenant.slug}`} target="_blank" rel="noopener noreferrer" title="Voir la boutique" aria-label="Voir la boutique"
              className="w-10 h-10 flex items-center justify-center rounded-lg text-[#555555] hover:text-[#111111] hover:bg-[#F5F5F5] transition-colors">
              <ExternalLink size={17} />
            </a>
          )}
          <button onClick={p.handleSave} disabled={p.saving || (!p.hasChanges && !p.saved)}
            className={`h-10 flex items-center gap-2 px-4 rounded-lg text-[14px] font-semibold transition-colors disabled:cursor-not-allowed ${
              p.saved ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#F5A623] text-[#111111] hover:bg-[#E8990F] disabled:bg-[#EDEDED] disabled:text-[#AAAAAA]"}`}>
            {p.saving ? <RefreshCw size={15} className="animate-spin" /> : p.saved ? <Check size={15} /> : <Save size={15} />}
            {p.saving ? "Enregistrement…" : p.saved ? "Enregistré" : "Enregistrer"}
          </button>
          {tenant.statut === "brouillon" && (
            <button onClick={p.publier} disabled={p.publishing || p.criteresManquants.length > 0}
              title={p.criteresManquants.length ? `Complète d'abord : ${p.criteresManquants.map((c) => c.label).join(", ")}` : undefined}
              className="h-10 flex items-center gap-2 px-4 rounded-lg text-[14px] font-semibold bg-[#111111] text-white hover:bg-[#333333] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {p.publishing ? <RefreshCw size={15} className="animate-spin" /> : <Rocket size={15} />}
              {p.publishing ? "Publication…" : "Publier"}
            </button>
          )}
        </div>
      </header>

      {p.bandeaux}

      <div className="flex-1 flex min-h-0">
        {/* ── Panneau de gauche ── */}
        <aside className="relative w-[320px] flex-shrink-0 flex flex-col bg-white border-r border-[#E5E5E5]">
          {onglet === "sections" && page !== "accueil" && (
            p.panneauxPages[page]
              ? <div className="flex-1 flex flex-col min-h-0">
                  <div className="px-5 h-14 flex items-center border-b border-[#EEEEEE] flex-shrink-0"><p className="text-[15px] font-semibold">{PAGES.find((pg) => pg.id === page)?.label}</p></div>
                  <div className="flex-1 overflow-y-auto scrollbar-thin text-[14px]">{p.panneauxPages[page]}</div>
                </div>
              : <PanneauPage page={page} onPage={setPage} />
          )}

          {onglet === "sections" && page === "accueil" && (
            <PanneauSections
              tree={tree}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDeplacer={deplacer}
              onToggleActif={(id) => setTree((t) => toggleNodeActif(t, id))}
              onDupliquer={(id) => setTree((t) => duplicateNode(t, id))}
              onSupprimer={supprimer}
              onAjouterSection={(zone, index) => setAjout({ mode: "section", zone, index })}
              onAjouterBloc={(sectionId) => setAjout({ mode: "bloc", sectionId })}
            />
          )}

          {onglet === "parametres" && !reglage && (
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <div className="px-5 py-4 border-b border-[#EEEEEE]"><p className="text-[16px] font-semibold">Paramètres du thème</p></div>
              <ul className="p-2">
                {p.reglages.map((r) => (
                  <li key={r.id}>
                    <button onClick={() => setReglageOuvert(r.id)} className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left hover:bg-[#F5F5F5] transition-colors">
                      <span className="w-9 h-9 flex-shrink-0 rounded-lg bg-[#F5F5F5] flex items-center justify-center text-[#666666]"><r.Icon size={17} /></span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14px] font-medium">{r.label}</span>
                        <span className="block text-[12.5px] text-[#888888] truncate">{r.desc}</span>
                      </span>
                      <ChevronRight size={16} className="text-[#AAAAAA]" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {onglet === "parametres" && reglage && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center gap-2 px-3 h-14 border-b border-[#EEEEEE] flex-shrink-0">
                <button onClick={() => setReglageOuvert(null)} aria-label="Retour" className="w-8 h-8 flex items-center justify-center rounded-lg text-[#666666] hover:text-[#111111] hover:bg-[#F5F5F5]"><ArrowLeft size={17} /></button>
                <p className="text-[15px] font-semibold">{reglage.label}</p>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin text-[14px]">{reglage.contenu}</div>
            </div>
          )}

          {onglet === "modeles" && (
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <div className="px-5 py-4 border-b border-[#EEEEEE]"><p className="text-[16px] font-semibold">Modèles</p></div>
              {p.modeles}
            </div>
          )}

          {ajout && <MenuAjout mode={ajout.mode} onChoisir={choisirAjout} onFermer={() => setAjout(null)} />}
        </aside>

        {/* ── Aperçu ── (fiche produit quand son panneau est ouvert) */}
        {page === "produit" ? <ApercuFiche config={config} tenant={tenant} device={device} />
          : pageEnCadre ? <ApercuPage slug={tenant.slug} chemin={PAGES.find((pg) => pg.id === page)!.chemin} device={device} version={versionApercu} onNaviguer={setPage} />
          : <Apercu
          onNaviguer={setPage}
          config={config}
          tree={tree}
          slug={tenant.slug}
          device={device}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onChangeConfig={(id, patch) => setTree((t) => updateNodeConfig(t, id, patch))}
          onAjouterSection={(zone, index) => { setOnglet("sections"); setAjout({ mode: "section", zone, index }); }}
          selectedEl={selectedEl}
          onSelectElement={(noeudId, elId) => { setSelectedIdBrut(noeudId); setSelectedEl(elId); }}
        />}

        {/* ── Réglages de l'élément sélectionné ── */}
        {embed && selectedEl && infoEl && (
          <PanneauElement
            key={selectedEl}
            titre={infoEl.nom}
            sousTitre={`Dans « ${nomNoeud(sectionDe(embed.id) ?? embed)} »`}
            contenu={{ texte: infoEl.texte, lien: infoEl.lien, image: infoEl.image, alt: infoEl.alt, placeholder: infoEl.placeholder, texteEnLigne: infoEl.texteEnLigne }}
            onContenu={(patch) => majEmbed((c) => ({ html: modifierElement(c.html || "", selectedEl, (el) => appliquerContenu(el, patch)) }))}
            styles={(embed.config?.elementStyles as ElementStyles | undefined)?.[selectedEl] ?? {}}
            device={device}
            onStyle={(etat, patch) => majEmbed((c) => ({ elementStyles: majStyleElement(c.elementStyles, selectedEl, etat, patch) }))}
            onReinitialiser={() => majEmbed((c) => { const { [selectedEl]: _retire, ...reste } = (c.elementStyles ?? {}) as ElementStyles; return { elementStyles: reste }; })}
            onParent={() => {
              const parent = selectionnerParent(embed.config?.html || "", selectedEl);
              if (!parent) { const sec = sectionDe(embed.id); setSelectedId(sec?.id ?? null); return; }
              majEmbed(() => ({ html: parent.html }));
              setSelectedEl(parent.id);
            }}
            onSupprimer={() => { majEmbed((c) => ({ html: modifierElement(c.html || "", selectedEl, (el) => el.remove()) })); setSelectedEl(null); }}
            onClose={() => setSelectedEl(null)}
          />
        )}
        {selection && !(embed && selectedEl && infoEl) && (
          <BlockStylePanel
            key={selection.id}
            node={selection}
            titre={nomNoeud(selection)}
            device={device}
            canMoveUp={!!position && position.index > 0}
            canMoveDown={!!position && position.index < position.total - 1}
            onMoveUp={() => decaler(-1)}
            onMoveDown={() => decaler(1)}
            onChangeStyle={(patch) => setTree((t) => updateNodeStyle(t, selection.id, patch))}
            onChangeResponsiveStyle={(bp, patch) => setTree((t) => updateNodeResponsiveStyle(t, selection.id, bp, patch))}
            onChangeConfig={(patch) => setTree((t) => updateNodeConfig(t, selection.id, patch))}
            onDuplicate={() => setTree((t) => duplicateNode(t, selection.id))}
            onDelete={() => supprimer(selection.id)}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      <AxiaBuilderPanel onSyncWithServer={p.onSyncWithServer} variante="boutique" decalageDroite={selection ? 340 : 0} />
    </div>
  );
}

function BoutonBarre({ titre, onClick, disabled, children }: { titre: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} title={titre} aria-label={titre}
      className="w-10 h-10 flex items-center justify-center rounded-lg text-[#555555] hover:text-[#111111] hover:bg-[#F5F5F5] disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
      {children}
    </button>
  );
}

function envelopperEnSection(widget: BlockNode): BlockNode {
  return {
    id: genBlockId("section"),
    type: "section",
    children: [{ id: genBlockId("row"), type: "row", children: [{ id: genBlockId("col"), type: "column", children: [widget] }] }],
  };
}

function premiereColonne(node: BlockNode): BlockNode | null {
  for (const c of node.children ?? []) {
    if (c.type === "column") return c;
    const trouve = premiereColonne(c);
    if (trouve) return trouve;
  }
  return null;
}

function trouverParent(liste: BlockNode[], id: string, parent: BlockNode | null = null): BlockNode | null {
  for (const n of liste) {
    if (n.id === id) return parent;
    const t = trouverParent(n.children ?? [], id, n);
    if (t) return t;
  }
  return null;
}

// Position dans l'arbre complet correspondant à `index` dans la zone donnée.
function indexGlobal(tree: BlockNode[], zone: Zone, index: number): number {
  const liste = tree.filter((n) => zoneDe(n) === zone);
  if (index < liste.length) return tree.indexOf(liste[index]);
  if (liste.length) return tree.indexOf(liste[liste.length - 1]) + 1;
  return tree.filter((n) => ZONES.indexOf(zoneDe(n)) < ZONES.indexOf(zone)).length;
}

