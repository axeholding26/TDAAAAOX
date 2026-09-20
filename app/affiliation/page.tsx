export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { TYPES_PRODUIT_DIGITAL } from "@/lib/affiliation";
import { formatMontant } from "@/lib/utils";
import { NavbarMarketing } from "@/components/marketing/NavbarMarketing";
import { FooterMarketing } from "@/components/marketing/FooterMarketing";
import { AffiliateAccountPanel } from "@/components/marketing/AffiliateAccountPanel";
import { DevenirAffilieButton } from "@/components/marketing/DevenirAffilieButton";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Search, TrendingUp, Users, Percent, ArrowRight, Zap, ShieldCheck,
  Wallet, Package, BadgeCheck, Link2, Rocket, LayoutGrid,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Devenez affilié — gagnez de l'argent avec AXSO",
  description: "Parcourez des centaines de produits de marchands africains, obtenez votre lien unique en un clic et gagnez jusqu'à 50% de commission sur chaque vente.",
};

interface Listing {
  produitId: string; nom: string; image: string | null; prix: number; type: string;
  categorie: string | null; ventes: number; tauxPct: number;
  programmeId: string; nomProgramme: string;
  tenantId: string; nomBoutique: string; logoUrl: string | null; certifie: boolean; devise: string;
}

interface Props {
  searchParams: Promise<{ q?: string; cat?: string; tri?: string }>;
}

export default async function AffiliationMarketplacePage({ searchParams }: Props) {
  const { q, cat, tri } = await searchParams;

  const programmes = await prisma.programmeAffiliation.findMany({
    where: { actif: true, tenant: { statut: "active" } },
    include: { tenant: { select: { id: true, slug: true, nomBoutique: true, logoUrl: true, certifie: true, devise: true } } },
    take: 80,
  });

  const listingsParProgramme = await Promise.all(
    programmes.map(async (prog) => {
      const produits = await prisma.produit.findMany({
        where: {
          tenantId: prog.tenantId, actif: true, affiliationActive: true,
          ...(prog.tousLesProduits ? {} : { id: { in: prog.produitIds } }),
        },
        select: { id: true, nom: true, images: true, prix: true, type: true, categorie: true, ventes: true, tauxCommissionAff: true },
        orderBy: { ventes: "desc" },
        take: 16,
      });
      const tauxDefaut = prog.tiersActifs ? prog.tier1Commission : prog.valeurCommission;
      return produits.map((p): Listing => ({
        produitId: p.id, nom: p.nom, image: p.images?.[0] ?? null, prix: p.prix, type: p.type,
        categorie: p.categorie, ventes: p.ventes,
        tauxPct: p.tauxCommissionAff != null ? Math.round(p.tauxCommissionAff * 1000) / 10
          : TYPES_PRODUIT_DIGITAL.has(p.type) ? 50 : tauxDefaut,
        programmeId: prog.id, nomProgramme: prog.nom,
        tenantId: prog.tenant.id, nomBoutique: prog.tenant.nomBoutique, logoUrl: prog.tenant.logoUrl,
        certifie: prog.tenant.certifie, devise: prog.tenant.devise,
      }));
    })
  );

  const toutesListings = listingsParProgramme.flat();
  const categories = Array.from(new Set(toutesListings.map((l) => l.categorie).filter(Boolean))) as string[];
  const nbMarchands = new Set(programmes.map((p) => p.tenantId)).size;
  const nbProduits = toutesListings.length;
  const commissionMax = toutesListings.reduce((m, l) => Math.max(m, l.tauxPct), 0);

  let listings = toutesListings;
  if (q) {
    const needle = q.toLowerCase();
    listings = listings.filter((l) => l.nom.toLowerCase().includes(needle) || l.nomBoutique.toLowerCase().includes(needle));
  }
  if (cat) listings = listings.filter((l) => l.categorie === cat);
  listings = tri === "populaire"
    ? [...listings].sort((a, b) => b.ventes - a.ventes)
    : [...listings].sort((a, b) => b.tauxPct - a.tauxPct);
  listings = listings.slice(0, 60);

  return (
    <main className="bg-white text-[#111111] min-h-screen" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <NavbarMarketing />

      {/* ── Hero ── */}
      <section className="pt-36 pb-16 px-6 sm:px-10 lg:px-16 xl:px-24 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at top, rgba(245,166,35,0.1) 0%, transparent 65%)" }} />
        <div className="max-w-3xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full"
            style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)" }}>
            <Rocket size={13} style={{ color: "#F5A623" }} />
            <span className="text-xs font-bold" style={{ color: "#F5A623" }}>Le marketplace d'affiliation d'AXSO</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-black mb-6 leading-[1.08]">
            Gagnez de l'argent en<br />
            <span style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              recommandant des produits
            </span>
          </h1>
          <p className="text-[#666666] text-xl leading-relaxed max-w-2xl mx-auto mb-8">
            Parcourez les produits de {nbMarchands}+ marchands africains, obtenez votre lien unique en un clic — sans compte à créer — et touchez jusqu'à {Math.round(commissionMax)}% de commission sur chaque vente.
          </p>
          <div className="flex justify-center mb-4">
            <AffiliateAccountPanel />
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            <a href="#marketplace"
              className="inline-flex items-center gap-2 font-bold px-8 py-4 rounded-2xl transition-all hover:scale-105"
              style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", color: "#080808", boxShadow: "0 8px 30px rgba(245,166,35,0.35)" }}>
              Parcourir les produits <ArrowRight size={18} />
            </a>
            <Link href="/mon-espace-affilie"
              className="font-semibold px-8 py-4 rounded-2xl transition-all hover:bg-gray-50"
              style={{ border: "1px solid rgba(0,0,0,0.12)", color: "rgba(0,0,0,0.65)" }}>
              J'ai déjà des liens — voir mes gains
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 pb-20">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-5">
          {[
            { Icon: Users, n: `${nbMarchands}+`, label: "marchands partenaires" },
            { Icon: Package, n: `${nbProduits}+`, label: "produits promouvables" },
            { Icon: Percent, n: `${Math.round(commissionMax)}%`, label: "commission max" },
            { Icon: Zap, n: "50%", label: "sur les produits digitaux" },
          ].map(({ Icon, n, label }) => (
            <div key={label} className="rounded-2xl p-6 text-center border"
              style={{ background: "rgba(245,166,35,0.04)", borderColor: "rgba(245,166,35,0.12)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                style={{ background: "rgba(245,166,35,0.1)" }}>
                <Icon size={18} style={{ color: "#F5A623" }} />
              </div>
              <p className="text-3xl font-black mb-1" style={{ color: "#F5A623" }}>{n}</p>
              <p className="text-[#808080] text-xs">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Comment ça marche ── */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 pb-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black mb-3">Comment ça marche</h2>
            <p className="text-[#808080]">Aucun compte marchand requis — devenez affilié en moins de 2 minutes</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              { Icon: LayoutGrid, titre: "1. Parcourez", texte: "Explorez le catalogue de tous les marchands AXSO et repérez les produits qui correspondent à votre audience." },
              { Icon: Link2, titre: "2. Obtenez votre lien", texte: "Un clic sur \"Devenir affilié\", renseignez votre nom et email — votre lien de suivi personnel est généré instantanément." },
              { Icon: Wallet, titre: "3. Gagnez", texte: "Partagez votre lien. Chaque vente attribuée vous rapporte une commission, suivie en temps réel dans votre portail." },
            ].map(({ Icon, titre, texte }) => (
              <div key={titre} className="rounded-2xl p-6 border" style={{ background: "rgba(0,0,0,0.02)", borderColor: "rgba(0,0,0,0.07)" }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(245,166,35,0.1)" }}>
                  <Icon size={20} style={{ color: "#F5A623" }} />
                </div>
                <p className="font-bold text-[#111111] mb-2">{titre}</p>
                <p className="text-[#666666] text-sm leading-relaxed">{texte}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Marketplace ── */}
      <section id="marketplace" className="px-6 sm:px-10 lg:px-16 xl:px-24 pb-28 scroll-mt-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-black mb-3">Le catalogue</h2>
            <p className="text-[#808080]">{nbProduits} produits éligibles à l'affiliation, tous marchands confondus</p>
          </div>

          {/* Filtres */}
          <form className="flex flex-wrap gap-2 mb-8" method="GET">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#B3B3B3" }} />
              <input
                name="q" defaultValue={q} placeholder="Rechercher un produit ou un marchand…"
                className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border outline-none"
                style={{ borderColor: "rgba(0,0,0,0.1)" }}
              />
            </div>
            {categories.length > 0 && (
              <select name="cat" defaultValue={cat || ""} className="px-4 py-3 text-sm rounded-xl border outline-none bg-white" style={{ borderColor: "rgba(0,0,0,0.1)" }}>
                <option value="">Toutes catégories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <select name="tri" defaultValue={tri || "commission"} className="px-4 py-3 text-sm rounded-xl border outline-none bg-white" style={{ borderColor: "rgba(0,0,0,0.1)" }}>
              <option value="commission">Commission la plus élevée</option>
              <option value="populaire">Best-sellers</option>
            </select>
            <button type="submit" className="px-6 py-3 text-sm font-bold rounded-xl text-white" style={{ background: "#111111" }}>
              Filtrer
            </button>
          </form>

          {listings.length === 0 ? (
            <div className="text-center py-20 rounded-2xl border-2 border-dashed" style={{ borderColor: "rgba(0,0,0,0.1)" }}>
              <Package size={40} className="mx-auto mb-4" style={{ color: "#D9D9D9" }} />
              <p className="font-bold text-[#111111] mb-1">Aucun produit trouvé</p>
              <p className="text-sm text-[#999999]">Essayez une autre recherche ou catégorie.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {listings.map((l) => (
                <div key={`${l.tenantId}-${l.produitId}`}
                  className="rounded-2xl overflow-hidden border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                  style={{ borderColor: "rgba(0,0,0,0.08)" }}>
                  <div className="relative aspect-square overflow-hidden" style={{ background: "#F5F5F5" }}>
                    {l.image ? (
                      <img src={l.image} alt={l.nom} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Package size={36} style={{ color: "#D9D9D9" }} /></div>
                    )}
                    <span className="absolute top-2.5 left-2.5 text-[10px] font-black px-2 py-1 rounded-lg text-white" style={{ background: "#F5A623" }}>
                      +{Math.round(l.tauxPct)}% comm.
                    </span>
                    {TYPES_PRODUIT_DIGITAL.has(l.type) && (
                      <span className="absolute top-2.5 right-2.5 text-[9px] font-bold px-2 py-0.5 rounded-lg text-white" style={{ background: "rgba(0,0,0,0.6)" }}>
                        Digital
                      </span>
                    )}
                  </div>
                  <div className="p-3.5">
                    <p className="font-medium text-sm leading-snug line-clamp-2 mb-1.5">{l.nom}</p>
                    <div className="flex items-center gap-1 mb-2">
                      {l.logoUrl && <img src={l.logoUrl} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />}
                      <p className="text-[11px] truncate" style={{ color: "#999999" }}>{l.nomBoutique}</p>
                      {l.certifie && <BadgeCheck size={11} style={{ color: "#F5A623" }} />}
                    </div>
                    <p className="font-bold text-sm mb-3" style={{ color: "#111111" }}>{formatMontant(l.prix, l.devise)}</p>
                    <DevenirAffilieButton programmeId={l.programmeId} nomBoutique={l.nomBoutique} logoUrl={l.logoUrl} nomProgramme={l.nomProgramme} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Confiance ── */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 pb-28">
        <div className="max-w-5xl mx-auto rounded-3xl p-10 sm:p-14 border grid sm:grid-cols-3 gap-8"
          style={{ background: "linear-gradient(135deg, rgba(245,166,35,0.08) 0%, rgba(27,42,74,0.04) 100%)", borderColor: "rgba(245,166,35,0.2)" }}>
          {[
            { Icon: ShieldCheck, titre: "Suivi fiable", texte: "Chaque clic et chaque vente sont attribués via un cookie d'attribution, avec une fenêtre allant jusqu'à 90 jours." },
            { Icon: Wallet, titre: "Paiements réels", texte: "Les commissions sont versées directement sur mobile money par le marchand, suivies dans votre portail personnel." },
            { Icon: TrendingUp, titre: "Sans plafond", texte: "Pas de limite au nombre de marchands ou de produits que vous pouvez promouvoir en même temps." },
          ].map(({ Icon, titre, texte }) => (
            <div key={titre}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(245,166,35,0.12)" }}>
                <Icon size={20} style={{ color: "#F5A623" }} />
              </div>
              <p className="font-bold text-[#111111] mb-2">{titre}</p>
              <p className="text-[#666666] text-sm leading-relaxed">{texte}</p>
            </div>
          ))}
        </div>
      </section>

      <FooterMarketing />
    </main>
  );
}
