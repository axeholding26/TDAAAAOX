// Actions que l'agent AXIA (lib/gemini.ts::agentConstructeurLibre) peut
// appliquer à l'arbre du constructeur libre — un sous-ensemble volontaire
// des primitives de lib/block-tree.ts, jamais de mutation libre de l'arbre.
// Fichier pur, partagé par le client (BuilderCanvas, applique réellement les
// actions) et la route API (valide leur forme avant de les renvoyer).
import type { BlockNode, BlockNodeType, BlockStyleOverrides } from "./theme-config";
import {
  insertNode, moveNode, removeNode, duplicateNode, peutDeposer,
  updateNodeStyle, updateNodeResponsiveStyle, updateNodeConfig, toggleNodeActif,
} from "./block-tree";
import { createDefaultNode, getCatalogEntry } from "./block-catalog";

// Spécification d'un nœud à insérer, récursive — permet à l'agent de créer
// une sous-arborescence entière (ex: section > ligne > 2 colonnes) en UNE
// seule action "insert", puisqu'il ne peut pas connaître à l'avance les id
// générés pour chaîner plusieurs actions dépendantes.
export interface AgentNodeSpec {
  type: BlockNodeType;
  config?: Record<string, any>;
  style?: BlockStyleOverrides;
  children?: AgentNodeSpec[];
}

export type AgentAction =
  | { op: "insert"; parentId: string | null; index: number; node: AgentNodeSpec }
  | { op: "move"; nodeId: string; newParentId: string | null; newIndex: number }
  | { op: "remove"; nodeId: string }
  | { op: "duplicate"; nodeId: string }
  | { op: "updateStyle"; nodeId: string; style: Partial<BlockStyleOverrides> }
  | { op: "updateResponsiveStyle"; nodeId: string; breakpoint: "tablet" | "mobile"; style: Partial<BlockStyleOverrides> }
  | { op: "updateConfig"; nodeId: string; config: Record<string, any> }
  | { op: "toggleActif"; nodeId: string };

const OPS_VALIDES = new Set(["insert", "move", "remove", "duplicate", "updateStyle", "updateResponsiveStyle", "updateConfig", "toggleActif"]);

function validerNodeSpec(brut: any): AgentNodeSpec | null {
  if (!brut || typeof brut !== "object" || typeof brut.type !== "string" || !getCatalogEntry(brut.type)) return null;
  const spec: AgentNodeSpec = { type: brut.type };
  if (brut.config && typeof brut.config === "object") spec.config = brut.config;
  if (brut.style && typeof brut.style === "object") spec.style = brut.style;
  if (Array.isArray(brut.children)) {
    const enfants = brut.children.map(validerNodeSpec).filter((n: AgentNodeSpec | null): n is AgentNodeSpec => n !== null);
    if (enfants.length) spec.children = enfants;
  }
  return spec;
}

// Filtre/normalise les actions brutes renvoyées par le modèle — tout ce qui
// ne ressemble pas à une action valide (type de bloc inconnu, champ
// manquant) est silencieusement écarté plutôt que de faire planter
// l'application des actions suivantes.
export function validerActions(brut: any): AgentAction[] {
  if (!Array.isArray(brut)) return [];
  const actions: AgentAction[] = [];
  for (const a of brut) {
    if (!a || typeof a !== "object" || !OPS_VALIDES.has(a.op)) continue;
    if (a.op === "insert" && Number.isInteger(a.index)) {
      const node = validerNodeSpec(a.node);
      if (node) actions.push({ op: "insert", parentId: a.parentId ?? null, index: a.index, node });
    } else if (a.op === "move" && typeof a.nodeId === "string" && Number.isInteger(a.newIndex)) {
      actions.push({ op: "move", nodeId: a.nodeId, newParentId: a.newParentId ?? null, newIndex: a.newIndex });
    } else if ((a.op === "remove" || a.op === "duplicate" || a.op === "toggleActif") && typeof a.nodeId === "string") {
      actions.push({ op: a.op, nodeId: a.nodeId });
    } else if (a.op === "updateStyle" && typeof a.nodeId === "string" && a.style && typeof a.style === "object") {
      actions.push({ op: "updateStyle", nodeId: a.nodeId, style: a.style });
    } else if (a.op === "updateResponsiveStyle" && typeof a.nodeId === "string" && (a.breakpoint === "tablet" || a.breakpoint === "mobile") && a.style && typeof a.style === "object") {
      actions.push({ op: "updateResponsiveStyle", nodeId: a.nodeId, breakpoint: a.breakpoint, style: a.style });
    } else if (a.op === "updateConfig" && typeof a.nodeId === "string" && a.config && typeof a.config === "object") {
      actions.push({ op: "updateConfig", nodeId: a.nodeId, config: a.config });
    }
  }
  return actions;
}

// Construit un vrai BlockNode (id générés) à partir d'une spec, en élaguant
// récursivement tout enfant qui violerait la règle d'imbrication section >
// ligne > colonne > widget — mieux vaut un sous-arbre tronqué qu'un arbre
// invalide silencieusement accepté. Ne valide QUE les enfants les uns par
// rapport aux autres (indépendant de l'éventuel parent externe) : le nœud
// racine de la spec passe par insertNode, qui sait déjà envelopper
// automatiquement (comme le glisser-déposer humain) si son type ne
// correspond pas au conteneur ciblé par l'action.
function construireNoeud(spec: AgentNodeSpec): BlockNode {
  const node = createDefaultNode(spec.type, spec.config);
  if (spec.style) node.style = spec.style;
  if (spec.children?.length && (spec.type === "section" || spec.type === "row" || spec.type === "column")) {
    node.children = spec.children
      .filter((c) => peutDeposer(spec.type, c.type))
      .map(construireNoeud);
  }
  return node;
}

export function applyAgentActions(tree: BlockNode[], actions: AgentAction[]): BlockNode[] {
  let t = tree;
  for (const a of actions) {
    switch (a.op) {
      case "insert": {
        t = insertNode(t, a.parentId, a.index, construireNoeud(a.node));
        break;
      }
      case "move": t = moveNode(t, a.nodeId, a.newParentId, a.newIndex); break;
      case "remove": t = removeNode(t, a.nodeId); break;
      case "duplicate": t = duplicateNode(t, a.nodeId); break;
      case "updateStyle": t = updateNodeStyle(t, a.nodeId, a.style); break;
      case "updateResponsiveStyle": t = updateNodeResponsiveStyle(t, a.nodeId, a.breakpoint, a.style); break;
      case "updateConfig": t = updateNodeConfig(t, a.nodeId, a.config); break;
      case "toggleActif": t = toggleNodeActif(t, a.nodeId); break;
    }
  }
  return t;
}
