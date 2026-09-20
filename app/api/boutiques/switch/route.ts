// Change la boutique active de la session (multi-boutique Palier 2) —
// bascule INSTANTANÉE, sans reconnexion. On persiste le choix sur
// User.tenantId (reflété au prochain login normal) ET on réécrit
// directement le cookie de session JWT en cours avec le nouveau tenantId,
// via les mêmes encode/decode qu'Auth.js utilise en interne. Ça évite
// d'avoir à monter un <SessionProvider> côté client juste pour déclencher
// useSession().update() — même résultat, sans le risque de régression sur
// l'ensemble de l'arbre du dashboard.
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getToken, encode } from "next-auth/jwt";

const SECRET = process.env.AUTH_SECRET!;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const userId = (session.user as any)?.id;

  const { tenantId } = await req.json();
  if (!tenantId || typeof tenantId !== "string") {
    return NextResponse.json({ error: "tenantId requis" }, { status: 400 });
  }

  const acces = await prisma.proprietaireBoutique.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
  });
  if (!acces) return NextResponse.json({ error: "Vous ne possédez pas cette boutique" }, { status: 403 });

  await prisma.user.update({ where: { id: userId }, data: { tenantId } });

  const secureCookie = req.nextUrl.protocol === "https:";
  const cookieName = secureCookie ? "__Secure-authjs.session-token" : "authjs.session-token";

  const res = NextResponse.json({ success: true });

  try {
    const token = await getToken({ req, secret: SECRET, secureCookie });
    if (token) {
      token.tenantId = tenantId;
      const nouveauJwt = await encode({ token, secret: SECRET, salt: cookieName });
      res.cookies.set(cookieName, nouveauJwt, {
        httpOnly: true,
        secure: secureCookie,
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });
    }
  } catch (err) {
    // Si la réécriture du cookie échoue pour une raison quelconque, le
    // changement reste persisté en base (User.tenantId) — une reconnexion
    // suffira à récupérer la bonne boutique, aucune donnée n'est perdue.
    console.error("[boutiques/switch] Échec réécriture cookie session:", err);
  }

  return res;
}
