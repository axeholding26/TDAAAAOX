// AXSO BUILDER — moteur de boutique. La vitrine en ligne reste Tenant.themeConfig ; une IA
// ne modifie que le BROUILLON (BrouillonBoutique), par opérations pures appliquées en une
// transaction logique. Publier = copier le brouillon en ligne et créer une version ;
// restaurer = revenir à une version. Seul point d'écriture des configurations du Builder.
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import type { ThemeConfig } from "@/lib/theme-config";
import { comparer, resumer, type Changement } from "./diff";
import { ErreurBuilder, type DonneesBoutique, type EtapeOperation, type OperationBuilder } from "./types";
import { validerConfig } from "./validation";

const GARDER_VERSIONS = 60;
const TAILLE_MAX = 3_000_000; // caractères de JSON : au-delà, la config ne passe plus raisonnablement en base

export const empreinte = (cfg: unknown) => createHash("sha256").update(JSON.stringify(cfg ?? {})).digest("hex");
const copie = <T,>(v: T): T => JSON.parse(JSON.stringify(v ?? {}));

export interface Auteur { userId: string; connexionId?: string; client?: string; fournisseur?: string }

export async function donneesBoutique(tenantId: string): Promise<DonneesBoutique> {
  const [t, collections, produits] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true, nomBoutique: true, devise: true, whatsapp: true, whatsappNumero: true } }),
    prisma.collection.findMany({ where: { tenantId, actif: true }, select: { slug: true, nom: true }, take: 100 }),
    prisma.produit.findMany({ where: { tenantId }, select: { id: true, nom: true }, orderBy: { ventes: "desc" }, take: 200 }),
  ]);
  if (!t) throw new ErreurBuilder("NOT_FOUND", "Boutique introuvable.");
  return { slug: t.slug, nom: t.nomBoutique, devise: t.devise, whatsapp: t.whatsappNumero || t.whatsapp || "", collections, produits };
}

/** Brouillon en cours, ou copie de la version en ligne s'il n'y en a pas. */
export async function lireBrouillon(tenantId: string) {
  const [t, b] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { themeConfig: true, statut: true } }),
    prisma.brouillonBoutique.findUnique({ where: { tenantId } }),
  ]);
  if (!t) throw new ErreurBuilder("NOT_FOUND", "Boutique introuvable.");
  const enLigne = (t.themeConfig ?? {}) as Record<string, any>;
  const empreinteEnLigne = empreinte(enLigne);
  return {
    config: (b ? b.config : copie(enLigne)) as unknown as ThemeConfig,
    enLigne: enLigne as unknown as ThemeConfig,
    existe: !!b,
    majLe: b?.updatedAt ?? null,
    // Le marchand a modifié la boutique en ligne (Constructeur) depuis le début du brouillon.
    enLigneAChange: !!b && b.baseEmpreinte !== empreinteEnLigne,
    empreinteEnLigne,
    statutBoutique: t.statut,
  };
}

/**
 * Applique des opérations au brouillon, dans l'ordre, sur une copie : si l'une échoue ou si
 * le résultat est invalide, RIEN n'est enregistré (transaction logique). Écriture protégée
 * contre une modification concurrente du brouillon (verrou optimiste sur updatedAt).
 */
export async function appliquerOperations(
  tenantId: string, etapes: EtapeOperation[], operations: Map<string, OperationBuilder>, auteur: Auteur,
) {
  if (!etapes.length) throw new ErreurBuilder("INVALID_INPUT", "Aucune opération à appliquer.");
  const b = await lireBrouillon(tenantId);
  const donnees = await donneesBoutique(tenantId);
  let cfg = copie(b.config);
  etapes.forEach((e, i) => {
    const op = operations.get(e.op);
    if (!op) throw new ErreurBuilder("INVALID_INPUT", `Étape ${i + 1} : opération inconnue « ${e.op} ». Rien n'a été modifié.`);
    try {
      cfg = op.appliquer(copie(cfg), e.args ?? {}, donnees);
    } catch (err) {
      const message = err instanceof ErreurBuilder ? err.message : "erreur inattendue";
      throw new ErreurBuilder(err instanceof ErreurBuilder ? err.code : "VALIDATION_FAILED", `Étape ${i + 1} (${e.op}) : ${message} Rien n'a été modifié (annulation de toute la transaction).`);
    }
  });
  const problemes = validerConfig(cfg, b.config);
  if (problemes.length) throw new ErreurBuilder("VALIDATION_FAILED", `Résultat refusé, rien n'a été modifié : ${problemes.slice(0, 5).join(" ; ")}`);
  if (JSON.stringify(cfg).length > TAILLE_MAX) throw new ErreurBuilder("VALIDATION_FAILED", "La boutique deviendrait trop lourde ; rien n'a été modifié.");

  const etapeDiff = comparer(b.config, cfg);
  if (b.existe) {
    const r = await prisma.brouillonBoutique.updateMany({ where: { tenantId, updatedAt: b.majLe! }, data: { config: cfg as any, majPar: auteur.connexionId ?? auteur.userId } });
    if (!r.count) throw new ErreurBuilder("CONFLICT", "Le brouillon a été modifié en même temps par quelqu'un d'autre. Relis-le et recommence ; rien n'a été modifié.");
  } else {
    await prisma.brouillonBoutique.create({ data: { tenantId, config: cfg as any, baseEmpreinte: b.empreinteEnLigne, majPar: auteur.connexionId ?? auteur.userId } })
      .catch(() => { throw new ErreurBuilder("CONFLICT", "Un brouillon vient d'être créé en même temps. Recommence ; rien n'a été modifié."); });
  }
  return { config: cfg, changements: etapeDiff, depuisEnLigne: comparer(b.enLigne, cfg) };
}

async function prochainNumero(tenantId: string, tx: typeof prisma = prisma) {
  const d = await tx.versionBoutique.findFirst({ where: { tenantId }, orderBy: { numero: "desc" }, select: { numero: true } });
  return (d?.numero ?? 0) + 1;
}

async function purger(tenantId: string) {
  const vieilles = await prisma.versionBoutique.findMany({ where: { tenantId }, orderBy: { numero: "desc" }, skip: GARDER_VERSIONS, select: { id: true } });
  if (vieilles.length) await prisma.versionBoutique.deleteMany({ where: { id: { in: vieilles.map((v) => v.id) } } });
}

const metaVersion = (a: Auteur) => ({ auteur: a.userId, client: a.client, fournisseur: a.fournisseur, connexionId: a.connexionId });

/** Instantané de la version en ligne (ou du brouillon) : point de retour nommé. */
export async function creerInstantane(tenantId: string, raison: string, auteur: Auteur, source: "publie" | "brouillon" = "publie") {
  const b = await lireBrouillon(tenantId);
  const config = source === "brouillon" ? b.config : b.enLigne;
  const v = await prisma.versionBoutique.create({
    data: { tenantId, numero: await prochainNumero(tenantId), type: "instantane", config: config as any, raison: raison.slice(0, 500), ...metaVersion(auteur) },
  });
  await purger(tenantId);
  return v;
}

/**
 * Publie le brouillon : la version d'avant est gardée (retour possible), puis le brouillon
 * passe en ligne. Refusé si le marchand a modifié la boutique en ligne entre-temps, sauf `forcer`.
 */
export async function publierBrouillon(tenantId: string, raison: string, auteur: Auteur, forcer = false) {
  const b = await lireBrouillon(tenantId);
  if (!b.existe) throw new ErreurBuilder("NOT_FOUND", "Aucun brouillon à publier : la boutique en ligne est déjà à jour.");
  if (b.enLigneAChange && !forcer) {
    throw new ErreurBuilder("CONFLICT", "La boutique en ligne a été modifiée (par le marchand) depuis le début de ce brouillon : publier écraserait ces changements. Compare les versions, puis publie avec force: true seulement si le marchand l'accepte.");
  }
  const changements = comparer(b.enLigne, b.config);
  const version = await prisma.$transaction(async (tx) => {
    // L'état en ligne juste avant devient une version s'il n'en est pas déjà une (première
    // publication, ou retouches du marchand depuis) : le retour en arrière est toujours exact.
    const derniere = await tx.versionBoutique.findFirst({ where: { tenantId }, orderBy: { numero: "desc" }, select: { config: true } });
    if (!derniere || empreinte(derniere.config) !== b.empreinteEnLigne) {
      await tx.versionBoutique.create({ data: { tenantId, numero: await prochainNumero(tenantId, tx as any), type: "instantane", config: b.enLigne as any, raison: "État en ligne avant publication", auteur: auteur.userId } });
    }
    const v = await tx.versionBoutique.create({
      data: { tenantId, numero: await prochainNumero(tenantId, tx as any), type: "publication", config: b.config as any, raison: raison.slice(0, 500), changements: changements as any, ...metaVersion(auteur) },
    });
    await tx.tenant.update({ where: { id: tenantId }, data: { themeConfig: b.config as any } });
    await tx.brouillonBoutique.delete({ where: { tenantId } });
    return v;
  });
  await purger(tenantId);
  return { version, changements, resume: resumer(changements), statutBoutique: b.statutBoutique };
}

/** Remet une version : dans le brouillon (à vérifier puis publier) ou directement en ligne. */
export async function restaurerVersion(tenantId: string, numero: number, cible: "brouillon" | "publie", auteur: Auteur) {
  const v = await prisma.versionBoutique.findUnique({ where: { tenantId_numero: { tenantId, numero } } });
  if (!v) throw new ErreurBuilder("NOT_FOUND", `Version ${numero} introuvable.`);
  const b = await lireBrouillon(tenantId);
  if (cible === "brouillon") {
    await prisma.brouillonBoutique.upsert({
      where: { tenantId }, create: { tenantId, config: v.config as any, baseEmpreinte: b.empreinteEnLigne, majPar: auteur.connexionId ?? auteur.userId },
      update: { config: v.config as any, majPar: auteur.connexionId ?? auteur.userId },
    });
    return { changements: comparer(b.enLigne, v.config as Record<string, any>), version: v };
  }
  const changements = comparer(b.enLigne, v.config as Record<string, any>);
  await prisma.$transaction(async (tx) => {
    await tx.versionBoutique.create({ data: { tenantId, numero: await prochainNumero(tenantId, tx as any), type: "avant_restauration", config: b.enLigne as any, raison: `Avant le retour à la version ${numero}`, ...metaVersion(auteur) } });
    await tx.tenant.update({ where: { id: tenantId }, data: { themeConfig: v.config as any } });
    await tx.brouillonBoutique.deleteMany({ where: { tenantId } });
  });
  await purger(tenantId);
  return { changements, version: v };
}

export async function abandonnerBrouillon(tenantId: string) {
  return (await prisma.brouillonBoutique.deleteMany({ where: { tenantId } })).count > 0;
}

/** Config d'une référence : numéro de version, « brouillon » ou « publie ». */
export async function configDe(tenantId: string, ref: string | number): Promise<Record<string, any>> {
  if (ref === "brouillon" || ref === "publie") {
    const b = await lireBrouillon(tenantId);
    return (ref === "brouillon" ? b.config : b.enLigne) as unknown as Record<string, any>;
  }
  // « v2 », « dernière »… : pas un numéro de version — introuvable, sans requête invalide en base.
  const numero = Number(ref);
  if (!Number.isInteger(numero)) throw new ErreurBuilder("NOT_FOUND", `Version « ${ref} » introuvable : donne un numéro de version, « brouillon » ou « publie ».`);
  const v = await prisma.versionBoutique.findUnique({ where: { tenantId_numero: { tenantId, numero } }, select: { config: true } });
  if (!v) throw new ErreurBuilder("NOT_FOUND", `Version ${ref} introuvable.`);
  return v.config as Record<string, any>;
}

export async function comparerVersions(tenantId: string, a: string | number, b: string | number): Promise<{ changements: Changement[]; resume: string }> {
  const changements = comparer(await configDe(tenantId, a), await configDe(tenantId, b));
  return { changements, resume: resumer(changements) };
}

/**
 * « Annule ce que l'IA vient de faire » : remet en ligne l'état d'avant la dernière
 * publication de cette connexion (la version qui la précède).
 */
export async function annulerDernierePublication(tenantId: string, connexionId: string, auteur: Auteur) {
  const pub = await prisma.versionBoutique.findFirst({ where: { tenantId, connexionId, type: "publication" }, orderBy: { numero: "desc" } });
  if (!pub) throw new ErreurBuilder("NOT_FOUND", "Cette IA n'a encore rien publié sur cette boutique.");
  const avant = await prisma.versionBoutique.findFirst({ where: { tenantId, numero: { lt: pub.numero } }, orderBy: { numero: "desc" } });
  if (!avant) throw new ErreurBuilder("NOT_FOUND", "Aucune version antérieure à cette publication.");
  const r = await restaurerVersion(tenantId, avant.numero, "publie", auteur);
  return { ...r, publication: pub, retourA: avant };
}
