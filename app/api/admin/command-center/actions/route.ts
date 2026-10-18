// Moteur d'actions : assigner un insight à une équipe, l'ignorer, notifier des
// marchands (données réelles uniquement), cocher une tâche. Tout est journalisé.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSessionPour } from "@/lib/admin-auth";
import { peutAgir } from "@/lib/command-center/rbac";
import { lireReglages, ecrireReglage, journaliser } from "@/lib/command-center/serveur";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const limite = rateLimit({ windowMs: 60_000, max: 20, keyPrefix: "cc-actions" });

const schema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("assigner"), titre: z.string().min(1).max(200), assigneA: z.string().min(1).max(40), lien: z.string().max(400).nullable().optional(), insightId: z.string().max(120).optional() }),
  z.object({ type: z.literal("ignorer"), insightId: z.string().min(1).max(120) }),
  z.object({ type: z.literal("retablir"), insightId: z.string().min(1).max(120) }),
  z.object({ type: z.literal("notifier"), ids: z.array(z.string().min(1).max(40)).min(1).max(500), titre: z.string().min(1).max(200), message: z.string().min(10).max(500), insightId: z.string().max(120).optional() }),
  z.object({ type: z.literal("tache"), id: z.string().min(1).max(60), statut: z.enum(["a_faire", "fait"]) }),
]);

export async function POST(req: NextRequest) {
  const session = await getAdminSessionPour("cc");
  if (!session || !peutAgir(session.role)) return NextResponse.json({ erreur: "Votre rôle ne permet pas cette action" }, { status: 403 });
  const l = limite.check(session.userId);
  if (!l.success) return rateLimitResponse(l.reset);
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ erreur: "Requête invalide" }, { status: 400 });
  const a = p.data;
  const r = await lireReglages();

  // ponytail: lecture-modification-écriture sans verrou sur la liste ; suffisant pour une petite équipe, passer à une table dédiée si plusieurs admins agissent en même temps.
  switch (a.type) {
    case "assigner": {
      const tache = { id: `t${Date.now().toString(36)}`, titre: a.titre, assigneA: a.assigneA, creePar: session.email, creeLe: Date.now(), statut: "a_faire" as const, lien: a.lien ?? undefined };
      await ecrireReglage(session, "taches", [tache, ...r.taches].slice(0, 200));
      return NextResponse.json({ message: `Assigné à ${a.assigneA}` });
    }
    case "ignorer":
      await ecrireReglage(session, "ignores", [...new Set([a.insightId, ...r.ignores])].slice(0, 500));
      return NextResponse.json({ message: "Insight ignoré" });
    case "retablir":
      await ecrireReglage(session, "ignores", r.ignores.filter((x) => x !== a.insightId));
      return NextResponse.json({ message: "Insight rétabli" });
    case "tache":
      await ecrireReglage(session, "taches", r.taches.map((t) => (t.id === a.id ? { ...t, statut: a.statut } : t)));
      return NextResponse.json({ message: a.statut === "fait" ? "Tâche terminée" : "Tâche rouverte" });
    case "notifier": {
      // Seules de vraies boutiques reçoivent la notification (les identifiants de démo n'existent pas en base).
      const boutiques = await prisma.tenant.findMany({ where: { id: { in: a.ids } }, select: { id: true } });
      if (!boutiques.length) return NextResponse.json({ erreur: "Aucune boutique réelle dans la sélection" }, { status: 400 });
      await prisma.notificationMarchand.createMany({ data: boutiques.map((b) => ({ tenantId: b.id, type: "message_axso", titre: a.titre.slice(0, 120), message: a.message, lien: "/dashboard/abonnement" })) });
      await journaliser(session, "marchands.notifier", "NotificationMarchand", null, null, { ids: boutiques.map((b) => b.id), titre: a.titre, message: a.message });
      return NextResponse.json({ message: `${boutiques.length} marchand${boutiques.length > 1 ? "s" : ""} notifié${boutiques.length > 1 ? "s" : ""}` });
    }
  }
}
