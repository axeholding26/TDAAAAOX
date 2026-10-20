// Bannière pub de « Ma boutique » : une fois par semaine, à un moment aléatoire.
import { test } from "node:test";
import assert from "node:assert/strict";
import { tourDePub } from "@/components/dashboard/BannierePub";

const J = 24 * 3600 * 1000, S = 7 * J;

test("première visite : rien, prochaine programmée dans la semaine", () => {
  const r = tourDePub(1000 * S, null, () => 0.5);
  assert.equal(r.afficher, false);
  assert.equal(r.prochaine, 1000 * S + S / 2);
});

test("affichée une fois, puis plus avant la semaine suivante", () => {
  const r = tourDePub(1000 * S + 3 * J, 1000 * S + J, () => 0.2);
  assert.equal(r.afficher, true);
  assert.ok(r.prochaine >= 1001 * S && r.prochaine < 1002 * S);
  assert.equal(tourDePub(1000 * S + 4 * J, r.prochaine).afficher, false);
});
