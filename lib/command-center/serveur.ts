// Point d'entrée serveur du Command Center : autorisation (RBAC), contexte de
// filtres, jeu de données (cache 60 s), réglages et journal d'audit.
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { getAdminSessionPour, type AdminSession } from "@/lib/admin-auth";
import type { Section } from "./rbac";
import type { Dataset, Source } from "./types";
import { genererDemo } from "./demo";
import { chargerReel } from "./reel";
import { lireFiltres, fenetres, type Filtres, type Fenetres } from "./contexte";
import { Vue } from "./moteur";
import { REGLAGES_DEFAUT, SCHEMAS, type CleReglage, type Reglages } from "./reglages";
import { statsMarchands, radarChurn, radarExpansion, impactFonctions, alertes, variations, priorites } from "./insights";
import type { T } from "@/lib/i18n";

const TTL = 60_000;
let reel: { ds: Dataset; a: number } | null = null;
let enCours: Promise<Dataset> | null = null;

export interface Chargement { ds: Dataset; erreur: string | null; derniereReussite: number | null }

/** Données réelles mises en cache 60 s (une seule lecture simultanée). En cas d'échec, on sert la dernière version connue en le signalant. */
export async function chargerDataset(source: Source): Promise<Chargement> {
  if (source === "demo") return { ds: genererDemo(), erreur: null, derniereReussite: null };
  if (reel && Date.now() - reel.a < TTL) return { ds: reel.ds, erreur: null, derniereReussite: reel.a };
  try {
    enCours ??= chargerReel().finally(() => { enCours = null; });
    const ds = await enCours;
    reel = { ds, a: Date.now() };
    return { ds, erreur: null, derniereReussite: reel.a };
  } catch (e) {
    console.error("[command-center] chargement des données réelles", e);
    if (reel) return { ds: reel.ds, erreur: "Les données n'ont pas pu être actualisées : affichage de la dernière version disponible.", derniereReussite: reel.a };
    throw new Error("Les données Axso n'ont pas pu être chargées.");
  }
}

export const lireReglages = cache(async (): Promise<Reglages> => {
  const lignes = await prisma.reglageAdmin.findMany().catch(() => []);
  const r = { ...REGLAGES_DEFAUT } as Record<string, unknown>;
  for (const l of lignes) {
    const schema = SCHEMAS[l.cle as CleReglage];
    const ok = schema?.safeParse(l.valeur);
    if (ok?.success) r[l.cle] = ok.data;
  }
  return r as Reglages;
});

async function ip() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

export async function journaliser(s: AdminSession, action: string, entite: string, entiteId: string | null, avant: unknown, apres: unknown) {
  await prisma.auditAdmin.create({
    data: { adminId: s.userId, adminEmail: s.email, action, entite, entiteId, avant: avant === undefined ? undefined : JSON.parse(JSON.stringify(avant ?? null)), apres: apres === undefined ? undefined : JSON.parse(JSON.stringify(apres ?? null)), ip: await ip() },
  }).catch((e) => console.error("[audit] écriture impossible", e));
}

/** Valide puis enregistre un réglage, avec trace d'audit (avant / après). */
export async function ecrireReglage<K extends CleReglage>(s: AdminSession, cle: K, valeur: unknown): Promise<Reglages[K]> {
  const v = SCHEMAS[cle].parse(valeur) as Reglages[K];
  const avant = (await prisma.reglageAdmin.findUnique({ where: { cle } }))?.valeur ?? REGLAGES_DEFAUT[cle];
  await prisma.reglageAdmin.upsert({ where: { cle }, create: { cle, valeur: v as object, majPar: s.email }, update: { valeur: v as object, majPar: s.email } });
  await journaliser(s, `reglage.${cle}`, "ReglageAdmin", cle, avant, v);
  return v;
}

/** Données de démo : toujours en local ; en production seulement si CC_DEMO=1 (aucune donnée fictive en prod par défaut). */
export const demoAutorisee = () => process.env.NODE_ENV !== "production" || process.env.CC_DEMO === "1";

export interface ContexteCC {
  session: AdminSession; filtres: Filtres; fen: Fenetres; vue: Vue; reglages: Reglages;
  ds: Dataset; erreur: string | null; derniereReussite: number | null;
}

type SP = Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;

/** À appeler en tête de chaque page du Command Center : refuse l'accès hors rôle. */
export async function contexteCC(section: Section, searchParams: SP): Promise<ContexteCC> {
  const session = await getAdminSessionPour(section);
  if (!session) redirect("/admin?refus=1");
  const filtres = lireFiltres(await searchParams);
  if (!demoAutorisee()) filtres.source = "reel";
  const [{ ds, erreur, derniereReussite }, reglages] = await Promise.all([chargerDataset(filtres.source), lireReglages()]);
  const vue = new Vue(ds, filtres);
  vue.etapeActivation = reglages.activation;
  return { session, filtres, fen: fenetres(filtres, ds.genereA), vue, reglages, ds, erreur, derniereReussite };
}

/** Analyses lourdes partagées par plusieurs blocs d'une même page. */
/** `t` : langue des textes produits (titres d'alertes, causes, priorités) ; français par défaut. */
export function analyser(c: ContexteCC, t?: T) {
  const stats = statsMarchands(c.vue);
  const churn = radarChurn(c.vue, stats, c.reglages.poids_sante, t);
  const expansion = radarExpansion(c.vue, stats, t);
  const fonctions = impactFonctions(c.vue, c.fen);
  const al = alertes(c.vue, c.fen, c.reglages, churn, expansion, fonctions, t);
  const vars = variations(c.vue, c.fen, undefined, t);
  return { stats, churn, expansion, fonctions, alertes: al, variations: vars, priorites: priorites(al, churn, expansion, vars, t).filter((p) => !c.reglages.ignores.includes(p.id)) };
}

const limiteCC = rateLimit({ windowMs: 60_000, max: 120, keyPrefix: "command-center" });

/** Contexte d'une route API : session autorisée pour la section + limite de débit (par admin). Renvoie une réponse d'erreur sinon. */
export async function contexteApi(section: Section, req: NextRequest): Promise<ContexteCC | NextResponse> {
  const session = await getAdminSessionPour(section);
  if (!session) return NextResponse.json({ erreur: "Accès refusé" }, { status: 403 });
  const l = limiteCC.check(session.userId);
  if (!l.success) return rateLimitResponse(l.reset);
  const filtres = lireFiltres(req.nextUrl.searchParams);
  if (!demoAutorisee()) filtres.source = "reel";
  try {
    const [{ ds, erreur, derniereReussite }, reglages] = await Promise.all([chargerDataset(filtres.source), lireReglages()]);
    const vue = new Vue(ds, filtres);
    vue.etapeActivation = reglages.activation;
    return { session, filtres, fen: fenetres(filtres, ds.genereA), vue, reglages, ds, erreur, derniereReussite };
  } catch (e) {
    return NextResponse.json({ erreur: (e as Error).message }, { status: 503 });
  }
}
