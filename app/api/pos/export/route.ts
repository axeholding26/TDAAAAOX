// Export CSV / XLSX : produits, prix, stock, clients, fournisseurs.
// GET /api/pos/export?entite=&format=xlsx|csv — droit : import_export.
// Le fichier reprend les colonnes du modèle d'import : il se réimporte tel quel.
// La colonne « Prix d'achat » sort vide sans le droit voir_couts.
// En-têtes de réponse : x-axso-lignes, et x-axso-tronque: 1 au-delà de 20 000 lignes.
import { routePos } from "@/lib/pos/acces";
import { journaliserAudit } from "@/lib/pos/audit";
import { aDroit, exigerDroit } from "@/lib/pos/droits";
import { erreurs } from "@/lib/pos/erreurs";
import { prisma } from "@/lib/prisma";
import { exporter, fichierTableur } from "@/lib/pos/achats/import";
import { DEFINITIONS, estEntite } from "@/lib/pos/achats/import-regles";

export const maxDuration = 60;

export const GET = routePos(async (ctx, req) => {
  exigerDroit(ctx, "import_export");
  const q = new URL(req.url).searchParams;
  const entite = q.get("entite");
  if (!estEntite(entite)) throw erreurs.invalide("Choisissez ce qu'il faut exporter : produits, prix, stock, clients ou fournisseurs.");
  const format = q.get("format") === "csv" ? "csv" : "xlsx";
  const { tableau, lignes, tronque } = await exporter(ctx.tenantId, entite, { voirCouts: aDroit(ctx, "voir_couts") });
  // Sortie de données de la boutique (fichier clients compris) : tracée.
  await prisma.$transaction((tx) => journaliserAudit(tx, ctx, { action: "export.telecharge", entite: "Export", apres: { type: entite, format, lignes, tronque } }));
  return fichierTableur(`${entite}-axso-${new Date().toISOString().slice(0, 10)}`, DEFINITIONS[entite].libelle, tableau, format, { "x-axso-lignes": String(lignes), ...(tronque ? { "x-axso-tronque": "1" } : {}) });
});
