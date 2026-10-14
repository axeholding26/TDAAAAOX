// Module « automatisation » : l'IA crée et pilote des automatisations (QUAND un événement ou
// une heure, SI des conditions, ALORS des outils) et abonne des services externes aux
// événements de la boutique (webhooks). Le moteur est dans lib/controle-ia/automatisations.ts,
// le bus et la livraison des webhooks dans lib/controle-ia/evenements.ts.
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { INCONNU, type CtxOutil, type ModuleIA, type OutilIA, type ResultatIA } from "../types";
import { decider, estOrchestration, type Risque } from "../regles";
import { TYPES_EVENEMENT, WEBHOOKS_MAX, estTypeEvenement, refusUrlWebhook } from "../evenements";
import {
  JOURS, OPERATEURS, PLAFONDS, SCOPE_AUTOMATISATION, conditionsVraies, decrireDeclencheur, prochaineExecution, validerDefinition,
  type Condition, type Declencheur, type Etape, type NatureOutil,
} from "../automatisations";

const COMMUN = { module: "marketing", scope: SCOPE_AUTOMATISATION, tier: "palier2", capacite: "automatisation" } as const;
const LECTURE = { ...COMMUN, niveau: "lecture" } as const;
const ECRITURE = { ...COMMUN, niveau: "ecriture" } as const;

const CONDITIONS = {
  type: "array", description: `Comparaisons toutes vraies (au plus ${PLAFONDS.conditions}). « champ » : chemin dans l'événement (« stock ») ou dans le résultat d'une étape (« etapes.1.donnees.total », étapes numérotées à partir de 0).`,
  items: { type: "object", properties: { champ: { type: "string" }, op: { type: "string", enum: [...OPERATEURS] }, valeur: { description: "Nombre, texte ou « {{chemin}} »" } }, required: ["champ", "op"] },
};
const DEFINITION = {
  nom: { type: "string", description: "Nom court, lisible par le marchand" },
  declencheur: {
    type: "object", description: "QUAND. Événement de la boutique : { type: \"evenement\", evenement }. Horaire : { type: \"horaire\", frequence: \"jour\" | \"semaine\", heure: \"HH:MM\", jour (si semaine), fuseau (facultatif : celui de la boutique) }.",
    properties: { type: { type: "string", enum: ["evenement", "horaire"] }, evenement: { type: "string", enum: [...TYPES_EVENEMENT] }, frequence: { type: "string", enum: ["jour", "semaine"] }, heure: { type: "string" }, jour: { type: "string", enum: JOURS }, fuseau: { type: "string" } },
    required: ["type"],
  },
  conditions: { ...CONDITIONS, description: `SI (facultatif). ${CONDITIONS.description}` },
  etapes: {
    type: "array", description: `ALORS : de 1 à ${PLAFONDS.etapes} étapes, dans l'ordre. { type: "outil", outil, args, essais? } appelle un outil de ta liste (pas un outil d'automatisation ni d'objectif), avec tes droits et les mêmes règles d'accord que toi ; « essais » (2 ou 3) retente après une panne. { type: "accord", outil, args } fait la même chose mais attend TOUJOURS l'accord du marchand. { type: "attente", minutes }. { type: "branche", conditions, sinon } continue si les conditions sont vraies, sinon saute à l'étape numéro « sinon » (plus loin) ou s'arrête ("arreter"). Dans « args », « {{stock}} » ou « {{etapes.0.donnees.x}} » reprend une donnée de l'événement ou d'une étape précédente.`,
    items: { type: "object", properties: { type: { type: "string", enum: ["outil", "accord", "attente", "branche"] }, outil: { type: "string" }, args: { type: "object" }, essais: { type: "integer" }, minutes: { type: "integer" }, conditions: CONDITIONS, sinon: {} }, required: ["type"] },
  },
};
const ID = { id: { type: "string", description: "Identifiant de l'automatisation (donné par list_automations)" } };

const OUTILS: OutilIA[] = [
  {
    name: "create_automation", ...ECRITURE, risque: "moyen",
    description: "Crée une automatisation qui agira ensuite SEULE, avec tes droits : « QUAND le stock passe sous le seuil ALORS chercher des fournisseurs, comparer, préparer un bon de commande et demander l'accord », « CHAQUE LUNDI 08:00 analyser l'activité et envoyer le rapport ». À utiliser quand le marchand veut qu'une chose se fasse à chaque fois, sans te le redemander. Vérifie-la ensuite avec run_automation.",
    parameters: { type: "object", properties: DEFINITION, required: ["nom", "declencheur", "etapes"] },
    sortie: "Identifiant, prochaine exécution si elle est horaire.",
    exemple: { nom: "Rapport du lundi", declencheur: { type: "horaire", frequence: "semaine", jour: "lundi", heure: "08:00" }, etapes: [{ type: "outil", outil: "stats_globales", args: { periode: "7j" } }, { type: "outil", outil: "rapport_complet", args: {}, essais: 2 }] },
  },
  {
    name: "list_automations", ...LECTURE,
    description: "Liste les automatisations de la boutique (état, déclencheur, dernier résultat). Avec « id » : la définition complète et le journal des dernières exécutions, pour comprendre pourquoi l'une d'elles n'a pas fait ce qui était prévu.",
    parameters: { type: "object", properties: { id: { type: "string", description: "Facultatif : détail d'une automatisation" } } },
    sortie: "Automatisations ; avec id : étapes et dernières exécutions.", exemple: {},
  },
  {
    name: "update_automation", ...ECRITURE, risque: "moyen",
    description: "Modifie une automatisation existante (nom, déclencheur, conditions ou étapes ; ce qui n'est pas envoyé ne change pas). Elle tournera désormais avec les droits de TA connexion.",
    parameters: { type: "object", properties: { ...ID, ...DEFINITION }, required: ["id"] },
    sortie: "Définition enregistrée.", exemple: { id: "cm…", declencheur: { type: "horaire", frequence: "jour", heure: "07:30" } },
  },
  {
    name: "pause_automation", ...ECRITURE, risque: "faible",
    description: "Met une automatisation en pause (elle ne se déclenche plus, ses exécutions en attente s'arrêtent) ou la relance avec « reprendre: true ».",
    parameters: { type: "object", properties: { ...ID, reprendre: { type: "boolean", description: "true pour la relancer ; absent ou false pour la mettre en pause" } }, required: ["id"] },
    sortie: "Nouvel état.", exemple: { id: "cm…" },
  },
  {
    name: "delete_automation", ...ECRITURE, risque: "moyen",
    description: "Supprime définitivement une automatisation et son historique. Préfère pause_automation si le marchand veut seulement l'arrêter un temps.",
    parameters: { type: "object", properties: ID, required: ["id"] },
    sortie: "Confirmation.", exemple: { id: "cm…" },
  },
  {
    name: "run_automation", ...LECTURE,
    description: "Essai à blanc : décrit, étape par étape, ce que ferait une automatisation si elle se déclenchait maintenant (outil appelé, exécution directe, attente de l'accord du marchand ou refus faute de droit). RIEN n'est exécuté. À utiliser juste après create_automation ou update_automation, et pour expliquer une automatisation au marchand.",
    parameters: { type: "object", properties: { ...ID, evenement_exemple: { type: "object", description: "Données d'un événement fictif, pour tester les conditions (ex. { stock: 2, seuil: 5 })" } }, required: ["id"] },
    sortie: "Déroulé prévu, étape par étape.", exemple: { id: "cm…", evenement_exemple: { stock: 2, seuil: 5 } },
  },
  {
    name: "manage_webhooks", module: "boutique", niveau: "ecriture", risque: "moyen", scope: SCOPE_AUTOMATISATION, capacite: "automatisation",
    description: `Abonne un service externe du marchand (ERP, tableur, outil maison) aux événements de la boutique : Axso lui envoie un POST https signé à chaque événement. action « lister », « creer » (url + evenements) ou « supprimer » (id). Des données de la boutique sortent vers cette adresse : ne crée un webhook que vers une adresse donnée par le marchand. Au plus ${WEBHOOKS_MAX} par boutique.`,
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["lister", "creer", "supprimer"] },
        url: { type: "string", description: "Adresse https publique qui recevra les événements (creer)" },
        evenements: { type: "array", items: { type: "string", enum: [...TYPES_EVENEMENT] }, description: "Événements à envoyer (creer)" },
        id: { type: "string", description: "Webhook à supprimer" },
      },
      required: ["action"],
    },
    sortie: "Webhooks de la boutique ; à la création, le secret de signature dans les données (une seule fois).",
    exemple: { action: "creer", url: "https://erp.exemple.com/axso", evenements: ["order.paid", "inventory.low"] },
  },
];

const refus = (code: NonNullable<ResultatIA["code"]>, resultat: string): ResultatIA => ({ succes: false, code, resultat });
const INTROUVABLE = refus("NOT_FOUND", "Automatisation introuvable dans cette boutique.");
const texte = (v: unknown) => (typeof v === "string" ? v : "");

/** Fuseau de la boutique, d'après son pays (Tenant.juridiction, code ISO) : pas de champ fuseau sur la boutique. */
async function fuseauBoutique(tenantId: string): Promise<string> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { juridiction: true } });
  try {
    const l = new Intl.Locale(`und-${t?.juridiction || "CM"}`) as any;
    // ponytail: premier fuseau du pays ; l'IA peut préciser « fuseau » pour un pays qui en a plusieurs.
    return (l.getTimeZones?.() ?? l.timeZones)?.[0] ?? "Africa/Douala";
  } catch { return "Africa/Douala"; }
}

/** Ce que le catalogue dit de chaque outil (import dynamique : serveur.ts importe ce module). */
async function fichesCatalogue() {
  const { catalogue } = await import("../serveur");
  return new Map(catalogue().map((f) => [f.name, f]));
}
const natureDepuis = (fiches: Awaited<ReturnType<typeof fichesCatalogue>>) => (outil: string): NatureOutil => {
  const f = fiches.get(outil);
  // Tout ce qui porte le droit d'automatiser (automatisations, objectifs, webhooks) est fermé aux étapes — serveur.ts le refuse aussi à l'exécution.
  return !f ? "inconnu" : f.permissions.some(estOrchestration) ? "interdit" : f.risk_level === "none" ? "lecture" : "ecriture";
};

const suivante = (d: Declencheur) => (d.type === "horaire" ? prochaineExecution(d, new Date()) : null);

async function valider(brut: unknown, tenantId: string) {
  return validerDefinition(brut, natureDepuis(await fichesCatalogue()), await fuseauBoutique(tenantId));
}

async function creer(args: Record<string, any>, ctx: CtxOutil): Promise<ResultatIA> {
  const v = await valider(args, ctx.tenantId);
  if (!v.ok) return refus("INVALID_INPUT", `Automatisation refusée — ${v.erreur}`);
  if ((await prisma.automatisationIA.count({ where: { tenantId: ctx.tenantId } })) >= PLAFONDS.parBoutique) return refus("CONFLICT", `Cette boutique a déjà ${PLAFONDS.parBoutique} automatisations : supprimes-en une avant.`);
  const d = v.valeur;
  const a = await prisma.automatisationIA.create({
    data: { tenantId: ctx.tenantId, connexionId: ctx.connexionId, nom: d.nom, declencheur: d.declencheur as any, conditions: d.conditions as any, etapes: d.etapes as any, prochaineExecution: suivante(d.declencheur) },
  });
  return {
    succes: true, donnees: { automation_id: a.id, active: true, next_run: a.prochaineExecution?.toISOString() ?? null },
    resultat: `Automatisation « ${a.nom} » créée (id ${a.id}) : ${decrireDeclencheur(d.declencheur)}, ${d.etapes.length} étape(s). Elle agit avec les droits de cette connexion et s'arrête si le marchand la coupe. Vérifie-la avec run_automation.`,
  };
}

async function modifier(args: Record<string, any>, ctx: CtxOutil): Promise<ResultatIA> {
  const a = await prisma.automatisationIA.findFirst({ where: { id: texte(args.id), tenantId: ctx.tenantId } });
  if (!a) return INTROUVABLE;
  const v = await valider({ nom: args.nom ?? a.nom, declencheur: args.declencheur ?? a.declencheur, conditions: args.conditions ?? a.conditions, etapes: args.etapes ?? relire(a.etapes as unknown as Etape[]) }, ctx.tenantId);
  if (!v.ok) return refus("INVALID_INPUT", `Modification refusée — ${v.erreur}`);
  const d = v.valeur;
  await prisma.automatisationIA.update({
    where: { id: a.id },
    // Elle tourne désormais avec les droits de qui l'a modifiée : une connexion ne fait pas agir une autre à sa place.
    data: { connexionId: ctx.connexionId, nom: d.nom, declencheur: d.declencheur as any, conditions: d.conditions as any, etapes: d.etapes as any, prochaineExecution: a.actif ? suivante(d.declencheur) : null },
  });
  return { succes: true, donnees: { automation_id: a.id, definition: d }, resultat: `Automatisation « ${d.nom} » modifiée : ${decrireDeclencheur(d.declencheur)}, ${d.etapes.length} étape(s).` };
}

/** Étapes telles que l'IA les écrit : « sinon » est stocké en position (à partir de 0), elle le donne en numéro (à partir de 1). */
const relire = (etapes: Etape[]) => etapes.map((e) => (e.type === "branche" && typeof e.sinon === "number" ? { ...e, sinon: e.sinon + 1 } : e));

async function pause(args: Record<string, any>, ctx: CtxOutil): Promise<ResultatIA> {
  const a = await prisma.automatisationIA.findFirst({ where: { id: texte(args.id), tenantId: ctx.tenantId } });
  if (!a) return INTROUVABLE;
  const actif = args.reprendre === true;
  await prisma.automatisationIA.update({ where: { id: a.id }, data: { actif, prochaineExecution: actif ? suivante(a.declencheur as unknown as Declencheur) : null } });
  return { succes: true, donnees: { automation_id: a.id, active: actif }, resultat: `Automatisation « ${a.nom} » ${actif ? "relancée" : "en pause"}.` };
}

async function supprimer(args: Record<string, any>, ctx: CtxOutil): Promise<ResultatIA> {
  const a = await prisma.automatisationIA.findFirst({ where: { id: texte(args.id), tenantId: ctx.tenantId }, select: { id: true, nom: true } });
  if (!a) return INTROUVABLE;
  await prisma.$transaction([
    prisma.executionAutomatisation.deleteMany({ where: { automatisationId: a.id, tenantId: ctx.tenantId } }),
    prisma.automatisationIA.delete({ where: { id: a.id } }),
  ]);
  return { succes: true, donnees: { automation_id: a.id, deleted: true }, resultat: `Automatisation « ${a.nom} » supprimée.` };
}

async function lister(args: Record<string, any>, ctx: CtxOutil): Promise<ResultatIA> {
  if (args.id) {
    const a = await prisma.automatisationIA.findFirst({ where: { id: texte(args.id), tenantId: ctx.tenantId } });
    if (!a) return INTROUVABLE;
    const executions = await prisma.executionAutomatisation.findMany({ where: { automatisationId: a.id, tenantId: ctx.tenantId }, orderBy: { createdAt: "desc" }, take: 5, select: { statut: true, etape: true, journal: true, createdAt: true } });
    const d = a.declencheur as unknown as Declencheur;
    return {
      succes: true,
      donnees: { automation_id: a.id, name: a.nom, active: a.actif, trigger: d, conditions: a.conditions, steps: relire(a.etapes as unknown as Etape[]), next_run: a.prochaineExecution, last_run: a.derniereExecution, runs: a.executions, last_result: a.dernierResultat, executions },
      resultat: `« ${a.nom} » — ${a.actif ? "active" : "en pause"}, ${decrireDeclencheur(d)}. ${a.executions} exécution(s). Dernier résultat : ${a.dernierResultat ?? "aucun"}.`,
    };
  }
  const liste = await prisma.automatisationIA.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { createdAt: "desc" } });
  return {
    succes: true,
    donnees: { automations: liste.map((a) => ({ automation_id: a.id, name: a.nom, active: a.actif, trigger: a.declencheur, steps: (a.etapes as unknown[]).length, next_run: a.prochaineExecution, last_run: a.derniereExecution, runs: a.executions, last_result: a.dernierResultat })) },
    resultat: liste.length
      ? liste.map((a) => `• ${a.nom} (id ${a.id}) — ${a.actif ? "active" : "en pause"}, ${decrireDeclencheur(a.declencheur as unknown as Declencheur)}${a.dernierResultat ? ` — ${a.dernierResultat.slice(0, 120)}` : ""}`).join("\n")
      : "Aucune automatisation dans cette boutique.",
  };
}

/** Essai à blanc : lit la définition et les droits de la connexion qui la porte, n'appelle aucun outil. */
async function essayer(args: Record<string, any>, ctx: CtxOutil): Promise<ResultatIA> {
  const a = await prisma.automatisationIA.findFirst({ where: { id: texte(args.id), tenantId: ctx.tenantId } });
  if (!a) return INTROUVABLE;
  const { contexteDeConnexion, outilsDisponibles } = await import("../serveur");
  const ia = await contexteDeConnexion(a.connexionId, a.tenantId);
  if (!ia) return { succes: true, donnees: { would_run: false }, resultat: `« ${a.nom} » ne tournerait pas : la connexion de l'IA qui l'a créée a été coupée. Modifie-la (update_automation) pour la reprendre avec tes droits.` };

  const d = a.declencheur as unknown as Declencheur, conditions = a.conditions as unknown as Condition[], etapes = a.etapes as unknown as Etape[];
  const fiches = await fichesCatalogue();
  const ouverts = new Set(outilsDisponibles(ia).map((o) => o.name));
  const lignes = [`Essai à blanc de « ${a.nom} » (rien n'est exécuté). Déclencheur : ${decrireDeclencheur(d)}. Mode de la connexion : ${ia.mode}.`];
  if (!a.actif) lignes.push("Elle est en pause : elle ne se déclenche pas.");
  if (conditions.length) {
    const exemple = args.evenement_exemple && typeof args.evenement_exemple === "object" ? args.evenement_exemple : null;
    lignes.push(`Conditions : ${conditions.map((c) => `${c.champ} ${c.op} ${c.valeur ?? ""}`.trim()).join(" ET ")}${exemple ? ` → ${conditionsVraies(conditions, { evenement: exemple, etapes: {} }) ? "remplies" : "NON remplies"} avec l'exemple fourni` : " (donne « evenement_exemple » pour les tester)"}.`);
  }
  const plan = etapes.map((e, i) => {
    if (e.type === "attente") return { step: i + 1, type: e.type, outcome: "wait", texte: `attend ${e.minutes} min` };
    if (e.type === "branche") return { step: i + 1, type: e.type, outcome: "branch", texte: `si ${e.conditions.map((c) => `${c.champ} ${c.op} ${c.valeur ?? ""}`.trim()).join(" ET ")} : continue ; sinon ${e.sinon === "arreter" ? "s'arrête" : `passe à l'étape ${e.sinon + 1}`}` };
    const f = fiches.get(e.outil);
    const ecriture = !!f && f.risk_level !== "none";
    const issue = !f || !ouverts.has(e.outil) ? "refused"
      : ecriture && (e.type === "accord" || decider(ia.mode, f.risk_level as Risque, true) === "accord") ? "approval" : "execute";
    const suite = issue === "refused" ? "SERAIT REFUSÉ (outil fermé à cette connexion : droit ou plan) — l'automatisation s'arrêterait ici"
      : issue === "approval" ? "attendrait l'accord du marchand dans Axso avant d'être exécuté, puis la suite reprendrait"
      : ecriture ? "s'exécuterait directement (au-delà des limites fixées par le marchand, l'accord serait demandé)" : "s'exécuterait directement (lecture)";
    return { step: i + 1, type: e.type, tool: e.outil, args: e.args, outcome: issue, texte: `appelle ${e.outil} ${JSON.stringify(e.args).slice(0, 200)} → ${suite}${e.essais ? ` ; jusqu'à ${e.essais} essais en cas de panne` : ""}` };
  });
  lignes.push(...plan.map((p) => `${p.step}. ${p.texte}`));
  return { succes: true, donnees: { would_run: a.actif, dry_run: true, steps: plan.map(({ texte: _t, ...p }) => p) }, resultat: lignes.join("\n") };
}

async function webhooks(args: Record<string, any>, ctx: CtxOutil): Promise<ResultatIA> {
  const { tenantId } = ctx;
  if (args.action === "lister") {
    // Jamais le secret : il n'est donné qu'à la création.
    const liste = await prisma.webhookIA.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, select: { id: true, url: true, evenements: true, actif: true, echecs: true, createdAt: true } });
    return {
      succes: true, donnees: { webhooks: liste },
      resultat: liste.length ? liste.map((w) => `• ${w.url} (id ${w.id}) — ${w.evenements.join(", ")} — ${w.actif ? "actif" : "désactivé après des échecs répétés"}`).join("\n") : "Aucun webhook dans cette boutique.",
    };
  }
  if (args.action === "supprimer") {
    const r = await prisma.webhookIA.deleteMany({ where: { id: texte(args.id), tenantId } });
    return r.count ? { succes: true, donnees: { deleted: true }, resultat: "Webhook supprimé : plus rien n'est envoyé à cette adresse." } : refus("NOT_FOUND", "Webhook introuvable dans cette boutique.");
  }
  if (args.action !== "creer") return refus("INVALID_INPUT", "« action » vaut lister, creer ou supprimer.");

  const motif = refusUrlWebhook(args.url);
  if (motif) return refus("INVALID_INPUT", `Adresse refusée : ${motif}. Il faut une adresse https publique.`);
  const evenements = Array.isArray(args.evenements) ? [...new Set(args.evenements)] : [];
  if (!evenements.length || !evenements.every(estTypeEvenement)) return refus("INVALID_INPUT", `« evenements » : au moins un parmi ${TYPES_EVENEMENT.join(", ")}.`);
  if ((await prisma.webhookIA.count({ where: { tenantId } })) >= WEBHOOKS_MAX) return refus("CONFLICT", `Cette boutique a déjà ${WEBHOOKS_MAX} webhooks : supprimes-en un avant.`);
  const secret = `whsec_${randomBytes(24).toString("base64url")}`;
  const w = await prisma.webhookIA.create({ data: { tenantId, url: new URL(args.url).href, evenements, secret } });
  return {
    succes: true,
    // Le secret ne va que dans les données de CETTE réponse : le texte, lui, est recopié dans le journal des actions.
    donnees: { webhook_id: w.id, url: w.url, events: evenements, secret, signature: "En-têtes X-Axso-Timestamp et X-Axso-Signature: sha256=HMAC-SHA256(secret, « horodatage.corps ») en hexadécimal" },
    resultat: `Webhook créé (id ${w.id}) vers ${new URL(w.url).hostname} pour ${evenements.join(", ")}. Le secret de signature figure une seule fois dans les données de cette réponse : transmets-le au marchand maintenant. S'il est perdu, le marchand en génère un nouveau dans Axso → Contrôle IA.`,
  };
}

const EXECUTEURS: Record<string, (args: Record<string, any>, ctx: CtxOutil) => Promise<ResultatIA>> = {
  create_automation: creer, list_automations: lister, update_automation: modifier, pause_automation: pause,
  delete_automation: supprimer, run_automation: essayer, manage_webhooks: webhooks,
};

export const MODULE: ModuleIA = {
  id: "automatisation", nom: "Automatisations", outils: OUTILS,
  executer: (nom, args, ctx) => EXECUTEURS[nom]?.(args ?? {}, ctx) ?? Promise.resolve(INCONNU),
};
