// Consommateur de tâches — le maillon qui manquait entre l'orchestrateur
// (publierTache) et les agents (executeOutil) : jusqu'ici les tâches
// publiées restaient en statut "pending" pour toujours, aucun code ne les
// lisait. Ce module les exécute réellement, en mémoire, sans repasser par
// une requête HTTP authentifiée (les agent-* routes exigent une session
// utilisateur, incompatible avec une exécution cron).
import { consommerTaches, marquerComplete, marquerEchec, type AgentId } from "./agent-bus";
import { runAgent, type AgentTool, type ToolExecutor } from "./agent-runner";

import { SYSTEM_PROMPT as PROMPT_REVENUE, OUTILS as OUTILS_REVENUE, executeOutil as executeOutilRevenue } from "@/app/api/ai/agent-revenue/route";
import { SYSTEM_PROMPT as PROMPT_VEILLE, OUTILS as OUTILS_VEILLE, executeOutil as executeOutilVeille } from "@/app/api/ai/agent-veille/route";
import { SYSTEM_PROMPT as PROMPT_GROWTH, OUTILS as OUTILS_GROWTH, executeOutil as executeOutilGrowth } from "@/app/api/ai/agent-growth/route";
import { SYSTEM_PROMPT as PROMPT_STOCK, OUTILS as OUTILS_STOCK, executeOutil as executeOutilStock } from "@/app/api/ai/agent-stock/route";
import { SYSTEM_PROMPT as PROMPT_FIDELITE, OUTILS as OUTILS_FIDELITE, executeOutil as executeOutilFidelite } from "@/app/api/ai/agent-fidelite/route";
import { PROMPT as PROMPT_MARKETING, OUTILS as OUTILS_MARKETING, executeOutil as executeOutilMarketing } from "@/app/api/ai/agent-marketing/route";
import { PROMPT as PROMPT_ANALYTICS, OUTILS as OUTILS_ANALYTICS, executeOutil as executeOutilAnalytics } from "@/app/api/ai/agent-analytics/route";
import { PROMPT as PROMPT_CLIENTS, OUTILS as OUTILS_CLIENTS, executeOutil as executeOutilClients } from "@/app/api/ai/agent-clients/route";
import { PROMPT as PROMPT_PRODUITS, OUTILS as OUTILS_PRODUITS, executeOutil as executeOutilProduits } from "@/app/api/ai/agent-produits/route";
import { PROMPT as PROMPT_LIVRAISON, OUTILS as OUTILS_LIVRAISON, executeOutil as executeOutilLivraison } from "@/app/api/ai/agent-livraison/route";

interface AgentConfig {
  prompt: string;
  outils: AgentTool[];
  // Normalise les deux formes rencontrées dans les routes agent-* : certaines
  // exposent un executeOutil déjà lié au tenant (fonction fabrique), d'autres
  // un executeOutil direct à 3 arguments — voir agent-bus.ts::AgentId.
  buildExecutor: (tenantId: string) => ToolExecutor;
}

const AGENTS: Partial<Record<AgentId, AgentConfig>> = {
  "agent-revenue":   { prompt: PROMPT_REVENUE,   outils: OUTILS_REVENUE,   buildExecutor: executeOutilRevenue },
  "agent-veille":    { prompt: PROMPT_VEILLE,    outils: OUTILS_VEILLE,    buildExecutor: executeOutilVeille },
  "agent-growth":    { prompt: PROMPT_GROWTH,    outils: OUTILS_GROWTH,    buildExecutor: executeOutilGrowth },
  "agent-stock":     { prompt: PROMPT_STOCK,     outils: OUTILS_STOCK,     buildExecutor: executeOutilStock },
  "agent-fidelite":  { prompt: PROMPT_FIDELITE,  outils: OUTILS_FIDELITE,  buildExecutor: executeOutilFidelite },
  "agent-marketing": { prompt: PROMPT_MARKETING, outils: OUTILS_MARKETING, buildExecutor: () => executeOutilMarketing },
  "agent-analytics": { prompt: PROMPT_ANALYTICS, outils: OUTILS_ANALYTICS, buildExecutor: () => executeOutilAnalytics },
  "agent-clients":   { prompt: PROMPT_CLIENTS,   outils: OUTILS_CLIENTS,   buildExecutor: () => executeOutilClients },
  "agent-produits":  { prompt: PROMPT_PRODUITS,  outils: OUTILS_PRODUITS,  buildExecutor: () => executeOutilProduits },
  "agent-livraison": { prompt: PROMPT_LIVRAISON, outils: OUTILS_LIVRAISON, buildExecutor: () => executeOutilLivraison },
};

function messageDepuisTache(type: string, payload: object): string {
  return `Tâche déléguée par l'orchestrateur Axso — type : "${type}".
Contexte : ${JSON.stringify(payload)}

Agis maintenant avec les outils à ta disposition, sans demander de confirmation. Sois concret et chiffré dans ta réponse.`;
}

export interface ResultatTraitement {
  agentId: AgentId;
  tacheId: string;
  type: string;
  succes: boolean;
  resume: string;
}

// Draine les tâches "pending" de chaque agent pour un tenant et les exécute
// réellement (appel LLM + outils, écriture en base via les executeOutil
// existants qui journalisent déjà dans AgentDecision).
export async function traiterTachesEnAttente(tenantId: string, limitParAgent = 5): Promise<ResultatTraitement[]> {
  const resultats: ResultatTraitement[] = [];

  for (const agentId of Object.keys(AGENTS) as AgentId[]) {
    const config = AGENTS[agentId];
    if (!config) continue;

    const taches = await consommerTaches(tenantId, agentId, limitParAgent);
    for (const tache of taches) {
      try {
        const message = messageDepuisTache(tache.type, tache.payload as object);
        const executor = config.buildExecutor(tenantId);
        const result = await runAgent(
          config.prompt,
          [{ role: "user", content: message }],
          config.outils,
          tenantId,
          executor,
          6
        );
        await marquerComplete(tache.id, { reponse: result.reponse, actions: result.actions });
        resultats.push({
          agentId,
          tacheId: tache.id,
          type: tache.type,
          succes: true,
          resume: result.actions[result.actions.length - 1] ?? result.reponse.slice(0, 160),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await marquerEchec(tache.id, message);
        resultats.push({ agentId, tacheId: tache.id, type: tache.type, succes: false, resume: message });
      }
    }
  }

  return resultats;
}
