import { NavbarMarketing } from "@/components/marketing/NavbarMarketing";
import { FooterMarketing } from "@/components/marketing/FooterMarketing";
import Link from "next/link";
import {
  ShoppingBag, CreditCard, Zap, Truck, TrendingUp, BarChart2,
  Globe, Check, ArrowRight, Package, Users, MessageCircle,
  Star, Shield, Clock, Layers, Cpu, MapPin,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fonctionnalités — AXSO, la plateforme e-commerce africaine",
  description: "Catalogue, paiements Mobile Money, Axia IA, livraison, marketing, analytics — tout pour vendre en Afrique.",
};

const STATS = [
  { n: "8",     label: "modules intégrés" },
  { n: "50+",   label: "fonctionnalités" },
  { n: "12",    label: "pays couverts" },
  { n: "1 247+", label: "boutiques actives" },
];

const PAIEMENTS = ["Wave", "Orange Money", "MTN MoMo", "M-Pesa", "Stripe", "CinetPay", "CampPay", "Flutterwave"];

const AGENTS = [
  { icon: Package,        nom: "Agent Produits",   desc: "Crée, optimise et audite votre catalogue automatiquement" },
  { icon: TrendingUp,     nom: "Agent Marketing",  desc: "Campagnes, relances panier abandonné, séquences email/SMS" },
  { icon: BarChart2,      nom: "Agent Analytics",  desc: "KPIs en temps réel, rapports hebdo, recommandations" },
  { icon: Users,          nom: "Agent Clients",    desc: "Segmentation RFM, VIP, historique 360°" },
  { icon: Truck,          nom: "Agent Livraison",  desc: "Assignation livreurs, suivi GPS, alertes retard" },
  { icon: CreditCard,     nom: "Agent Revenus",    desc: "Objectifs CA, wallet marchand, commissions affiliation" },
  { icon: Cpu,            nom: "Agent Contenu",    desc: "Vidéos publicitaires IA, images, posts réseaux sociaux" },
  { icon: Layers,         nom: "Agent Commandes",  desc: "Traitement automatique, RMA, facturation PDF" },
  { icon: Globe,          nom: "Agent Sourcing",   desc: "Fournisseurs dropshipping, marges, comparaison prix" },
  { icon: ShoppingBag,    nom: "Agent Boutique",   desc: "Thème, SEO, configuration technique sans code" },
  { icon: MessageCircle,  nom: "Agent CRM",        desc: "WhatsApp, Instagram DM, conversations centralisées" },
];

export default function FonctionnalitesPage() {
  return (
    <main className="bg-white text-[#111111] min-h-screen" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <NavbarMarketing />

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="pt-36 pb-24 px-6 sm:px-10 lg:px-16 xl:px-24 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at top, rgba(245,166,35,0.11) 0%, transparent 65%)" }} />
        <div className="max-w-3xl mx-auto text-center relative">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] mb-6 px-3 py-1.5 rounded-full"
            style={{ color: "#F5A623", background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)" }}>
            <Zap size={11} /> Plateforme complète
          </span>
          <h1 className="text-4xl sm:text-6xl font-black mb-6 leading-[1.08]">
            Tout ce qu'il faut<br />pour vendre{" "}
            <span style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              en Afrique
            </span>
          </h1>
          <p className="text-[#666666] text-xl leading-relaxed max-w-2xl mx-auto mb-10">
            AXSO réunit boutique en ligne, paiements Mobile Money, intelligence artificielle et logistique en une seule plateforme — pensée pour les réalités africaines.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/inscription"
              className="font-bold px-8 py-4 rounded-2xl transition-all hover:scale-105"
              style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", color: "#080808", boxShadow: "0 8px 30px rgba(245,166,35,0.35)" }}>
              Créer ma boutique gratuitement
            </Link>
            <Link href="/#tarifs"
              className="font-semibold px-8 py-4 rounded-2xl transition-all hover:bg-gray-50"
              style={{ border: "1px solid rgba(0,0,0,0.12)", color: "rgba(0,0,0,0.7)" }}>
              Voir les tarifs
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ───────────────────────────────────────────────────────────── */}
      <div className="px-6 sm:px-10 lg:px-16 xl:px-24 pb-24">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-px rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(0,0,0,0.07)" }}>
          {STATS.map((s, i) => (
            <div key={s.label} className="py-10 px-6 text-center"
              style={{ background: i % 2 === 0 ? "rgba(245,166,35,0.04)" : "rgba(0,0,0,0.02)" }}>
              <p className="text-4xl font-black mb-1" style={{ color: "#F5A623" }}>{s.n}</p>
              <p className="text-[#808080] text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Feature 1 — Catalogue ───────────────────────────────────────────── */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 pb-32">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2.5 mb-6 px-3.5 py-2 rounded-xl"
              style={{ background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.2)" }}>
              <ShoppingBag size={16} style={{ color: "#F5A623" }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#F5A623" }}>Catalogue</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-[#111111] mb-5 leading-snug">
              Physique, digital ou dropshipping —<br />un seul catalogue
            </h2>
            <p className="text-[#666666] text-lg leading-relaxed mb-8">
              Gérez tous vos types de produits depuis une interface unique. AXSO s'adapte à votre activité, pas l'inverse.
            </p>
            <ul className="space-y-3.5">
              {[
                "Produits physiques avec variantes (taille, couleur, matière)",
                "Produits digitaux avec livraison instantanée et accès sécurisé",
                "Dropshipping AliExpress, CJ Dropshipping, fournisseurs locaux",
                "Gestion de stock temps réel avec alertes de réapprovisionnement",
                "Galerie photos HD, vidéos produit, descriptions générées par IA",
                "Import en masse via CSV ou scraping depuis d'autres boutiques",
              ].map(item => (
                <li key={item} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "rgba(245,166,35,0.12)" }}>
                    <Check size={11} style={{ color: "#F5A623" }} strokeWidth={3} />
                  </span>
                  <span className="text-[#4D4D4D] text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Mockup UI */}
          <div className="rounded-2xl overflow-hidden border relative"
            style={{ background: "#fff", borderColor: "rgba(0,0,0,0.08)", boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)" }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "rgba(0,0,0,0.06)", background: "#FAFAFA" }}>
              <div className="flex gap-1.5">{["#ff5f57","#febc2e","#28c840"].map(c => <div key={c} className="w-3 h-3 rounded-full" style={{ background: c }} />)}</div>
              <span className="text-[#888888] text-xs ml-2">dashboard — Catalogue</span>
            </div>
            <div className="p-5 space-y-3">
              {[
                { nom: "Robe wax premium", type: "Physique", prix: "24 500", stock: 48, accent: "#F5A623" },
                { nom: "Formation e-commerce", type: "Digital", prix: "15 000", stock: "∞", accent: "#7c3aed" },
                { nom: "Montre fashion homme", type: "Dropshipping", prix: "38 900", stock: 12, accent: "#0ea5e9" },
                { nom: "Bijoux argent", type: "Physique", prix: "12 000", stock: 23, accent: "#F5A623" },
              ].map(p => (
                <div key={p.nom} className="flex items-center gap-4 rounded-xl p-3"
                  style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.06)" }}>
                  <div className="w-10 h-10 rounded-lg flex-shrink-0" style={{ background: `${p.accent}15`, border: `1px solid ${p.accent}25` }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[#111111] text-sm font-semibold truncate">{p.nom}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${p.accent}12`, color: p.accent }}>{p.type}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[#111111] font-bold text-sm">{p.prix} XOF</p>
                    <p className="text-[#8C8C8C] text-xs">Stock : {p.stock}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[#888888] text-xs">127 produits au total</span>
                <span className="text-xs font-bold px-3 py-1.5 rounded-lg"
                  style={{ background: "rgba(245,166,35,0.1)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.2)" }}>+ Ajouter</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature 2 — Paiements ───────────────────────────────────────────── */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 pb-32">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Mockup paiements */}
          <div className="rounded-2xl overflow-hidden border order-2 lg:order-1"
            style={{ background: "#fff", borderColor: "rgba(0,0,0,0.08)", boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)" }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "rgba(0,0,0,0.06)", background: "#FAFAFA" }}>
              <div className="flex gap-1.5">{["#ff5f57","#febc2e","#28c840"].map(c => <div key={c} className="w-3 h-3 rounded-full" style={{ background: c }} />)}</div>
              <span className="text-[#888888] text-xs ml-2">Page de paiement — Checkout</span>
            </div>
            <div className="p-5">
              <p className="text-[#666666] text-xs font-bold uppercase tracking-wider mb-4">Choisissez votre mode de paiement</p>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {[
                  { nom: "Wave", color: "#00B9F1", active: true },
                  { nom: "Orange Money", color: "#FF7900", active: false },
                  { nom: "MTN MoMo", color: "#FFC200", active: false },
                  { nom: "Stripe", color: "#635BFF", active: false },
                  { nom: "CinetPay", color: "#E83E8C", active: false },
                  { nom: "M-Pesa", color: "#00A550", active: false },
                ].map(p => (
                  <div key={p.nom}
                    className="rounded-xl p-3 flex items-center gap-2 cursor-pointer transition-all"
                    style={{
                      background: p.active ? `${p.color}12` : "rgba(0,0,0,0.03)",
                      border: `1px solid ${p.active ? p.color + "40" : "rgba(0,0,0,0.06)"}`,
                    }}>
                    <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ background: `${p.color}20`, border: `1px solid ${p.color}40` }} />
                    <span className="text-xs font-medium" style={{ color: p.active ? p.color : "rgba(0,0,0,0.5)" }}>{p.nom}</span>
                    {p.active && <div className="ml-auto w-4 h-4 rounded-full flex items-center justify-center" style={{ background: p.color }}>
                      <Check size={9} color="#fff" strokeWidth={3} />
                    </div>}
                  </div>
                ))}
              </div>
              <div className="rounded-xl p-4" style={{ background: "rgba(0,185,241,0.08)", border: "1px solid rgba(0,185,241,0.2)" }}>
                <div className="flex justify-between mb-2">
                  <span className="text-[#666666] text-sm">Total commande</span>
                  <span className="text-[#111111] font-bold">24 500 XOF</span>
                </div>
                <div className="w-full h-10 rounded-xl flex items-center justify-center font-bold text-sm"
                  style={{ background: "linear-gradient(135deg,#00B9F1,#0080B0)", color: "#fff" }}>
                  Payer via Wave →
                </div>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-2.5 mb-6 px-3.5 py-2 rounded-xl"
              style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <CreditCard size={16} style={{ color: "#10b981" }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#10b981" }}>Paiements Africa-first</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-[#111111] mb-5 leading-snug">
              Tous les paiements africains,<br />nativement intégrés
            </h2>
            <p className="text-[#666666] text-lg leading-relaxed mb-8">
              Vos clients paient comme ils en ont l'habitude — Mobile Money, carte ou virement. Aucune intégration manuelle, tout est prêt à l'activation.
            </p>
            <div className="flex flex-wrap gap-2 mb-8">
              {PAIEMENTS.map(p => (
                <span key={p} className="text-sm px-3.5 py-1.5 rounded-xl font-medium"
                  style={{ background: "rgba(16,185,129,0.08)", color: "#10b981", border: "1px solid rgba(16,185,129,0.15)" }}>
                  {p}
                </span>
              ))}
            </div>
            <ul className="space-y-3.5">
              {[
                "Wallet marchand avec retrait Mobile Money automatique",
                "Codes promo et réductions à la commande",
                "Gestion des remboursements en un clic",
                "Facturation automatique PDF à chaque vente",
                "Réconciliation comptable intégrée",
              ].map(item => (
                <li key={item} className="flex items-start gap-3">
                  <Check size={14} className="flex-shrink-0 mt-1" style={{ color: "#10b981" }} />
                  <span className="text-[#4D4D4D] text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Feature 3 — Axia IA ─────────────────────────────────────────────── */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 pb-32">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2.5 mb-6 px-3.5 py-2 rounded-xl"
              style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)" }}>
              <Zap size={16} style={{ color: "#7c3aed" }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#7c3aed" }}>Axia — IA intégrée</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-[#111111] mb-5 leading-snug">
              Un agent IA qui gère<br />votre boutique à votre place
            </h2>
            <p className="text-[#666666] text-lg leading-relaxed mb-8">
              Axia n'est pas un chatbot. C'est un vrai agent qui exécute des actions dans votre boutique : crée des produits, analyse vos ventes, répond à vos clients, génère du contenu.
            </p>
            <ul className="space-y-3.5">
              {[
                "Axia marchande : gère commandes, stock, marketing par conversation",
                "Axia acheteur : assistant intégré dans votre vitrine pour vos clients",
                "11 agents spécialisés coordonnés automatiquement",
                "Génération de descriptions, photos et posts réseaux sociaux",
                "Analyse des avis et recommandations d'optimisation",
                "Onboarding boutique complet par IA en moins de 3 minutes",
              ].map(item => (
                <li key={item} className="flex items-start gap-3">
                  <Check size={14} className="flex-shrink-0 mt-1" style={{ color: "#7c3aed" }} />
                  <span className="text-[#4D4D4D] text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Chat mockup */}
          <div className="rounded-2xl overflow-hidden border"
            style={{ background: "#fff", borderColor: "rgba(124,58,237,0.25)", boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)" }}>
            <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "rgba(124,58,237,0.15)", background: "rgba(124,58,237,0.06)" }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#7c3aed,#a78bfa)" }}>
                <Zap size={14} color="#fff" />
              </div>
              <div>
                <p className="text-[#111111] font-bold text-sm">Axia</p>
                <p className="text-[#808080] text-xs">Agent e-commerce · En ligne</p>
              </div>
              <div className="ml-auto w-2 h-2 rounded-full bg-green-400" />
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm"
                  style={{ background: "rgba(0,0,0,0.07)", color: "rgba(0,0,0,0.7)" }}>
                  Quels sont mes produits les plus vendus ce mois ?
                </div>
              </div>
              <div className="flex gap-2 items-start">
                <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg,#7c3aed,#a78bfa)" }}>
                  <Zap size={10} color="#fff" />
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm space-y-2"
                  style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.2)", color: "rgba(0,0,0,0.8)" }}>
                  <p>Ce mois, vos 3 top produits :</p>
                  {[["Robe wax premium","47 ventes","1,15M XOF"],["Bijoux argent","32 ventes","384K XOF"],["Formation e-comm","18 ventes","270K XOF"]].map(([n,v,r]) => (
                    <div key={n} className="flex justify-between text-xs rounded-lg px-3 py-2" style={{ background: "rgba(0,0,0,0.05)" }}>
                      <span>{n}</span><span style={{ color: "#a78bfa" }}>{v} · {r}</span>
                    </div>
                  ))}
                  <p className="text-xs" style={{ color: "rgba(167,139,250,0.8)" }}>Voulez-vous que je génère un rapport complet ?</p>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm"
                  style={{ background: "rgba(0,0,0,0.07)", color: "rgba(0,0,0,0.7)" }}>
                  Oui, et relance les clients qui n'ont pas acheté depuis 30 jours
                </div>
              </div>
              <div className="flex gap-2 items-start">
                <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg,#7c3aed,#a78bfa)" }}>
                  <Zap size={10} color="#fff" />
                </div>
                <div className="rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm"
                  style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.2)", color: "#a78bfa" }}>
                  Rapport généré ✓ · Campagne relance créée pour 84 clients ✓
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature 4 — Livraison ───────────────────────────────────────────── */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 pb-32">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Tracking mockup */}
          <div className="rounded-2xl overflow-hidden border order-2 lg:order-1"
            style={{ background: "#fff", borderColor: "rgba(59,130,246,0.2)", boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)" }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(0,0,0,0.06)", background: "#FAFAFA" }}>
              <p className="text-[#666666] text-xs font-bold uppercase tracking-wider">Suivi commande #AX-2847</p>
              <p className="text-[#111111] font-bold mt-0.5">En cours de livraison</p>
            </div>
            <div className="p-5">
              {/* Fausse carte */}
              <div className="rounded-xl overflow-hidden mb-4 relative h-32"
                style={{ background: "linear-gradient(135deg, #111111 0%, #1a1a1a 100%)", border: "1px solid rgba(245,166,35,0.2)" }}>
                <div className="absolute inset-0 opacity-20"
                  style={{ backgroundImage: "repeating-linear-gradient(0deg,rgba(245,166,35,0.3) 0,rgba(245,166,35,0.3) 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,rgba(245,166,35,0.3) 0,rgba(245,166,35,0.3) 1px,transparent 1px,transparent 40px)" }} />
                <div className="absolute top-6 left-8 w-3 h-3 rounded-full bg-[#F5A623] ring-4 ring-[#F5A623]/25 animate-pulse" />
                <div className="absolute bottom-8 right-10 w-2.5 h-2.5 rounded-full" style={{ background: "#F5A623" }} />
                <div className="absolute bottom-5 right-14 w-24 h-0.5 rotate-[-20deg]" style={{ background: "rgba(245,166,35,0.4)" }} />
                <div className="absolute top-4 right-3 text-xs font-bold" style={{ color: "#F5A623" }}>
                  <MapPin size={12} className="inline mr-1" />Dakar
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-3">
                {[
                  { label: "Commande confirmée", heure: "09:14", done: true },
                  { label: "Colis pris en charge", heure: "11:32", done: true },
                  { label: "En route vers vous", heure: "14:05", done: true, active: true },
                  { label: "Livraison estimée", heure: "16:00–18:00", done: false },
                ].map((e, i) => (
                  <div key={e.label} className="flex items-center gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: e.done ? (e.active ? "linear-gradient(135deg,#F5A623,#d4880d)" : "rgba(59,130,246,0.8)") : "rgba(0,0,0,0.08)" }}>
                        {e.done && <Check size={10} color="#fff" strokeWidth={3} />}
                      </div>
                      {i < 3 && <div className="w-0.5 h-4" style={{ background: e.done ? "rgba(59,130,246,0.4)" : "rgba(0,0,0,0.06)" }} />}
                    </div>
                    <div className="flex-1 flex justify-between">
                      <span className="text-sm" style={{ color: e.active ? "#F5A623" : e.done ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.3)" }}>{e.label}</span>
                      <span className="text-xs" style={{ color: e.done ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.2)" }}>{e.heure}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-2.5 mb-6 px-3.5 py-2 rounded-xl"
              style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)" }}>
              <Truck size={16} style={{ color: "#3b82f6" }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#3b82f6" }}>Logistique avancée</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-[#111111] mb-5 leading-snug">
              De l'entrepôt à votre client,<br />suivi GPS en temps réel
            </h2>
            <p className="text-[#666666] text-lg leading-relaxed mb-8">
              Gérez votre réseau de livreurs, définissez vos zones de livraison et donnez à vos clients une expérience de suivi digne des grandes enseignes.
            </p>
            <ul className="space-y-3.5">
              {[
                "Moteur de frais de port : zones, poids, montant minimum",
                "Réseau de livreurs internes avec app mobile dédiée",
                "Intégration DHL, Campost, MTN Delivery, transporteurs locaux",
                "Suivi GPS temps réel partagé avec l'acheteur via lien",
                "RMA complet : remboursement, échange, avoir magasin",
                "Stock réservé automatiquement dès l'ajout au panier",
              ].map(item => (
                <li key={item} className="flex items-start gap-3">
                  <Check size={14} className="flex-shrink-0 mt-1" style={{ color: "#3b82f6" }} />
                  <span className="text-[#4D4D4D] text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Feature 5 — Marketing ───────────────────────────────────────────── */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 pb-32">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2.5 mb-6 px-3.5 py-2 rounded-xl"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <TrendingUp size={16} style={{ color: "#ef4444" }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#ef4444" }}>Marketing & Croissance</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-[#111111] mb-5 leading-snug">
              Automatisez votre croissance<br />pendant que vous dormez
            </h2>
            <p className="text-[#666666] text-lg leading-relaxed mb-8">
              Relances automatiques, affiliation, publicité multi-canal — AXSO transforme chaque visiteur en client et chaque client en ambassadeur.
            </p>
            <ul className="space-y-3.5">
              {[
                "Programme d'affiliation avec commissions et tableau de bord affilié",
                "Automation : panier abandonné, séquence bienvenue, clients inactifs",
                "Pixels Facebook, TikTok, Google Ads configurés en 1 clic",
                "Campagnes email et SMS vers vos segments clients",
                "Popups et bandeaux comportementaux sur votre boutique",
                "Studio vidéo IA pour créer vos publicités en quelques minutes",
              ].map(item => (
                <li key={item} className="flex items-start gap-3">
                  <Check size={14} className="flex-shrink-0 mt-1" style={{ color: "#ef4444" }} />
                  <span className="text-[#4D4D4D] text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Metrics mockup */}
          <div className="rounded-2xl overflow-hidden border"
            style={{ background: "#fff", borderColor: "rgba(239,68,68,0.2)", boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)" }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "rgba(0,0,0,0.06)", background: "#FAFAFA" }}>
              <div className="flex gap-1.5">{["#ff5f57","#febc2e","#28c840"].map(c => <div key={c} className="w-3 h-3 rounded-full" style={{ background: c }} />)}</div>
              <span className="text-[#888888] text-xs ml-2">Marketing — Performances</span>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Ventes ce mois", val: "1,84M XOF", delta: "+32%", up: true },
                  { label: "Nouveaux clients", val: "247", delta: "+18%", up: true },
                  { label: "Taux conversion", val: "4,2%", delta: "+0.8pt", up: true },
                ].map(m => (
                  <div key={m.label} className="rounded-xl p-3 text-center" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.06)" }}>
                    <p className="text-[#111111] font-black text-lg">{m.val}</p>
                    <p className="text-[#8C8C8C] text-[10px] mb-1">{m.label}</p>
                    <span className="text-xs font-bold" style={{ color: "#22c55e" }}>{m.delta}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[#8C8C8C] text-xs font-bold uppercase tracking-wider mb-3">Automations actives</p>
                {[
                  { nom: "Relance panier abandonné", envois: "84 emails/SMS", taux: "12% conv.", color: "#ef4444" },
                  { nom: "Séquence nouveaux clients", envois: "247 en cours", taux: "68% ouvert.", color: "#F5A623" },
                  { nom: "Réactivation 30 jours", envois: "156 ciblés", taux: "8% conv.", color: "#7c3aed" },
                ].map(a => (
                  <div key={a.nom} className="flex items-center gap-3 rounded-xl px-3 py-2.5 mb-2"
                    style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.05)" }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: a.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[#111111] text-xs font-semibold truncate">{a.nom}</p>
                      <p className="text-[#8C8C8C] text-[10px]">{a.envois}</p>
                    </div>
                    <span className="text-xs font-bold flex-shrink-0" style={{ color: "#22c55e" }}>{a.taux}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Axia Agents ─────────────────────────────────────────────────────── */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 pb-32"
        style={{ background: "linear-gradient(180deg, transparent 0%, rgba(124,58,237,0.05) 50%, transparent 100%)" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] mb-5 px-3 py-1.5 rounded-full"
              style={{ color: "#7c3aed", background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)" }}>
              <Cpu size={11} /> 11 agents spécialisés
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#111111] mb-4">L'équipe IA qui ne dort jamais</h2>
            <p className="text-[#737373] text-lg max-w-2xl mx-auto">
              Chaque agent Axia maîtrise un domaine précis et travaille en coordination avec les autres — comme une équipe complète sans les charges salariales.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {AGENTS.map(({ icon: Icon, nom, desc }) => (
              <div key={nom}
                className="rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-0.5 group"
                style={{ background: "rgba(0,0,0,0.02)", borderColor: "rgba(124,58,237,0.12)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-all group-hover:scale-110"
                  style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.25)" }}>
                  <Icon size={18} style={{ color: "#a78bfa" }} />
                </div>
                <h3 className="font-bold text-[#111111] mb-2">{nom}</h3>
                <p className="text-[#737373] text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ───────────────────────────────────────────────────────── */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 pb-24">
        <div className="max-w-3xl mx-auto rounded-3xl p-12 text-center border relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(245,166,35,0.08) 0%, rgba(245,166,35,0.03) 100%)", borderColor: "rgba(245,166,35,0.25)" }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 pointer-events-none"
            style={{ background: "radial-gradient(ellipse, rgba(245,166,35,0.15), transparent)" }} />
          <h2 className="text-3xl sm:text-4xl font-black text-[#111111] mb-4 relative">Prêt à bâtir votre empire ?</h2>
          <p className="text-[#666666] text-lg mb-8 relative">Créez votre boutique en 2 minutes. Gratuit, sans carte bancaire.</p>
          <Link href="/inscription"
            className="inline-flex items-center gap-2 font-bold px-10 py-4 rounded-2xl transition-all hover:scale-105 relative"
            style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", color: "#080808", boxShadow: "0 8px 30px rgba(245,166,35,0.4)" }}>
            Créer ma boutique gratuitement <ArrowRight size={18} />
          </Link>
          <p className="text-[#888888] text-xs mt-4 relative">
            <Shield size={11} className="inline mr-1" />
            Pas de carte · Annulation à tout moment · Support inclus
          </p>
        </div>
      </section>

      <FooterMarketing />
    </main>
  );
}
