export const dynamic = "force-dynamic";

// Storefront — Page checkout
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { boutiqueVisible } from "@/lib/tenant";
import Link from "next/link";
import { CheckoutForm } from "@/components/storefront/CheckoutForm";
import { habillageDesign } from "@/components/storefront/templates/HabillageDesign";
import { resolveConfigVitrine } from "@/lib/vitrine-design";
import { Lock } from "lucide-react";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function CheckoutPage({ params }: Props) {
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  // Même règle que les autres pages : publique si active, visible par le propriétaire (aperçu du Constructeur).
  if (!tenant || !(await boutiqueVisible(tenant))) notFound();

  const cfg = await resolveConfigVitrine(tenant.themeId, tenant.id, (tenant.themeConfig as Record<string, any>) || {});
  const theme = cfg.colors;

  // Boutique à design : même en-tête / pied de page que le reste de la boutique.
  const Habillage = habillageDesign(cfg);
  if (Habillage) {
    return (
      <Habillage>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <CheckoutForm paysBoutique={tenant.pays} theme={theme} slug={slug} devise={tenant.devise} tenantId={tenant.id} nomBoutique={tenant.nomBoutique}
            logoUrl={tenant.logoUrl || undefined} parametresCommande={(tenant.parametresCommande as any) || {}} />
        </div>
      </Habillage>
    );
  }

  return (
    <div style={{ backgroundColor: theme.fond, color: theme.texte, minHeight: "100vh" }}>
      {/* Navbar minimal */}
      <nav style={{ borderBottomColor: `${theme.accent}20` }} className="border-b">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href={`/${slug}`}>
            <span className="text-xl font-bold font-playfair" style={{ color: theme.accent }}>{tenant.nomBoutique}</span>
          </Link>
          <div className="flex items-center gap-2 text-sm opacity-50">
            <span className="text-xs">Paiement sécurisé</span>
            <Lock size={14} />
          </div>
        </div>
      </nav>

      {/* Étapes */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex items-center gap-2 text-xs opacity-50">
          <Link href={`/${slug}/panier`}>Panier</Link>
          <span>›</span>
          <span className="opacity-100 font-semibold" style={{ color: theme.accent }}>Informations</span>
          <span>›</span>
          <span>Paiement</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <CheckoutForm paysBoutique={tenant.pays} theme={theme} slug={slug} devise={tenant.devise} tenantId={tenant.id} nomBoutique={tenant.nomBoutique} logoUrl={tenant.logoUrl || undefined}
          parametresCommande={(tenant.parametresCommande as any) || {}} />
      </div>

      <footer className="border-t py-8 text-center text-sm opacity-50" style={{ borderColor: `${theme.accent}20` }}>
        <p>Paiement sécurisé via NotchPay · SSL 256-bit</p>
      </footer>
    </div>
  );
}
