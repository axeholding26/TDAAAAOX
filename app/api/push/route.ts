// Abonnement d'un appareil aux notifications push (voir lib/push.ts, public/sw.js).
//   GET    ?espace=…              clé publique VAPID (rien de secret)
//   POST   { espace, abonnement } enregistre cet appareil pour le compte connecté
//   DELETE { endpoint, espace }   désabonne cet appareil de cet espace
//   POST   ?test=1 { espace }     envoie une notification d'essai à ses propres appareils
// Le compte vient TOUJOURS de la session ; l'espace doit correspondre à ses droits.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdminSessionPour } from "@/lib/admin-auth";
import { boutiquesDuCompte } from "@/lib/tenant";
import { ESPACES, clePubliqueVapid, pousserTest, type Espace } from "@/lib/push";

// Le serveur enverra des requêtes à cette adresse : seulement les services de push des navigateurs (pas de SSRF).
const SERVICES_PUSH = /^(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)$/;
export const endpointAccepte = (e: string) => {
  try { const u = new URL(e); return u.protocol === "https:" && !u.port && SERVICES_PUSH.test(u.hostname); } catch { return false; }
};

const Abonnement = z.object({
  espace: z.enum(ESPACES as [Espace, ...Espace[]]),
  abonnement: z.object({ endpoint: z.string().max(1000).refine(endpointAccepte, "Service de push inconnu"), keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }) }),
});

/** Compte autorisé dans cet espace, sinon null. */
async function compte(espace: Espace): Promise<string | null> {
  if (espace === "admin") return (await getAdminSessionPour("marchands"))?.userId ?? null;
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return null;
  if (espace === "livreur") return (await prisma.livreur.findUnique({ where: { userId }, select: { id: true } })) ? userId : null;
  const { proprietaire, membre } = await boutiquesDuCompte(userId);
  return proprietaire.length || membre.length ? userId : null;
}

export async function GET() {
  const cle = clePubliqueVapid();
  return cle ? NextResponse.json({ cle }) : NextResponse.json({ erreur: "Notifications push non configurées (clés VAPID absentes)" }, { status: 503 });
}

export async function POST(req: NextRequest) {
  const corps = await req.json().catch(() => null);
  if (req.nextUrl.searchParams.get("test")) {
    const espace = z.enum(ESPACES as [Espace, ...Espace[]]).safeParse(corps?.espace);
    if (!espace.success) return NextResponse.json({ erreur: "Espace invalide" }, { status: 400 });
    const userId = await compte(espace.data);
    if (!userId) return NextResponse.json({ erreur: "Non autorisé" }, { status: 401 });
    // Raison précise affichée à l'utilisateur : clés absentes, appareil inconnu ou envoi refusé.
    if (!clePubliqueVapid()) return NextResponse.json({ erreur: "Notifications push non configurées sur le serveur (clés VAPID absentes)" }, { status: 503 });
    const bilan = await pousserTest(userId, espace.data);
    if (bilan.envoyes) return NextResponse.json(bilan);
    return NextResponse.json({ ...bilan, erreur: bilan.echecs ? "Le service de notifications de l'appareil a refusé l'envoi" : "Cet appareil n'est pas encore enregistré" }, { status: bilan.echecs ? 502 : 404 });
  }
  const p = Abonnement.safeParse(corps);
  if (!p.success) return NextResponse.json({ erreur: "Abonnement invalide" }, { status: 400 });
  const userId = await compte(p.data.espace);
  if (!userId) return NextResponse.json({ erreur: "Non autorisé" }, { status: 401 });
  const { endpoint, keys } = p.data.abonnement;
  const appareil = (req.headers.get("user-agent") ?? "").slice(0, 200) || null;
  // Même appareil et même espace : il change de compte, jamais deux lignes.
  await prisma.abonnementPush.upsert({
    where: { endpoint_espace: { endpoint, espace: p.data.espace } },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId, espace: p.data.espace, appareil },
    update: { p256dh: keys.p256dh, auth: keys.auth, userId, appareil },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ erreur: "Non autorisé" }, { status: 401 });
  const corps = await req.json().catch(() => null);
  await prisma.abonnementPush.deleteMany({ where: { endpoint: String(corps?.endpoint ?? ""), userId, ...(corps?.espace && { espace: String(corps.espace) }) } });
  return NextResponse.json({ ok: true });
}
