// Demandes de devis (RFQ). POST : génère le texte standardisé et prépare un
// envoi par fournisseur destinataire. Rien n'est envoyé ici : l'envoi se fait
// fournisseur par fournisseur dans /api/fournisseurs/devis/[id].
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { schemaDevise } from "@/lib/sourcing/cout-rendu";
import { prisma } from "@/lib/prisma";
import { accesSourcing, erreur, reponseErreur } from "@/lib/sourcing/acces";
import { redigerDevis } from "@/lib/sourcing/fournisseurs/ia";
import { chargerDevis, parametresBoutique } from "@/lib/sourcing/fournisseurs/service";

const vide = (v: unknown) => (v === "" ? null : v);
const txt = (max = 300) => z.preprocess(vide, z.string().trim().max(max).nullable().optional());
const schema = z.object({
  produitId: txt(40), nomProduit: z.string().trim().min(2).max(200), description: txt(3000),
  quantite: z.coerce.number().int().positive().max(10_000_000),
  prixCible: z.preprocess(vide, z.coerce.number().positive().nullable().optional()),
  devise: schemaDevise.default("USD"),
  villeDestination: txt(120), incoterm: txt(20), couleur: txt(120), packaging: txt(500), personnalisation: txt(500),
  langue: z.enum(["en", "fr"]).default("en"),
  fournisseurIds: z.array(z.string()).min(1, "Choisissez au moins un fournisseur").max(20),
});

export async function GET() {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  return NextResponse.json({ demandes: await chargerDevis(acces.tenantId) });
}

export async function POST(req: Request) {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  try {
    const { fournisseurIds, langue, ...d } = schema.parse(await req.json());
    const [fournisseurs, tenant, { contexte }] = await Promise.all([
      prisma.fournisseur.findMany({ where: { tenantId: acces.tenantId, id: { in: fournisseurIds } }, select: { id: true } }),
      prisma.tenant.findUnique({ where: { id: acces.tenantId }, select: { nomBoutique: true } }),
      parametresBoutique(acces.tenantId),
    ]);
    if (!fournisseurs.length) return erreur("Aucun fournisseur valide", 400);
    if (d.produitId && !(await prisma.produit.findFirst({ where: { id: d.produitId, tenantId: acces.tenantId }, select: { id: true } }))) return erreur("Produit introuvable", 404);
    const reference = `RFQ-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${randomBytes(2).toString("hex").toUpperCase()}`;
    const contenu = redigerDevis({ ...d, reference, paysNom: contexte.paysNom, boutique: tenant?.nomBoutique ?? "AXSO" }, langue);
    const demande = await prisma.demandeDevis.create({
      data: { ...d, tenantId: acces.tenantId, reference, paysDestination: contexte.pays, contenu, reponses: { create: fournisseurs.map((f) => ({ fournisseurId: f.id })) } },
    });
    return NextResponse.json({ ok: true, id: demande.id }, { status: 201 });
  } catch (e) {
    return reponseErreur(e);
  }
}
