/**
 * Agent AXIA — moteur Gemini exclusif (SDK officiel @google/genai)
 *
 * Phase 1 — Tool execution : Gemini (function calling)
 * Phase 2 — Synthèse de réponse : Gemini streaming natif
 */
import {
  hasGemini,
  completionWithToolsAuto,
  streamGemini,
  type ToolDefinition,
} from "./llm-client";

export type AgentTool = ToolDefinition;
export interface AgentResult { reponse: string; actions: string[]; }
export type ToolExecutor = (
  name: string,
  args: Record<string, any>,
  tenantId: string
) => Promise<{ succes: boolean; resultat: string }>;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function buildSynthesisUserMessage(originalQuestion: string, toolResults: string[]): string {
  if (toolResults.length === 0) return originalQuestion;
  const ctx = toolResults.join("\n\n");
  // Sans cette précision, le modèle (qui n'a plus d'outils ici) relit la demande et
  // « rejoue » l'appel d'outil en texte : JSON, nom d'outil et ids affichés à l'utilisateur.
  return `${originalQuestion}\n\n---\nLes outils ont DÉJÀ été appelés ; voici leurs résultats (utilise-les pour répondre, ne les répète pas) :\n${ctx}\n\n---\nRédige uniquement ta réponse, en langage naturel. N'écris aucun appel d'outil, aucun JSON, aucun identifiant technique.`;
}

// ─── runAgent (non-streaming) ─────────────────────────────────────────────────

export async function runAgent(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  tools: AgentTool[],
  tenantId: string,
  executeOutil: ToolExecutor,
  maxIterations = 8,
  _fast = false
): Promise<AgentResult> {
  const actionsEffectuees: string[] = [];
  const toolResults: string[] = [];

  try {
    const conversation: any[] = [{ role: "system", content: systemPrompt }, ...messages];

    for (let i = 0; i < maxIterations; i++) {
      const result = await completionWithToolsAuto(conversation, tools, 4000, false);
      if (result.stopReason === "end_turn") {
        // Réponse rédigée en voyant les résultats des outils : on la garde telle quelle,
        // la re-synthèse ci-dessous ne sert qu'à combler une réponse vide.
        if (result.text?.trim()) return { reponse: result.text, actions: actionsEffectuees };
        break;
      }
      if (result.stopReason === "tool_use" && result.toolCalls?.length) {
        conversation.push({ role: "assistant", content: null, tool_calls: result.toolCalls.map(tc => ({ id: tc.id, type: "function", function: { name: tc.name, arguments: JSON.stringify(tc.arguments) }, signature: tc.signature })) });
        for (const tc of result.toolCalls) {
          const { resultat } = await executeOutil(tc.name, tc.arguments, tenantId);
          actionsEffectuees.push(resultat);
          toolResults.push(resultat);
          conversation.push({ role: "tool", tool_call_id: tc.id, content: resultat });
        }
        continue;
      }
      break;
    }
  } catch (err: any) {
    console.warn("[agent] phase1:", err?.message?.slice(0, 80));
  }

  const originalQ = messages[messages.length - 1]?.content ?? "";
  const synthMsg = buildSynthesisUserMessage(originalQ, toolResults);
  const prevMessages = messages.slice(0, -1).map(m => ({ role: m.role, content: m.content }));
  const synthMessages = [...prevMessages, { role: "user" as const, content: synthMsg }];

  if (hasGemini()) {
    try {
      let reponse = "";
      for await (const token of streamGemini(systemPrompt, synthMessages, 4000)) {
        reponse += token;
      }
      return { reponse, actions: actionsEffectuees };
    } catch (err: any) {
      console.warn("[agent] gemini synthesis:", err?.message?.slice(0, 80));
    }
  }

  return { reponse: "", actions: actionsEffectuees };
}

// ─── runAgentStream (SSE streaming) ──────────────────────────────────────────

export function runAgentStream(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string | any[] }>,
  tools: AgentTool[],
  tenantId: string,
  executeOutil: ToolExecutor,
  maxIterations = 8
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (data: object) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch {}
      };
      const finish = (actions: string[]) => {
        if (closed) return;
        closed = true;
        try { send({ type: "done", actions }); } catch {}
        try { controller.close(); } catch {}
      };

      const actionsEffectuees: string[] = [];
      const toolResults: string[] = [];
      let phase1Text = "";

      // ── Phase 1 : Tool execution (Gemini function calling) ─────────────────
      try {
        const conversation: any[] = [
          { role: "system", content: systemPrompt },
          ...messages.map(m => ({
            role: m.role,
            content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
          })),
        ];

        for (let iter = 0; iter < maxIterations; iter++) {
          const result = await completionWithToolsAuto(conversation, tools, 4000);

          if (result.stopReason === "end_turn") {
            phase1Text = result.text ?? "";
            break;
          }

          if (result.stopReason === "tool_use" && result.toolCalls?.length) {
            conversation.push({
              role: "assistant", content: null,
              tool_calls: result.toolCalls.map(tc => ({ id: tc.id, type: "function", function: { name: tc.name, arguments: JSON.stringify(tc.arguments) }, signature: tc.signature })),
            });
            for (const tc of result.toolCalls) {
              const { resultat } = await executeOutil(tc.name, tc.arguments, tenantId);
              actionsEffectuees.push(resultat);
              toolResults.push(resultat);
              conversation.push({ role: "tool", tool_call_id: tc.id, content: resultat });
            }
            // Pas de relance « réponds directement » ici : elle coupait les enchaînements
            // (trouver l'id puis agir) — la boucle reste bornée par maxIterations.
            continue;
          }
          break;
        }
      } catch (err: any) {
        console.warn("[stream] phase1 failed:", err?.message?.slice(0, 100));
      }

      // ── Phase 2 : Streaming synthèse (Gemini natif) ─────────────────────────
      const originalQuestion = (() => {
        const last = messages[messages.length - 1];
        if (!last) return "";
        return typeof last.content === "string" ? last.content : JSON.stringify(last.content);
      })();

      // Réponse déjà rédigée par le modèle (avec ou sans outils) → on la stream telle quelle
      if (phase1Text.trim()) {
        const chunks = phase1Text.match(/\S+\s*/g) ?? [];
        for (const chunk of chunks) { send({ type: "token", text: chunk }); await sleep(2); }
        finish(actionsEffectuees);
        return;
      }

      const prevMessages = messages.slice(0, -1)
        .filter(m => m.role !== ("system" as any))
        .map(m => ({
          role: m.role as "user" | "assistant",
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
        }));

      const synthesisMsg = toolResults.length > 0
        ? buildSynthesisUserMessage(originalQuestion, toolResults)
        : originalQuestion;

      const synthMessages: Array<{ role: "user" | "assistant"; content: string }> = [
        ...prevMessages,
        { role: "user", content: synthesisMsg },
      ];

      if (hasGemini()) {
        try {
          for await (const token of streamGemini(systemPrompt, synthMessages, 4000)) {
            send({ type: "token", text: token });
          }
          finish(actionsEffectuees);
          return;
        } catch (err: any) {
          console.warn("[stream] gemini synthesis failed:", err?.message?.slice(0, 100));
        }
      }

      // Fallback : texte phase 1 mot par mot
      if (phase1Text) {
        const chunks = phase1Text.match(/\S+\s*/g) ?? [];
        for (const chunk of chunks) { send({ type: "token", text: chunk }); await sleep(5); }
        finish(actionsEffectuees);
        return;
      }

      send({ type: "token", text: "Service IA momentanément indisponible. Réessaie dans quelques secondes." });
      finish(actionsEffectuees);
    },
  });
}
