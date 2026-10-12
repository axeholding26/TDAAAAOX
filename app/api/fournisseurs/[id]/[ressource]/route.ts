// Éléments du dossier d'un fournisseur : offres (prix, paliers, MOQ), documents
// et certifications, audits, échantillons, évaluations après commande.
// POST crée, PATCH modifie ({ id, … }), DELETE supprime (?id=).
// Le marchand ne peut JAMAIS écrire un niveau de vérification : un document ou
// un audit naît « déclaré », et toute modification le fait redevenir « déclaré »
// (la vérification portait sur l'ancienne version). Seul un admin AXSO vérifie
// (/api/fournisseurs/[id]/verifier).
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { accesSourcing, erreur, reponseErreur } from "@/lib/sourcing/acces";
import { schemaDevise } from "@/lib/sourcing/cout-rendu";
import { importerOffresCatalogue, recalculer } from "@/lib/sourcing/fournisseurs/service";
import { CHECKLIST_ECHANTILLON, STATUTS_AUDIT, STATUTS_ECHANTILLON, TYPES_AUDIT, TYPES_DOCUMENT, VERDICTS_ECHANTILLON } from "@/lib/sourcing/fournisseurs/types";

const vide = (v: unknown) => (v === "" ? null : v);
const txt = (max = 300) => z.preprocess(vide, z.string().trim().max(max).nullable().optional());
const lien = z.preprocess(vide, z.string().url().max(2000).nullable().optional());
const date = z.preprocess(vide, z.coerce.date().nullable().optional());
const entier = (max = 10_000_000) => z.preprocess(vide, z.coerce.number().int().min(0).max(max).nullable().optional());
const montant = z.preprocess(vide, z.coerce.number().min(0).max(1e9).nullable().optional());
const cles = <T extends Record<string, string>>(o: T) => z.enum(Object.keys(o) as [string, ...string[]]);
const note = z.coerce.number().int().min(1).max(5);

const SCHEMAS = {
  offres: z.object({
    produitId: txt(40), nomProduit: z.string().trim().min(2).max(200), categorie: txt(120), urlOffre: lien,
    prixUnitaire: z.coerce.number().positive().max(1e9), devise: schemaDevise.default("USD"),
    paliers: z.array(z.object({ quantiteMin: z.coerce.number().int().positive(), prix: z.coerce.number().positive() })).max(12).default([]),
    moq: entier(), delaiProduction: entier(730), poidsKg: montant, disponible: z.boolean().optional(),
  }),
  documents: z.object({
    type: cles(TYPES_DOCUMENT), certification: txt(60), nom: z.string().trim().min(2).max(200), url: lien,
    organismeEmetteur: txt(200), numero: txt(120), dateEmission: date, dateExpiration: date,
  }),
  audits: z.object({
    type: cles(TYPES_AUDIT), prestataire: z.string().trim().min(2).max(200), statut: cles(STATUTS_AUDIT).default("demande"),
    dateAudit: date, rapportUrl: lien, reference: txt(120), notes: txt(2000),
  }),
  echantillons: z.object({
    offreId: txt(40), nomProduit: z.string().trim().min(2).max(200), quantite: z.coerce.number().int().min(1).max(1000).default(1),
    cout: montant, devise: schemaDevise.default("USD"), statut: cles(STATUTS_ECHANTILLON).default("a_commander"),
    commandeLe: date, recuLe: date, verdict: z.preprocess(vide, cles(VERDICTS_ECHANTILLON).nullable().optional()), notes: txt(2000),
    checklist: z.partialRecord(cles(CHECKLIST_ECHANTILLON), z.object({ note, commentaire: z.string().max(500).optional() })).optional(),
  }),
  evaluations: z.object({
    offreId: txt(40), commandeFournisseurId: txt(40),
    qualite: note, conformite: note, emballage: note, delai: note, communication: note,
    unitesRecues: z.coerce.number().int().min(0).max(10_000_000).default(0), unitesDefectueuses: z.coerce.number().int().min(0).default(0),
    delaiReelJours: entier(730), commentaire: txt(2000),
  }).refine((e) => e.unitesDefectueuses <= e.unitesRecues, { message: "Plus d'unités défectueuses que d'unités reçues", path: ["unitesDefectueuses"] }),
};
type Ressource = keyof typeof SCHEMAS;

// Les cinq tables partagent tenantId + fournisseurId : mêmes trois opérations.
interface Table {
  create(a: { data: Record<string, unknown> }): Promise<{ id: string }>;
  updateMany(a: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  deleteMany(a: { where: Record<string, unknown> }): Promise<{ count: number }>;
}
const TABLES: Record<Ressource, Table> = {
  offres: prisma.produitFournisseur as unknown as Table,
  documents: prisma.documentFournisseur as unknown as Table,
  audits: prisma.auditFournisseur as unknown as Table,
  echantillons: prisma.echantillonFournisseur as unknown as Table,
  evaluations: prisma.evaluationFournisseur as unknown as Table,
};
// Retour à « déclaré » quand le marchand touche à une pièce vérifiable.
const REMISE_A_ZERO: Partial<Record<Ressource, Record<string, unknown>>> = {
  documents: { statutVerification: "declare_fournisseur", sourceVerification: null, verifieParId: null, verifieLe: null, alerteExpirationLe: null },
  audits: { confiance: "declare_fournisseur", sourceVerification: null },
};

type Ctx = { params: Promise<{ id: string; ressource: string }> };

async function preparer({ params }: Ctx) {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  const { id, ressource } = await params;
  if (!(ressource in SCHEMAS)) return erreur("Ressource inconnue", 404);
  const fournisseur = await prisma.fournisseur.findFirst({ where: { id, tenantId: acces.tenantId }, select: { id: true } });
  if (!fournisseur) return erreur("Fournisseur introuvable", 404);
  return { tenantId: acces.tenantId, id, ressource: ressource as Ressource };
}

/** Champs calculés côté serveur, jamais reçus du navigateur. */
async function completer(tenantId: string, ressource: Ressource, data: Record<string, unknown>) {
  if (ressource === "offres") {
    if (data.produitId && !(await prisma.produit.findFirst({ where: { id: data.produitId as string, tenantId }, select: { id: true } }))) throw Object.assign(new Error("Produit introuvable"), { status: 404 });
    // Le marchand vient de saisir ou de confirmer ce prix : c'est la date de dernière vérification du prix.
    if ("prixUnitaire" in data) data.derniereVerificationAt = new Date();
  }
  return data;
}

export async function POST(req: Request, ctx: Ctx) {
  const p = await preparer(ctx);
  if (p instanceof NextResponse) return p;
  try {
    const corps = await req.json();
    if (p.ressource === "offres" && corps?.importerCatalogue) {
      const importees = await importerOffresCatalogue(p.tenantId, p.id);
      await recalculer(p.tenantId, p.id);
      return NextResponse.json({ ok: true, importees });
    }
    const data = await completer(p.tenantId, p.ressource, SCHEMAS[p.ressource].parse(corps));
    const { id } = await TABLES[p.ressource].create({ data: { ...data, tenantId: p.tenantId, fournisseurId: p.id } });
    await recalculer(p.tenantId, p.id);
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (e) {
    return reponseErreur(e);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const p = await preparer(ctx);
  if (p instanceof NextResponse) return p;
  if (p.ressource === "evaluations") return erreur("Une évaluation ne se modifie pas : supprimez-la et saisissez-la de nouveau.", 405);
  try {
    const { id, ...corps } = await req.json();
    if (typeof id !== "string") return erreur("Identifiant requis");
    const schema = SCHEMAS[p.ressource] as z.ZodObject<z.ZodRawShape>;
    // Seuls les champs envoyés sont modifiés (les valeurs par défaut du schéma ne s'appliquent qu'à la création).
    const envoyes = Object.fromEntries(Object.entries(schema.partial().parse(corps)).filter(([cle, v]) => cle in corps && v !== undefined));
    const data = await completer(p.tenantId, p.ressource, envoyes);
    const { count } = await TABLES[p.ressource].updateMany({ where: { id, tenantId: p.tenantId, fournisseurId: p.id }, data: { ...data, ...REMISE_A_ZERO[p.ressource] } });
    if (!count) return erreur("Élément introuvable", 404);
    await recalculer(p.tenantId, p.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return reponseErreur(e);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const p = await preparer(ctx);
  if (p instanceof NextResponse) return p;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return erreur("Identifiant requis");
  const { count } = await TABLES[p.ressource].deleteMany({ where: { id, tenantId: p.tenantId, fournisseurId: p.id } });
  if (!count) return erreur("Élément introuvable", 404);
  await recalculer(p.tenantId, p.id);
  return NextResponse.json({ ok: true });
}
