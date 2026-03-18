/**
 * Langfuse Tracing Integration
 *
 * Instruments model inference calls with Langfuse traces using the
 * proper hierarchical format expected by EAGLE's Langfuse dashboard.
 *
 * Hierarchy (matches Strands OTEL format):
 *   Session    = conversation (groups traces via sessionId)
 *   Trace      = one user turn (may have multiple LLM calls from tool loops)
 *   AGENT span = root observation wrapping the full request
 *   SPAN       = one event loop cycle (one per model call in a tool loop)
 *   GENERATION = one LLM call (Bedrock ConverseStream)
 *   TOOL       = one tool execution (sibling of GENERATION under SPAN)
 *
 * Disabled gracefully when LANGFUSE_SECRET_KEY is not set.
 */

import { readFileSync } from "fs";

import { Langfuse } from "langfuse";

let langfuse = null;

// App version for trace tagging
const APP_VERSION = (() => {
  try {
    return JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;
  } catch {
    return "unknown";
  }
})();

/**
 * Track agent state across multiple model calls in a single tool loop.
 * Key: traceId, Value: { agentSpanId, cycleCount }
 * Entries are cleaned up when the agent trace ends (stopReason !== "tool_use").
 */
const activeAgents = new Map();

// Clean up stale entries after 10 minutes (safety net for abandoned traces)
const STALE_TIMEOUT_MS = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [id, state] of activeAgents) {
    if (now - state.createdAt > STALE_TIMEOUT_MS) activeAgents.delete(id);
  }
}, 60_000).unref();

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
 * Start or continue a hierarchical trace for a user turn.
 *
 * Creates the full observation hierarchy:
 *   Trace → AGENT span → SPAN (cycle) → GENERATION
 *
 * On subsequent calls with the same traceId (tool loop iterations),
 * the trace and AGENT span are upserted; a new cycle SPAN + GENERATION is created.
 *
 * @param {Object} params
 * @param {string} params.model - Bedrock model ID
 * @param {string} [params.userID] - User ID
 * @param {string} [params.sessionId] - Conversation ID (groups traces into sessions)
 * @param {string} [params.traceId] - Turn ID (groups cycles into one trace)
 * @param {string} [params.turnLabel] - Human-readable label for this turn
 * @param {Object} [params.input] - Messages sent to the model
 * @param {Object} [params.metadata] - Additional metadata
 * @returns {{ trace, agentSpan, cycleSpan, generation, traceId }|null}
 */
export function startTrace({ model, userID, sessionId, traceId, turnLabel, input, metadata = {} }) {
  const lf = getLangfuse();
  if (!lf) return null;

  const env = process.env.TIER || process.env.NODE_ENV || "local";
  const isFirstCycle = !activeAgents.has(traceId);

  // 1. Trace (upsert — Langfuse merges by ID)
  const trace = lf.trace({
    id: traceId || undefined,
    name: "invoke_agent Research Optimizer",
    userId: userID ? String(userID) : undefined,
    sessionId: sessionId || undefined,
    input: isFirstCycle ? input : undefined,
    version: APP_VERSION,
    metadata: {
      "eagle.user_id": userID ? String(userID) : undefined,
      "eagle.session_id": sessionId || undefined,
      "eagle.tier": metadata.tier || "basic",
      "gen_ai.request.model": model,
      "gen_ai.agent.tools": metadata.toolNames ? JSON.stringify(metadata.toolNames) : undefined,
      app: "research-optimizer",
      environment: env,
    },
    tags: ["research-optimizer", `env:${env}`],
  });

  // 2. AGENT root span (upsert via deterministic ID across cycles)
  let state = activeAgents.get(traceId);
  if (!state) {
    state = { agentSpanId: `${traceId}-agent`, cycleCount: 0, createdAt: Date.now() };
    activeAgents.set(traceId, state);
  }
  state.cycleCount++;

  const agentSpan = trace.span({
    id: state.agentSpanId,
    name: "invoke_agent Research Optimizer",
    input: isFirstCycle ? input : undefined,
  });

  // 3. SPAN per event loop cycle
  const cycleSpan = agentSpan.span({
    name: "execute_event_loop_cycle",
    metadata: { cycle: state.cycleCount },
  });

  // 4. GENERATION under the cycle span
  const generation = cycleSpan.generation({
    name: "chat",
    model,
    input: input || undefined,
    metadata: { stream: metadata.stream ?? false },
  });

  return { trace, agentSpan, cycleSpan, generation, traceId };
}

/**
 * Create a TOOL observation under the current cycle span.
 * Call this when a tool_use block is detected in the LLM output stream.
 *
 * @param {Object} cycleSpan - The current cycle's SPAN handle
 * @param {Object} params
 * @param {string} params.name - Tool function name
 * @param {*} [params.input] - Tool input (if available)
 * @returns {Object|null} Tool span handle (call .end() when done)
 */
export function addToolSpan(cycleSpan, { name, input }) {
  if (!cycleSpan) return null;
  return cycleSpan.span({ name, input: input || undefined });
}

/**
 * Classify an error message into a category for Langfuse tagging/filtering.
 * Network/infra errors are tagged so they can be filtered out of dashboards.
 */
const ERROR_PATTERNS = [
  {
    pattern: /token has expired|refresh failed|ExpiredToken/i,
    category: "sso-expired",
    severity: "infra",
  },
  {
    pattern: /UnrecognizedClientException|InvalidIdentityToken/i,
    category: "credentials-invalid",
    severity: "infra",
  },
  {
    pattern: /ThrottlingException|rate limit|too many requests/i,
    category: "throttled",
    severity: "infra",
  },
  {
    pattern: /ModelNotReadyException|cold start/i,
    category: "model-cold-start",
    severity: "infra",
  },
  {
    pattern: /AccessDeniedException|not authorized|forbidden/i,
    category: "access-denied",
    severity: "infra",
  },
  {
    pattern: /ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EPIPE/i,
    category: "network-error",
    severity: "infra",
  },
  {
    pattern: /socket hang up|network|fetch failed|abort/i,
    category: "network-error",
    severity: "infra",
  },
  { pattern: /CERT_|certificate|TLS|SSL/i, category: "tls-error", severity: "infra" },
  {
    pattern: /ResourceNotFoundException|model.*not found/i,
    category: "model-not-found",
    severity: "config",
  },
  { pattern: /ValidationException/i, category: "validation-error", severity: "app" },
];

export function classifyError(message) {
  if (!message) return { category: "unknown", severity: "app" };
  for (const { pattern, category, severity } of ERROR_PATTERNS) {
    if (pattern.test(message)) return { category, severity };
  }
  return { category: "unknown", severity: "app" };
}

/**
 * End a generation and its parent spans.
 *
 * Ends the GENERATION with usage data, then:
 * - Always ends the cycle SPAN
 * - If stopReason !== "tool_use" (final response), also ends the AGENT span,
 *   updates the trace output, and cleans up state.
 * - If level is ERROR, classifies the error and tags the trace for filtering.
 *
 * @param {Object} generation - Langfuse generation handle
 * @param {Object} opts
 * @param {Object} [opts.trace] - Trace handle (to update output)
 * @param {Object} [opts.agentSpan] - AGENT span handle (to end on final response)
 * @param {Object} [opts.cycleSpan] - Cycle SPAN handle (always ended)
 * @param {string} [opts.traceId] - Trace ID (for state cleanup)
 * @param {Object} [opts.usage] - Token usage { inputTokens, outputTokens, cacheReadInputTokens }
 * @param {string} [opts.stopReason] - Stop reason (end_turn, tool_use, etc.)
 * @param {*} [opts.output] - Model output content
 * @param {string} [opts.level] - "DEFAULT" | "ERROR"
 * @param {string} [opts.statusMessage] - Error message if level is ERROR
 */
export function endGeneration(generation, opts = {}) {
  const { usage, stopReason, output, level, statusMessage, trace, agentSpan, cycleSpan, traceId } =
    opts;
  if (!generation) return;

  // Classify errors for tagging
  const errorInfo = level === "ERROR" ? classifyError(statusMessage) : null;

  const langfuseUsage = usage
    ? {
        input: usage.inputTokens || 0,
        output: usage.outputTokens || 0,
        total: (usage.inputTokens || 0) + (usage.outputTokens || 0),
      }
    : undefined;

  // End the GENERATION
  generation.end({
    output: output || stopReason || undefined,
    usage: langfuseUsage,
    level: level || "DEFAULT",
    statusMessage: statusMessage || undefined,
    metadata: {
      stopReason,
      cacheReadTokens: usage?.cacheReadInputTokens || 0,
      cacheWriteTokens: usage?.cacheWriteInputTokens || 0,
      ...(errorInfo && { errorCategory: errorInfo.category, errorSeverity: errorInfo.severity }),
    },
  });

  // End the cycle SPAN
  if (cycleSpan) {
    cycleSpan.end({
      output: stopReason || undefined,
      ...(errorInfo && {
        level: "ERROR",
        statusMessage: `[${errorInfo.category}] ${statusMessage}`,
      }),
    });
  }

  // On final response (not tool_use), finalize everything
  if (stopReason !== "tool_use") {
    if (agentSpan) {
      agentSpan.end({
        output: output ? { message: output, finish_reason: stopReason } : undefined,
        ...(errorInfo && {
          level: "ERROR",
          statusMessage: `[${errorInfo.category}] ${statusMessage}`,
        }),
      });
    }
    if (trace) {
      const traceUpdate = {};
      if (output) traceUpdate.output = { message: output, finish_reason: stopReason };
      // Tag errors on the trace for Langfuse filtering
      if (errorInfo) {
        traceUpdate.tags = [
          "research-optimizer",
          `error:${errorInfo.category}`,
          `severity:${errorInfo.severity}`,
        ];
        traceUpdate.metadata = {
          errorCategory: errorInfo.category,
          errorSeverity: errorInfo.severity,
          errorMessage: statusMessage?.substring(0, 500),
        };
      }
      if (Object.keys(traceUpdate).length) trace.update(traceUpdate);
    }
    // Clean up agent state
    if (traceId) activeAgents.delete(traceId);
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
