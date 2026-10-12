// Un scan (téléphone appairé avec ?appareil=1, caméra ou scanner clavier du poste).
// POST /api/pos/scanner/scans — corps : { scanId, code, contexte?, source?, scanneAt? }.
// Idempotent sur scanId : le renvoyer rend le même résultat avec `rejoue: true`,
// sans seconde ligne ni second événement. Publie `scan.created` sur la caisse.
import { enregistrerScan, routeScanner, schemaScan } from "@/lib/pos/scanner/service";

export const POST = routeScanner(async (ctx, req) => enregistrerScan(ctx, schemaScan.parse(await req.json())));
