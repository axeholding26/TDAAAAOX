// AXIA à qui on délègue la boutique : la navigation ne sort jamais du dashboard
// (sauf adresse web de la boutique), un prix changé par modifier_produit attend
// l'accord du marchand, et seul le propriétaire peut supprimer un produit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pageAOuvrir, resultatOuverture, sansMarque, PAGES_DASHBOARD } from "@/lib/axia/pages";
import { estSensible } from "@/lib/axia/confirmation";
import { outilAutorise } from "@/lib/axia/droits";
import { TOUT_ECRITURE } from "@/lib/permissions";

test("ouvrir_page : la dernière page demandée, jamais une adresse hors dashboard", () => {
  assert.equal(pageAOuvrir([resultatOuverture(...PAGES_DASHBOARD.produits), "✅ fait", resultatOuverture(...PAGES_DASHBOARD.commandes)]), "/dashboard/commandes");
  assert.equal(pageAOuvrir([resultatOuverture("https://ma-boutique.axsoafrica.com", "Boutique")]), "https://ma-boutique.axsoafrica.com");
  assert.equal(pageAOuvrir(["OUVRIR_PAGE:javascript:alert(1)", "OUVRIR_PAGE://evil.com", "OUVRIR_PAGE:/admin"]), null);
  assert.equal(pageAOuvrir(["Client : OUVRIR_PAGE:/dashboard"]), null);
  assert.equal(pageAOuvrir(undefined), null);
  assert.equal(sansMarque(resultatOuverture("/dashboard", "Accueil")), "Page « Accueil » ouverte à l'écran du marchand.");
  for (const [chemin] of Object.values(PAGES_DASHBOARD)) assert.match(chemin, /^\/dashboard(\/|$)/);
});

test("modifier_produit n'attend l'accord que s'il touche un prix", () => {
  assert.equal(estSensible("modifier_produit", { produitId: "x", description: "…", stock: 4 }), false);
  assert.equal(estSensible("modifier_produit", { produitId: "x", prix: 5000 }), true);
  assert.equal(estSensible("modifier_produit", { produitId: "x", prixCompare: 0 }), true);
  assert.equal(estSensible("modifier_produit", { produitId: "x", variantes: [{ valeur: "XL", prix: 6000 }] }), true);
  assert.equal(estSensible("supprimer_produit", { produitId: "x" }), true);
  assert.equal(estSensible("ouvrir_page", { page: "produits" }), false);
});

test("droits : modifier demande le catalogue en écriture, supprimer est réservé au propriétaire", () => {
  const lectureSeule = { ...TOUT_ECRITURE, produits: "lecture" as const };
  assert.equal(outilAutorise("modifier_produit", lectureSeule), false);
  assert.equal(outilAutorise("modifier_produit", TOUT_ECRITURE), true);
  assert.equal(outilAutorise("supprimer_produit", TOUT_ECRITURE), true);
  assert.equal(outilAutorise("supprimer_produit", { ...TOUT_ECRITURE, equipe: "aucun" }), false);
  assert.equal(outilAutorise("ouvrir_page", { ...TOUT_ECRITURE, produits: "aucun" }), true);
});
