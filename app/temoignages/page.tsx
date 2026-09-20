import { NavbarMarketing } from "@/components/marketing/NavbarMarketing";
import { FooterMarketing } from "@/components/marketing/FooterMarketing";
import Link from "next/link";
import { Star, Quote, ArrowRight, TrendingUp, Users, ShoppingBag, Award } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Témoignages — AXSO, ce que disent nos marchands",
  description: "Plus de 1 200 marchands africains font confiance à AXSO. Découvrez leurs histoires et résultats.",
};

const STATS = [
  { icon: Users,       n: "1 247+",  label: "boutiques actives" },
  { icon: TrendingUp,  n: "340%",    label: "croissance moy. 6 mois" },
  { icon: ShoppingBag, n: "4,8/5",   label: "note satisfaction" },
  { icon: Award,       n: "12",      label: "pays représentés" },
];

const TEMOIGNAGES = [
  {
    nom: "Aminata Koné",
    role: "Fondatrice, Wax & Prestige",
    pays: "Côte d'Ivoire",
    code: "CI",
    avatar: "AK",
    accentBg: "#F5A623",
    note: 5,
    chiffre: "+280% de CA en 4 mois",
    contenu: "Avant AXSO, je gérais tout sur WhatsApp et les transferts manuels. Aujourd'hui j'ai une vraie boutique en ligne, mes clients paient via Wave ou Orange Money et je reçois mes fonds directement dans mon wallet. Axia gère mes descriptions produits et même mes relances clients — c'est comme avoir une assistante disponible 24h/24.",
  },
  {
    nom: "Moussa Traoré",
    role: "Directeur, ElectroShop Mali",
    pays: "Mali",
    code: "ML",
    avatar: "MT",
    accentBg: "#7c3aed",
    note: 5,
    chiffre: "×3 le volume de commandes",
    contenu: "Je vendais uniquement en magasin à Bamako. Grâce à AXSO j'ai ouvert ma boutique en ligne en 2 heures et mes clients du Sénégal et du Burkina commandent maintenant. Le module livraison avec suivi GPS a vraiment rassuré mes acheteurs. En 6 mois, j'ai triplé mon volume de commandes.",
  },
  {
    nom: "Fatou Diallo",
    role: "CEO, FormationAfrique.com",
    pays: "Sénégal",
    code: "SN",
    avatar: "FD",
    accentBg: "#10b981",
    note: 5,
    chiffre: "1 200 formations vendues",
    contenu: "Je vends des formations vidéo et j'avais besoin d'une solution de livraison digitale fiable. AXSO livre l'accès automatiquement après le paiement, sans intervention manuelle. Mes étudiants reçoivent leur lien en moins de 30 secondes. J'ai vendu plus de 1 200 formations depuis l'ouverture.",
  },
  {
    nom: "Koffi Mensah",
    role: "Fondateur, Natura Togo",
    pays: "Togo",
    code: "TG",
    avatar: "KM",
    accentBg: "#3b82f6",
    note: 5,
    chiffre: "84% de taux de fidélisation",
    contenu: "Le programme d'affiliation d'AXSO est une révolution. J'ai 34 affiliés qui recommandent mes produits naturels et je ne paie qu'à la commission. Axia gère les relances, envoie les SMS automatiques et segmente mes clients — mon taux de fidélisation est passé de 31% à 84% en 8 mois.",
  },
  {
    nom: "Issa Coulibaly",
    role: "Gérant, TechGadgets BF",
    pays: "Burkina Faso",
    code: "BF",
    avatar: "IC",
    accentBg: "#ef4444",
    note: 5,
    chiffre: "Zero rupture de stock",
    contenu: "La gestion de stock en temps réel d'AXSO m'a sauvé. Avant je découvrais les ruptures quand les clients réclamaient. Maintenant Axia me prévient dès que j'atteins le seuil critique et peut même passer une commande fournisseur automatiquement. Plus aucune vente perdue pour cause de rupture.",
  },
  {
    nom: "Nadia Benali",
    role: "Dropshippeur, Mode Express",
    pays: "Cameroun",
    code: "CM",
    avatar: "NB",
    accentBg: "#F5A623",
    note: 5,
    chiffre: "450K XOF le premier mois",
    contenu: "J'ai commencé avec zéro stock grâce au dropshipping intégré dans AXSO. J'importe des produits depuis AliExpress en quelques clics, les descriptions sont générées en français par Axia, et mes clients ne voient aucune différence. Premier mois : 450 000 XOF de chiffre d'affaires sans un seul article en stock.",
  },
  {
    nom: "Boubacar Barry",
    role: "Fondateur, BarryDeco Guinée",
    pays: "Guinée",
    code: "GN",
    avatar: "BB",
    accentBg: "#7c3aed",
    note: 5,
    chiffre: "2 boutiques, 1 dashboard",
    contenu: "J'ai deux boutiques — une d'artisanat et une de déco intérieure. Sur AXSO je les gère depuis un seul tableau de bord. Axia me génère du contenu différent pour chaque boutique, adapté au ton et aux produits. Le plan Illimité me coûte moins qu'un seul employé et fait bien plus.",
  },
  {
    nom: "Grace Akosua",
    role: "Créatrice, Ghana Beauty Hub",
    pays: "Ghana",
    code: "GH",
    avatar: "GA",
    accentBg: "#10b981",
    note: 5,
    chiffre: "+620 clients en 3 mois",
    contenu: "La boutique AXSO est si belle que mes clientes pensent que j'ai embauché un designer. J'ai personnalisé le thème sans coder, ajouté mes produits beauty et lancé une campagne email via AXSO — 620 nouveaux clients en 3 mois. Le support répond en moins d'une heure, même le week-end.",
  },
  {
    nom: "Omar Diop",
    role: "CEO, FreightSN Logistique",
    pays: "Sénégal",
    code: "SN",
    avatar: "OD",
    accentBg: "#3b82f6",
    note: 5,
    chiffre: "300 livraisons/jour gérées",
    contenu: "On utilise le module livraison AXSO pour nos clients marchands. Suivi GPS pour les livreurs, notifications automatiques pour les clients, RMA intégré — tout ce qu'il faut pour une opération professionnelle. On gère 300 livraisons par jour sur la plateforme sans friction.",
  },
];

const LOGOS = [
  "Wax & Prestige", "ElectroShop", "FormationAfrique", "Natura Togo",
  "TechGadgets", "Mode Express", "BarryDeco", "Ghana Beauty Hub",
];

export default function TemoignagesPage() {
  return (
    <main className="bg-white text-[#111111] min-h-screen" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <NavbarMarketing />

      {/* ── Hero ── */}
      <section className="pt-36 pb-20 px-6 sm:px-10 lg:px-16 xl:px-24 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at top, rgba(245,166,35,0.1) 0%, transparent 65%)" }} />
        <div className="max-w-3xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full"
            style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)" }}>
            <div className="flex -space-x-1">
              {["#F5A623","#7c3aed","#10b981","#3b82f6"].map(c => (
                <div key={c} className="w-5 h-5 rounded-full border-2 border-white"
                  style={{ background: c }} />
              ))}
            </div>
            <span className="text-xs font-bold" style={{ color: "#F5A623" }}>1 247 marchands nous font confiance</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-black mb-6 leading-[1.08]">
            Ils ont transformé<br />
            <span style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              leur business
            </span>
          </h1>
          <p className="text-[#666666] text-xl leading-relaxed max-w-2xl mx-auto">
            Des marchands de 12 pays africains partagent leur expérience avec AXSO — en chiffres, en honnêteté.
          </p>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 pb-24">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-5">
          {STATS.map(({ icon: Icon, n, label }) => (
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

      {/* ── Featured testimonial ── */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 pb-20">
        <div className="max-w-5xl mx-auto rounded-3xl p-10 sm:p-14 relative overflow-hidden border"
          style={{ background: "linear-gradient(135deg, rgba(245,166,35,0.08) 0%, rgba(124,58,237,0.05) 100%)", borderColor: "rgba(245,166,35,0.2)" }}>
          <div className="absolute top-6 right-8 opacity-10">
            <Quote size={80} style={{ color: "#F5A623" }} />
          </div>
          <div className="flex gap-1 mb-6">
            {Array(5).fill(0).map((_, i) => <Star key={i} size={18} fill="#F5A623" style={{ color: "#F5A623" }} />)}
          </div>
          <blockquote className="text-xl sm:text-2xl font-medium text-[#333333] leading-relaxed mb-8 max-w-3xl">
            "Avant AXSO, je gérais tout sur WhatsApp et les transferts manuels. Aujourd'hui j'ai une vraie boutique en ligne, mes clients paient via Wave ou Orange Money et je reçois mes fonds directement dans mon wallet. Axia gère mes descriptions produits et même mes relances clients — c'est comme avoir une assistante disponible 24h/24."
          </blockquote>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", color: "#080808" }}>AK</div>
            <div>
              <p className="font-bold text-[#111111]">Aminata Koné</p>
              <p className="text-[#737373] text-sm">Fondatrice, Wax & Prestige · <span className="text-[10px] font-bold px-1 py-0.5 rounded" style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623" }}>CI</span> Côte d'Ivoire</p>
            </div>
            <div className="ml-auto hidden sm:block text-right">
              <p className="text-2xl font-black" style={{ color: "#F5A623" }}>+280%</p>
              <p className="text-[#8C8C8C] text-xs">de CA en 4 mois</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Grid témoignages ── */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 pb-28">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-[#111111] mb-3">Toutes les histoires</h2>
            <p className="text-[#808080]">Résultats réels, vérifiables dans nos données marchands</p>
          </div>

          <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 space-y-5">
            {TEMOIGNAGES.slice(1).map((t) => (
              <div key={t.nom}
                className="break-inside-avoid rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-0.5"
                style={{ background: "rgba(0,0,0,0.02)", borderColor: "rgba(0,0,0,0.07)" }}>

                {/* Header */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0"
                    style={{ background: `${t.accentBg}20`, color: t.accentBg, border: `1.5px solid ${t.accentBg}35` }}>
                    {t.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#111111] text-sm">{t.nom}</p>
                    <p className="text-[#808080] text-xs truncate">{t.role} · <span className="font-bold" style={{ color: t.accentBg }}>{t.code}</span> {t.pays}</p>
                  </div>
                  <div className="flex gap-0.5 flex-shrink-0">
                    {Array(t.note).fill(0).map((_, i) => (
                      <Star key={i} size={10} fill="#F5A623" style={{ color: "#F5A623" }} />
                    ))}
                  </div>
                </div>

                {/* Chiffre clé */}
                <div className="rounded-xl px-3 py-2 mb-4 inline-block"
                  style={{ background: `${t.accentBg}0d`, border: `1px solid ${t.accentBg}20` }}>
                  <span className="text-sm font-black" style={{ color: t.accentBg }}>{t.chiffre}</span>
                </div>

                {/* Contenu */}
                <p className="text-[#595959] text-sm leading-relaxed">{t.contenu}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Logos wall ── */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 pb-24">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-[#B3B3B3] text-xs font-bold uppercase tracking-[0.25em] mb-8">Ils vendent avec AXSO</p>
          <div className="flex flex-wrap justify-center gap-3">
            {LOGOS.map(logo => (
              <div key={logo}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.07)", color: "rgba(0,0,0,0.35)" }}>
                {logo}
              </div>
            ))}
            <div className="px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "rgba(245,166,35,0.05)", border: "1px solid rgba(245,166,35,0.15)", color: "rgba(245,166,35,0.6)" }}>
              + 1 230 autres →
            </div>
          </div>
        </div>
      </section>

      {/* ── Note globale ── */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 pb-24">
        <div className="max-w-3xl mx-auto rounded-3xl p-10 text-center border"
          style={{ background: "rgba(0,0,0,0.02)", borderColor: "rgba(0,0,0,0.08)" }}>
          <div className="flex justify-center gap-1.5 mb-4">
            {Array(5).fill(0).map((_, i) => <Star key={i} size={28} fill="#F5A623" style={{ color: "#F5A623" }} />)}
          </div>
          <p className="text-6xl font-black mb-2" style={{ color: "#F5A623" }}>4,8</p>
          <p className="text-[#808080] mb-2">Note moyenne sur 1 247 avis vérifiés</p>
          <div className="flex justify-center gap-8 mt-6 flex-wrap">
            {[["Facilité d'utilisation","4,9"],["Support client","4,8"],["Rapport qualité/prix","4,9"],["Fonctionnalités","4,7"]].map(([l, n]) => (
              <div key={l} className="text-center">
                <p className="text-2xl font-black text-[#111111]">{n}</p>
                <p className="text-[#999999] text-xs">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 pb-28">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-[#111111] mb-4">Rejoignez-les aujourd'hui</h2>
          <p className="text-[#737373] text-lg mb-8">Démarrez gratuitement — aucune carte requise. Votre boutique en ligne en 2 minutes.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/inscription"
              className="inline-flex items-center gap-2 font-bold px-10 py-4 rounded-2xl transition-all hover:scale-105"
              style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", color: "#080808", boxShadow: "0 8px 30px rgba(245,166,35,0.35)" }}>
              Créer ma boutique gratuitement <ArrowRight size={18} />
            </Link>
            <Link href="/contact"
              className="font-semibold px-8 py-4 rounded-2xl transition-all hover:bg-gray-50"
              style={{ border: "1px solid rgba(0,0,0,0.12)", color: "rgba(0,0,0,0.65)" }}>
              Parler à l'équipe
            </Link>
          </div>
        </div>
      </section>

      <FooterMarketing />
    </main>
  );
}
