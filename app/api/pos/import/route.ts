// Import de fichiers CSV / XLSX : produits, prix, stock, clients, fournisseurs.
// Droit : import_export.
// GET  /api/pos/import — { entites: [{ id, libelle, description, colonnes }], limites }.
// GET  /api/pos/import?modele=<entite>&format=xlsx|csv — le modèle à remplir.
// POST /api/pos/import — FormData { fichier, entite, mode, cle? }.
//   mode "valider"  : n'écrit rien. { ok, entite, total, valides, erreurs: [{ ligne, colonne, message }], aCreer, aModifier }.
//   mode "importer" : importe les lignes valides, par paquets idempotents (clé d'import obligatoire).
//     { ok, termine, paquets, paquetsFaits, dejaAppliques, total, valides, erreurs, crees, modifies, inchanges }.
//     `termine: false` : le temps alloué est écoulé, renvoyer la même demande (même fichier, même clé) pour reprendre.
// Limites : lib/pos/achats/import.ts → LIMITES_IMPORT.
import { routePos } from "@/lib/pos/acces";
import { exigerDroit } from "@/lib/pos/droits";
import { erreurs } from "@/lib/pos/erreurs";
import { LIMITES_IMPORT, appliquerImport, modeleImport, validerImport } from "@/lib/pos/achats/import";
import { DEFINITIONS, ENTITES, estEntite } from "@/lib/pos/achats/import-regles";

// Un appel d'import travaille 45 s au plus, puis rend la main (reprise par le client).
export const maxDuration = 60;

export const GET = routePos(async (ctx, req) => {
  exigerDroit(ctx, "import_export");
  const q = new URL(req.url).searchParams;
  const modele = q.get("modele");
  if (modele) {
    if (!estEntite(modele)) throw erreurs.invalide("Ce type de fichier n'existe pas.");
    return modeleImport(modele, q.get("format") === "csv" ? "csv" : "xlsx");
  }
  return {
    entites: ENTITES.map((id) => ({ id, libelle: DEFINITIONS[id].libelle, description: DEFINITIONS[id].description, colonnes: DEFINITIONS[id].colonnes.map(({ titre, requis, aide }) => ({ titre, requis: !!requis, aide: aide ?? null })) })),
    limites: { octets: LIMITES_IMPORT.octets, lignes: LIMITES_IMPORT.lignes, export: LIMITES_IMPORT.export },
  };
});

export const POST = routePos(async (ctx, req) => {
  exigerDroit(ctx, "import_export");
  const form = await req.formData().catch(() => null);
  const fichier = form?.get("fichier");
  const entite = form?.get("entite");
  if (!(fichier instanceof File)) throw erreurs.invalide("Aucun fichier n'a été reçu. Choisissez un fichier Excel ou CSV.");
  if (!estEntite(entite)) throw erreurs.invalide("Choisissez ce que contient le fichier : produits, prix, stock, clients ou fournisseurs.");
  if (form?.get("mode") !== "importer") return { ok: true, ...(await validerImport(ctx.tenantId, entite, fichier)) };
  const cle = req.headers.get("idempotency-key") ?? form.get("cle");
  return { ok: true, ...(await appliquerImport(ctx, entite, fichier, typeof cle === "string" ? cle : undefined)) };
});
