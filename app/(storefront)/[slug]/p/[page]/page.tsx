export const dynamic = "force-dynamic";

// Pages libres de la boutique (themeConfig.pagesPerso, créées par le Builder) : /<boutique>/p/<page>.
// Même rendu que l'accueil construit (BlockTreeRenderer), entre l'en-tête et le pied de page
// de l'accueil. Une page « brouillon » reste invisible du public, même publiée en ligne ;
// l'aperçu du Builder (cookie signé) la montre, avec le brouillon de la boutique.
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { boutiqueVisible } from "@/lib/tenant";
import { resolveConfigVitrine } from "@/lib/vitrine-design";
import { brouillonEnApercu } from "@/lib/vitrine-design";
import { BlockTreeRenderer } from "@/components/storefront/blocks/BlockTreeRenderer";
import { habillageDesign } from "@/components/storefront/templates/HabillageDesign";
import { ordonnerParZone, zoneDe } from "@/lib/block-tree";
import { cssSectionsDesign } from "@/lib/scope-css";
import type { PagePerso } from "@/lib/builder/operations/structure";

interface Props {
  params: Promise<{ slug: string; page: string }>;
}

/** La page demandée, telle que ce visiteur a le droit de la voir (null sinon). */
async function pageVisible(slug: string, cle: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, statut: true, nomBoutique: true, themeId: true, themeConfig: true } });
  if (!tenant) return null;
  // Le brouillon si ce navigateur a un aperçu valide pour cette boutique, sinon la version en ligne.
  const apercu = (await brouillonEnApercu(tenant.id)) ?? undefined;
  const source = apercu ?? ((tenant.themeConfig ?? {}) as Record<string, any>);
  const page = (source.pagesPerso ?? {})[cle] as PagePerso | undefined;
  if (!page || (page.statut !== "publiee" && !apercu)) return null;
  return { tenant, page };
}

export async function generateMetadata({ params }: Props) {
  const { slug, page } = await params;
  const v = await pageVisible(slug, page);
  if (!v) return { title: "Page introuvable" };
  const { page: p, tenant } = v;
  return {
    title: p.seo?.titre || `${p.nom} — ${tenant.nomBoutique}`,
    description: p.seo?.description || undefined,
    openGraph: { images: p.seo?.image ? [{ url: p.seo.image }] : [] },
    ...(p.visibilite === "lien" || p.statut !== "publiee" || p.seo?.noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function PageLibre({ params }: Props) {
  const { slug, page } = await params;
  const v = await pageVisible(slug, page);
  if (!v || !(await boutiqueVisible(v.tenant))) notFound();
  const { tenant, page: p } = v;

  const cfg = await resolveConfigVitrine(tenant.themeId, tenant.id, tenant.themeConfig as Record<string, any>);
  const layoutCfg = cfg.layout ?? {};
  const CONTAINER = layoutCfg.largeurContainer === "100%" ? "max-w-full" : `max-w-[${layoutCfg.largeurContainer || "1280px"}]`;
  const SECTION_PY_MAP: Record<string, string> = { sm: "py-8 sm:py-10", md: "py-12 sm:py-16", lg: "py-16 sm:py-20", xl: "py-20 sm:py-28" };
  const SECTION_PY = SECTION_PY_MAP[layoutCfg.paddingSection || "lg"];

  // En-tête et pied de page : ceux de l'accueil, sauf si la page a les siens.
  const propre = p.builderTree ?? [];
  const accueil = cfg.builderTree ?? [];
  const herite = (z: "header" | "footer") => (propre.some((n) => zoneDe(n) === z) ? [] : accueil.filter((n) => zoneDe(n) === z));
  const nodes = ordonnerParZone([...herite("header"), ...propre, ...herite("footer")]);

  const cssDesign = cssSectionsDesign(cfg as any);
  const contenu = (
    <div style={{ containerType: "inline-size" }}>
      {cssDesign && <style dangerouslySetInnerHTML={{ __html: cssDesign }} />}
      <BlockTreeRenderer nodes={nodes} ctx={{ slug, colors: cfg.colors, container: CONTAINER, sectionPy: SECTION_PY, tenantId: tenant.id, editable: false }} />
    </div>
  );

  // Accueil sans zones En-tête / Pied de page : habillage du design importé s'il existe.
  if (!nodes.some((n) => zoneDe(n) === "header")) {
    const Habillage = habillageDesign(cfg);
    if (Habillage) return <Habillage>{contenu}</Habillage>;
  }
  return <div style={{ backgroundColor: cfg.colors.fond, color: cfg.colors.texte, minHeight: "100vh" }}>{contenu}</div>;
}
