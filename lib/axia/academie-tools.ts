// Outils AXIA de l'académie (Module L) — tous préfixés `academie_`, utilisés par les agents
// Course Architect, Assessment, Learning Tutor et Student Success (./agents.ts).
// LIMITES :
// - Générer (coût IA) et publier passent par SENSIBLES (./confirmation.ts) : l'appel du modèle
//   crée une demande dans la bulle AXIA ; rien ne part sans le clic du marchand. Même validée,
//   une génération respecte le plafond IA du mois (lib/academie/studio.ts).
// - Publier crée/actualise une formation INACTIVE : la mise en vente reste au marchand.
// - Les relances d'apprenants sont RÉDIGÉES, jamais envoyées.
// - Droits : ./droits.ts (catalogue = « produits », apprenants = « clients »).
import type { AgentTool, ToolExecutor } from "@/lib/agent-runner";
import { prisma } from "@/lib/prisma";
import { estVisible } from "@/lib/formation/regles";
import { chargerStudio, creerStudio, estimerTaches, lancerTaches, publier, type TypeTache } from "@/lib/academie/studio";
import { etapeCourante } from "@/lib/academie/regles";
import { repondreDepuis } from "@/lib/academie/tuteur";

const outil = (name: string, description: string, properties: Record<string, any> = {}, required: string[] = []): AgentTool => ({
  name, description, parameters: { type: "object", properties, required },
});
const STUDIO = { studio_id: { type: "string", description: "Identifiant du studio (academie_lister_studios)" } };
const TYPE = { type: "string", enum: ["studio_curriculum", "studio_lecon", "studio_vente"], description: "curriculum, leçon(s), ou page de vente + e-mails" };
const ELEMENT = { type: "string", description: "Optionnel : une leçon ou un module à (re)générer ; vide = toutes les leçons à rédiger" };

export const AXIA_ACADEMIE_TOOLS: AgentTool[] = [
  outil("academie_lister_studios", "Liste les studios de création de formation de la boutique avec leur étape et le nombre de leçons par statut."),
  outil("academie_creer_studio", "Crée un studio (brouillon, sans aucun coût) à partir d'un brief. Le marchand le retrouve dans Produits → Studio de cours.", {
    theme: { type: "string" }, public: { type: "string" }, niveau: { type: "string", enum: ["debutant", "intermediaire", "avance"] },
    objectifs: { type: "string" }, duree_heures: { type: "number" }, prix: { type: "number" },
  }, ["theme"]),
  outil("academie_estimer_generation", "Coût estimé (FCFA) d'une génération et budget IA restant du mois. À appeler AVANT de proposer une génération.", { ...STUDIO, type: TYPE, element_id: ELEMENT }, ["studio_id", "type"]),
  outil("academie_lancer_generation", "Lance une génération IA payante (curriculum, leçon(s) ou page de vente). Demande l'accord du marchand.", { ...STUDIO, type: TYPE, element_id: ELEMENT }, ["studio_id", "type"]),
  outil("academie_controle_qualite", "Points signalés par le contrôle qualité (références, certifications, chiffres non sourcés) et leçons à valider.", STUDIO, ["studio_id"]),
  outil("academie_publier_formation", "Publie le studio en formation réelle (inactive, à mettre en vente par le marchand). Demande l'accord du marchand.", STUDIO, ["studio_id"]),
  outil("academie_tester_tuteur", "Pose une question au tuteur IA d'une formation de la boutique, comme le ferait un apprenant (réponse limitée au contenu publié).", {
    produit_id: { type: "string", description: "Identifiant du produit formation" }, question: { type: "string" },
    mode: { type: "string", enum: ["question", "indice", "resume", "exercices"] },
  }, ["produit_id", "question"]),
  outil("academie_progression_apprenants", "Progression des apprenants d'une formation : inscrits, taux de complétion, apprenants inactifs depuis 14 jours.", {
    produit_id: { type: "string", description: "Identifiant du produit formation" },
  }, ["produit_id"]),
  outil("academie_relance_apprenant", "Rédige un message d'encouragement pour un apprenant inactif. N'ENVOIE RIEN : rend le texte, que le marchand envoie lui-même.", {
    produit_id: { type: "string" }, apprenant: { type: "string", description: "E-mail de l'apprenant" },
  }, ["produit_id", "apprenant"]),
];

const ok = (resultat: string) => ({ succes: true, resultat });
const ko = (resultat: string) => ({ succes: false, resultat });

async function formation(tenantId: string, produitId: string) {
  return prisma.produit.findFirst({
    where: { id: String(produitId), tenantId, type: "formation" },
    select: { id: true, nom: true, tenant: { select: { nomBoutique: true } }, formation: { select: { chapitres: { orderBy: { ordre: "asc" }, select: { titre: true, actif: true, statut: true, lecons: { orderBy: { ordre: "asc" }, select: { id: true, titre: true, type: true, contenu: true, actif: true, statut: true } } } } } } },
  });
}

export const executerOutilAcademie: ToolExecutor = async (nom, args, tenantId) => {
  try {
    switch (nom) {
      case "academie_lister_studios": {
        const studios = await prisma.studioCours.findMany({ where: { tenantId, statut: { not: "archive" } }, orderBy: { updatedAt: "desc" }, take: 15, include: { elements: { select: { type: true, statut: true } } } });
        if (!studios.length) return ok("Aucun studio de cours. Propose d'en créer un avec academie_creer_studio.");
        return ok(studios.map((s) => {
          const lecons = s.elements.filter((e) => e.type === "lecon" && e.statut !== "archive");
          const par = lecons.reduce<Record<string, number>>((a, e) => ({ ...a, [e.statut]: (a[e.statut] ?? 0) + 1 }), {});
          return `• ${s.titre} (id ${s.id}) — étape ${etapeCourante(s.elements, s.statut === "publie")}/6 — leçons : ${Object.entries(par).map(([k, v]) => `${v} ${k}`).join(", ") || "aucune"}`;
        }).join("\n"));
      }
      case "academie_creer_studio": {
        const s = await creerStudio(tenantId, { theme: args.theme, public: args.public ?? "", niveau: args.niveau ?? "debutant", objectifs: args.objectifs ?? "", dureeHeures: Number(args.duree_heures) || 3, ...(args.prix != null && { prix: Number(args.prix) }) });
        return ok(`Studio créé (id ${s.id}), rien n'a encore été généré. Prochaine étape : estimer puis lancer le curriculum (accord du marchand requis).`);
      }
      case "academie_estimer_generation": {
        const e = await estimerTaches(tenantId, String(args.studio_id), args.type as TypeTache, args.element_id || undefined);
        return ok(`${e.nombre} génération(s), coût estimé ${e.coutEstime} FCFA. Budget IA du mois : ${e.budget.reste} FCFA restants sur ${e.budget.plafond}.${e.budget.ok ? "" : ` ${e.budget.message}`}`);
      }
      case "academie_lancer_generation": {
        const r = await lancerTaches(tenantId, String(args.studio_id), args.type as TypeTache, { elementId: args.element_id || undefined, accord: true });
        return ok(`${r.nombre} génération(s) en file (≈ ${r.coutEstime} FCFA). Elles avancent quand le marchand ouvre le studio, ou au prochain passage planifié.`);
      }
      case "academie_controle_qualite": {
        const s = await chargerStudio(tenantId, String(args.studio_id));
        const actifs = s.elements.filter((e) => e.statut !== "archive");
        const alertes = actifs.flatMap((e) => (e.alertes as { extrait: string; raison: string }[]).map((a) => `• ${e.titre} : « ${a.extrait} » — ${a.raison}`));
        const aValider = actifs.filter((e) => e.statut === "a_verifier").map((e) => e.titre);
        return ok(`${alertes.length ? `Points à vérifier :\n${alertes.slice(0, 30).join("\n")}` : "Aucun point signalé."}\n${aValider.length ? `À valider par le marchand : ${aValider.join(", ")}` : "Rien en attente de validation."}`);
      }
      case "academie_publier_formation": {
        const r = await publier(tenantId, String(args.studio_id));
        return ok(`Formation publiée (produit ${r.produitId}), encore INACTIVE : le marchand la met en vente depuis Produits.`);
      }
      case "academie_tester_tuteur": {
        const f = await formation(tenantId, args.produit_id);
        if (!f?.formation) return ko("Formation introuvable dans cette boutique.");
        const lecons = f.formation.chapitres.filter(estVisible).flatMap((c) => c.lecons.filter(estVisible).filter((l) => l.type !== "quiz").map((l) => ({ ...l, chapitre: c.titre })));
        const r = await repondreDepuis({ tenantId, formation: f.nom, boutique: f.tenant.nomBoutique }, lecons, { question: String(args.question).slice(0, 800), mode: args.mode ?? "question" });
        return ok(`${r.reponse}${r.sources.length ? `\nSources : ${r.sources.map((x) => x.titre).join(" · ")}` : ""}`);
      }
      case "academie_progression_apprenants":
      case "academie_relance_apprenant": {
        const f = await formation(tenantId, args.produit_id);
        if (!f?.formation) return ko("Formation introuvable dans cette boutique.");
        const leconIds = f.formation.chapitres.filter(estVisible).flatMap((c) => c.lecons.filter(estVisible).map((l) => l.id));
        const acces = await prisma.accesFormation.findMany({ where: { produitId: f.id, revoqueAt: null }, select: { clientEmail: true, createdAt: true, derniereActiviteAt: true } });
        const faites = leconIds.length ? await prisma.progressionLecon.groupBy({ by: ["clientEmail"], where: { leconId: { in: leconIds }, complete: true }, _count: true }) : [];
        const n = new Map(faites.map((x) => [x.clientEmail, x._count]));
        const pct = (e: string) => (leconIds.length ? Math.round(((n.get(e) ?? 0) / leconIds.length) * 100) : 0);
        if (nom === "academie_relance_apprenant") {
          const a = acces.find((x) => x.clientEmail === String(args.apprenant));
          if (!a) return ko("Cet apprenant n'a pas accès à cette formation.");
          return ok(`Brouillon (rien n'a été envoyé) :\n« Bonjour ! Tu as déjà fait ${pct(a.clientEmail)} % de « ${f.nom} ». Ta prochaine leçon t'attend : 15 minutes suffisent pour avancer aujourd'hui. Ton accès est à vie, reprends quand tu veux. — ${f.tenant.nomBoutique} »`);
        }
        if (!acces.length) return ok("Aucun apprenant pour l'instant.");
        const limite = Date.now() - 14 * 86_400_000;
        const inactifs = acces.filter((a) => (a.derniereActiviteAt ?? a.createdAt).getTime() < limite && pct(a.clientEmail) < 100);
        const moyenne = Math.round(acces.reduce((s, a) => s + pct(a.clientEmail), 0) / acces.length);
        return ok(`${acces.length} apprenant(s), complétion moyenne ${moyenne} %, ${acces.filter((a) => pct(a.clientEmail) === 100).length} ont tout terminé.\n${inactifs.length ? `Inactifs depuis 14 j : ${inactifs.slice(0, 15).map((a) => `${a.clientEmail} (${pct(a.clientEmail)} %)`).join(", ")}` : "Aucun inactif."}`);
      }
      default:
        return ko(`Outil inconnu : ${nom}`);
    }
  } catch (e: any) {
    return ko(e?.message ?? "Erreur");
  }
};
