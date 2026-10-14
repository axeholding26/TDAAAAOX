// Centre de contrôle des IA externes : connexions, journal, activité, réglages et révocation.
// Un compte à accès complet voit toutes les connexions de la boutique ; un membre
// d'équipe ne voit et ne gère que les siennes.
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionsSession } from "@/lib/permissions-server";
import { outilAutorise } from "@/lib/axia/droits";
import { origineSite } from "@/lib/origine-site";
import { DOMAINES, MODES, SCOPES_FINS, VARIATION_PRIX_DEFAUT } from "@/lib/controle-ia/regles";
import { revoquer } from "@/lib/controle-ia/serveur";

async function filtre() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  const tenantId = (session?.user as any)?.tenantId as string | undefined;
  if (!userId || !tenantId) return null;
  const complet = outilAutorise("deleguer_vers_agent", await permissionsSession(session));
  // Une connexion peut couvrir plusieurs boutiques : elle apparaît dans chacune.
  return { tenantId, connexions: { boutiques: { has: tenantId }, ...(complet ? {} : { userId }) } };
}

const refus = () => NextResponse.json({ error: "Non autorisé" }, { status: 401 });

export async function GET() {
  const f = await filtre();
  if (!f) return refus();
  const depuis = new Date(Date.now() - 30 * 86_400_000);
  const actionsIci = { tenantId: f.tenantId, connexion: f.connexions };
  const [connexions, actions, parOutil, parStatut] = await Promise.all([
    prisma.connexionIA.findMany({ where: { ...f.connexions, revoqueLe: null }, orderBy: { createdAt: "desc" }, select: { id: true, client: true, fournisseur: true, scopes: true, mode: true, limites: true, utiliseLe: true, createdAt: true } }),
    prisma.actionIA.findMany({ where: actionsIci, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, client: true, outil: true, risque: true, entree: true, sortie: true, statut: true, avant: true, apres: true, annuleLe: true, createdAt: true } }),
    prisma.actionIA.groupBy({ by: ["outil"], where: { ...actionsIci, createdAt: { gte: depuis } }, _count: true, _avg: { dureeMs: true }, orderBy: { _count: { outil: "desc" } }, take: 8 }),
    prisma.actionIA.groupBy({ by: ["statut"], where: { ...actionsIci, createdAt: { gte: depuis } }, _count: true }),
  ]);
  const vue = connexions.map(({ scopes, limites, ...c }) => {
    const l = (limites ?? {}) as Record<string, unknown>;
    return {
      ...c,
      variationPrixMax: Number(l.variationPrixMax ?? VARIATION_PRIX_DEFAUT), budgetPubMax: Number(l.budgetPubMax ?? 0), transactionMax: Number(l.transactionMax ?? 0),
      risqueBuilderMax: l.risqueBuilderMax === "moyen" ? "moyen" : "faible",
      droits: [
        ...Object.entries(DOMAINES).map(([dom, { libelle }]) => ({ libelle, niveau: scopes.includes(`axso:${dom}:write`) ? "modifier" : scopes.includes(`axso:${dom}:read`) ? "consulter" : "aucun" })),
        ...Object.entries(SCOPES_FINS).map(([s, libelle]) => ({ libelle, niveau: scopes.includes(s) ? "oui" : "aucun" })),
      ],
    };
  });
  return NextResponse.json({
    connexions: vue, actions, urlMcp: `${await origineSite()}/api/mcp/v1`,
    activite: {
      total: parStatut.reduce((s, x) => s + x._count, 0),
      parStatut: Object.fromEntries(parStatut.map((x) => [x.statut, x._count])),
      outils: parOutil.map((x) => ({ outil: x.outil, appels: x._count, dureeMoyenneMs: Math.round(x._avg.dureeMs ?? 0) })),
    },
  });
}

const montant = z.number().min(0).max(1_000_000_000);
const reglages = z.object({ id: z.string(), mode: z.enum(MODES as [string, ...string[]]), variationPrixMax: z.number().min(0).max(100), budgetPubMax: montant, transactionMax: montant, risqueBuilderMax: z.enum(["faible", "moyen"]).default("faible") });

export async function PATCH(req: Request) {
  const f = await filtre();
  if (!f) return refus();
  const p = reglages.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Format invalide" }, { status: 400 });
  const { id, mode, ...limites } = p.data;
  const r = await prisma.connexionIA.updateMany({ where: { id, ...f.connexions, revoqueLe: null }, data: { mode, limites } });
  return r.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Introuvable" }, { status: 404 });
}

export async function DELETE(req: Request) {
  const f = await filtre();
  if (!f) return refus();
  const { boutiques, ...reste } = f.connexions;
  const ok = await revoquer(new URL(req.url).searchParams.get("id") ?? "", { boutique: boutiques.has, ...reste });
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Introuvable" }, { status: 404 });
}
