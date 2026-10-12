import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { changerStatutCommande } from "@/lib/cycle-livraison";
import { PAIEMENT } from "@/lib/commandes";
import { NOTE_PRIX_ACHAT_MANQUANT } from "@/lib/paiement-commande";
import { avancerCommandeFournisseur } from "@/lib/sourcing/fournisseurs/service";
import { MOTIFS_ANNULATION } from "@/lib/sourcing/statuts";
import { accesSourcing } from "@/lib/sourcing/acces";

// Mêmes valeurs que CommandeFournisseur.statut (prisma/schema.prisma).
const STATUTS = ["en_attente", "envoye", "confirme", "expedie", "livre", "annule"];

export async function GET(req: Request) {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  const { tenantId } = acces;
  const { searchParams } = new URL(req.url);
  const statut = searchParams.get("statut");

  const where: any = { tenantId };
  if (statut) where.statut = statut;

  const commandes = await (prisma as any).commandeFournisseur.findMany({
    where,
    include: {
      commande: { select: { numero: true, clientNom: true, clientEmail: true, montantTotal: true, devise: true, createdAt: true } },
      fournisseur: { select: { nom: true, pays: true, type: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const stats = {
    total: await (prisma as any).commandeFournisseur.count({ where: { tenantId } }),
    en_attente: await (prisma as any).commandeFournisseur.count({ where: { tenantId, statut: "en_attente" } }),
    expedie: await (prisma as any).commandeFournisseur.count({ where: { tenantId, statut: "expedie" } }),
    livre: await (prisma as any).commandeFournisseur.count({ where: { tenantId, statut: "livre" } }),
  };

  return NextResponse.json({ commandes, stats });
}

export async function POST(req: Request) {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  const { tenantId } = acces;
  const body = await req.json();

  // Verify commande belongs to tenant
  const commande = await prisma.commande.findFirst({
    where: { id: body.commandeId, tenantId },
    include: { lignes: { include: { produit: { select: { fournisseurId: true, prixFournisseur: true } } } } },
  });
  if (!commande) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  // Rien ne part chez le fournisseur tant que la commande n'est pas payée
  // (paiement à la livraison : confirmée par le marchand, comme dans lib/sourcing/statuts.ts).
  const codConfirmee = commande.methodePaiement.includes("cod") && commande.statut !== "en_attente";
  if (commande.statut === "annulee" || (commande.paiementStatut !== PAIEMENT.PAYE && !codConfirmee)) {
    return NextResponse.json({ error: "Cette commande n'est pas encore payée : la commande fournisseur ne peut pas être créée." }, { status: 409 });
  }

  // Auto-detect fournisseurId from products if not provided
  const fournisseurId = body.fournisseurId ?? commande.lignes.find((l: any) => l.produit?.fournisseurId)?.produit?.fournisseurId;
  if (!fournisseurId) return NextResponse.json({ error: "Aucun fournisseur associé à cette commande" }, { status: 400 });
  // L'identifiant peut venir du navigateur : le fournisseur doit appartenir à la boutique.
  if (!(await prisma.fournisseur.findFirst({ where: { id: String(fournisseurId), tenantId }, select: { id: true } }))) {
    return NextResponse.json({ error: "Fournisseur introuvable" }, { status: 404 });
  }

  // Seulement les lignes de ce fournisseur, au prix d'achat connu : un prix manquant
  // n'est jamais deviné, il compte 0 et la note le signale.
  const lignesFournisseur = commande.lignes.filter((l) => l.produit?.fournisseurId === fournisseurId);
  const prixManquant = lignesFournisseur.some((l) => l.produit?.prixFournisseur == null);
  const montantFournisseur = lignesFournisseur.reduce((s, l) => s + (l.produit?.prixFournisseur ?? 0) * l.quantite, 0);

  // Idempotence : une seule commande fournisseur par commande et par fournisseur.
  const deja = await prisma.commandeFournisseur.findFirst({ where: { tenantId, commandeId: commande.id, fournisseurId } });
  if (deja) return NextResponse.json({ commandeFournisseur: deja });

  const cf = await (prisma as any).commandeFournisseur.create({
    data: {
      tenantId,
      commandeId: body.commandeId,
      fournisseurId,
      montantFournisseur,
      delaiEstime: body.delaiEstime,
      notes: [body.notes, prixManquant && NOTE_PRIX_ACHAT_MANQUANT].filter(Boolean).join(" — ") || null,
      envoiAuto: body.envoiAuto ?? false,
      // Rien n'est transmis automatiquement : le marchand passe la commande puis la marque « envoyée ».
      statut: "en_attente",
    },
  });
  return NextResponse.json({ commandeFournisseur: cf });
}

export async function PATCH(req: Request) {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  const { tenantId } = acces;
  const body = await req.json();

  const existante = await prisma.commandeFournisseur.findFirst({ where: { id: body.id, tenantId } });
  if (!existante) return NextResponse.json({ error: "Commande fournisseur introuvable" }, { status: 404 });
  if (body.statut !== undefined && !STATUTS.includes(body.statut)) return NextResponse.json({ error: "Statut inconnu" }, { status: 400 });

  // Sans motif, une annulation n'est imputée à personne : on ne blâme pas le fournisseur par défaut.
  const motifAnnulation = body.statut === "annule" && body.motif in MOTIFS_ANNULATION ? String(body.motif) : undefined;
  if (body.statut !== undefined && body.statut !== existante.statut
    && !(await avancerCommandeFournisseur(tenantId, existante.id, body.statut, { motifAnnulation }))) {
    return NextResponse.json({ error: "Cette commande fournisseur ne peut pas revenir à une étape précédente." }, { status: 409 });
  }
  const cf = await prisma.commandeFournisseur.update({
    where: { id: existante.id },
    data: {
      trackingNo: body.trackingNo,
      reference: body.reference,
      notes: body.notes,
    },
  });

  // La commande client suit le cycle de livraison normal (transitions, WhatsApp, CA).
  if (body.trackingNo) {
    await prisma.commande.update({ where: { id: cf.commandeId }, data: { numeroSuivi: body.trackingNo } });
  }
  // « Livré » sans passage par « expédié » : on enchaîne les deux étapes.
  const etapes = body.statut === "expedie" ? ["expediee"] : body.statut === "livre" ? ["expediee", "livree"] : [];
  for (const [i, statut] of etapes.entries()) {
    const commande = await prisma.commande.findUnique({ where: { id: cf.commandeId }, select: { statut: true } });
    if (commande?.statut === statut || (statut === "expediee" && commande?.statut === "livree")) continue;
    const r = await changerStatutCommande({ commandeId: cf.commandeId, statut, acteur: { type: "marchand", tenantId, source: "interface" } });
    if (!r.ok && i === etapes.length - 1) return NextResponse.json({ error: r.error }, { status: r.status });
  }

  return NextResponse.json({ commandeFournisseur: cf });
}
