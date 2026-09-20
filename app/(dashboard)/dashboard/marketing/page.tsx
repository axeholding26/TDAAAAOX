// Dashboard Marketing et promotions
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatMontant } from "@/lib/utils";
import Link from "next/link";
import {
  Tag,
  Mail,
  Megaphone,
  TrendingUp,
  ArrowRight,
  Users,
  Zap,
  Target,
} from "lucide-react";
import { AgentActiveIndicator } from "@/components/dashboard/AgentActiveIndicator";
import { BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";
import { MarketingTutorial } from "@/components/dashboard/tutorials/MarketingTutorial";

export default async function MarketingPage() {
  const session = await auth();
  if (!session) redirect("/connexion");

  const tenantId = (session.user as any)?.tenantId;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) redirect("/inscription");

  const [codesPromo, totalClients] = await Promise.all([
    prisma.codePromo.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.client.count({ where: { tenantId } }),
  ]);

  const codesActifs = codesPromo.filter((c) => c.actif).length;
  const pixelsActifs = [tenant.metaPixelId, tenant.tiktokPixelId, tenant.snapPixelId, tenant.gtmId].filter(Boolean).length;

  const tools = [
    {
      icone: Tag,
      titre: "Codes Promo",
      description: "Créez des remises pour fidéliser vos clients et booster vos ventes.",
      href: "/dashboard/marketing/codes-promo",
      accent: "#F5A623",
      stat: codesActifs > 0 ? `${codesActifs} code${codesActifs > 1 ? "s" : ""} actif${codesActifs > 1 ? "s" : ""}` : "Aucun code actif",
      statClass: codesActifs > 0 ? "bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]" : "bg-[#F4F4F4] text-[#717171] border border-[#E8E8E8]",
    },
    {
      icone: Mail,
      titre: "Email Marketing",
      description: "Envoyez des campagnes email ciblées à votre base clients.",
      href: "/dashboard/marketing/email",
      accent: "#16A34A",
      stat: `${totalClients} client${totalClients > 1 ? "s" : ""} à contacter`,
      statClass: "bg-[#ECFDF5] text-[#16A34A] border border-[#BBF7D0]",
    },
    {
      icone: Megaphone,
      titre: "Campagnes",
      description: "Planifiez et lancez des promotions ciblées sur votre boutique.",
      href: "/dashboard/marketing",
      accent: "#7C3AED",
      stat: "Bientôt disponible",
      statClass: "bg-[#F4F4F4] text-[#717171] border border-[#E8E8E8]",
    },
    {
      icone: TrendingUp,
      titre: "SEO & Visibilité",
      description: "Optimisez le référencement de vos produits pour attirer plus de visiteurs.",
      href: "/dashboard/produits",
      accent: "#D97706",
      stat: "Optimisez vos fiches",
      statClass: "bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]",
    },
    {
      icone: Target,
      titre: "Tracking & Pixels",
      description: "Meta, TikTok, Snapchat, Google Tag Manager et vos scripts de suivi personnalisés.",
      href: "/dashboard/marketing/tracking",
      accent: "#1877F2",
      stat: pixelsActifs > 0 ? `${pixelsActifs} pixel${pixelsActifs > 1 ? "s" : ""} actif${pixelsActifs > 1 ? "s" : ""}` : "Aucun pixel actif",
      statClass: pixelsActifs > 0 ? "bg-[#EFF6FF] text-[#1877F2] border border-[#BFDBFE]" : "bg-[#F4F4F4] text-[#717171] border border-[#E8E8E8]",
    },
  ];

  return (
    <div className="space-y-6">
      <MarketingTutorial />
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#111111] font-poppins inline-flex items-center gap-2">Marketing <AgentActiveIndicator label="Agent Marketing actif" /></h1>
            <BoutonRevoirTutoriel moduleKey="marketing" />
          </div>
          <p className="text-[#717171] text-sm mt-1">Boostez vos ventes avec des outils ciblés</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-[#E8E8E8] rounded-xl px-4 py-2">
          <Users size={14} className="text-[#717171]" />
          <span className="text-[#717171] text-sm">{totalClients} client{totalClients > 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Codes actifs",    value: codesActifs.toString(),                                                              icon: Tag,      accent: "#F5A623" },
          { label: "Total codes",     value: codesPromo.length.toString(),                                                        icon: Zap,      accent: "#7C3AED" },
          { label: "Base clients",    value: totalClients.toString(),                                                              icon: Users,    accent: "#16A34A" },
          { label: "Taux activation", value: codesPromo.length > 0 ? `${Math.round((codesActifs / codesPromo.length) * 100)}%` : "—", icon: TrendingUp, accent: "#D97706" },
        ].map((stat, i) => {
          const Icone = stat.icon;
          return (
            <div key={i} className="bg-white border border-[#E8E8E8] rounded-2xl p-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#F4F4F4] mb-3">
                <Icone size={15} style={{ color: stat.accent }} />
              </div>
              <p className="text-[#111111] text-xl font-bold font-poppins">{stat.value}</p>
              <p className="text-[#717171] text-xs mt-0.5">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Grid outils marketing */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {tools.map((tool, i) => {
          const Icone = tool.icone;
          return (
            <Link key={i} href={tool.href}>
              <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 hover:border-[#D0D0D0] transition-colors group cursor-pointer h-full flex flex-col">
                <div className="flex items-start justify-between mb-5">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-[#F4F4F4]">
                    <Icone size={20} style={{ color: tool.accent }} />
                  </div>
                  <ArrowRight
                    size={16}
                    className="text-[#717171] group-hover:text-[#111111] group-hover:translate-x-0.5 transition-all duration-200 mt-1"
                  />
                </div>

                <p className="text-[#111111] font-semibold text-sm">{tool.titre}</p>
                <p className="text-[#717171] text-sm mt-1 leading-relaxed flex-1">{tool.description}</p>

                <div className="mt-4 pt-4 border-t border-[#E8E8E8] flex items-center justify-between">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tool.statClass}`}>
                    {tool.stat}
                  </span>
                  <span className="text-xs font-medium text-[#717171] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    Accéder →
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Codes promo récents */}
      {codesPromo.length > 0 && (
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#F4F4F4]">
                <Tag size={15} className="text-[#F5A623]" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#111111]">Codes promo récents</h2>
                <p className="text-[#717171] text-xs">{codesActifs} actif{codesActifs > 1 ? "s" : ""} sur {codesPromo.length}</p>
              </div>
            </div>
            <Link
              href="/dashboard/marketing/codes-promo"
              className="flex items-center gap-1 text-sm font-medium text-[#F5A623] hover:text-[#D97706] transition-colors"
            >
              Voir tout <ArrowRight size={14} />
            </Link>
          </div>

          <div className="space-y-2">
            {codesPromo.map((code) => (
              <div
                key={code.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[#F4F4F4] border border-[#E8E8E8] hover:border-[#D0D0D0] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <code className="text-sm font-mono font-bold px-3 py-1 rounded-lg bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]">
                    {code.code}
                  </code>
                  <span className="text-[#717171] text-sm">
                    {code.type === "pourcentage"
                      ? `${code.valeur}% de remise`
                      : `${formatMontant(code.valeur, tenant.devise)} de remise`}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[#717171] text-xs">
                    {code.utilisations}/{code.maxUtilisations ?? "∞"} util.
                  </span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    code.actif
                      ? "bg-[#ECFDF5] text-[#16A34A] border border-[#BBF7D0]"
                      : "bg-[#F4F4F4] text-[#717171] border border-[#E8E8E8]"
                  }`}>
                    {code.actif ? "Actif" : "Inactif"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {codesPromo.length === 0 && totalClients === 0 && (
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#F4F4F4] border border-[#E8E8E8] flex items-center justify-center mx-auto mb-4">
            <Megaphone size={24} className="text-[#717171]" />
          </div>
          <p className="text-[#111111] font-semibold text-base mb-2">Prêt à booster vos ventes ?</p>
          <p className="text-[#717171] text-sm mb-6 max-w-sm mx-auto">
            Commencez par créer un code promo pour attirer vos premiers clients.
          </p>
          <Link href="/dashboard/marketing/codes-promo">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[#111111] text-white">
              <Tag size={14} />
              Créer un code promo
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
