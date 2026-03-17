import db, { Trace } from "database";

/** Resolve environment tag: TIER (infra) > NODE_ENV > "local" */
const APP_ENV = process.env.TIER || process.env.NODE_ENV || "local";

/**
 * Insert a trace row into the database. Fire-and-forget safe.
 */
export async function insertTrace(data) {
  await db.insert(Trace).values({
    traceId: data.traceId,
    userID: data.userID || null,
    conversationID: data.conversationID || null,
    durationMs: data.durationMs || null,
    inputTokens: data.inputTokens || null,
    outputTokens: data.outputTokens || null,
    cost: data.cost || null,
    status: data.status || "success",
    toolsCalled: data.toolsCalled || [],
    spans: data.spans || [],
    traceJson: data.traceJson || {},
    environment: data.environment || APP_ENV,
  });
}

/** Extract tool names from a non-streaming response */
export function extractToolsCalled(result) {
  if (!result?.content) return [];
  return result.content.filter((block) => block.type === "tool_use").map((block) => block.name);
}

/** Extract usage from stream chunks (look for message_delta with usage) */
export function extractStreamUsage(chunks) {
  let inputTokens = 0;
  let outputTokens = 0;
  for (const chunk of chunks) {
    if (chunk?.usage) {
      inputTokens = chunk.usage.input_tokens || inputTokens;
      outputTokens = chunk.usage.output_tokens || outputTokens;
    }
    if (chunk?.message?.usage) {
      inputTokens = chunk.message.usage.input_tokens || inputTokens;
      outputTokens = chunk.message.usage.output_tokens || outputTokens;
    }
  }
  return { inputTokens, outputTokens };
}

/** Extract tool names from stream chunks */
export function extractStreamToolsCalled(chunks) {
  const tools = new Set();
  for (const chunk of chunks) {
    if (chunk?.type === "content_block_start" && chunk?.content_block?.type === "tool_use") {
      tools.add(chunk.content_block.name);
    }
  }
  return [...tools];
}

/** Build spans from stream chunks (tool_use blocks) */
export function extractStreamSpans(chunks) {
  const spans = [];
  let currentTool = null;
  let toolStartIdx = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (chunk?.type === "content_block_start" && chunk?.content_block?.type === "tool_use") {
      currentTool = { name: chunk.content_block.name, type: "tool_use", startIdx: i };
      toolStartIdx = i;
    }
    if (chunk?.type === "content_block_stop" && currentTool) {
      spans.push({
        name: currentTool.name,
        type: currentTool.type,
        startIdx: currentTool.startIdx,
        endIdx: i,
      });
      currentTool = null;
    }
  }
  return spans;
}
