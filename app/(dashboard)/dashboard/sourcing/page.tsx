"use client";
// Hub AXSO Sourcing : parcours guidé (de « aucune idée » au premier produit en
// vente), alertes calculées sur les vraies données, et accès aux modules.
// Rien n'est inventé ici : une étape n'est cochée que si les données le prouvent.
import Link from "next/link";
import {
  Search, Gauge, Download, Tag, Store, Rocket, ShoppingCart, Send, Truck, TrendingUp,
  Check, ArrowRight, Flame, AlertTriangle, Package, Star, FlaskConical, Trophy, Plane, Boxes, Calculator, Plug, Map,
} from "lucide-react";
import { ModuleTutorial, BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";
import { useT } from "@/components/I18nProvider";
import { Page, Entete, Carte, Bouton, Chargement, Erreur, useApi } from "@/components/dashboard/sourcing/ui";

const TUTORIEL = [
  { Icon: Map, titre: "Un parcours en 10 étapes", description: "De la recherche d'un produit jusqu'à la mesure du bénéfice. Axso coche chaque étape quand vos données montrent qu'elle est faite." },
  { Icon: Download, titre: "Vous apportez le produit", description: "Vous cherchez le produit sur le site du fournisseur, puis vous copiez ses informations dans Axso. La connexion automatique aux fournisseurs n'est pas encore disponible." },
  { Icon: Gauge, titre: "Coût réel et score", description: "Axso calcule le coût réel par commande livrée, un prix conseillé et un score sur 100. Les valeurs non mesurées sont marquées « Estimation »." },
  { Icon: Plug, titre: "Des intégrations honnêtes", description: "Chaque service affiche son état : Actif, À connecter, ou Sandbox (données fictives pour essayer)." },
];

interface ProduitHub { id: string; etape: string; produitId: string | null; confianceScore: number; concurrence: number | null; logistique: number | null }
interface Alerte { type: string; ton: "positif" | "attention"; titre: string; message: string; lien?: string }
interface Tdb { kpi: { commandes: number; ca: number; tauxLivraison: number | null; delaiFournisseurJours: number | null }; alertes: Alerte[] }

const MODULES = [
  { href: "/dashboard/sourcing/catalogue", Icon: Package, titre: "Catalogue", texte: "Tous vos produits repérés." },
  { href: "/dashboard/sourcing/fournisseurs", Icon: Search, titre: "Recherche fournisseur", texte: "Comparer et suivre vos fournisseurs." },
  { href: "/dashboard/sourcing/import", Icon: Download, titre: "Import produit", texte: "Ajouter un produit à analyser." },
  { href: "/dashboard/sourcing/catalogue?vue=favoris", Icon: Star, titre: "Produits favoris", texte: "Ceux que vous avez mis de côté." },
  { href: "/dashboard/sourcing/catalogue?vue=test", Icon: FlaskConical, titre: "Produits en test", texte: "En vente pour vérifier la demande." },
  { href: "/dashboard/sourcing/catalogue?vue=gagnants", Icon: Trophy, titre: "Produits gagnants", texte: "Validés après un test rentable." },
  { href: "/dashboard/sourcing/commandes", Icon: ShoppingCart, titre: "Commandes fournisseurs", texte: "Ce qu'il faut commander et suivre." },
  { href: "/dashboard/sourcing/expeditions", Icon: Plane, titre: "Expéditions internationales", texte: "Vos colis en route vers le pays." },
  { href: "/dashboard/sourcing/stocks", Icon: Boxes, titre: "Stocks", texte: "Ruptures à venir et réassort." },
  { href: "/dashboard/sourcing/calculateur", Icon: Calculator, titre: "Calculateur de rentabilité", texte: "Coût réel et prix conseillé." },
  { href: "/dashboard/dropshipping", Icon: TrendingUp, titre: "Tableau de bord profit", texte: "Chiffre d'affaires et bénéfice réels." },
  { href: "/dashboard/sourcing/reglages", Icon: Plug, titre: "Pays & intégrations", texte: "Pays de vente, coûts, services branchés." },
];

export default function SourcingPage() {
  const t = useT();
  const catalogue = useApi<{ produits: ProduitHub[] }>("/api/sourcing/produits?vue=tous");
  const tdb = useApi<Tdb>("/api/sourcing/tableau-de-bord?jours=30");

  const produits = catalogue.data?.produits ?? [];
  const kpi = tdb.data?.kpi;
  const premier = produits[0];
  const fiche = premier ? `/dashboard/sourcing/produits/${premier.id}` : "/dashboard/sourcing/catalogue";
  const enBoutique = produits.some((p) => p.produitId);

  // `prouve` = ce que les données des 30 derniers jours montrent.
  const etapes = [
    { Icon: Search, titre: "Trouver un produit", texte: "Cherchez un produit chez un fournisseur. Un seul suffit pour commencer.", href: "/dashboard/sourcing/import", prouve: produits.length > 0 },
    // 0,38 = part du score calculée automatiquement ; au-delà, le marchand a rempli au moins une estimation.
    { Icon: Gauge, titre: "Analyser", texte: "Regardez son coût réel et son score avant d'y mettre de l'argent.", href: fiche, prouve: produits.some((p) => p.confianceScore > 0.38 || p.concurrence !== null || p.logistique !== null) },
    { Icon: Download, titre: "Importer", texte: "Ajoutez sa fiche dans votre catalogue Sourcing.", href: "/dashboard/sourcing/import", prouve: produits.length > 0 },
    { Icon: Tag, titre: "Fixer le prix", texte: "Gardez le prix conseillé ou choisissez le vôtre.", href: fiche, prouve: enBoutique }, // publier exige un prix
    { Icon: Store, titre: "Publier", texte: "Mettez le produit en vente dans votre boutique.", href: "/dashboard/sourcing/catalogue", prouve: enBoutique },
    { Icon: Rocket, titre: "Lancer le test", texte: "Faites connaître le produit pour obtenir vos premières ventes.", href: fiche, prouve: enBoutique && produits.some((p) => p.etape !== "decouverte") },
    { Icon: ShoppingCart, titre: "Recevoir la commande", texte: "Confirmez chaque commande avec le client avant d'expédier.", href: "/dashboard/commandes", prouve: (kpi?.commandes ?? 0) > 0 },
    { Icon: Send, titre: "Faire expédier", texte: "Transmettez la commande à votre fournisseur.", href: "/dashboard/sourcing/commandes", prouve: kpi?.delaiFournisseurJours != null }, // une commande fournisseur est passée à « expédiée »
    { Icon: Truck, titre: "Livrer", texte: "Suivez le colis jusqu'au client.", href: "/dashboard/sourcing/expeditions", prouve: (kpi?.tauxLivraison ?? 0) > 0 },
    { Icon: TrendingUp, titre: "Mesurer le bénéfice", texte: "Regardez ce qu'il vous reste vraiment après tous les frais.", href: "/dashboard/dropshipping", prouve: (kpi?.ca ?? 0) > 0 && (kpi?.tauxLivraison ?? 0) > 0 }, // une vente payée et livrée : le bénéfice est calculé
  ].map((e, i, toutes) => ({ ...e, fait: e.prouve || toutes.slice(i + 1).some((s) => s.prouve) }));
  const prochaine = etapes.findIndex((e) => !e.fait);

  return (
    <Page>
      <ModuleTutorial moduleKey="sourcing" titre={t("AXSO Sourcing")} sousTitre={t("Du produit trouvé au bénéfice mesuré")} steps={TUTORIEL} />
      <Entete badge="AXSO SOURCING" titre="AXSO Sourcing"
        sousTitre="Trouvez un produit, vérifiez qu'il est rentable, mettez-le en vente. Suivez les étapes une par une."
        actions={<BoutonRevoirTutoriel moduleKey="sourcing" />} />

      {catalogue.chargement && !catalogue.data ? <Chargement /> : catalogue.erreur ? <Erreur message={catalogue.erreur} /> : (
        <>
          {/* La prochaine étape : le seul gros bouton de la page */}
          {prochaine >= 0 && (
            <section className="rounded-2xl p-5 border border-[#FDE68A] bg-[#FFF7ED]">
              <p className="text-[11px] font-bold text-[#B45309] uppercase tracking-wide">{t("Prochaine étape — {0} sur 10", prochaine + 1)}</p>
              <h2 className="text-[18px] font-bold text-[#111111] mt-1">{t(etapes[prochaine].titre)}</h2>
              <p className="text-[13px] text-[#666666] mt-1 mb-4 leading-relaxed">{t(etapes[prochaine].texte)}</p>
              <Bouton href={etapes[prochaine].href}>{t(etapes[prochaine].titre)}<ArrowRight size={14} /></Bouton>
            </section>
          )}

          {(tdb.data?.alertes ?? []).length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tdb.data!.alertes.map((a, i) => {
                const positif = a.ton === "positif";
                const Icone = positif ? Flame : AlertTriangle;
                const contenu = (
                  <div className="flex gap-3 rounded-2xl border p-4 h-full" style={positif ? { background: "#ECFDF5", borderColor: "#BBF7D0" } : { background: "#FEF2F2", borderColor: "#FECACA" }}>
                    <Icone size={18} className="flex-shrink-0 mt-0.5" style={{ color: positif ? "#15803D" : "#B91C1C" }} />
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-[#111111]">{t(a.titre)}</p>
                      <p className="text-[12px] text-[#666666] mt-0.5 leading-relaxed">{t(a.message)}</p>
                    </div>
                  </div>
                );
                return a.lien ? <Link key={i} href={a.lien}>{contenu}</Link> : <div key={i}>{contenu}</div>;
              })}
            </div>
          )}

          <Carte titre="Votre parcours" aide="Une étape est cochée quand vos données montrent qu'elle est faite.">
            <ol className="divide-y divide-[#F0F0F0]">
              {etapes.map((e, i) => (
                <li key={e.titre}>
                  <Link href={e.href} className="flex items-center gap-3 py-3 group">
                    <span className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-bold"
                      style={e.fait ? { background: "#ECFDF5", color: "#15803D" } : i === prochaine ? { background: "#F5A623", color: "#111111" } : { background: "#F5F5F5", color: "#AAAAAA" }}>
                      {e.fait ? <Check size={15} /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#111111]"><e.Icon size={13} className="text-[#AAAAAA]" />{t(e.titre)}</span>
                      <span className="block text-[12px] text-[#666666] leading-snug">{t(e.texte)}</span>
                    </span>
                    <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: e.fait ? "#15803D" : "#AAAAAA" }}>{e.fait ? t("Fait") : t("À faire")}</span>
                    <ArrowRight size={14} className="text-[#CCCCCC] group-hover:text-[#F5A623] flex-shrink-0" />
                  </Link>
                </li>
              ))}
            </ol>
          </Carte>
        </>
      )}

      <div>
        <h2 className="text-[14px] font-bold text-[#111111] mb-3">{t("Tous les modules")}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {MODULES.map((m) => (
            <Link key={m.href} href={m.href} className="bg-white rounded-2xl border border-[#E8E8E8] shadow-sm p-4 hover:border-[#F5A623] transition-colors">
              <m.Icon size={18} className="text-[#F5A623]" />
              <p className="text-[13px] font-bold text-[#111111] mt-2 leading-tight">{t(m.titre)}</p>
              <p className="text-[11px] text-[#666666] mt-0.5 leading-snug">{t(m.texte)}</p>
            </Link>
          ))}
        </div>
      </div>
    </Page>
  );
}
