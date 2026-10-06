export const dynamic = "force-dynamic";

// Storefront — Page checkout
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { boutiqueVisible } from "@/lib/tenant";
import Link from "next/link";
import { CheckoutForm, type ArticleCommande } from "@/components/storefront/CheckoutForm";
import { prixClient } from "@/lib/pricing";
import { habillageDesign } from "@/components/storefront/templates/HabillageDesign";
import { resolveConfigVitrine } from "@/lib/vitrine-design";
import { Lock } from "lucide-react";
import { getT } from "@/lib/i18n/serveur";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ produit?: string; quantite?: string; variante?: string }>;
}

// Le produit commandé (bouton Commander de sa fiche) : prix recalculé ici
// depuis la base, comme le refera la création de la commande.
async function articleCommande(tenantId: string, taux: number, q: { produit?: string; quantite?: string; variante?: string }): Promise<ArticleCommande | null> {
  if (!q.produit) return null;
  const p = await prisma.produit.findFirst({
    where: { id: q.produit, tenantId, actif: true },
    select: { id: true, nom: true, type: true, prix: true, images: true, variantes: { where: { actif: true }, select: { nom: true, valeur: true, prix: true } } },
  });
  if (!p) return null;
  const variante = q.variante ? p.variantes.find((v) => `${v.nom}: ${v.valeur}` === q.variante) : undefined;
  return {
    produitId: p.id, nom: p.nom, type: p.type, imageUrl: p.images[0],
    prix: prixClient(variante?.prix ?? p.prix, taux),
    quantite: p.type === "physique" || p.type === "dropshipping" ? Math.min(Math.max(Math.floor(Number(q.quantite) || 1), 1), 999) : 1,
    variante: variante ? q.variante : undefined,
  };
}

export default async function CheckoutPage({ params, searchParams }: Props) {
  const t = await getT();
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  // Même règle que les autres pages : publique si active, visible par le propriétaire (aperçu du Constructeur).
  if (!tenant || !(await boutiqueVisible(tenant))) notFound();

  const article = await articleCommande(tenant.id, tenant.commissionRate ?? 0.06, await searchParams);
  const cfg = await resolveConfigVitrine(tenant.themeId, tenant.id, (tenant.themeConfig as Record<string, any>) || {});
  const theme = cfg.colors;

  // Boutique à design : même en-tête / pied de page que le reste de la boutique.
  const Habillage = habillageDesign(cfg);
  if (Habillage) {
    return (
      <Habillage>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <CheckoutForm paysBoutique={tenant.pays} theme={theme} slug={slug} devise={tenant.devise} tenantId={tenant.id} nomBoutique={tenant.nomBoutique}
            logoUrl={tenant.logoUrl || undefined} parametresCommande={(tenant.parametresCommande as any) || {}} article={article} />
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
            <span className="text-xl font-bold font-playfair" style={{ color: theme.accent }}>{t(tenant.nomBoutique)}</span>
          </Link>
          <div className="flex items-center gap-2 text-sm opacity-50">
            <span className="text-xs">{t("Paiement sécurisé")}</span>
            <Lock size={14} />
          </div>
        </div>
      </nav>

      {/* Étapes */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex items-center gap-2 text-xs opacity-50">
          {article && <><Link href={`/${slug}/produits/${article.produitId}`}>{t(article.nom)}</Link><span>›</span></>}
          <span className="opacity-100 font-semibold" style={{ color: theme.accent }}>{t("Informations")}</span>
          <span>›</span>
          <span>{t("Paiement")}</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <CheckoutForm paysBoutique={tenant.pays} theme={theme} slug={slug} devise={tenant.devise} tenantId={tenant.id} nomBoutique={tenant.nomBoutique} logoUrl={tenant.logoUrl || undefined}
          parametresCommande={(tenant.parametresCommande as any) || {}} article={article} />
      </div>

      <footer className="border-t py-8 text-center text-sm opacity-50" style={{ borderColor: `${theme.accent}20` }}>
        <p>{t("Paiement sécurisé via NotchPay · SSL 256-bit")}</p>
      </footer>
    </div>
  );
}
