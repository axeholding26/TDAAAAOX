// Ouvre l'aperçu du brouillon d'une boutique (lien renvoyé par axso_builder_preview).
// Le jeton est vérifié ici ; la vitrine lit ensuite le cookie (lib/vitrine-design.ts).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COOKIE_APERCU, DUREE_APERCU, lireJetonApercu } from "@/lib/builder/apercu";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jeton = url.searchParams.get("j");
  const tenantId = lireJetonApercu(jeton);
  if (!tenantId) return new NextResponse("Lien d'aperçu expiré ou invalide : redemande-le à ton assistant.", { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
  if (!t) return new NextResponse("Boutique introuvable.", { status: 404 });
  // Chemin interne à la boutique seulement (jamais une autre adresse).
  const page = (url.searchParams.get("page") ?? "").replace(/[^a-z0-9/_-]/gi, "").replace(/^\/+/, "");
  const res = NextResponse.redirect(new URL(`/${t.slug}${page ? `/${page}` : ""}`, url.origin));
  res.cookies.set(COOKIE_APERCU, jeton!, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: DUREE_APERCU, path: "/" });
  return res;
}
