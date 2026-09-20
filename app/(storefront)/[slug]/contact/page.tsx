export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Mail, Phone, MapPin, MessageCircle } from "lucide-react";
import { resolveThemeConfigAsync } from "@/lib/theme-config-server";
import { StorefrontNavbar } from "@/components/storefront/StorefrontNavbar";
import { CustomSectionsRenderer } from "@/components/storefront/CustomSectionsRenderer";
import { ContactForm } from "@/components/storefront/ContactForm";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { nomBoutique: true } });
  if (!tenant) return { title: "Boutique introuvable" };
  return { title: `Contact — ${tenant.nomBoutique}` };
}

// Même patron que a-propos/page.tsx : navbar/footer dupliqués (convention
// établie sur toutes les pages storefront), coordonnées déjà en base
// (téléphone/whatsapp/email/adresse) affichées ici pour la première fois de
// façon dédiée, + formulaire de contact réel (POST /api/storefront/[slug]/contact).
export default async function ContactPage({ params }: Props) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    include: { collections: { where: { actif: true }, take: 6, orderBy: { createdAt: "desc" } } },
  });
  if (!tenant || tenant.statut !== "active") notFound();

  const cfg = await resolveThemeConfigAsync(tenant.themeId, tenant.id, tenant.themeConfig as Record<string, any>);
  const c = cfg.colors;
  const layoutCfg = cfg.layout ?? {};
  const CONTAINER = layoutCfg.largeurContainer === "100%" ? "max-w-full" : `max-w-[${layoutCfg.largeurContainer || "1280px"}]`;
  const SECTION_PY_MAP: Record<string, string> = { sm: "py-8 sm:py-10", md: "py-12 sm:py-16", lg: "py-16 sm:py-20", xl: "py-20 sm:py-28" };
  const SECTION_PY = SECTION_PY_MAP[layoutCfg.paddingSection || "lg"];

  const contactPage = cfg.contactPage;
  const afficherFormulaire = contactPage?.afficherFormulaire ?? true;

  const coordonnees = [
    tenant.telephone && { Icon: Phone, label: "Téléphone", value: tenant.telephone, href: `tel:${tenant.telephone.replace(/\s/g, "")}` },
    tenant.whatsapp && { Icon: MessageCircle, label: "WhatsApp", value: tenant.whatsapp, href: `https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}` },
    tenant.email && { Icon: Mail, label: "Email", value: tenant.email, href: `mailto:${tenant.email}` },
    tenant.adresse && { Icon: MapPin, label: "Adresse", value: tenant.adresse, href: undefined },
  ].filter(Boolean) as Array<{ Icon: any; label: string; value: string; href?: string }>;

  return (
    <div style={{ backgroundColor: c.fond, color: c.texte, minHeight: "100vh" }}>
      <StorefrontNavbar
        slug={slug}
        nomBoutique={tenant.nomBoutique}
        logoUrl={tenant.logoUrl}
        accent={c.accent}
        fond={c.fond}
        texte={c.texte}
        radius={cfg.radius}
        collections={tenant.collections}
        certifie={tenant.certifie}
        navStyle={cfg.navigationStyle}
        showAbout={cfg.aboutPage?.actif}
        showContact={cfg.contactPage?.actif}
      />

      <div className={`${CONTAINER} mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-4`}>
        <h1 className="text-3xl sm:text-4xl font-bold font-playfair" style={{ color: c.texte }}>Contact</h1>
        <p className="text-sm mt-2" style={{ opacity: 0.5 }}>
          <Link href={`/${slug}`} className="hover:opacity-100 transition-opacity">{tenant.nomBoutique}</Link> · Contact
        </p>
        {contactPage?.intro && (
          <p className="text-base mt-4 max-w-xl leading-relaxed" style={{ opacity: 0.65 }}>{contactPage.intro}</p>
        )}
      </div>

      <section className={SECTION_PY}>
        <div className={`${CONTAINER} mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-10`}>
          {/* Coordonnées */}
          <div className="space-y-3">
            {coordonnees.length === 0 && (
              <p className="text-sm" style={{ opacity: 0.5 }}>Aucune coordonnée renseignée pour l'instant.</p>
            )}
            {coordonnees.map((item, i) => {
              const content = (
                <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: `${c.accent}08`, border: `1px solid ${c.accent}15` }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${c.accent}18` }}>
                    <item.Icon size={16} style={{ color: c.accent }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: c.accent }}>{item.label}</p>
                    <p className="text-sm truncate" style={{ color: c.texte }}>{item.value}</p>
                  </div>
                </div>
              );
              return item.href ? (
                <a key={i} href={item.href} target={item.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="block hover:opacity-90 transition-opacity">{content}</a>
              ) : (
                <div key={i}>{content}</div>
              );
            })}
          </div>

          {/* Formulaire */}
          {afficherFormulaire && (
            <div>
              <ContactForm slug={slug} accent={c.accent} texte={c.texte} fond={c.fond} />
            </div>
          )}
        </div>
      </section>

      {contactPage?.sections?.length ? (
        <CustomSectionsRenderer sections={contactPage.sections} slug={slug} colors={c} container={CONTAINER} sectionPy={SECTION_PY} />
      ) : null}

      {/* ─── FOOTER (identique aux autres pages storefront) ─── */}
      <footer className="border-t mt-0" style={{ backgroundColor: c.fond, borderColor: `${c.accent}15` }}>
        <div className={`${CONTAINER} mx-auto px-4 sm:px-6 lg:px-8 py-14`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            <div className="lg:col-span-2">
              {tenant.logoUrl ? (
                <img src={tenant.logoUrl} alt={tenant.nomBoutique} className="h-10 mb-4 object-contain" />
              ) : (
                <p className="text-2xl font-bold font-playfair mb-4" style={{ color: c.accent }}>{tenant.nomBoutique}</p>
              )}
              {tenant.description && (
                <p className="text-sm leading-relaxed mb-5" style={{ opacity: 0.55, maxWidth: "320px" }}>{tenant.description}</p>
              )}
            </div>
            <div>
              <p className="font-semibold text-sm mb-4 uppercase tracking-wider" style={{ color: c.accent }}>Navigation</p>
              <div className="space-y-3">
                {[
                  { label: "Accueil", href: `/${slug}` },
                  { label: "Produits", href: `/${slug}/produits` },
                  ...(cfg.aboutPage?.actif ? [{ label: "À propos", href: `/${slug}/a-propos` }] : []),
                  { label: "Suivi commande", href: `/suivi` },
                ].map((l) => (
                  <Link key={l.href} href={l.href} className="block text-sm transition-opacity hover:opacity-100" style={{ opacity: 0.55 }}>
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="font-semibold text-sm mb-4 uppercase tracking-wider" style={{ color: c.accent }}>Contact</p>
              <div className="space-y-3">
                {tenant.email && <a href={`mailto:${tenant.email}`} className="block text-sm transition-opacity hover:opacity-100" style={{ opacity: 0.55 }}>{tenant.email}</a>}
                {tenant.adresse && <p className="text-sm" style={{ opacity: 0.55 }}>{tenant.adresse}</p>}
              </div>
            </div>
          </div>
        </div>
        <div className="border-t py-5" style={{ borderColor: `${c.accent}10` }}>
          <div className={`${CONTAINER} mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs`} style={{ opacity: 0.4 }}>
            <p>© {new Date().getFullYear()} {tenant.nomBoutique}. Tous droits réservés.</p>
            <p>Propulsé par <span style={{ color: c.accent, opacity: 1 }}>Axso</span></p>
          </div>
        </div>
      </footer>
    </div>
  );
}
