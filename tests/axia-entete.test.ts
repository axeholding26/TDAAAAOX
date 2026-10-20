// AXIA ne fait jamais disparaître l'en-tête (navbar) de la page d'accueil.
import { test } from "node:test";
import assert from "node:assert/strict";
import { protegerEntete } from "@/lib/agent-actions";
import { appliquerActionDesign } from "@/lib/design-accueil";

const tree: any[] = [
  { id: "h", type: "section", config: { zone: "header" }, children: [{ id: "h-bloc", type: "text" }] },
  { id: "s", type: "section", children: [] },
  { id: "nav", type: "section", children: [{ id: "e", type: "embed-html", config: { html: "<nav><a href='/'>Accueil</a></nav>" } }] },
];

test("suppression / masquage de l'en-tête écartés, le reste passe", () => {
  const gardees = protegerEntete(tree, [
    { op: "remove", nodeId: "h" }, { op: "toggleActif", nodeId: "h-bloc" }, { op: "remove", nodeId: "nav" },
    { op: "updateConfig", nodeId: "h", config: { zone: "template" } }, { op: "remove", nodeId: "s" },
  ]);
  assert.deepEqual(gardees, [{ op: "remove", nodeId: "s" }]);
});

test("modifier_design_accueil refuse de supprimer l'en-tête", () => {
  assert.throws(() => appliquerActionDesign(tree, { action: "supprimer_section", section: "h" } as any), /en-tête/);
  assert.equal(appliquerActionDesign(tree, { action: "supprimer_section", section: "s" } as any).length, 2);
});
