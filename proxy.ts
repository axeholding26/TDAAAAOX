// Proxy multi-tenant Axso — Next.js 16 (remplace middleware.ts)
// Routage par sous-domaine ou domaine custom
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { slugPourDomaine } from "@/lib/domaines";
import { auth } from "@/lib/auth";
import { requireNiveau } from "@/lib/permissions-server";
import { moduleApi } from "@/lib/permissions-api";

const DOMAINE_APP = process.env.NEXT_PUBLIC_AXSO_DOMAIN || "localhost:3000";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host") || "";

  // API : jamais préfixées du slug (appelées en /api/... depuis une vitrine sur
  // sous-domaine ou domaine custom). Un membre d'équipe connecté n'atteint que
  // les modules que sa grille lui ouvre (lib/permissions-api.ts).
  if (pathname.startsWith("/api/")) {
    const module = moduleApi(pathname);
    if (module) {
      const session = await auth();
      if ((session?.user as any)?.tenantId) {
        const refus = await requireNiveau(session, module, request.method === "GET" || request.method === "HEAD" ? "lecture" : "ecriture");
        if (refus) return NextResponse.json({ error: refus.error }, { status: refus.status });
      }
    }
    return NextResponse.next();
  }

  // Ignorer les fichiers statiques
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Détecter si c'est un sous-domaine de boutique
  const estSousDomaine =
    hostname !== DOMAINE_APP &&
    hostname.endsWith(`.${DOMAINE_APP}`) &&
    !hostname.startsWith("www.");

  // *.vercel.app (preview ET alias de production tant qu'aucun domaine
  // personnalisé n'est branché) ne doit JAMAIS être traité comme le domaine
  // custom d'un tenant — ce serait le cas pour absolument tout hostname
  // différent de NEXT_PUBLIC_AXSO_DOMAIN, y compris l'infrastructure de
  // déploiement de l'app elle-même. Cause vérifiée du 404 sur toute l'app en
  // prod Vercel (ex: https://tdaaaaox.vercel.app/) : la réponse portait
  // `x-matched-path: /[slug]` — le proxy réécrivait "/" en "/tdaaaaox.vercel.app"
  // (hostname pris comme slug de boutique), qui n'existe pas en base → 404.
  // Se reproduit pour N'IMPORTE QUEL hostname Vercel tant que
  // NEXT_PUBLIC_AXSO_DOMAIN ne correspond pas EXACTEMENT au hostname visité
  // (donc systématiquement en preview, chaque déploiement ayant un
  // sous-domaine *.vercel.app unique et imprévisible à l'avance).
  const estDomaineVercel = hostname.endsWith(".vercel.app");

  const estDomainePropre =
    hostname !== DOMAINE_APP &&
    !hostname.endsWith(`.${DOMAINE_APP}`) &&
    !hostname.startsWith("localhost") &&
    !estDomaineVercel;

  if (estSousDomaine || estDomainePropre) {
    // Domaine propre : le nom de domaine n'est PAS le slug — recherche en base
    // (boutique publiée dont customDomain = ce domaine, cache 60 s, voir lib/domaines.ts).
    const slug = estSousDomaine ? hostname.replace(`.${DOMAINE_APP}`, "") : await slugPourDomaine(hostname);
    if (!slug) return new NextResponse("Aucune boutique n'est reliée à ce domaine.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });

    // Les liens internes de la vitrine sont en /{slug}/… : déjà préfixés, on les sert tels quels.
    if (pathname === `/${slug}` || pathname.startsWith(`/${slug}/`)) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = `/${slug}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  // Expose pathname to server components via REQUEST header
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  // Aperçu du Constructeur (cookie posé par /dashboard/builder) : la vitrine
  // s'affiche dans le cadre d'aperçu de l'éditeur, même origine uniquement.
  response.headers.set("X-Frame-Options", request.cookies.get("axso_apercu")?.value === "1" ? "SAMEORIGIN" : "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
