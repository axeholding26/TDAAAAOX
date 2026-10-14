// Builder MCP — expériences A/B (Palier 2). A = la version en ligne, B = le brouillon actuel ou
// un plan de design appliqué à une copie. Démarrer ou arrêter change ce que voit le public
// (risque moyen). La gagnante va dans le BROUILLON, jamais en ligne directement.
// Personnalisation (pays, appareil, campagne, langue) : règles validées et stockées, PAS rendues.
import { prisma } from "@/lib/prisma";
import { lireBrouillon, donneesBoutique } from "@/lib/builder/moteur";
import { validerConfig } from "@/lib/builder/validation";
import { OPERATIONS, OPERATIONS_PAR_NOM } from "@/lib/builder/operations";
import { lireMarque, simuler, validerEtapes, type EtapePlan, type Intention } from "@/lib/builder/intention";
import { mesurer, validerRegles, zTest, SEUILS, type Variante } from "@/lib/builder/experiences";
import type { CtxOutil, OutilIA, ResultatIA } from "../../types";
import { evenement, ko, lienApercu, ok, traduire } from "./commun";

const objet = (properties: Record<string, any> = {}, required: string[] = []) => ({ type: "object" as const, properties, required });
const base = { module: "boutique" as const, capacite: "builder_experiences", tier: "palier2" as const, cache: true };
const ID = { type: "string", description: "Identifiant de l'expérience" };
const REGLES = {
  type: "array", maxItems: 10, description: "Ciblage préparé (pays ISO, appareil, campagne utm, langue) : stocké et validé, PAS encore appliqué par la vitrine.",
  items: objet({ pays: { type: "array", items: { type: "string" } }, appareil: { type: "string", enum: ["mobile", "tablette", "ordinateur"] }, campagne: { type: "string" }, langue: { type: "array", items: { type: "string" } } }),
};
const MESURE = "Mesure : visiteurs arrivés pendant l'expérience et leurs commandes passées sur la vitrine (WhatsApp/livraison et produits digitaux). Les visiteurs venus avant le début voient aussi une variante mais ne sont pas comptés ; les ventes en caisse ne comptent pas.";

export const OUTILS: OutilIA[] = [
  {
    ...base, name: "axso_builder_create_experiment", niveau: "ecriture", risque: "faible",
    description: "Prépare un test A/B de la vitrine : A = version en ligne, B = le brouillon actuel (source « brouillon ») ou un plan de design (source « plan » + plan_id) appliqué à une copie. demarrer: true le lance tout de suite (le public voit alors B selon la répartition). Une seule expérience en cours par boutique.",
    parameters: objet({
      nom: { type: "string" }, source: { type: "string", enum: ["brouillon", "plan"] }, plan_id: { type: "string" },
      repartition: { type: "integer", minimum: 1, maximum: 99, description: "% de visiteurs sur B (défaut 50)" }, regles: REGLES, demarrer: { type: "boolean" },
    }, ["nom", "source"]),
    sortie: "experiment_id, statut, ce qui change dans B.",
    exemple: { nom: "Hero minimaliste", source: "brouillon", repartition: 50, demarrer: false },
    evaluerRisque: async (args) => (args.demarrer === true ? { risque: "moyen", resume: "Lance un test A/B : une partie du public verra la variante B." } : { risque: "faible" }),
  },
  {
    ...base, name: "axso_builder_get_experiment", niveau: "lecture",
    description: "Résultats d'un test A/B (sans identifiant : les dernières expériences) : visiteurs, commandes, taux, écart et verdict statistique. Aucun gagnant n'est déclaré sans test significatif ni sous le seuil de données.",
    parameters: objet({ experiment_id: ID }),
    sortie: "par variante : visiteurs, conversions, taux ; écart, p-valeur, gagnant ou « pas assez de données ».",
  },
  {
    ...base, name: "axso_builder_update_experiment", niveau: "ecriture", risque: "faible",
    description: "Modifie un test A/B : nom, répartition, règles de ciblage, ou le démarre (statut « en_cours »).",
    parameters: objet({ experiment_id: ID, nom: { type: "string" }, repartition: { type: "integer", minimum: 1, maximum: 99 }, regles: REGLES, statut: { type: "string", enum: ["en_cours"] } }, ["experiment_id"]),
    evaluerRisque: async (args, ctx) => {
      const x = await prisma.experienceBoutique.findFirst({ where: { id: String(args.experiment_id ?? ""), tenantId: ctx.tenantId }, select: { statut: true } });
      return x && (args.statut === "en_cours" || (x.statut === "en_cours" && args.repartition !== undefined)) ? { risque: "moyen", resume: "Change ce que voit le public de la vitrine." } : { risque: "faible" };
    },
  },
  {
    ...base, name: "axso_builder_stop_experiment", niveau: "ecriture", risque: "moyen",
    description: "Arrête un test A/B (tout le public revoit la version en ligne) et donne le verdict. appliquer: « gagnante » met B dans le BROUILLON seulement s'il gagne significativement ; « B » le fait quand même (choix du marchand). Jamais de mise en ligne directe : publier ensuite avec axso_builder_publish.",
    parameters: objet({ experiment_id: ID, appliquer: { type: "string", enum: ["gagnante", "B", "aucune"] } }, ["experiment_id"]),
  },
];

const repartitionDe = (v: unknown) => (v === undefined ? 50 : Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 99 ? (v as number) : null);

/** Clés de premier niveau que `cfg` change par rapport à `enLigne` : la config partielle de B. */
function partielle(enLigne: Record<string, any>, cfg: Record<string, any>) {
  return Object.fromEntries(Object.keys(cfg).filter((k) => JSON.stringify(cfg[k] ?? null) !== JSON.stringify(enLigne[k] ?? null)).map((k) => [k, cfg[k]]));
}

async function varianteB(ctx: CtxOutil, source: string, planId: unknown): Promise<Record<string, any> | string> {
  const b = await lireBrouillon(ctx.tenantId);
  const enLigne = b.enLigne as unknown as Record<string, any>;
  let cfg: Record<string, any>;
  if (source === "brouillon") {
    if (!b.existe) return "aucun brouillon : prépare d'abord la variante B (plan de design, opérations) ou utilise source « plan ».";
    cfg = b.config as unknown as Record<string, any>;
  } else {
    const p = await prisma.planIA.findFirst({ where: { id: String(planId ?? ""), tenantId: ctx.tenantId } });
    const meta = p?.contraintes as any;
    if (!p || !meta?._builder) return "plan de design introuvable (plan_id d'axso_builder_plan_design_goal).";
    // Le plan est rejoué sur une COPIE de la version en ligne, avec les mêmes contrôles de portée et de marque.
    const v = validerEtapes(p.etapes as unknown as EtapePlan[], OPERATIONS);
    const sim = simuler(enLigne, v.etapes, OPERATIONS_PAR_NOM, await donneesBoutique(ctx.tenantId), meta.intention as Intention, lireMarque(enLigne.marque));
    if (!sim.retenues.length || sim.invalide.length) return `le plan ne s'applique pas à la version en ligne (${[...v.rejets, ...sim.rejets, ...sim.invalide].slice(0, 3).join(" ; ") || "aucun changement"}).`;
    cfg = sim.config;
  }
  const part = partielle(enLigne, cfg);
  if (!Object.keys(part).length) return "la variante B serait identique à la version en ligne.";
  const problemes = validerConfig({ ...enLigne, ...part }, enLigne);
  if (problemes.length) return `variante B refusée : ${problemes.slice(0, 3).join(" ; ")}`;
  return part;
}

async function demarrer(ctx: CtxOutil, id: string): Promise<ResultatIA | null> {
  // ponytail: contrôle puis écriture (pas de verrou) ; deux démarrages simultanés pourraient passer — contrainte unique partielle en base si besoin.
  const autre = await prisma.experienceBoutique.findFirst({ where: { tenantId: ctx.tenantId, statut: "en_cours", id: { not: id } }, select: { id: true, nom: true } });
  if (autre) return ko("CONFLICT", `l'expérience « ${autre.nom} » (${autre.id}) est déjà en cours : une seule à la fois par boutique. Arrête-la d'abord.`);
  await prisma.experienceBoutique.updateMany({ where: { id, tenantId: ctx.tenantId, statut: "brouillon" }, data: { statut: "en_cours", debut: new Date() } });
  evenement(ctx, "store.updated", { experience: id, statut: "en_cours" });
  return null;
}

async function verdict(tenantId: string, x: { id: string; debut: Date | null }) {
  const m = x.debut ? await mesurer(tenantId, x.id) : { A: { visiteurs: 0, conversions: 0 }, B: { visiteurs: 0, conversions: 0 } };
  return zTest(m.A, m.B);
}

const pct = (t: number) => `${(t * 100).toFixed(2)} %`;
const texteVerdict = (v: ReturnType<typeof zTest>) =>
  `A (en ligne) : ${v.a.visiteurs} visiteurs, ${v.a.conversions} commandes, ${pct(v.a.taux)}\nB : ${v.b.visiteurs} visiteurs, ${v.b.conversions} commandes, ${pct(v.b.taux)}\nÉcart : ${(v.ecart * 100).toFixed(2)} pt${v.ecartRelatif !== null ? ` (${(v.ecartRelatif * 100).toFixed(1)} %)` : ""}\n${v.conclusion}`;

export async function executer(nom: string, args: Record<string, any>, ctx: CtxOutil): Promise<ResultatIA> {
  try {
    switch (nom) {
      case "axso_builder_create_experiment": {
        const nomXp = typeof args.nom === "string" ? args.nom.trim().slice(0, 120) : "";
        const repartition = repartitionDe(args.repartition);
        const regles = validerRegles(args.regles);
        if (!nomXp || !["brouillon", "plan"].includes(args.source)) return ko("INVALID_INPUT", "`nom` et `source` (brouillon | plan) sont obligatoires.");
        if (repartition === null) return ko("INVALID_INPUT", "`repartition` : entier de 1 à 99.");
        if ("erreur" in regles) return ko("INVALID_INPUT", regles.erreur);
        const b = await varianteB(ctx, args.source, args.plan_id);
        if (typeof b === "string") return ko("INVALID_INPUT", b);
        const variantes: Variante[] = [{ id: "A", nom: "Version en ligne", config: {} }, { id: "B", nom: nomXp, config: b, ...(regles.regles.length && { regles: regles.regles }) }];
        const x = await prisma.experienceBoutique.create({ data: { tenantId: ctx.tenantId, nom: nomXp, variantes: variantes as any, repartition, metrique: "conversion" } });
        const refus = args.demarrer === true ? await demarrer(ctx, x.id) : null;
        if (refus) return { ...refus, resultat: `${refus.resultat} L'expérience ${x.id} est créée mais pas démarrée.` };
        return ok(
          `Expérience ${x.id} « ${nomXp} » ${args.demarrer === true ? `EN COURS : ${repartition} % des nouveaux visiteurs voient B` : "préparée (pas encore lancée : axso_builder_update_experiment {statut: \"en_cours\"})"}.\nB change : ${Object.keys(b).join(", ")}.\n${MESURE}${regles.regles.length ? "\nRègles de ciblage enregistrées mais NON appliquées : tous les visiteurs sont répartis au hasard." : ""}`,
          { experiment_id: x.id, status: args.demarrer === true ? "en_cours" : "brouillon", variant_b_keys: Object.keys(b), split: repartition, targeting_rules_applied: false },
        );
      }
      case "axso_builder_get_experiment": {
        if (!args.experiment_id) {
          const xs = await prisma.experienceBoutique.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, nom: true, statut: true, debut: true, fin: true } });
          return ok(xs.length ? xs.map((x) => `${x.id} [${x.statut}] ${x.nom}${x.debut ? ` depuis ${x.debut.toISOString().slice(0, 10)}` : ""}`).join("\n") : "Aucune expérience.", { experiments: xs });
        }
        const x = await prisma.experienceBoutique.findFirst({ where: { id: String(args.experiment_id), tenantId: ctx.tenantId } });
        if (!x) return ko("NOT_FOUND", "expérience introuvable.");
        const v = x.statut === "arrete" && (x.resultats as any)?.verdict ? (x.resultats as any).verdict as ReturnType<typeof zTest> : await verdict(ctx.tenantId, x);
        const b = (x.variantes as unknown as Variante[]).find((y) => y.id === "B");
        return ok(`Expérience « ${x.nom} » [${x.statut}] — ${x.repartition} % sur B.\n${texteVerdict(v)}\n${MESURE}${b?.regles?.length ? "\nRègles de ciblage : enregistrées, non appliquées." : ""}`,
          { experiment_id: x.id, status: x.statut, split: x.repartition, metric: x.metrique, results: v, min_sample: SEUILS, started_at: x.debut, ended_at: x.fin, targeting_rules: b?.regles ?? [], targeting_rules_applied: false });
      }
      case "axso_builder_update_experiment": {
        const x = await prisma.experienceBoutique.findFirst({ where: { id: String(args.experiment_id ?? ""), tenantId: ctx.tenantId } });
        if (!x) return ko("NOT_FOUND", "expérience introuvable.");
        if (x.statut === "arrete") return ko("CONFLICT", "expérience arrêtée : crée-en une nouvelle.");
        const repartition = args.repartition === undefined ? x.repartition : repartitionDe(args.repartition);
        if (repartition === null) return ko("INVALID_INPUT", "`repartition` : entier de 1 à 99.");
        const variantes = x.variantes as unknown as Variante[];
        if (args.regles !== undefined) {
          const r = validerRegles(args.regles);
          if ("erreur" in r) return ko("INVALID_INPUT", r.erreur);
          for (const v of variantes) if (v.id === "B") v.regles = r.regles;
        }
        await prisma.experienceBoutique.updateMany({ where: { id: x.id, tenantId: ctx.tenantId }, data: { nom: typeof args.nom === "string" && args.nom.trim() ? args.nom.trim().slice(0, 120) : x.nom, repartition, variantes: variantes as any } });
        if (args.statut === "en_cours" && x.statut === "brouillon") { const refus = await demarrer(ctx, x.id); if (refus) return refus; }
        return ok(`Expérience ${x.id} mise à jour${args.statut === "en_cours" ? " et EN COURS" : ""} (${repartition} % sur B).${x.statut === "en_cours" && args.repartition !== undefined ? " Les visiteurs déjà répartis peuvent changer de variante : les résultats mélangent les deux répartitions." : ""}`,
          { experiment_id: x.id, status: args.statut === "en_cours" ? "en_cours" : x.statut, split: repartition });
      }
      case "axso_builder_stop_experiment": {
        const x = await prisma.experienceBoutique.findFirst({ where: { id: String(args.experiment_id ?? ""), tenantId: ctx.tenantId } });
        if (!x) return ko("NOT_FOUND", "expérience introuvable.");
        if (args.appliquer !== undefined && !["gagnante", "B", "aucune"].includes(args.appliquer)) return ko("INVALID_INPUT", "appliquer : gagnante, B ou aucune.");
        const v = await verdict(ctx.tenantId, x);
        if (x.statut !== "arrete") {
          await prisma.experienceBoutique.updateMany({ where: { id: x.id, tenantId: ctx.tenantId }, data: { statut: "arrete", fin: new Date(), resultats: { verdict: v, calcule_le: new Date().toISOString() } as any } });
          evenement(ctx, "store.updated", { experience: x.id, statut: "arrete" });
        }
        const mettreB = args.appliquer === "B" || (args.appliquer === "gagnante" && v.gagnant === "B");
        let suite = args.appliquer === "gagnante" && !mettreB ? `\nRien n'est mis dans le brouillon : ${v.gagnant === "A" ? "la version en ligne gagne" : "aucune gagnante démontrée"}.` : "";
        if (mettreB) {
          const part = (x.variantes as unknown as Variante[]).find((y) => y.id === "B")?.config ?? {};
          const b = await lireBrouillon(ctx.tenantId);
          const cfg = { ...(b.config as unknown as Record<string, any>), ...part };
          const problemes = validerConfig(cfg, b.config as unknown as Record<string, any>);
          if (problemes.length) return ko("VALIDATION_FAILED", `expérience arrêtée, mais B ne peut pas être mise dans le brouillon : ${problemes.slice(0, 3).join(" ; ")}`);
          // ponytail: écrit le brouillon ici (moteur.ts n'a pas d'« écrire une config ») ; même verrou optimiste que le moteur.
          const majPar = ctx.connexionId;
          if (b.existe) {
            if (!(await prisma.brouillonBoutique.updateMany({ where: { tenantId: ctx.tenantId, updatedAt: b.majLe! }, data: { config: cfg as any, majPar } })).count) return ko("CONFLICT", "expérience arrêtée ; le brouillon a changé en même temps, B n'y est pas mise. Recommence avec appliquer: \"B\".");
          } else await prisma.brouillonBoutique.create({ data: { tenantId: ctx.tenantId, config: cfg as any, baseEmpreinte: b.empreinteEnLigne, majPar } });
          suite = `\nVariante B mise dans le BROUILLON${args.appliquer === "B" && v.gagnant !== "B" ? " (choix du marchand, sans gagnante démontrée)" : ""}. Aperçu : ${(await lienApercu(ctx.tenantId)) ?? "indisponible"} ; mise en ligne avec axso_builder_publish.`;
        }
        return ok(`Expérience « ${x.nom} » arrêtée : tout le public voit la version en ligne.\n${texteVerdict(v)}${suite}`, { experiment_id: x.id, status: "arrete", results: v, winner: v.gagnant, applied_to_draft: mettreB });
      }
    }
    return ko("NOT_FOUND", "outil inconnu.");
  } catch (err) { return traduire(err); }
}
