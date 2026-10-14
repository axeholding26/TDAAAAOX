// Builder IA, côté marchand (page Contrôle IA) : verrou d'urgence, brouillon en cours,
// versions et retour à une version, activité et métriques des modifications faites par les IA.
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionsSession } from "@/lib/permissions-server";
import { abandonnerBrouillon, lireBrouillon, restaurerVersion } from "@/lib/builder/moteur";
import { comparer, resumer } from "@/lib/builder/diff";
import { ErreurBuilder } from "@/lib/builder/types";
import { lienApercuMarchand } from "@/lib/builder/apercu-serveur";

async function acces() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  const tenantId = (session?.user as any)?.tenantId as string | undefined;
  if (!userId || !tenantId) return null;
  // Design de la boutique : il faut le droit d'écriture sur la boutique pour décider.
  const ecriture = (await permissionsSession(session)).boutique === "ecriture";
  return { userId, tenantId, ecriture };
}

export async function GET() {
  const a = await acces();
  if (!a) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const depuis = new Date(Date.now() - 30 * 86_400_000);
  const builder = { tenantId: a.tenantId, outil: { startsWith: "axso_builder_" }, createdAt: { gte: depuis } };
  const [t, b, versions, parStatut, duree, sessions, publications, restaurations, activite] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: a.tenantId }, select: { editionIaBloquee: true } }),
    lireBrouillon(a.tenantId),
    prisma.versionBoutique.findMany({ where: { tenantId: a.tenantId }, orderBy: { numero: "desc" }, take: 20, select: { numero: true, type: true, client: true, raison: true, createdAt: true, changements: true } }),
    prisma.actionIA.groupBy({ by: ["statut"], where: builder, _count: true }),
    prisma.actionIA.aggregate({ where: builder, _avg: { dureeMs: true } }),
    prisma.actionIA.findMany({ where: builder, distinct: ["connexionId"], select: { connexionId: true } }),
    prisma.versionBoutique.count({ where: { tenantId: a.tenantId, type: "publication", createdAt: { gte: depuis } } }),
    prisma.versionBoutique.count({ where: { tenantId: a.tenantId, type: "avant_restauration", createdAt: { gte: depuis } } }),
    prisma.actionIA.findMany({ where: { ...builder, statut: { in: ["execute", "accord_demande"] } }, orderBy: { createdAt: "desc" }, take: 15, select: { id: true, client: true, outil: true, risque: true, statut: true, createdAt: true, sortie: true } }),
  ]);
  const n = (s: string) => parStatut.find((x) => x.statut === s)?._count ?? 0;
  const changements = b.existe ? comparer(b.enLigne, b.config) : [];
  return NextResponse.json({
    verrou: !!t?.editionIaBloquee,
    brouillon: b.existe ? { changements: changements.length, resume: resumer(changements, 12), enLigneAChange: b.enLigneAChange, apercu: await lienApercuMarchand(a.tenantId) } : null,
    versions: versions.map(({ changements, ...v }) => ({ ...v, nbChangements: Array.isArray(changements) ? changements.length : 0 })),
    activite: activite.map((x) => ({ ...x, sortie: x.sortie.split("\n").slice(0, 4).join("\n").slice(0, 300) })),
    metriques: {
      builder_actions_total: parStatut.reduce((s, x) => s + x._count, 0), builder_actions_failed: n("echec"), builder_policy_blocks: n("refuse"),
      builder_approval_requests: n("accord_demande"), builder_publish_total: publications, builder_actions_rolled_back: restaurations,
      builder_ai_sessions: sessions.length, builder_average_execution_time: Math.round(duree._avg.dureeMs ?? 0),
    },
    peutDecider: a.ecriture,
  });
}

const corps = z.union([
  z.object({ verrou: z.boolean() }),
  z.object({ restaurer: z.number().int().min(1) }),
  z.object({ abandonner: z.literal(true) }),
]);

export async function PATCH(req: Request) {
  const a = await acces();
  if (!a) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!a.ecriture) return NextResponse.json({ error: "Ton rôle ne permet pas de modifier la boutique." }, { status: 403 });
  const p = corps.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Format invalide" }, { status: 400 });
  try {
    if ("verrou" in p.data) {
      // Effet immédiat : la passerelle relit ce champ à chaque appel d'une IA.
      await prisma.tenant.update({ where: { id: a.tenantId }, data: { editionIaBloquee: p.data.verrou } });
      return NextResponse.json({ ok: true });
    }
    if ("restaurer" in p.data) {
      const r = await restaurerVersion(a.tenantId, p.data.restaurer, "publie", { userId: a.userId });
      return NextResponse.json({ ok: true, resume: resumer(r.changements, 12) });
    }
    await abandonnerBrouillon(a.tenantId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ErreurBuilder) return NextResponse.json({ error: err.message }, { status: err.code === "NOT_FOUND" ? 404 : 409 });
    throw err;
  }
}
