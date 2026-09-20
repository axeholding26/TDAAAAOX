export const dynamic = "force-dynamic";

// Storefront — Page panier
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CartContent } from "@/components/storefront/CartContent";
import { ImportedLiteralCartShell } from "@/components/storefront/templates/ImportedLiteralCartShell";
import { resolveThemeConfigAsync } from "@/lib/theme-config-server";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function PanierPage({ params }: Props) {
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant || tenant.statut !== "active") notFound();

  const cfg = await resolveThemeConfigAsync(tenant.themeId, tenant.id, tenant.themeConfig as Record<string, any>);
  const theme = cfg.colors;

  if (cfg.builderHtmlPanierChrome) {
    return <ImportedLiteralCartShell cfg={cfg} slug={slug} devise={tenant.devise} />;
  }

  return (
    <div style={{ backgroundColor: theme.fond, color: theme.texte, minHeight: "100vh" }}>
      {/* Navbar */}
      <nav style={{ borderBottomColor: `${theme.accent}20` }} className="sticky top-0 z-50 backdrop-blur-lg border-b">
        <div style={{ backgroundColor: `${theme.fond}cc` }} className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href={`/${slug}`}>
            <span className="text-xl font-bold font-playfair" style={{ color: theme.accent }}>{tenant.nomBoutique}</span>
          </Link>
          <Link href={`/${slug}/produits`} className="text-sm hover:opacity-80 transition-opacity">← Continuer les achats</Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold font-playfair mb-8" style={{ color: theme.accent }}>Mon Panier</h1>
        <CartContent theme={theme} slug={slug} devise={tenant.devise} />
      </div>

      <footer className="border-t py-8 text-center text-sm opacity-50" style={{ borderColor: `${theme.accent}20` }}>
        <p>{tenant.nomBoutique} · Propulsé par <span style={{ color: theme.accent }}>Axso</span></p>
      </footer>
    </div>
  );
}
