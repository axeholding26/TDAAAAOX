// AI Course Studio : studios, éléments versionnés, file de tâches (TacheIA « studio_* »),
// budget (UsageIA), publication en Formation réelle (modèles du cœur pédagogique).
// Toute fonction reçoit le tenantId de la session : jamais de lecture hors de la boutique.
import type { Prisma, StudioElement } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { quizSchema } from "@/lib/formation/regles";
import { texteParDefaut, type FonctionTexte } from "./fournisseurs";
import {
  briefSchema, genererCurriculum, genererLecon, genererVente, leconEnHtml, venteEnHtml,
  type Brief, type ContenuLecon, type Curriculum, type Vente,
} from "./generation";
import {
  MARQUE_SOURCE, PLAFOND_DEFAUT, controlerReferences, coutTexte, delaiReprise, estimer, jetons, periodeCourante, transition, verifierBudget,
} from "./regles";

export class ErreurStudio extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/** Boutique de la session marchande (null : pas de boutique, donc refus). */
export async function tenantDeSession(): Promise<string | null> {
  const session = await auth();
  return ((session?.user as any)?.tenantId as string | undefined) ?? null;
}

// ─── Budget (UsageIA) ────────────────────────────────────────────────────────

export async function budget(tenantId: string) {
  const [t, usages] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { plafondIAMensuel: true } }),
    prisma.usageIA.findMany({ where: { tenantId, periode: periodeCourante() }, select: { cout: true } }),
  ]);
  const depense = Math.round(usages.reduce((s, u) => s + u.cout, 0) * 100) / 100;
  const plafond = t?.plafondIAMensuel ?? PLAFOND_DEFAUT;
  return { plafond, depense, reste: Math.max(0, Math.round((plafond - depense) * 100) / 100), defaut: t?.plafondIAMensuel == null };
}

export async function controlerBudget(tenantId: string, estime: number) {
  const b = await budget(tenantId);
  return verifierBudget({ depense: b.depense, estime, plafond: b.plafond });
}

/** Journal dans UsageIA (generated_content = studio, ai_call = tuteur). */
export async function journaliser(tenantId: string, type: "generated_content" | "ai_call", cout: number) {
  const periode = periodeCourante();
  await prisma.usageIA.upsert({
    where: { tenantId_periode_type: { tenantId, periode, type } },
    create: { tenantId, periode, type, nombre: 1, cout },
    update: { nombre: { increment: 1 }, cout: { increment: cout } },
  });
}

/** Mesure les jetons réellement échangés pour journaliser le coût réel. */
export function compteur(texte: FonctionTexte) {
  let cout = 0;
  const f: FonctionTexte = async (messages, o) => {
    const r = await texte(messages, o);
    cout += coutTexte(jetons(messages.map((m) => m.content).join("\n")), jetons(r.texte));
    return r;
  };
  return { texte: f, cout: () => Math.round(cout * 100) / 100 };
}

// ─── Studios et éléments ─────────────────────────────────────────────────────

export async function chargerStudio(tenantId: string, id: string) {
  const s = await prisma.studioCours.findFirst({ where: { id, tenantId }, include: { elements: { orderBy: [{ type: "asc" }, { ordre: "asc" }] } } });
  if (!s) throw new ErreurStudio("Studio introuvable", 404);
  return s;
}

const brief = (s: { brief: Prisma.JsonValue }): Brief => briefSchema.parse(s.brief);

export async function creerStudio(tenantId: string, entree: unknown) {
  const b = briefSchema.parse(entree);
  if (b.formationExistanteId) await programmeExistant(tenantId, b.formationExistanteId); // vérifie qu'il est à cette boutique
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { devise: true } });
  return prisma.studioCours.create({ data: { tenantId, titre: b.theme, brief: { ...b, devise: b.devise ?? t?.devise ?? "XAF" } } });
}

/** Texte d'une formation existante de la boutique (programme à améliorer). */
async function programmeExistant(tenantId: string, produitId: string): Promise<string> {
  const f = await prisma.formation.findFirst({
    where: { produitId, produit: { tenantId } },
    select: { produit: { select: { nom: true } }, chapitres: { orderBy: { ordre: "asc" }, select: { titre: true, lecons: { orderBy: { ordre: "asc" }, select: { titre: true, contenu: true } } } } },
  });
  if (!f) throw new ErreurStudio("Formation existante introuvable dans ta boutique", 404);
  return `${f.produit.nom}\n` + f.chapitres.map((c) => `## ${c.titre}\n` + c.lecons.map((l) => `- ${l.titre} : ${(l.contenu ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 300)}`).join("\n")).join("\n");
}

/** Modifie un élément en gardant l'état précédent dans l'historique (réversible). */
async function majElement(el: StudioElement, data: { titre?: string; contenu?: unknown; statut?: string; alertes?: unknown; erreur?: string | null }, origine: "ia" | "marchand" | "restauration") {
  const change = data.contenu !== undefined || (data.titre !== undefined && data.titre !== el.titre);
  if (change) {
    await prisma.studioVersion.create({ data: { elementId: el.id, version: el.version, titre: el.titre, contenu: el.contenu as Prisma.InputJsonValue, origine } });
  }
  return prisma.studioElement.update({
    where: { id: el.id },
    data: {
      ...(data.titre !== undefined && { titre: data.titre }),
      ...(data.contenu !== undefined && { contenu: data.contenu as Prisma.InputJsonValue }),
      ...(data.statut !== undefined && { statut: transition(el.statut, data.statut) }),
      ...(data.alertes !== undefined && { alertes: data.alertes as Prisma.InputJsonValue }),
      ...(data.erreur !== undefined && { erreur: data.erreur }),
      ...(change && { version: el.version + 1 }),
    },
  });
}

async function element(tenantId: string, id: string) {
  const el = await prisma.studioElement.findFirst({ where: { id, tenantId } });
  if (!el) throw new ErreurStudio("Élément introuvable", 404);
  return el;
}

/** Édition manuelle : l'élément repasse en vérification, le contrôle qualité est refait. */
export async function editerElement(tenantId: string, id: string, data: { titre?: string; contenu?: unknown }) {
  const el = await element(tenantId, id);
  if (el.statut === "en_generation" || el.statut === "archive") throw new ErreurStudio("Élément non modifiable dans cet état");
  const s = await prisma.studioCours.findUniqueOrThrow({ where: { id: el.studioId } });
  const contenu = data.contenu ?? el.contenu;
  return majElement(el, {
    ...data,
    alertes: controlerReferences(contenu, brief(s).sources),
    ...(el.statut !== "a_verifier" && el.statut !== "brouillon" && { statut: "a_verifier" }),
  }, "marchand");
}

export async function changerStatut(tenantId: string, id: string, statut: "valide" | "archive" | "brouillon" | "a_verifier", confirmerAlertes = false) {
  const el = await element(tenantId, id);
  if (statut === "valide") {
    if (el.type === "lecon" && !(el.contenu as any)?.script) throw new ErreurStudio("Leçon pas encore rédigée");
    if ((el.alertes as unknown[]).length && !confirmerAlertes) throw new ErreurStudio("Le contrôle qualité signale des points à vérifier : confirme que tu les as vérifiés", 409);
  }
  return majElement(el, { statut }, "marchand");
}

export async function versions(tenantId: string, id: string) {
  await element(tenantId, id);
  return prisma.studioVersion.findMany({ where: { elementId: id }, orderBy: { version: "desc" }, take: 30 });
}

export async function restaurer(tenantId: string, id: string, version: number) {
  const el = await element(tenantId, id);
  const v = await prisma.studioVersion.findUnique({ where: { elementId_version: { elementId: id, version } } });
  if (!v) throw new ErreurStudio("Version introuvable", 404);
  const s = await prisma.studioCours.findUniqueOrThrow({ where: { id: el.studioId } });
  return majElement(el, {
    titre: v.titre, contenu: v.contenu, alertes: controlerReferences(v.contenu, brief(s).sources),
    ...(el.statut !== "a_verifier" && el.statut !== "brouillon" && el.statut !== "en_generation" && { statut: "a_verifier" }),
  }, "restauration");
}

/** Étape 2 : le marchand valide le positionnement et le curriculum (titres modifiables avant). */
export async function validerCurriculum(tenantId: string, studioId: string) {
  const s = await chargerStudio(tenantId, studioId);
  const cibles = s.elements.filter((e) => (e.type === "positionnement" || e.type === "module") && e.statut === "a_verifier");
  if (!cibles.length) throw new ErreurStudio("Aucun curriculum à valider");
  for (const e of cibles) await majElement(e, { statut: "valide" }, "marchand");
  await prisma.studioCours.update({ where: { id: studioId }, data: { etape: 3 } });
}

// ─── Lancement des tâches (coût annoncé avant) ───────────────────────────────

export type TypeTache = "studio_curriculum" | "studio_lecon" | "studio_vente";

/** Cibles d'une demande : le studio, ou les leçons (une leçon, un module entier, ou toutes celles à rédiger). */
async function cibles(tenantId: string, studioId: string, type: TypeTache, elementId?: string) {
  const s = await chargerStudio(tenantId, studioId);
  if (type !== "studio_lecon") return { s, ids: [studioId] };
  const lecons = s.elements.filter((e) => e.type === "lecon" && e.statut !== "archive" && e.statut !== "en_generation");
  if (!elementId) return { s, ids: lecons.filter((e) => e.statut === "brouillon").map((e) => e.id) };
  const el = s.elements.find((e) => e.id === elementId);
  if (!el) throw new ErreurStudio("Élément introuvable", 404);
  if (el.type === "module") return { s, ids: lecons.filter((e) => e.parentId === el.id).map((e) => e.id) };
  if (el.type !== "lecon" || !lecons.includes(el)) throw new ErreurStudio("Cette leçon ne peut pas être régénérée maintenant");
  return { s, ids: [el.id] };
}

export async function estimerTaches(tenantId: string, studioId: string, type: TypeTache, elementId?: string) {
  const { s, ids } = await cibles(tenantId, studioId, type, elementId);
  const coutEstime = ids.length ? estimer(type, ids.length, brief(s).sources.length) : 0;
  return { nombre: ids.length, coutEstime, budget: await controlerBudget(tenantId, coutEstime) };
}

export async function lancerTaches(tenantId: string, studioId: string, type: TypeTache, opts: { elementId?: string; accord: boolean }) {
  if (!opts.accord) throw new ErreurStudio("Accord explicite requis après lecture du coût estimé");
  const { s, ids } = await cibles(tenantId, studioId, type, opts.elementId);
  if (!ids.length) throw new ErreurStudio("Rien à générer");
  if (type === "studio_curriculum" && s.elements.some((e) => e.type === "lecon" && !["brouillon", "archive"].includes(e.statut))) {
    throw new ErreurStudio("Des leçons sont déjà rédigées : régénère-les une par une plutôt que tout le curriculum");
  }
  if (type === "studio_vente" && s.elements.some((e) => e.type === "lecon" && !["valide", "publie", "archive"].includes(e.statut))) {
    throw new ErreurStudio("Valide toutes les leçons avant de rédiger la page de vente");
  }
  const enCours = await prisma.tacheIA.count({ where: { tenantId, type, cible: { in: ids }, statut: { in: ["en_attente", "en_cours"] } } });
  if (enCours) throw new ErreurStudio("Une génération est déjà en cours pour cet élément");
  const unitaire = estimer(type, 1, brief(s).sources.length);
  const b = await controlerBudget(tenantId, unitaire * ids.length);
  if (!b.ok) throw new ErreurStudio(b.message!, 402);

  for (const id of ids) {
    if (type === "studio_lecon") await majElement(await element(tenantId, id), { statut: "en_generation", erreur: null }, "ia");
  }
  await prisma.tacheIA.createMany({ data: ids.map((cible) => ({ tenantId, type, cible, coutEstime: unitaire, etape: "En file d'attente" })) });
  await prisma.studioCours.update({ where: { id: studioId }, data: { statut: "en_generation" } });
  return { nombre: ids.length, coutEstime: Math.round(unitaire * ids.length * 100) / 100 };
}

export async function annulerTaches(tenantId: string, studioId: string) {
  const s = await chargerStudio(tenantId, studioId);
  const ids = [studioId, ...s.elements.map((e) => e.id)];
  const taches = await prisma.tacheIA.findMany({ where: { tenantId, cible: { in: ids }, statut: "en_attente", type: { startsWith: "studio_" } } });
  await prisma.tacheIA.updateMany({ where: { id: { in: taches.map((t) => t.id) } }, data: { statut: "annule", etape: "Annulée" } });
  for (const t of taches) {
    const el = s.elements.find((e) => e.id === t.cible);
    if (el?.statut === "en_generation") await majElement(el, { statut: "brouillon" }, "marchand");
  }
  return taches.length;
}

export async function tachesStudio(tenantId: string, studioId: string) {
  const s = await prisma.studioCours.findFirst({ where: { id: studioId, tenantId }, select: { elements: { select: { id: true } } } });
  if (!s) return [];
  return prisma.tacheIA.findMany({
    where: { tenantId, type: { startsWith: "studio_" }, cible: { in: [studioId, ...s.elements.map((e) => e.id)] } },
    orderBy: { createdAt: "desc" }, take: 60,
    select: { id: true, type: true, cible: true, statut: true, progression: true, etape: true, erreur: true, tentatives: true, maxTentatives: true, coutEstime: true, coutReel: true, prochaineTentative: true, createdAt: true },
  });
}

// ─── Exécution de la file (route déclenchée + cron, compatible Vercel) ──────

const VERROU_PERIME = 5 * 60_000;

/**
 * Traite les tâches dues, une à la fois, tant qu'il reste du temps. Une tâche n'est démarrée que si
 * `demarrerAvant` n'est pas dépassé (une génération peut durer ~40 s ; la route a 60 s).
 */
export async function traiterTaches(o: { tenantId?: string; demarrerAvant: number; max?: number; texte?: FonctionTexte }) {
  const base = { type: { startsWith: "studio_" }, ...(o.tenantId && { tenantId: o.tenantId }) };
  // Verrou périmé (fonction coupée en plein travail) : la tâche redevient due.
  await prisma.tacheIA.updateMany({ where: { ...base, statut: "en_cours", verrouAt: { lt: new Date(Date.now() - VERROU_PERIME) } }, data: { statut: "en_attente", etape: "Reprise après interruption" } });
  const faites: { id: string; statut: string }[] = [];
  while (Date.now() < o.demarrerAvant && faites.length < (o.max ?? 5)) {
    const maintenant = new Date();
    const t = await prisma.tacheIA.findFirst({
      where: { ...base, statut: "en_attente", OR: [{ prochaineTentative: null }, { prochaineTentative: { lte: maintenant } }] },
      orderBy: { createdAt: "asc" },
    });
    if (!t) break;
    const pris = await prisma.tacheIA.updateMany({
      where: { id: t.id, statut: "en_attente" },
      data: { statut: "en_cours", verrouAt: maintenant, tentatives: { increment: 1 }, progression: 10, etape: "Génération en cours" },
    });
    if (!pris.count) continue; // prise par un autre passage
    faites.push({ id: t.id, statut: await executerTache({ ...t, tentatives: t.tentatives + 1 }, o.texte ?? texteParDefaut) });
  }
  return faites;
}

type Tache = { id: string; tenantId: string; type: string; cible: string | null; tentatives: number; maxTentatives: number; coutEstime: number | null };

async function executerTache(t: Tache, texteBrut: FonctionTexte): Promise<string> {
  const b = await controlerBudget(t.tenantId, t.coutEstime ?? 0);
  if (!b.ok) return terminerEnEchec(t, b.message!, true);
  const c = compteur(texteBrut);
  try {
    if (t.type === "studio_curriculum") await executerCurriculum(t.tenantId, t.cible!, c.texte);
    else if (t.type === "studio_lecon") await executerLecon(t.tenantId, t.cible!, c.texte);
    else if (t.type === "studio_vente") await executerVente(t.tenantId, t.cible!, c.texte);
    else throw new Error(`Tâche inconnue : ${t.type}`);
    if (c.cout()) await journaliser(t.tenantId, "generated_content", c.cout());
    await prisma.tacheIA.update({ where: { id: t.id }, data: { statut: "termine", progression: 100, etape: "Terminé", erreur: null, coutReel: c.cout(), verrouAt: null } });
    return "termine";
  } catch (e: any) {
    if (c.cout()) await journaliser(t.tenantId, "generated_content", c.cout()).catch(() => {});
    console.error("[studio]", t.type, e?.message);
    return terminerEnEchec(t, String(e?.message ?? "Erreur").slice(0, 300), e instanceof ErreurStudio);
  }
}

async function terminerEnEchec(t: Tache, erreur: string, definitif: boolean): Promise<string> {
  if (!definitif && t.tentatives < t.maxTentatives) {
    await prisma.tacheIA.update({ where: { id: t.id }, data: { statut: "en_attente", erreur, verrouAt: null, progression: 0, etape: `Nouvel essai prévu (${t.tentatives}/${t.maxTentatives})`, prochaineTentative: new Date(Date.now() + delaiReprise(t.tentatives)) } });
    return "reprise";
  }
  await prisma.tacheIA.update({ where: { id: t.id }, data: { statut: "echec", erreur, verrouAt: null, etape: "Échec" } });
  const el = t.type === "studio_lecon" && t.cible ? await prisma.studioElement.findFirst({ where: { id: t.cible, tenantId: t.tenantId } }) : null;
  if (el?.statut === "en_generation") await majElement(el, { statut: "brouillon", erreur }, "ia");
  return "echec";
}

async function executerCurriculum(tenantId: string, studioId: string, texte: FonctionTexte) {
  const s = await chargerStudio(tenantId, studioId);
  const b = brief(s);
  const programme = b.formationExistanteId ? await programmeExistant(tenantId, b.formationExistanteId) : "";
  const c: Curriculum = await genererCurriculum(b, texte, programme);
  // L'ancien curriculum est archivé (jamais supprimé) : il reste consultable et restaurable.
  await prisma.studioElement.updateMany({ where: { studioId, type: { in: ["positionnement", "module", "lecon"] }, statut: { not: "archive" } }, data: { statut: "archive" } });
  const sources = b.sources;
  await prisma.studioElement.create({ data: { studioId, tenantId, type: "positionnement", titre: c.titre, contenu: c.positionnement, statut: "a_verifier", alertes: controlerReferences(c.positionnement, sources) as any } });
  for (const [i, m] of c.modules.entries()) {
    const mod = await prisma.studioElement.create({ data: { studioId, tenantId, type: "module", ordre: i, titre: m.titre, contenu: { objectif: m.objectif }, statut: "a_verifier" } });
    await prisma.studioElement.createMany({ data: m.lecons.map((l, j) => ({ studioId, tenantId, type: "lecon", parentId: mod.id, ordre: i * 100 + j, titre: l.titre, contenu: { objectif: l.objectif, duree_min: l.duree_min } })) });
  }
  await prisma.studioCours.update({ where: { id: studioId }, data: { titre: c.titre, etape: 2, statut: "brouillon" } });
}

async function executerLecon(tenantId: string, elementId: string, texte: FonctionTexte) {
  const el = await element(tenantId, elementId);
  if (el.statut !== "en_generation") throw new ErreurStudio("Leçon plus en attente de génération (annulée ?)");
  const s = await chargerStudio(tenantId, el.studioId);
  const b = brief(s);
  const modules = s.elements.filter((e) => e.type === "module" && e.statut !== "archive");
  const lecons = s.elements.filter((e) => e.type === "lecon" && e.statut !== "archive");
  const plan = modules.map((m) => `${m.titre} : ${lecons.filter((l) => l.parentId === m.id).map((l) => l.titre).join(" · ")}`);
  const base = el.contenu as { objectif?: string; duree_min?: number };
  const r = await genererLecon(b, {
    titreCours: s.titre, module: modules.find((m) => m.id === el.parentId)?.titre ?? "", titre: el.titre,
    objectif: base.objectif ?? "", duree_min: base.duree_min ?? 15, plan,
  }, texte);
  const { modele, ...contenu } = r;
  await majElement(el, { contenu, statut: "a_verifier", alertes: controlerReferences(contenu, b.sources), erreur: null }, "ia");
}

async function executerVente(tenantId: string, studioId: string, texte: FonctionTexte) {
  const s = await chargerStudio(tenantId, studioId);
  const b = brief(s);
  const modules = s.elements.filter((e) => e.type === "module" && e.statut !== "archive");
  const resume = modules.map((m) => `${m.titre} : ${s.elements.filter((l) => l.type === "lecon" && l.parentId === m.id && l.statut !== "archive").map((l) => l.titre).join(" · ")}`).join("\n");
  const v: Vente = await genererVente(b, `${s.titre}\n${resume}`, texte);
  const ecrire = async (type: string, ordre: number, titre: string, contenu: object) => {
    const ex = s.elements.find((e) => e.type === type && e.ordre === ordre && e.statut !== "archive");
    const alertes = controlerReferences(contenu, b.sources);
    if (ex) return majElement(ex, { titre, contenu, alertes, ...(ex.statut !== "a_verifier" && { statut: "a_verifier" }) }, "ia");
    return prisma.studioElement.create({ data: { studioId, tenantId, type, ordre, titre, contenu: contenu as any, statut: "a_verifier", alertes: alertes as any } });
  };
  await ecrire("page_vente", 0, v.page.titre, v.page);
  for (const [i, e] of v.emails.entries()) await ecrire("email", i, e.objet, e);
}

// ─── Publication en formation réelle ────────────────────────────────────────

const slugifier = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "formation";

/**
 * Crée (ou met à jour) le produit « formation » de la boutique : chapitres, leçons, quiz corrigés côté
 * serveur (QuizLecon). Le produit reste INACTIF : le marchand le met en vente lui-même. Seul le produit
 * créé par CE studio est touché.
 */
export async function publier(tenantId: string, studioId: string) {
  const s = await chargerStudio(tenantId, studioId);
  const b = brief(s);
  const actifs = s.elements.filter((e) => e.statut !== "archive");
  const modules = actifs.filter((e) => e.type === "module").sort((a, z) => a.ordre - z.ordre);
  const lecons = actifs.filter((e) => e.type === "lecon").sort((a, z) => a.ordre - z.ordre);
  const pasPretes = [...modules, ...lecons].filter((e) => e.statut !== "valide" && e.statut !== "publie");
  if (!lecons.length) throw new ErreurStudio("Aucune leçon à publier");
  if (pasPretes.length) throw new ErreurStudio(`À valider avant publication : ${pasPretes.slice(0, 5).map((e) => e.titre).join(", ")}${pasPretes.length > 5 ? "…" : ""}`);
  // Le marqueur laissé par l'IA ne doit jamais atteindre un apprenant.
  const aSourcer = [...modules, ...lecons].filter((e) => JSON.stringify(e.contenu).includes(MARQUE_SOURCE));
  if (aSourcer.length) throw new ErreurStudio(`Remplace ${MARQUE_SOURCE} par ta source (ou retire la phrase) dans : ${aSourcer.slice(0, 5).map((e) => e.titre).join(", ")}`);
  const vente = actifs.find((e) => e.type === "page_vente" && (e.statut === "valide" || e.statut === "publie"));
  const page = vente?.contenu as Vente["page"] | undefined;
  const pos = actifs.find((e) => e.type === "positionnement")?.contenu as Curriculum["positionnement"] | undefined;
  const archives = s.elements.filter((e) => e.statut === "archive" && e.publieId);

  const produitId = await prisma.$transaction(async (tx) => {
    let produit = s.produitId ? await tx.produit.findFirst({ where: { id: s.produitId, tenantId }, select: { id: true } }) : null;
    const infos = {
      description: page ? venteEnHtml(page) : pos?.promesse ?? null,
      ...(page && { metaTitle: page.meta_title || null, metaDesc: page.meta_desc || null, faq: page.faq }),
    };
    if (!produit) {
      let slug = slugifier(s.titre);
      if (await tx.produit.findUnique({ where: { tenantId_slug: { tenantId, slug } } })) slug = `${slug}-${Date.now().toString(36)}`;
      produit = await tx.produit.create({
        data: { tenantId, nom: s.titre, slug, prix: b.prix ?? 0, stock: 99999, type: "formation", actif: false, images: [], tags: [], ...infos },
        select: { id: true },
      });
    } else await tx.produit.update({ where: { id: produit.id }, data: infos });

    const dureeMin = lecons.reduce((t, l) => t + ((l.contenu as any)?.duree_min ?? 0), 0);
    const formation = await tx.formation.upsert({
      where: { produitId: produit.id },
      create: { produitId: produit.id, niveau: b.niveau, langue: b.langue.slice(0, 2).toLowerCase(), dureeMin },
      update: { niveau: b.niveau, dureeMin },
    });

    for (const [i, m] of modules.entries()) {
      const ch = m.publieId ? await tx.chapitre.findFirst({ where: { id: m.publieId, formationId: formation.id } }) : null;
      const chapitre = ch
        ? await tx.chapitre.update({ where: { id: ch.id }, data: { titre: m.titre, ordre: i, statut: "publie", actif: true } })
        : await tx.chapitre.create({ data: { formationId: formation.id, titre: m.titre, ordre: i } });
      await tx.studioElement.update({ where: { id: m.id }, data: { publieId: chapitre.id, statut: "publie" } });

      for (const [j, l] of lecons.filter((x) => x.parentId === m.id).entries()) {
        const c = l.contenu as unknown as ContenuLecon;
        const data = { chapitreId: chapitre.id, titre: l.titre, type: "texte", contenu: leconEnHtml(c), duree: (c.duree_min ?? 15) * 60, ordre: j * 2, statut: "publie", actif: true };
        const ex = l.publieId ? await tx.lecon.findFirst({ where: { id: l.publieId, chapitre: { formationId: formation.id } } }) : null;
        const lecon = ex ? await tx.lecon.update({ where: { id: ex.id }, data }) : await tx.lecon.create({ data });
        await tx.studioElement.update({ where: { id: l.id }, data: { publieId: lecon.id, statut: "publie" } });

        // Quiz : leçon « quiz » juste après, débloquée par la leçon, corrigée côté serveur.
        const quizLecon = await tx.lecon.findFirst({ where: { chapitreId: chapitre.id, type: "quiz", prerequis: { has: lecon.id } } });
        const q = quizSchema.safeParse({ questions: c.quiz ?? [] });
        if (q.success) {
          const ql = quizLecon
            ? await tx.lecon.update({ where: { id: quizLecon.id }, data: { titre: `Quiz — ${l.titre}`, ordre: j * 2 + 1, statut: "publie", actif: true } })
            : await tx.lecon.create({ data: { chapitreId: chapitre.id, titre: `Quiz — ${l.titre}`, type: "quiz", contenu: "<p>Vérifie ce que tu as retenu.</p>", ordre: j * 2 + 1, prerequis: [lecon.id] } });
          await tx.quizLecon.upsert({ where: { leconId: ql.id }, create: { leconId: ql.id, questions: q.data.questions as any, noteMin: q.data.noteMin }, update: { questions: q.data.questions as any } });
        } else if (quizLecon) await tx.lecon.update({ where: { id: quizLecon.id }, data: { statut: "archive" } });
      }
    }
    // Éléments archivés dans le studio : leur chapitre/leçon publié passe en archive (jamais supprimé : progression des apprenants).
    for (const a of archives) {
      if (a.type === "module") await tx.chapitre.updateMany({ where: { id: a.publieId!, formationId: formation.id }, data: { statut: "archive" } });
      if (a.type === "lecon") await tx.lecon.updateMany({ where: { id: a.publieId!, chapitre: { formationId: formation.id } }, data: { statut: "archive" } });
    }
    for (const e of actifs.filter((e) => (e.type === "positionnement" || e.type === "page_vente") && e.statut === "valide")) {
      await tx.studioElement.update({ where: { id: e.id }, data: { statut: "publie" } });
    }
    await tx.studioCours.update({ where: { id: studioId }, data: { produitId: produit.id, statut: "publie", etape: 6 } });
    return produit.id;
  }, { timeout: 30_000 });
  return { produitId };
}

export async function archiverStudio(tenantId: string, studioId: string) {
  await chargerStudio(tenantId, studioId);
  await annulerTaches(tenantId, studioId);
  await prisma.studioCours.update({ where: { id: studioId }, data: { statut: "archive" } });
}
