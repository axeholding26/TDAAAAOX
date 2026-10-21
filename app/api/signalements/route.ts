// « Signaler un problème » côté marchand : lister ceux de la boutique active, en déposer un.
// Contexte (boutique, utilisateur, navigateur) pris côté serveur : jamais cru du client.
import { after, NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pousserAdmins } from "@/lib/push";
import { envoyerAlerteSignalement } from "@/lib/email";
import { schemaSignalement, limiteAtteinte, LIMITE_PAR_HEURE } from "@/lib/signalements";

async function contexte() {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId as string | undefined;
  const userId = (session?.user as any)?.id as string | undefined;
  if (!session || !tenantId || !userId) return null;
  return { tenantId, userId, nom: session.user?.name ?? "", email: session.user?.email ?? "" };
}

export async function GET() {
  const c = await contexte();
  if (!c) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const signalements = await prisma.signalement.findMany({
    where: { tenantId: c.tenantId }, orderBy: { createdAt: "desc" }, take: 50,
    select: { id: true, description: true, capture: true, page: true, statut: true, reponse: true, reponduLe: true, createdAt: true },
  });
  return NextResponse.json({ signalements });
}

export async function POST(req: NextRequest) {
  const c = await contexte();
  if (!c) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const p = schemaSignalement.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Signalement invalide" }, { status: 400 });
  // Compté en base (et non en mémoire) : la limite tient entre instances serverless.
  const n = await prisma.signalement.count({ where: { userId: c.userId, createdAt: { gte: new Date(Date.now() - 3600_000) } } });
  if (limiteAtteinte(n)) return NextResponse.json({ error: `Limite atteinte (${LIMITE_PAR_HEURE} signalements par heure). Réessayez plus tard.` }, { status: 429 });

  const { description, capture, page, ecran, erreur } = p.data;
  const appareil = [req.headers.get("user-agent")?.slice(0, 300), ecran && `écran ${ecran}`].filter(Boolean).join(" · ") || null;
  const s = await prisma.signalement.create({
    data: { tenantId: c.tenantId, userId: c.userId, description, capture: capture || null, page: page || "/dashboard", appareil, erreur },
    select: { id: true, page: true, tenant: { select: { nomBoutique: true, slug: true } } },
  });

  // Alertes Axso après la réponse : un e-mail ou un push en échec ne bloque pas le marchand.
  after(() => Promise.allSettled([
    pousserAdmins({ titre: `🛟 Problème signalé — ${s.tenant.nomBoutique}`, message: description.slice(0, 140), lien: `/admin/support?id=${s.id}`, type: "signalement" }),
    envoyerAlerteSignalement({
      a: "axedigital00@gmail.com", // même destinataire que EMAIL_RETRAITS (lib/wallet.ts)
      id: s.id, boutique: s.tenant.nomBoutique, slug: s.tenant.slug, auteur: [c.nom, c.email].filter(Boolean).join(" · "),
      description, page: s.page, appareil, erreur, capture: capture || null,
    }),
  ]));
  return NextResponse.json({ id: s.id }, { status: 201 });
}
