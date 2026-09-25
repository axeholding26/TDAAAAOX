"use client";

import { Suspense, useEffect, useState } from "react";
import type { ThemeConfig } from "@/lib/theme-config";
import { ProductPageClient, type ProductPageClientProps } from "@/components/storefront/ProductPageClient";
import { StorefrontTypography } from "@/components/storefront/StorefrontTypography";

type Device = "desktop" | "tablet" | "mobile";
const LARGEUR: Record<Device, string> = { desktop: "100%", tablet: "768px", mobile: "390px" };
type Produit = ProductPageClientProps["produit"];

// Produit d'exemple quand la boutique n'en a pas encore : toutes les sections
// (variantes, avis…) restent visibles pendant le réglage.
const EXEMPLE: Produit = {
  id: "exemple", nom: "Produit d'exemple", description: "Une courte description de votre produit, affichée sous le prix.", descriptionIA: null,
  images: [], prixAffiche: 15000, prixCompareAffiche: 19000, remise: 21, stock: 12, type: "physique", fichierUrl: null, fichierNom: null,
  categorie: null, marque: null, collections: [], noteMoyenne: 4.5,
  variantes: [
    { id: "t-s", nom: "Taille", valeur: "S", prix: null, stock: 5 }, { id: "t-m", nom: "Taille", valeur: "M", prix: null, stock: 5 },
    { id: "t-l", nom: "Taille", valeur: "L", prix: null, stock: 0 },
  ],
  avis: [
    { id: "a1", note: 5, titre: "Parfait", commentaire: "Très bonne qualité, livraison rapide.", verifie: true, client: { nom: "Awa" }, createdAt: new Date().toISOString() },
    { id: "a2", note: 4, titre: null, commentaire: "Conforme à la description.", verifie: false, client: { nom: "Koffi" }, createdAt: new Date().toISOString() },
  ],
};

// Aperçu en direct de la fiche produit dans le Constructeur — même composant
// que la boutique en ligne, alimenté par la config en cours d'édition.
export function ApercuFiche({ config, tenant, device }: { config: ThemeConfig; tenant: any; device: Device }) {
  const [produit, setProduit] = useState<Produit>(EXEMPLE);

  useEffect(() => {
    fetch("/api/produits?limit=1").then(r => r.json()).then(async d => {
      const premier = d.produits?.[0];
      if (!premier) return;
      const { produit: p } = await fetch(`/api/produits/${premier.id}`).then(r => r.json());
      if (!p) return;
      setProduit({
        ...EXEMPLE, id: p.id, nom: p.nom, description: p.description, descriptionIA: p.descriptionIA ?? null,
        images: p.images ?? [], prixAffiche: p.prix, prixCompareAffiche: p.prixCompare ?? null, remise: 0, stock: p.stock, type: p.type,
        // Variantes d'exemple seulement pour un produit physique qui n'en a pas (pour voir leur style) ;
        // jamais de tailles sur un ebook ou une formation.
        variantes: p.variantes?.length ? p.variantes.map((v: any) => ({ id: v.id, nom: v.nom, valeur: v.valeur, prix: v.prix, stock: v.stock }))
          : p.type === "physique" ? EXEMPLE.variantes : [],
      });
    }).catch(() => {});
  }, []);

  const c = config.colors;
  return (
    <div className="isolate flex-1 min-w-0 overflow-y-auto bg-[#F1F2F4] p-4 lg:p-5">
      <div className="relative mx-auto rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden transition-[width] duration-300"
        style={{ width: LARGEUR[device], maxWidth: "100%" }}
        // Aperçu : liens non suivis, formulaires (avis) jamais envoyés.
        onClickCapture={(e) => { if ((e.target as HTMLElement).closest("a")) e.preventDefault(); }}
        onSubmitCapture={(e) => { e.preventDefault(); e.stopPropagation(); }}>
        <p className="px-4 py-2 text-[12px] text-[#8A6D1F] bg-[#FFF8E6] border-b border-[#F5E6BF]">
          Aperçu avec {produit.id === "exemple" ? "un produit d'exemple" : `« ${produit.nom} »`} — les avis{produit.id === "exemple" ? " et variantes" : ""} affichés sont des exemples pour visualiser le style.
        </p>
        <StorefrontTypography fonts={config.fonts} />
        <div className="axs-store pointer-events-auto">
          <Suspense>
            <ProductPageClient
              produit={produit}
              produitsSimilaires={[]}
              sansPied
              tenant={{
                id: tenant?.id ?? "", slug: tenant?.slug ?? "", nomBoutique: tenant?.nomBoutique ?? "", devise: tenant?.devise ?? "XAF",
                certifie: !!tenant?.certifie, accent: c.accent, fond: c.fond, texte: c.texte, surface: c.surface, radius: config.radius,
                whatsapp: tenant?.whatsapp ?? null, whatsappNumero: tenant?.whatsappNumero ?? null,
                productPage: config.productPage ?? null, layout: config.layout ?? null, boutons: config.boutons ?? null,
                boutiqueDigitale: config.modeBoutique === "digital",
              }}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
