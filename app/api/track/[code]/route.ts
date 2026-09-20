// Public affiliate click tracker — redirects to storefront with ?ref= set.
// Résout contre deux sources : AffiliationLien (B2B, lien produit précis)
// puis Affilie.codeParrainage (programme B2C individuel, redirige vers la
// boutique). L'attribution réelle au checkout se fait via ?ref= (localStorage
// axso_ref, voir CheckoutForm.tsx) — le cookie posé ici est informatif.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  try {
    const lien = await prisma.affiliationLien.findUnique({
      where: { code },
      include: {
        tenant: { select: { slug: true } },
        produit: { select: { slug: true } },
      },
    });

    if (lien && lien.actif) {
      prisma.affiliationLien.update({
        where: { id: lien.id },
        data: { clics: { increment: 1 } },
      }).catch(() => {});

      const shopSlug = lien.tenant.slug;
      const prodSlug = lien.produit?.slug;
      const dest = prodSlug
        ? `${appUrl}/${shopSlug}/produits/${prodSlug}`
        : `${appUrl}/${shopSlug}`;

      const url = new URL(dest);
      url.searchParams.set("ref", code);

      const response = NextResponse.redirect(url.toString(), { status: 302 });
      response.cookies.set("aff_ref", code, {
        maxAge: (lien.cookieJours ?? 30) * 86400,
        path: "/", sameSite: "lax", httpOnly: false,
      });
      return response;
    }

    const affilie = await prisma.affilie.findUnique({
      where: { codeParrainage: code },
      include: { tenant: { select: { slug: true } }, programme: { select: { dureeCookie: true } } },
    });

    if (affilie && affilie.statut === "actif") {
      prisma.affilie.update({
        where: { id: affilie.id },
        data: { clics: { increment: 1 } },
      }).catch(() => {});

      const url = new URL(`${appUrl}/${affilie.tenant.slug}`);
      url.searchParams.set("ref", code);

      const response = NextResponse.redirect(url.toString(), { status: 302 });
      response.cookies.set("aff_ref", code, {
        maxAge: (affilie.programme?.dureeCookie ?? 30) * 86400,
        path: "/", sameSite: "lax", httpOnly: false,
      });
      return response;
    }

    return NextResponse.redirect(appUrl || "/");
  } catch {
    return NextResponse.redirect(appUrl || "/");
  }
}
