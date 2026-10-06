import { redirect } from "next/navigation";

// Plus de panier : chaque produit se commande depuis sa fiche (Commander).
// Les anciens liens vers le panier mènent au catalogue.
export default async function PanierPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/${slug}/produits`);
}
