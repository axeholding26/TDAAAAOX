// Page Contrôle IA : automatisations créées par les IA (liste, pause / reprise, suppression) et
// webhooks sortants (où partent les événements de la boutique). Même règle d'accès que
// app/api/controle-ia : un compte à accès complet voit tout ce qui tourne dans la boutique ;
// un membre d'équipe ne voit et ne gère que ce que ses propres connexions ont créé.
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionsSession } from "@/lib/permissions-server";
import { outilAutorise } from "@/lib/axia/droits";
import { decrireDeclencheur, prochaineExecution, type Declencheur, type Etape } from "@/lib/controle-ia/automatisations";

async function filtre() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  const tenantId = (session?.user as any)?.tenantId as string | undefined;
  if (!userId || !tenantId) return null;
  const complet = outilAutorise("deleguer_vers_agent", await permissionsSession(session));
  if (complet) return { tenantId, complet, automatisations: { tenantId } };
  const siennes = await prisma.connexionIA.findMany({ where: { userId, boutiques: { has: tenantId } }, select: { id: true } });
  return { tenantId, complet, automatisations: { tenantId, connexionId: { in: siennes.map((c) => c.id) } } };
}

const refus = () => NextResponse.json({ error: "Non autorisé" }, { status: 401 });
const introuvable = () => NextResponse.json({ error: "Introuvable" }, { status: 404 });

export async function GET() {
  const f = await filtre();
  if (!f) return refus();
  const [automatisations, webhooks] = await Promise.all([
    prisma.automatisationIA.findMany({ where: f.automatisations, orderBy: { createdAt: "desc" } }),
    // Les webhooks appartiennent à la boutique (pas à une connexion) : accès complet seulement. Jamais le secret.
    f.complet ? prisma.webhookIA.findMany({ where: { tenantId: f.tenantId }, orderBy: { createdAt: "desc" }, select: { id: true, url: true, evenements: true, actif: true, echecs: true, createdAt: true } }) : [],
  ]);
  const ids = automatisations.map((a) => a.id);
  const [connexions, enAttente] = await Promise.all([
    prisma.connexionIA.findMany({ where: { id: { in: automatisations.map((a) => a.connexionId) } }, select: { id: true, client: true, revoqueLe: true } }),
    prisma.executionAutomatisation.groupBy({ by: ["automatisationId"], where: { tenantId: f.tenantId, automatisationId: { in: ids }, statut: "en_attente" }, _count: true }),
  ]);
  return NextResponse.json({
    automatisations: automatisations.map(({ connexionId, ...a }) => {
      const c = connexions.find((x) => x.id === connexionId);
      const etapes = (a.etapes as unknown as Etape[]) ?? [];
      const resume = `${decrireDeclencheur(a.declencheur as unknown as Declencheur)} : ${etapes.map((e) => (e.type === "outil" || e.type === "accord" ? `${e.outil}${e.type === "accord" ? " (avec accord)" : ""}` : e.type === "attente" ? `attente ${e.minutes} min` : "condition")).join(" → ")}`;
      return { ...a, resume, client: c?.client ?? null, connexionCoupee: !c || !!c.revoqueLe, enAttente: enAttente.find((e) => e.automatisationId === a.id)?._count ?? 0 };
    }),
    webhooks,
  });
}

const modification = z.union([
  z.object({ id: z.string(), actif: z.boolean() }),
  // Secret perdu (ou jamais reçu : création validée après coup par le marchand) : un nouveau, montré une seule fois.
  z.object({ webhook: z.string(), action: z.literal("nouveau_secret") }),
]);

export async function PATCH(req: Request) {
  const f = await filtre();
  if (!f) return refus();
  const p = modification.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Format invalide" }, { status: 400 });
  if ("webhook" in p.data) {
    if (!f.complet) return refus();
    const secret = `whsec_${randomBytes(24).toString("base64url")}`;
    const r = await prisma.webhookIA.updateMany({ where: { id: p.data.webhook, tenantId: f.tenantId }, data: { secret, actif: true, echecs: 0 } });
    return r.count ? NextResponse.json({ ok: true, secret }) : introuvable();
  }
  const a = await prisma.automatisationIA.findFirst({ where: { id: p.data.id, ...f.automatisations } });
  if (!a) return introuvable();
  const d = a.declencheur as unknown as Declencheur;
  const { actif } = p.data;
  await prisma.automatisationIA.update({ where: { id: a.id }, data: { actif, prochaineExecution: actif && d?.type === "horaire" ? prochaineExecution(d, new Date()) : null } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const f = await filtre();
  if (!f) return refus();
  const params = new URL(req.url).searchParams;
  if (params.get("webhook")) {
    if (!f.complet) return refus();
    const r = await prisma.webhookIA.deleteMany({ where: { id: params.get("webhook")!, tenantId: f.tenantId } });
    return r.count ? NextResponse.json({ ok: true }) : introuvable();
  }
  const a = await prisma.automatisationIA.findFirst({ where: { id: params.get("id") ?? "", ...f.automatisations }, select: { id: true } });
  if (!a) return introuvable();
  await prisma.$transaction([
    prisma.executionAutomatisation.deleteMany({ where: { automatisationId: a.id, tenantId: f.tenantId } }),
    prisma.automatisationIA.delete({ where: { id: a.id } }),
  ]);
  return NextResponse.json({ ok: true });
}
