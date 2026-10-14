// Builder MCP — brouillon, transaction, aperçu, versions, publication et retour en arrière.
// Toute modification va dans le BROUILLON ; seule axso_builder_publish (ou une restauration
// en ligne) change la vitrine, avec un risque calculé sur les changements réels.
import { prisma } from "@/lib/prisma";
import {
  abandonnerBrouillon, annulerDernierePublication, comparerVersions, creerInstantane, lireBrouillon, publierBrouillon, restaurerVersion,
} from "@/lib/builder/moteur";
import { comparer, resumer } from "@/lib/builder/diff";
import { risqueChangements } from "@/lib/builder/risque";
import { OPERATIONS } from "@/lib/builder/operations";
import type { CtxOutil, OutilIA, ResultatIA } from "../../types";
import { auteurDe, evenement, ko, lienApercu, modifier, ok, traduire } from "./commun";

const objet = (properties: Record<string, any> = {}, required: string[] = []) => ({ type: "object" as const, properties, required });
const REF = { oneOf: [{ type: "integer" }, { type: "string", enum: ["brouillon", "publie"] }], description: "Numéro de version, « brouillon » ou « publie »" };
const base = { module: "boutique" as const, capacite: "builder_versions" };

export const OUTILS: OutilIA[] = [
  {
    ...base, name: "axso_builder_get_draft_status", niveau: "lecture",
    description: "État du brouillon de la boutique : existe-t-il, quels changements par rapport à la version en ligne, le marchand a-t-il modifié la boutique en ligne entre-temps, dernières versions. À lire avant de publier.",
    parameters: objet(), sortie: "changements brouillon/en ligne, conflit éventuel, 5 dernières versions.",
  },
  {
    ...base, name: "axso_builder_apply", niveau: "ecriture", risque: "faible",
    description: "Applique PLUSIEURS opérations du Builder au brouillon en une seule transaction (toutes ou aucune) : préfère-le à une série d'appels séparés pour une refonte. Chaque étape : { op: nom d'un outil d'opération (voir axso_builder_get_capabilities), args }.",
    parameters: objet({
      operations: { type: "array", minItems: 1, maxItems: 60, items: objet({ op: { type: "string" }, args: { type: "object" } }, ["op"]) },
      raison: { type: "string", description: "Objectif de ces changements, montré au marchand" },
    }, ["operations"]),
    sortie: "résumé des changements (+ ajouté, - supprimé, ~ modifié, ↕ déplacé) et lien d'aperçu.",
    exemple: { operations: [{ op: "axso_builder_move_section", args: { section_id: "sec_2", position: 0 } }], raison: "Mettre les meilleures ventes plus haut" },
  },
  {
    ...base, name: "axso_builder_preview", niveau: "lecture",
    description: "Lien d'aperçu du brouillon dans la vraie vitrine (valable 1 h, visible seulement par qui l'ouvre) et structure de la page, pour ordinateur, tablette et mobile. Le public ne voit rien avant publication.",
    parameters: objet({ page: { type: "string", description: "Chemin dans la boutique : vide (accueil), « produits », « p/<page> »…" }, appareil: { type: "string", enum: ["desktop", "tablet", "mobile"] } }),
    sortie: "preview_url, sections dans l'ordre d'affichage par zone.",
  },
  {
    ...base, name: "axso_builder_list_versions", niveau: "lecture",
    description: "Historique des versions de la boutique (publications, instantanés, restaurations) avec auteur, IA, date et raison.",
    parameters: objet({ limite: { type: "integer", minimum: 1, maximum: 60 } }),
  },
  {
    ...base, name: "axso_builder_compare_versions", niveau: "lecture",
    description: "Compare deux états (numéro de version, « brouillon » ou « publie ») : sections ajoutées, supprimées, déplacées, styles et contenus modifiés, pages, thème.",
    parameters: objet({ de: REF, vers: REF }, ["de", "vers"]),
  },
  {
    ...base, name: "axso_builder_create_snapshot", niveau: "ecriture", risque: "faible",
    description: "Crée un point de retour nommé de la version en ligne (ou du brouillon) avant une série de changements.",
    parameters: objet({ raison: { type: "string" }, source: { type: "string", enum: ["publie", "brouillon"] } }, ["raison"]),
  },
  {
    ...base, name: "axso_builder_restore_snapshot", niveau: "ecriture", risque: "moyen",
    description: "Revient à une version : dans le brouillon (à vérifier puis publier, sans risque) ou directement en ligne (l'état actuel est gardé comme version).",
    parameters: objet({ numero: { type: "integer", minimum: 1 }, cible: { type: "string", enum: ["brouillon", "publie"] } }, ["numero", "cible"]),
    enLigne: (args) => args.cible === "publie",
    evaluerRisque: async (args, ctx) => {
      if (args.cible !== "publie") return { risque: "faible" };
      try {
        const { changements } = await comparerVersions(ctx.tenantId, "publie", Number(args.numero));
        return { risque: risqueChangements(changements).risque, resume: resumer(changements, 12) };
      } catch { return null; }
    },
  },
  {
    ...base, name: "axso_builder_rollback", niveau: "ecriture", risque: "moyen",
    description: "« Annule ce que tu viens de faire » : sans paramètre, abandonne le brouillon en cours s'il existe, sinon remet en ligne l'état d'avant ta dernière publication. `quoi` force l'un ou l'autre.",
    parameters: objet({ quoi: { type: "string", enum: ["brouillon", "derniere_publication"] } }),
    enLigne: (args) => args.quoi !== "brouillon", // sans précision, il peut toucher la version en ligne : prudence
    // Abandonner un brouillon ne change rien en ligne : pas d'accord nécessaire.
    evaluerRisque: async (args) => (args.quoi === "brouillon" ? { risque: "faible" } : null),
  },
  {
    ...base, name: "axso_builder_publish", niveau: "ecriture", risque: "moyen",
    description: "Publie le brouillon : il devient la boutique en ligne, l'état précédent est gardé comme version. Le risque est calculé sur les changements réels ; selon le mode et ce risque, l'accord du marchand est demandé avec le résumé et l'aperçu.",
    enLigne: () => true,
    parameters: objet({ raison: { type: "string", description: "Ce qui change et pourquoi, montré au marchand" }, force: { type: "boolean", description: "Écraser des changements faits en ligne par le marchand entre-temps (seulement s'il l'a accepté)" } }, ["raison"]),
    evaluerRisque: async (_args, ctx) => {
      const b = await lireBrouillon(ctx.tenantId).catch(() => null);
      if (!b?.existe) return null;
      const ch = comparer(b.enLigne, b.config);
      const r = risqueChangements(ch);
      return { risque: r.risque, resume: `${resumer(ch, 15)}\n(risque ${r.risque}, score ${r.score}/100)`, apercu: (await lienApercu(ctx.tenantId)) ?? undefined };
    },
  },
  {
    ...base, name: "axso_builder_discard_draft", niveau: "ecriture", risque: "faible",
    description: "Abandonne le brouillon : la boutique en ligne reste telle quelle.",
    parameters: objet(),
  },
];

async function ordreSections(tenantId: string, ref: "brouillon" | "publie") {
  const b = await lireBrouillon(tenantId);
  const cfg = (ref === "brouillon" ? b.config : b.enLigne) as any;
  return (cfg.builderTree ?? []).map((s: any) => ({ id: s.id, zone: s.config?.zone ?? "template", nom: s.config?.nom ?? s.children?.[0]?.children?.[0]?.children?.[0]?.type ?? s.type, masquee: s.actif === false }));
}

export async function executer(nom: string, args: Record<string, any>, ctx: CtxOutil): Promise<ResultatIA> {
  const auteur = auteurDe(ctx);
  try {
    switch (nom) {
      case "axso_builder_get_draft_status": {
        const b = await lireBrouillon(ctx.tenantId);
        const ch = b.existe ? comparer(b.enLigne, b.config) : [];
        const versions = await prisma.versionBoutique.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { numero: "desc" }, take: 5, select: { numero: true, type: true, client: true, raison: true, createdAt: true } });
        return ok(
          `${b.existe ? `Brouillon en cours (${ch.length} changement(s) non publiés) :\n${resumer(ch, 20)}` : "Aucun brouillon : la boutique en ligne est à jour."}${b.enLigneAChange ? "\n⚠ Le marchand a modifié la boutique en ligne depuis le début du brouillon : publier écraserait ses changements." : ""}\nBoutique ${b.statutBoutique === "active" ? "visible en ligne" : `non visible du public (${b.statutBoutique})`}.`,
          { draft: b.existe, changes: ch, live_changed_since_draft: b.enLigneAChange, store_status: b.statutBoutique, versions },
        );
      }
      case "axso_builder_apply": {
        const ops = Array.isArray(args.operations) ? args.operations : [];
        if (!ops.length || ops.length > 60) return ko("INVALID_INPUT", "`operations` : 1 à 60 étapes { op, args }.");
        const etapes = ops.map((o: any) => ({ op: String(o?.op ?? ""), args: o?.args && typeof o.args === "object" ? o.args : {} }));
        if (etapes.some((e: { op: string }) => !OPERATIONS.some((x) => x.nom === e.op))) return ko("INVALID_INPUT", `opération inconnue. Disponibles : ${OPERATIONS.map((o) => o.nom).join(", ")}.`);
        return modifier(ctx, etapes, `Transaction appliquée (${etapes.length} opérations)${args.raison ? ` — ${String(args.raison).slice(0, 200)}` : ""}`);
      }
      case "axso_builder_preview": {
        const page = String(args.page ?? "").replace(/^\/+/, "");
        const url = await lienApercu(ctx.tenantId, page);
        const b = await lireBrouillon(ctx.tenantId);
        const sections = await ordreSections(ctx.tenantId, b.existe ? "brouillon" : "publie");
        evenement(ctx, "preview.created", { page });
        return ok(
          `Aperçu ${b.existe ? "du brouillon" : "(aucun brouillon : version en ligne)"}${args.appareil ? ` — ouvre-le en largeur ${args.appareil === "mobile" ? "375 px" : args.appareil === "tablet" ? "768 px" : "1280 px"}` : ""} : ${url ?? "indisponible (secret serveur absent)"}\nSections : ${sections.map((s: any) => `${s.zone}/${s.nom}${s.masquee ? " (masquée)" : ""}`).join(" → ") || "aucune (socle par défaut)"}`,
          { preview_url: url, draft: b.existe, sections, devices: { desktop: 1280, tablet: 768, mobile: 375 } },
        );
      }
      case "axso_builder_list_versions": {
        const v = await prisma.versionBoutique.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { numero: "desc" }, take: Math.min(60, Math.max(1, Number(args.limite) || 15)), select: { numero: true, type: true, client: true, fournisseur: true, raison: true, createdAt: true, changements: true } });
        return ok(v.length ? v.map((x) => `v${x.numero} [${x.type}] ${x.createdAt.toISOString().slice(0, 16)} ${x.client ?? "marchand"} — ${x.raison}`).join("\n") : "Aucune version pour l'instant.", { versions: v.map(({ changements, ...x }) => ({ ...x, nb_changements: Array.isArray(changements) ? changements.length : 0 })) });
      }
      case "axso_builder_compare_versions": {
        const r = await comparerVersions(ctx.tenantId, args.de, args.vers);
        return ok(r.resume, { changes: r.changements });
      }
      case "axso_builder_create_snapshot": {
        const v = await creerInstantane(ctx.tenantId, String(args.raison ?? "Instantané").slice(0, 300), auteur, args.source === "brouillon" ? "brouillon" : "publie");
        return ok(`Instantané v${v.numero} créé.`, { version: v.numero });
      }
      case "axso_builder_restore_snapshot": {
        const r = await restaurerVersion(ctx.tenantId, Number(args.numero), args.cible === "publie" ? "publie" : "brouillon", auteur);
        if (args.cible === "publie") evenement(ctx, "rollback.completed", { version: r.version.numero });
        return ok(`Version ${r.version.numero} remise ${args.cible === "publie" ? "EN LIGNE (l'état précédent est gardé comme version)" : "dans le brouillon (publie pour la mettre en ligne)"}.\n${resumer(r.changements)}`, { version: r.version.numero, changes: r.changements });
      }
      case "axso_builder_rollback": {
        const b = await lireBrouillon(ctx.tenantId);
        if (args.quoi !== "derniere_publication" && (args.quoi === "brouillon" || b.existe)) {
          return (await abandonnerBrouillon(ctx.tenantId)) ? ok("Brouillon abandonné : rien de ce qui était en préparation n'est conservé, la boutique en ligne est inchangée.") : ko("NOT_FOUND", "aucun brouillon à abandonner.");
        }
        const r = await annulerDernierePublication(ctx.tenantId, ctx.connexionId, auteur);
        evenement(ctx, "rollback.completed", { version: r.retourA.numero });
        return ok(`Publication v${r.publication.numero} annulée : la boutique en ligne est revenue à la v${r.retourA.numero}.\n${resumer(r.changements)}`, { restored_version: r.retourA.numero, changes: r.changements });
      }
      case "axso_builder_publish": {
        evenement(ctx, "publish.started", {});
        try {
          const r = await publierBrouillon(ctx.tenantId, String(args.raison ?? "Publication").slice(0, 500), auteur, args.force === true);
          evenement(ctx, "publish.completed", { version: r.version.numero, changements: r.changements.length });
          const visible = r.statutBoutique === "active";
          return ok(`Publié (version v${r.version.numero}).\n${r.resume}${visible ? "" : `\nLa boutique n'est pas encore visible du public (${r.statutBoutique}) : publier_boutique la rend visible quand elle est complète.`}\nRetour en arrière possible avec axso_builder_rollback.`,
            { version: r.version.numero, changes: r.changements, store_visible: visible });
        } catch (err) {
          evenement(ctx, "publish.failed", { raison: err instanceof Error ? err.message.slice(0, 200) : "erreur" });
          const r = traduire(err);
          return { ...r, donnees: { ...r.donnees, builder_code: "BUILDER_PUBLISH_BLOCKED" } };
        }
      }
      case "axso_builder_discard_draft":
        return (await abandonnerBrouillon(ctx.tenantId)) ? ok("Brouillon abandonné.") : ko("NOT_FOUND", "aucun brouillon.");
    }
    return ko("NOT_FOUND", "outil inconnu.");
  } catch (err) { return traduire(err); }
}
