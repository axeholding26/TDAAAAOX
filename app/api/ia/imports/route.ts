// Import IA → boutique en REST, pour les intégrations sans MCP (GPT Actions de ChatGPT, scripts) :
// même jeton OAuth, mêmes droits, limites, accords et journal que le serveur MCP
// (/api/mcp/v1) — chaque requête est un appel d'outil du module « imports ».
//   POST { tool?, ...arguments }  tool : importer_creation (défaut), ajouter_visuel_produit, creer_lien_depot, publier_import
//   GET  ?import_id=…             etat_import
import { NextResponse } from "next/server";
import { origineSite } from "@/lib/origine-site";
import { getClientIp } from "@/lib/rate-limit";
import { appelerOutil, contexteDuJeton, debitDepasse } from "@/lib/controle-ia/serveur";

export const maxDuration = 60;
const OUTILS = new Set(["importer_creation", "ajouter_visuel_produit", "creer_lien_depot", "publier_import"]);

async function executer(req: Request, outil: string, args: Record<string, unknown>) {
  const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1] ?? null;
  const ctx = await contexteDuJeton(bearer);
  if (!ctx) return new NextResponse(null, { status: 401, headers: { "WWW-Authenticate": `Bearer resource_metadata="${await origineSite()}/.well-known/oauth-protected-resource"` } });
  if (debitDepasse(ctx, getClientIp(req))) return NextResponse.json({ error: { code: "RATE_LIMITED", message: "Trop d'appels, réessaie dans une minute." } }, { status: 429 });
  const r = await appelerOutil(ctx, outil, args);
  const status = r.succes ? (r.code === "APPROVAL_REQUIRED" ? 202 : 200) : r.code === "NOT_FOUND" ? 404 : r.code === "INSUFFICIENT_PERMISSION" || r.code === "PLAN_REQUIRED" ? 403 : r.code === "RATE_LIMITED" ? 429 : r.code === "INTERNAL" || r.code === "UNAVAILABLE" ? 503 : 422;
  return NextResponse.json(r.succes ? { message: r.resultat, ...r.donnees } : { error: { code: r.code, message: r.resultat, ...r.donnees } }, { status });
}

export async function POST(req: Request) {
  const corps = await req.json().catch(() => null);
  if (!corps || typeof corps !== "object" || Array.isArray(corps)) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Corps JSON attendu." } }, { status: 400 });
  const { tool = "importer_creation", ...args } = corps as Record<string, unknown>;
  if (!OUTILS.has(String(tool))) return NextResponse.json({ error: { code: "INVALID_INPUT", message: `tool : ${[...OUTILS].join(", ")}.` } }, { status: 400 });
  return executer(req, String(tool), args);
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("import_id");
  return executer(req, "etat_import", id ? { import_id: id } : {});
}
