// « Importer dans ma boutique » : crée le produit de la boutique à partir de la
// fiche sourcing (ou met son prix et son coût à jour s'il existe déjà).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { accesSourcing, contexteCalcul, journaliser, erreur, reponseErreur } from "@/lib/sourcing/acces";
import { evaluerProduit, MODES_APPRO } from "@/lib/sourcing/produit-source";
import { connecteur } from "@/lib/sourcing/connecteurs";
import type { KitTest } from "@/lib/sourcing/ia";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  const { id } = await params;
  try {
    const source = await prisma.produitSource.findFirst({ where: { id, tenantId: acces.tenantId } });
    if (!source) return erreur("Produit introuvable", 404);
    if (connecteur(source.connecteur).statut === "sandbox") return erreur("Produit de démonstration (sandbox) : ses données sont fictives, il ne peut pas être publié.", 422);

    const ev = evaluerProduit(source, await contexteCalcul(acces.tenantId));
    const prix = ev.cout.prixVente;
    if (!prix || prix <= 0) return erreur("Fixez un prix de vente avant de publier.", 422);
    const lignes = Object.fromEntries(ev.cout.lignes.map((l) => [l.cle, l.montant]));
    const chiffres = { prix, cout: ev.cout.coutProduitRendu, prixFournisseur: lignes.produit };

    // Déjà publié : seuls le prix et les coûts sont resynchronisés (le marchand a pu retoucher la fiche boutique).
    if (source.produitId) {
      const r = await prisma.produit.updateMany({ where: { id: source.produitId, tenantId: acces.tenantId }, data: chiffres });
      if (r.count) {
        await journaliser(acces, "prix_synchronise", `ProduitSource:${id}`, chiffres);
        return NextResponse.json({ produitId: source.produitId, cree: false });
      }
    }

    const kit = source.kitTest as KitTest | null;
    const variantes = (source.variantes as { nom: string; valeur: string; prix?: number; sku?: string; stock?: number }[]) ?? [];
    const dropshipping = source.modeAppro === "dropshipping";
    const produit = await prisma.$transaction(async (tx) => {
      // Garde contre le double clic : un seul des deux appels prend la fiche (produitId encore vide).
      const pris = await tx.produitSource.updateMany({ where: { id, tenantId: acces.tenantId, produitId: source.produitId }, data: { produitId: "en_cours" } });
      if (!pris.count) throw Object.assign(new Error("Publication déjà en cours."), { status: 409 });
      const p = await tx.produit.create({
        data: {
          tenantId: acces.tenantId,
          nom: kit?.titre?.slice(0, 200) || source.nom,
          slug: `${slugify(source.nom).slice(0, 60) || "produit"}-${Date.now().toString(36)}`,
          description: kit?.description || source.description,
          ...chiffres,
          images: source.images, videos: source.videos, tags: [],
          poids: source.poidsKg, sku: source.sku,
          faq: kit?.faq?.length ? kit.faq : undefined,
          type: MODES_APPRO.find((m) => m.cle === source.modeAppro)?.typeProduit ?? "dropshipping",
          // Dropshipping : stock chez le fournisseur (même convention que l'import existant).
          // Stock local : 0 jusqu'à la réception de la marchandise (stock strict).
          stock: dropshipping ? 9999 : 0,
          urlFournisseur: source.url, nomFournisseur: source.fournisseurNom, fournisseurId: source.fournisseurId,
          actif: true,
        },
      });
      if (variantes.length) {
        await tx.variante.createMany({ data: variantes.map((v) => ({ produitId: p.id, nom: v.nom, valeur: v.valeur, prix: null, sku: v.sku ?? null, stock: dropshipping ? 9999 : 0 })) });
      }
      await tx.produitSource.update({ where: { id }, data: { produitId: p.id, score: ev.score.total, ...(source.etape === "decouverte" && { etape: "test" }) } });
      return p;
    });
    await journaliser(acces, "produit_publie", `ProduitSource:${id}`, { produitId: produit.id, ...chiffres });
    return NextResponse.json({ produitId: produit.id, slug: produit.slug, cree: true }, { status: 201 });
  } catch (e) {
    return reponseErreur(e);
  }
}
