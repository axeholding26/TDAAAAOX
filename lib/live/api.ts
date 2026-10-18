// Préambule commun des routes marchandes Live / Bootcamp (module « produits », contrôlé par proxy.ts).
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "../auth";
import { prisma } from "../prisma";
import { slugify } from "../utils";
import { FOURNISSEURS, lienValide, nouvelleSalleJitsi, type CleFournisseur } from "./visio";
import { dateDansFuseau, FUSEAU_DEFAUT } from "./regles";

export async function tenantOuRefus(): Promise<{ tenantId: string; userId: string } | NextResponse> {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId as string | undefined;
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  return { tenantId, userId: (session?.user as any)?.id ?? "" };
}

const fuseauValide = (f: string) => { try { new Intl.DateTimeFormat("fr", { timeZone: f }); return true; } catch { return false; } };
export const zFuseau = z.string().max(60).refine(fuseauValide, "Fuseau horaire inconnu").default(FUSEAU_DEFAUT);
export const zDateLocale = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "Date invalide");
export const zLien = z.string().trim().max(1000).refine((u) => lienValide(u), "Adresse https requise");

export const zSeance = z.object({
  type: z.enum(["webinaire", "masterclass", "atelier", "qr", "classe", "session"]).default("webinaire"),
  titre: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000).optional().nullable(),
  intervenants: z.array(z.object({ nom: z.string().trim().min(1).max(80), role: z.string().trim().max(80).optional() })).max(10).default([]),
  debut: zDateLocale,
  fuseau: zFuseau,
  dureeMin: z.number().int().min(10).max(600).default(60),
  recurrence: z.object({ frequence: z.enum(["quotidienne", "hebdomadaire"]), occurrences: z.number().int().min(1).max(52) }).nullable().optional(),
  fournisseur: z.enum(Object.keys(FOURNISSEURS) as [CleFournisseur, ...CleFournisseur[]]).default("lien_externe"),
  lienSalle: zLien.optional().nullable().or(z.literal("")),
  ouvertureMin: z.number().int().min(0).max(240).default(15),
  rappels: z.array(z.number().int().min(5).max(20_160)).max(5).default([1440, 60]),
});
export type Seance = z.infer<typeof zSeance>;

/** Champs Prisma d'une séance validée ; erreur lisible si le fournisseur n'est pas utilisable. */
export function donneesSeance(s: Partial<Seance>, existant?: { fournisseur: string; salleId: string | null }): { data: Record<string, unknown> } | { erreur: string } {
  const data: Record<string, unknown> = {};
  for (const k of ["type", "titre", "description", "intervenants", "dureeMin", "fuseau", "ouvertureMin", "rappels"] as const) if (s[k] !== undefined) data[k] = s[k];
  if (s.recurrence !== undefined) data.recurrence = s.recurrence ?? null;
  if (s.debut) data.debut = dateDansFuseau(s.debut, s.fuseau ?? FUSEAU_DEFAUT);
  if (s.lienSalle !== undefined) data.lienSalle = s.lienSalle || null;
  const fournisseur = s.fournisseur ?? existant?.fournisseur;
  if (fournisseur) {
    const f = FOURNISSEURS[fournisseur as CleFournisseur];
    if (!f.configure()) return { erreur: `${f.nom} n'est pas configuré (${f.env.join(", ")})` };
    data.fournisseur = fournisseur;
    if (fournisseur === "jitsi" && !existant?.salleId) data.salleId = nouvelleSalleJitsi();
  }
  if (s.rappels) data.rappels = [...new Set(s.rappels)];
  return { data };
}

/** Produit vendable (type evenement | bootcamp), dans le catalogue existant : prix vendeur, commission ajoutée au paiement en ligne. */
export async function creerProduitLive(tenantId: string, p: { nom: string; description?: string | null; prix: number; image?: string | null; type: "evenement" | "bootcamp"; actif: boolean }) {
  let slug = slugify(p.nom) || "live";
  if (await prisma.produit.findUnique({ where: { tenantId_slug: { tenantId, slug } } })) slug = `${slug}-${Date.now().toString(36)}`;
  return prisma.produit.create({
    data: { tenantId, nom: p.nom, slug, description: p.description || null, prix: p.prix, stock: 99999, images: p.image ? [p.image] : [], type: p.type, actif: p.actif, categorie: p.type === "bootcamp" ? "Bootcamp" : "Événement" },
  });
}
