// Fiche d'un fournisseur : dossier complet + analyse (score expliqué, détection
// fabricant, risques, label, coût réel de chaque offre).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accesSourcing, erreur, reponseErreur } from "@/lib/sourcing/acces";
import { LIBELLE_STATUT } from "@/lib/sourcing/connecteurs";
import { ficheFournisseur, invaliderVerifications, journaliserCoordonnees, recalculer, schemaFournisseur } from "@/lib/sourcing/fournisseurs/service";
import { PRESTATAIRES_INSPECTION, VERIFICATEURS_CERTIFICATS } from "@/lib/sourcing/fournisseurs/services-tiers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  const { id } = await params;
  const quantite = Number(new URL(req.url).searchParams.get("quantite")) || undefined;
  const fiche = await ficheFournisseur(acces.tenantId, id, quantite);
  if (!fiche) return erreur("Fournisseur introuvable", 404);
  const produits = await prisma.produit.findMany({ where: { tenantId: acces.tenantId, actif: true }, select: { id: true, nom: true }, orderBy: { nom: "asc" }, take: 300 });
  // Services tiers : affichés avec leur vrai statut (« À connecter » tant qu'ils ne sont pas branchés).
  const servicesTiers = [...PRESTATAIRES_INSPECTION, ...VERIFICATEURS_CERTIFICATS].map((s) => ({ id: s.id, nom: s.nom, statut: s.statut, libelleStatut: LIBELLE_STATUT[s.statut], description: s.description, urlSite: "urlSite" in s ? s.urlSite : null }));
  return NextResponse.json({ ...fiche, produits, servicesTiers });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  const { id } = await params;
  try {
    const data = schemaFournisseur.partial().parse(await req.json());
    const avant = await prisma.fournisseur.findFirst({ where: { id, tenantId: acces.tenantId } });
    if (!avant) return erreur("Fournisseur introuvable", 404);
    await prisma.fournisseur.update({ where: { id }, data });
    await journaliserCoordonnees(acces.tenantId, avant, data);
    // Modifier une donnée déjà vérifiée par AXSO retire la vérification correspondante.
    const verificationsRetirees = await invaliderVerifications(acces.tenantId, avant, data);
    await recalculer(acces.tenantId, id);
    return NextResponse.json({ ok: true, verificationsRetirees });
  } catch (e) {
    return reponseErreur(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  const { id } = await params;
  const existant = await prisma.fournisseur.findFirst({ where: { id, tenantId: acces.tenantId }, select: { id: true, _count: { select: { commandesFournisseur: true, bonsCommande: true } } } });
  if (!existant) return erreur("Fournisseur introuvable", 404);
  const desactiver = async () => {
    await prisma.fournisseur.update({ where: { id }, data: { actif: false } });
    return NextResponse.json({ ok: true, desactive: true, message: "Ce fournisseur a un historique de commandes : il a été désactivé au lieu d'être supprimé." });
  };
  // Des commandes passées (dropshipping ou bons de commande de la caisse) gardent leur fournisseur : on le désactive au lieu de l'effacer.
  if (existant._count.commandesFournisseur + existant._count.bonsCommande > 0) return desactiver();
  try {
    await prisma.$transaction([
      prisma.produit.updateMany({ where: { fournisseurId: id, tenantId: acces.tenantId }, data: { fournisseurId: null } }),
      prisma.fournisseur.delete({ where: { id } }),
    ]);
  } catch (e) {
    // Encore référencé ailleurs (clé étrangère) : même repli, jamais d'erreur brute.
    if ((e as { code?: string }).code === "P2003") return desactiver();
    return reponseErreur(e);
  }
  return NextResponse.json({ ok: true });
}
