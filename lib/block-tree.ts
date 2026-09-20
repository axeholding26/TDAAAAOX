// ─── Arbre de blocs — opérations pures ─────────────────────────────────────────
// Aucune dépendance DOM/React : ce module est le SEUL point d'entrée pour
// muter un `BlockNode[]` (constructeur libre, vague 1). Le canevas (dnd-kit)
// et le panneau de style appellent uniquement ces fonctions, jamais de
// mutation directe de l'arbre — garantit un seul endroit où la règle
// d'imbrication (section → ligne → colonne → widget) est appliquée.
import type { BlockNode, BlockNodeType, BlockStyleOverrides } from "./theme-config";

export function genBlockId(prefix: string = "bloc"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Règle d'imbrication — une seule table, pas un graphe général ─────────────
const TYPES_WIDGETS: BlockNodeType[] = [
  "features", "stats", "countdown", "brands", "video", "gallery",
  "social-proof", "spacer", "richtext", "cta-band", "tabs", "columns",
  "heading", "text", "image", "button", "products",
];

const REGLES_IMBRICATION: Record<string, BlockNodeType[]> = {
  root: ["section"],
  section: ["row"],
  row: ["column"],
  column: ["row", ...TYPES_WIDGETS],
};

export function peutDeposer(typeParent: BlockNodeType | "root", typeEnfant: BlockNodeType): boolean {
  return (REGLES_IMBRICATION[typeParent] || []).includes(typeEnfant);
}

export function estWidget(type: BlockNodeType): boolean {
  return TYPES_WIDGETS.includes(type);
}

// ─── Recherche ─────────────────────────────────────────────────────────────────
export function findNode(tree: BlockNode[], id: string): BlockNode | null {
  for (const node of tree) {
    if (node.id === id) return node;
    if (node.children) {
      const trouve = findNode(node.children, id);
      if (trouve) return trouve;
    }
  }
  return null;
}

function trouverConteneur(tree: BlockNode[], id: string): { liste: BlockNode[]; index: number; parent: BlockNode | null } | null {
  for (let i = 0; i < tree.length; i++) {
    if (tree[i].id === id) return { liste: tree, index: i, parent: null };
  }
  for (const node of tree) {
    if (!node.children) continue;
    for (let i = 0; i < node.children.length; i++) {
      if (node.children[i].id === id) return { liste: node.children, index: i, parent: node };
    }
    const trouve = trouverConteneurRecursif(node, id);
    if (trouve) return trouve;
  }
  return null;
}

function trouverConteneurRecursif(node: BlockNode, id: string): { liste: BlockNode[]; index: number; parent: BlockNode | null } | null {
  if (!node.children) return null;
  for (let i = 0; i < node.children.length; i++) {
    if (node.children[i].id === id) return { liste: node.children, index: i, parent: node };
  }
  for (const enfant of node.children) {
    const trouve = trouverConteneurRecursif(enfant, id);
    if (trouve) return trouve;
  }
  return null;
}

function estDescendant(node: BlockNode, id: string): boolean {
  if (!node.children) return false;
  for (const enfant of node.children) {
    if (enfant.id === id || estDescendant(enfant, id)) return true;
  }
  return false;
}

function cloneProfond(tree: BlockNode[]): BlockNode[] {
  return tree.map((n) => ({ ...n, children: n.children ? cloneProfond(n.children) : undefined }));
}

// ─── Insertion intelligente — enveloppe automatiquement un widget déposé
// directement sur une section/ligne, comme dans Elementor. ───────────────────
export function insertNode(
  tree: BlockNode[],
  parentId: string | null,
  index: number,
  nouveauNoeud: BlockNode
): BlockNode[] {
  const arbre = cloneProfond(tree);
  const parent = parentId ? findNode(arbre, parentId) : null;
  const typeParent: BlockNodeType | "root" = parent ? parent.type : "root";

  let noeudAInserer = nouveauNoeud;
  if (!peutDeposer(typeParent, nouveauNoeud.type)) {
    // Enveloppe automatique : widget déposé sur une section → row+column ;
    // sur une row → column ; sinon dépôt refusé (retourne l'arbre inchangé).
    if (typeParent === "section" && nouveauNoeud.type !== "row") {
      noeudAInserer = { id: genBlockId("row"), type: "row", children: [{ id: genBlockId("col"), type: "column", children: [nouveauNoeud] }] };
    } else if (typeParent === "row" && nouveauNoeud.type !== "column") {
      noeudAInserer = { id: genBlockId("col"), type: "column", children: [nouveauNoeud] };
    } else if (typeParent === "root" && nouveauNoeud.type !== "section") {
      noeudAInserer = {
        id: genBlockId("section"), type: "section",
        children: [{ id: genBlockId("row"), type: "row", children: [{ id: genBlockId("col"), type: "column", children: [nouveauNoeud] }] }],
      };
    } else {
      return tree; // combinaison non supportée, no-op défensif
    }
  }

  if (!parent) {
    arbre.splice(Math.max(0, Math.min(index, arbre.length)), 0, noeudAInserer);
    return arbre;
  }
  parent.children = parent.children || [];
  parent.children.splice(Math.max(0, Math.min(index, parent.children.length)), 0, noeudAInserer);
  return arbre;
}

// ─── Déplacement d'un nœud existant (réordonnancement ou changement de parent) ─
export function moveNode(tree: BlockNode[], nodeId: string, newParentId: string | null, newIndex: number): BlockNode[] {
  const source = findNode(tree, nodeId);
  if (!source) return tree;
  if (newParentId === nodeId) return tree; // ne peut pas devenir son propre parent
  if (estDescendant(source, newParentId || "")) return tree; // ne peut pas descendre dans son propre sous-arbre

  const nouveauParent = newParentId ? findNode(tree, newParentId) : null;
  const typeParent: BlockNodeType | "root" = nouveauParent ? nouveauParent.type : "root";
  if (!peutDeposer(typeParent, source.type)) return tree; // cible invalide, no-op

  const arbre = cloneProfond(tree);
  const emplacement = trouverConteneur(arbre, nodeId);
  if (!emplacement) return tree;
  const [noeudDeplace] = emplacement.liste.splice(emplacement.index, 1);

  if (!newParentId) {
    arbre.splice(Math.max(0, Math.min(newIndex, arbre.length)), 0, noeudDeplace);
    return arbre;
  }
  const cibleParent = findNode(arbre, newParentId);
  if (!cibleParent) return tree;
  cibleParent.children = cibleParent.children || [];
  cibleParent.children.splice(Math.max(0, Math.min(newIndex, cibleParent.children.length)), 0, noeudDeplace);
  return arbre;
}

export function removeNode(tree: BlockNode[], nodeId: string): BlockNode[] {
  const arbre = cloneProfond(tree);
  const emplacement = trouverConteneur(arbre, nodeId);
  if (!emplacement) return tree;
  emplacement.liste.splice(emplacement.index, 1);
  return arbre;
}

export function duplicateNode(tree: BlockNode[], nodeId: string): BlockNode[] {
  const original = findNode(tree, nodeId);
  if (!original) return tree;

  const regenererIds = (n: BlockNode): BlockNode => ({
    ...n,
    id: genBlockId(n.type),
    children: n.children ? n.children.map(regenererIds) : undefined,
  });
  const copie = regenererIds(original);

  const arbre = cloneProfond(tree);
  const emplacement = trouverConteneur(arbre, nodeId);
  if (!emplacement) return tree;
  emplacement.liste.splice(emplacement.index + 1, 0, copie);
  return arbre;
}

export function updateNodeStyle(tree: BlockNode[], nodeId: string, patch: Partial<BlockStyleOverrides>): BlockNode[] {
  const arbre = cloneProfond(tree);
  const node = findNode(arbre, nodeId);
  if (!node) return tree;
  node.style = { ...node.style, ...patch };
  return arbre;
}

// Vague 3 — même principe que updateNodeStyle mais pour une surcharge
// tablette/mobile (node.style.responsive.<breakpoint>), fusionnée en
// épargnant les autres champs déjà définis pour cet appareil.
export function updateNodeResponsiveStyle(
  tree: BlockNode[],
  nodeId: string,
  breakpoint: "tablet" | "mobile",
  patch: Partial<BlockStyleOverrides>
): BlockNode[] {
  const arbre = cloneProfond(tree);
  const node = findNode(arbre, nodeId);
  if (!node) return tree;
  const responsive = node.style?.responsive || {};
  node.style = { ...node.style, responsive: { ...responsive, [breakpoint]: { ...responsive[breakpoint], ...patch } } };
  return arbre;
}

export function updateNodeConfig(tree: BlockNode[], nodeId: string, patch: Record<string, any>): BlockNode[] {
  const arbre = cloneProfond(tree);
  const node = findNode(arbre, nodeId);
  if (!node) return tree;
  node.config = { ...node.config, ...patch };
  return arbre;
}

export function toggleNodeActif(tree: BlockNode[], nodeId: string): BlockNode[] {
  const arbre = cloneProfond(tree);
  const node = findNode(arbre, nodeId);
  if (!node) return tree;
  node.actif = node.actif === false ? true : false;
  return arbre;
}
