/**
 * Langfuse Tracing Integration
 *
 * Instruments model inference calls with Langfuse traces.
 * Disabled gracefully when LANGFUSE_SECRET_KEY is not set.
 *
 * Hierarchy:
 *   Session  = conversation (groups traces)
 *   Trace    = one user turn (may have multiple LLM calls from tool loops)
 *   Generation = one LLM call
 */

import { Langfuse } from "langfuse";

let langfuse = null;

/**
 * Initialize the Langfuse client (singleton).
 * Returns null if credentials are missing — callers should handle gracefully.
 */
export function getLangfuse() {
  if (langfuse) return langfuse;

  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  if (!secretKey || !publicKey) return null;

  const baseUrl = process.env.LANGFUSE_HOST || "https://us.cloud.langfuse.com";

  langfuse = new Langfuse({ secretKey, publicKey, baseUrl });
  console.log("[Langfuse] Tracing enabled →", baseUrl);
  return langfuse;
}

/**
 * Start (or reuse) a Langfuse trace and create a new generation within it.
 *
 * When traceId is provided, Langfuse merges calls with the same ID into one
 * trace — so multiple model calls in a tool loop become generations under a
 * single trace.
 *
 * @param {Object} params
 * @param {string} params.model - Model ID
 * @param {string} [params.userID] - User ID
 * @param {string} [params.sessionId] - Conversation ID (groups traces)
 * @param {string} [params.traceId] - Turn ID (groups generations)
 * @param {string} [params.turnLabel] - Human-readable label for this turn
 * @param {Object} [params.input] - Messages sent to the model
 * @param {Object} [params.metadata] - Additional metadata
 * @returns {{ trace, generation }|null}
 */
export function startTrace({ model, userID, sessionId, traceId, turnLabel, input, metadata = {} }) {
  const lf = getLangfuse();
  if (!lf) return null;

  const trace = lf.trace({
    id: traceId || undefined,
    name: turnLabel || "model-inference",
    userId: userID || undefined,
    sessionId: sessionId || undefined,
    input: input || undefined,
    metadata: { ...metadata, app: "research-optimizer" },
    tags: ["research-optimizer"],
  });

  const generation = trace.generation({
    name: `llm-call [${model.split(".").pop()}]`,
    model,
    input: input || undefined,
    metadata: { stream: metadata.stream ?? false },
  });

  return { trace, generation };
}

/**
 * End a generation with usage data and output.
 *
 * @param {Object} generation - Langfuse generation object
 * @param {Object} params
 * @param {Object} [params.trace] - Parent trace (to update with output)
 * @param {Object} [params.usage] - Token usage { inputTokens, outputTokens, cacheReadInputTokens }
 * @param {string} [params.stopReason] - Stop reason (end_turn, tool_use, etc.)
 * @param {Object} [params.output] - Model output content
 * @param {string} [params.level] - "DEFAULT" | "ERROR"
 * @param {string} [params.statusMessage] - Error message if level is ERROR
 */
export function endGeneration(
  generation,
  { usage, stopReason, output, level, statusMessage, trace } = {}
) {
  if (!generation) return;

  const langfuseUsage = usage
    ? {
        input: usage.inputTokens || 0,
        output: usage.outputTokens || 0,
        total: (usage.inputTokens || 0) + (usage.outputTokens || 0),
      }
    : undefined;

  generation.end({
    usage: langfuseUsage,
    output: output || stopReason || undefined,
    level: level || "DEFAULT",
    statusMessage: statusMessage || undefined,
    metadata: {
      stopReason,
      cacheReadTokens: usage?.cacheReadInputTokens || 0,
      cacheWriteTokens: usage?.cacheWriteInputTokens || 0,
    },
  });

  // Update trace output on final response (end_turn), not intermediate tool_use turns
  if (trace && output && stopReason !== "tool_use") {
    trace.update({ output });
  }
}

/**
 * Flush pending events to Langfuse. Call on process shutdown.
 */
export async function flushLangfuse() {
  if (langfuse) {
    await langfuse.flushAsync();
  }
}
