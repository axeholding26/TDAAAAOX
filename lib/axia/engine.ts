/**
 * Axia — moteur d'orchestration robuste (Gemini exclusif, @google/genai)
 *
 * Objectif : tant que l'appel API Gemini aboutit, Axia produit toujours une
 * réponse de qualité — jamais de réponse vide, jamais de crash silencieux.
 *
 * Garanties :
 * - Retry automatique sur erreurs transitoires (429/5xx/réseau)
 * - Deadline stricte par appel pour ne jamais dépasser le budget de la route
 * - Réponse finale JAMAIS vide (fallback déterministe sur les résultats d'outils)
 * - Exécution d'outil isolée : un outil qui échoue ne fait pas planter la conversation
 */
import { hasGemini, completionWithToolsAuto, streamGemini, type ToolDefinition } from "@/lib/llm-client";

export type AxiaTool = ToolDefinition;
export interface AxiaResult { reponse: string; actions: string[]; }
export type ToolExecutor = (
  name: string,
  args: Record<string, any>,
  tenantId: string
) => Promise<{ succes: boolean; resultat: string }>;

export interface AxiaRunOptions {
  maxIterations?: number;
  toolDeadlineMs?: number;
  synthesisDeadlineMs?: number;
  retryAttempts?: number;
}

const DEFAULTS: Required<AxiaRunOptions> = {
  maxIterations: 6,
  toolDeadlineMs: 45_000,
  synthesisDeadlineMs: 25_000,
  retryAttempts: 2,
};

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function isRetriable(err: any): boolean {
  const msg = String(err?.message ?? err ?? "");
  return /429|500|502|503|504|fetch failed|ECONNRESET|ETIMEDOUT|network|timeout|overloaded/i.test(msg);
}

async function withRetry<T>(fn: () => Promise<T>, attempts: number, baseDelayMs = 350): Promise<T> {
  let lastErr: any;
  for (let i = 0; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      if (!isRetriable(err) || i === attempts) throw err;
      await sleep(baseDelayMs * Math.pow(2, i));
    }
  }
  throw lastErr;
}

function withDeadline<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`TIMEOUT:${label}`)), ms);
    promise.then(
      v => { clearTimeout(timer); resolve(v); },
      e => { clearTimeout(timer); reject(e); }
    );
  });
}

function buildSynthesisUserMessage(originalQuestion: string, toolResults: string[]): string {
  if (toolResults.length === 0) return originalQuestion;
  const ctx = toolResults.join("\n\n");
  return `${originalQuestion}\n\n---\nContexte (utilise-le pour répondre, ne le répète pas) :\n${ctx}`;
}

function fallbackReponse(toolResults: string[], phase1Text: string): string {
  if (phase1Text.trim()) return phase1Text;
  if (toolResults.length > 0) return toolResults.join("\n\n");
  return "Je n'ai pas pu traiter ta demande à l'instant — réessaie dans un instant.";
}

// ─── Phase 1 : boucle d'exécution d'outils ────────────────────────────────────

async function toolPhase(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  tools: AxiaTool[],
  tenantId: string,
  executeOutil: ToolExecutor,
  opts: Required<AxiaRunOptions>
) {
  const start = Date.now();
  const actionsEffectuees: string[] = [];
  const toolResults: string[] = [];
  let phase1Text = "";

  try {
    const conversation: any[] = [{ role: "system", content: systemPrompt }, ...messages];

    for (let i = 0; i < opts.maxIterations; i++) {
      if (Date.now() - start > opts.toolDeadlineMs) break;

      let result;
      try {
        result = await withDeadline(
          withRetry(() => completionWithToolsAuto(conversation, tools, 4000, false), opts.retryAttempts),
          Math.max(8_000, opts.toolDeadlineMs - (Date.now() - start)),
          "tool_call"
        );
      } catch (err: any) {
        console.warn("[axia] tool_call abandonné:", err?.message?.slice(0, 100));
        break;
      }

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
          let resultat: string;
          try {
            // 35s : suffisant pour une exécution normale et pour une délégation imbriquée (elle-même plafonnée à ~30s)
            const r = await withDeadline(executeOutil(tc.name, tc.arguments, tenantId), 35_000, `exec:${tc.name}`);
            resultat = r.resultat;
          } catch (err: any) {
            resultat = `L'action "${tc.name}" a échoué : ${err?.message?.slice(0, 100) ?? "erreur inconnue"}`;
          }
          actionsEffectuees.push(resultat);
          toolResults.push(resultat);
          conversation.push({ role: "tool", tool_call_id: tc.id, content: resultat });
        }
        continue;
      }

      break;
    }
  } catch (err: any) {
    console.warn("[axia] tool phase:", err?.message?.slice(0, 100));
  }

  return { actionsEffectuees, toolResults, phase1Text };
}

// ─── runAxia (non-streaming) ────────────────────────────────────────────────────

export async function runAxia(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  tools: AxiaTool[],
  tenantId: string,
  executeOutil: ToolExecutor,
  options: AxiaRunOptions = {}
): Promise<AxiaResult> {
  const opts = { ...DEFAULTS, ...options };
  const { actionsEffectuees, toolResults, phase1Text } = await toolPhase(systemPrompt, messages, tools, tenantId, executeOutil, opts);

  // Réponse directe sans outil : pas besoin de re-synthèse
  if (phase1Text && toolResults.length === 0) {
    return { reponse: phase1Text, actions: actionsEffectuees };
  }

  const originalQ = messages[messages.length - 1]?.content ?? "";
  const synthMsg = buildSynthesisUserMessage(originalQ, toolResults);
  const prevMessages = messages.slice(0, -1).map(m => ({ role: m.role, content: m.content }));
  const synthMessages = [...prevMessages, { role: "user" as const, content: synthMsg }];

  if (hasGemini()) {
    try {
      const reponse = await withDeadline(
        withRetry(async () => {
          let acc = "";
          for await (const token of streamGemini(systemPrompt, synthMessages, 4000)) acc += token;
          if (!acc.trim()) throw new Error("EMPTY_SYNTHESIS");
          return acc;
        }, opts.retryAttempts),
        opts.synthesisDeadlineMs,
        "synthesis"
      );
      return { reponse, actions: actionsEffectuees };
    } catch (err: any) {
      console.warn("[axia] synthesis échouée:", err?.message?.slice(0, 100));
    }
  }

  return { reponse: fallbackReponse(toolResults, phase1Text), actions: actionsEffectuees };
}

// ─── runAxiaStream (SSE) ─────────────────────────────────────────────────────

export function runAxiaStream(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string | any[] }>,
  tools: AxiaTool[],
  tenantId: string,
  executeOutil: ToolExecutor,
  options: AxiaRunOptions = {}
): ReadableStream<Uint8Array> {
  const opts = { ...DEFAULTS, ...options };
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

      const flatMessages = messages.map(m => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      })) as Array<{ role: "user" | "assistant"; content: string }>;

      const { actionsEffectuees, toolResults, phase1Text } = await toolPhase(systemPrompt, flatMessages, tools, tenantId, executeOutil, opts);

      // Réponse directe sans outil → on la stream mot par mot
      if (phase1Text && toolResults.length === 0) {
        const chunks = phase1Text.match(/\S+\s*/g) ?? [];
        for (const chunk of chunks) { send({ type: "token", text: chunk }); await sleep(2); }
        finish(actionsEffectuees);
        return;
      }

      const originalQuestion = flatMessages[flatMessages.length - 1]?.content ?? "";
      const prevMessages = flatMessages.slice(0, -1);
      const synthesisMsg = toolResults.length > 0 ? buildSynthesisUserMessage(originalQuestion, toolResults) : originalQuestion;
      const synthMessages: Array<{ role: "user" | "assistant"; content: string }> = [...prevMessages, { role: "user", content: synthesisMsg }];

      if (hasGemini()) {
        try {
          let gotToken = false;
          await withDeadline((async () => {
            for await (const token of streamGemini(systemPrompt, synthMessages, 4000)) {
              gotToken = true;
              send({ type: "token", text: token });
            }
          })(), opts.synthesisDeadlineMs, "stream_synthesis");
          if (gotToken) { finish(actionsEffectuees); return; }
        } catch (err: any) {
          console.warn("[axia] stream synthesis échouée:", err?.message?.slice(0, 100));
        }
      }

      // Garantie de non-vacuité : fallback déterministe
      const fallback = fallbackReponse(toolResults, phase1Text);
      const chunks = fallback.match(/\S+\s*/g) ?? [fallback];
      for (const chunk of chunks) { send({ type: "token", text: chunk }); await sleep(4); }
      finish(actionsEffectuees);
    },
  });
}
