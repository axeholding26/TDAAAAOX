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
  return `${originalQuestion}\n\n---\nContexte (utilise-le pour répondre, ne le répète pas) :\n${ctx}`;
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
    let toolsUsed = false;

    for (let i = 0; i < maxIterations; i++) {
      const result = await completionWithToolsAuto(conversation, tools, 4000, false);
      if (result.stopReason === "end_turn") {
        if (!toolsUsed) return { reponse: result.text ?? "", actions: actionsEffectuees };
        break;
      }
      if (result.stopReason === "tool_use" && result.toolCalls?.length) {
        toolsUsed = true;
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
              const { succes, resultat } = await executeOutil(tc.name, tc.arguments, tenantId);
              actionsEffectuees.push(resultat);
              toolResults.push(resultat);
              conversation.push({ role: "tool", tool_call_id: tc.id, content: resultat });
            }
            const origQ = messages[messages.length - 1];
            if (origQ) {
              const q = typeof origQ.content === "string" ? origQ.content : JSON.stringify(origQ.content);
              conversation.push({ role: "user", content: `Réponds directement à ma question : "${q}"` });
            }
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

      // Si Phase 1 a répondu sans utiliser d'outil → streamer directement, pas besoin de re-synthèse
      if (phase1Text && toolResults.length === 0) {
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
