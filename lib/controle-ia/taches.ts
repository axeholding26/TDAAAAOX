// Tâches longues (étude, génération vidéo, import, objectif) : l'appel MCP rend un job_id
// tout de suite, le travail continue après la réponse (after() de Next, comme les constats
// AXIA) et l'IA suit l'avancement avec axso_statut_tache.
// ponytail: borné par maxDuration de la route (60 s) ; passer à une vraie file (cron qui
// reprend les TacheIA « en_attente ») si un travail doit durer plus longtemps.
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ResultatIA } from "./types";

export type Avancer = (progression: number, etape?: string) => Promise<void>;

export async function lancerTache(
  cible: { tenantId: string; connexionId?: string }, type: string, travail: (avancer: Avancer) => Promise<unknown>,
): Promise<ResultatIA> {
  const t = await prisma.tacheIA.create({ data: { tenantId: cible.tenantId, connexionId: cible.connexionId, type } });
  const executer = async () => {
    try {
      await prisma.tacheIA.update({ where: { id: t.id }, data: { statut: "en_cours" } });
      const resultat = await travail(async (progression, etape) => {
        await prisma.tacheIA.update({ where: { id: t.id }, data: { progression: Math.max(0, Math.min(99, Math.round(progression))), etape } });
      });
      await prisma.tacheIA.update({ where: { id: t.id }, data: { statut: "termine", progression: 100, resultat: (resultat ?? {}) as any } });
    } catch (err: any) {
      console.error("[tache-ia]", type, err?.message);
      await prisma.tacheIA.update({ where: { id: t.id }, data: { statut: "echec", erreur: String(err?.message ?? "erreur").slice(0, 300) } }).catch(() => {});
    }
  };
  // Hors d'une requête (tests, cron sans réponse en cours), after() n'existe pas : on lance sans attendre.
  try { after(executer); } catch { void executer(); }
  return { succes: true, resultat: `Tâche lancée (job_id : ${t.id}). Suis-la avec axso_statut_tache.`, donnees: { job_id: t.id, status: "en_attente", progress: 0 } };
}

export async function statutTache(tenantId: string, id: string): Promise<ResultatIA> {
  const t = await prisma.tacheIA.findFirst({ where: { id, tenantId } });
  if (!t) return { succes: false, code: "NOT_FOUND", resultat: "Tâche introuvable." };
  const donnees = { job_id: t.id, type: t.type, status: t.statut, progress: t.progression, step: t.etape, result: t.resultat, error: t.erreur };
  const texte = t.statut === "termine" ? `Tâche terminée.\n${JSON.stringify(t.resultat).slice(0, 6000)}`
    : t.statut === "echec" ? `Tâche en échec : ${t.erreur}` : `Tâche ${t.statut} (${t.progression} %)${t.etape ? ` — ${t.etape}` : ""}. Redemande dans quelques secondes.`;
  return { succes: t.statut !== "echec", resultat: texte, donnees };
}
