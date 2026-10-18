// AI Course Studio — un studio : détail (éléments, tâches, étape, budget) et actions.
// Toute génération passe par « estimer » (coût affiché) puis « lancer » avec accord: true.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { aiLimiter, apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import {
  annulerTaches, archiverStudio, budget, changerStatut, chargerStudio, editerElement, estimerTaches, lancerTaches,
  publier, restaurer, tachesStudio, tenantDeSession, validerCurriculum, versions,
} from "@/lib/academie/studio";
import { etapeCourante } from "@/lib/academie/regles";

type Ctx = { params: Promise<{ id: string }> };
const id40 = z.string().min(1).max(40);
const typeTache = z.enum(["studio_curriculum", "studio_lecon", "studio_vente"]);

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("estimer"), type: typeTache, elementId: id40.optional() }),
  z.object({ action: z.literal("lancer"), type: typeTache, elementId: id40.optional(), accord: z.literal(true) }),
  z.object({ action: z.literal("annuler") }),
  z.object({ action: z.literal("valider_curriculum") }),
  z.object({ action: z.literal("statut"), elementId: id40, statut: z.enum(["valide", "archive", "brouillon", "a_verifier"]), confirmerAlertes: z.boolean().optional() }),
  z.object({ action: z.literal("editer"), elementId: id40, titre: z.string().trim().min(1).max(200).optional(), contenu: z.record(z.string(), z.unknown()).optional() }),
  z.object({ action: z.literal("versions"), elementId: id40 }),
  z.object({ action: z.literal("restaurer"), elementId: id40, version: z.number().int().min(1) }),
  z.object({ action: z.literal("publier") }),
  z.object({ action: z.literal("archiver") }),
]);

export async function GET(_req: NextRequest, { params }: Ctx) {
  const tenantId = await tenantDeSession();
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  try {
    const [studio, taches, b] = await Promise.all([chargerStudio(tenantId, id), tachesStudio(tenantId, id), budget(tenantId)]);
    return NextResponse.json({ studio, etape: etapeCourante(studio.elements, studio.statut === "publie"), taches, budget: b });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erreur" }, { status: e?.status ?? 500 });
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const tenantId = await tenantDeSession();
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  const p = actionSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  const a = p.data;
  // Valider/éditer une à une des dizaines de leçons est normal : limite IA seulement sur les lancements.
  const rl = (a.action === "lancer" ? aiLimiter : apiLimiter).check(`studio:${tenantId}`);
  if (!rl.success) return rateLimitResponse(rl.reset);
  try {
    switch (a.action) {
      case "estimer": return NextResponse.json(await estimerTaches(tenantId, id, a.type, a.elementId));
      case "lancer": return NextResponse.json(await lancerTaches(tenantId, id, a.type, { elementId: a.elementId, accord: a.accord }));
      case "annuler": return NextResponse.json({ annulees: await annulerTaches(tenantId, id) });
      case "valider_curriculum": await validerCurriculum(tenantId, id); return NextResponse.json({ ok: true });
      case "statut": return NextResponse.json({ element: await changerStatut(tenantId, a.elementId, a.statut, a.confirmerAlertes) });
      case "editer": return NextResponse.json({ element: await editerElement(tenantId, a.elementId, { titre: a.titre, contenu: a.contenu }) });
      case "versions": return NextResponse.json({ versions: await versions(tenantId, a.elementId) });
      case "restaurer": return NextResponse.json({ element: await restaurer(tenantId, a.elementId, a.version) });
      case "publier": return NextResponse.json(await publier(tenantId, id));
      case "archiver": await archiverStudio(tenantId, id); return NextResponse.json({ ok: true });
    }
  } catch (e: any) {
    const status = e?.status ?? (/Passage impossible/.test(e?.message) ? 409 : 500);
    if (status === 500) console.error("[api/academie/studio]", e?.message);
    return NextResponse.json({ error: status === 500 ? "Erreur serveur" : e.message }, { status });
  }
}
