/**
 * Server-Side Agent Loop
 *
 * Replaces the client-side while(!isComplete) loop. The server calls the model,
 * executes tools, and loops until the model is done — streaming NDJSON events
 * to the client throughout. Tool results never cross the WAF because they stay
 * server-side.
 */

import { cmsClient } from "./clients/cms.js";
import { invoke } from "./clients/gateway.js";
import { executeTool, isClientOnlyTool } from "./tool-executor.js";
import {
  insertTrace,
  extractStreamUsage,
  extractStreamToolsCalled,
  extractStreamSpans,
} from "./trace-writer.js";

const MAX_ITERATIONS = 15;

/**
 * Run the full agent loop server-side, streaming NDJSON events to the client.
 *
 * @param {object} opts
 * @param {import('express').Request} opts.req
 * @param {import('express').Response} opts.res
 * @param {object} opts.body - Resolved request body (tools, system, messages already set)
 * @param {object} opts.user - Authenticated user
 */
export async function runAgentLoop({ req, res, body, user }) {
  const startMs = Date.now();
  const agentTraceId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ip = req.ip || req.socket.remoteAddress;

  const { model, tools, system, thoughtBudget, conversationId } = body;
  let messages = body.messages;
  let iteration = 0;
  const allToolsCalled = [];

  // Set up NDJSON streaming
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Signal to the client that the agent loop is active
  writeLine(res, { agentLoopStarted: true });

  try {
    while (iteration < MAX_ITERATIONS) {
      if (res.destroyed) break;

      const traceId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const iterationStart = Date.now();

      // ── 1. Call model with streaming ────────────────────────────────
      const result = await invoke({
        userID: user.id,
        ip,
        model,
        tools,
        system,
        messages,
        thoughtBudget,
        stream: true,
        langfuseTraceId: body.langfuseTraceId,
        langfuseSessionId: body.langfuseSessionId,
        langfuseTurnLabel: body.langfuseTurnLabel,
      });

      // Handle rate limit
      if (result.status === 429) {
        writeLine(res, { error: result.error });
        break;
      }

      // ── 2. Stream model output to client, collect content ───────────
      const { contentBlocks, toolUses, stopReason, chunks } = await streamAndCollect(
        res,
        result.stream
      );

      // ── 3. Insert trace for this iteration ─────────────────────────
      const usage = extractStreamUsage(chunks);
      insertTrace({
        traceId,
        userID: user.id,
        conversationID: conversationId,
        status: "success",
        durationMs: Date.now() - iterationStart,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        toolsCalled: extractStreamToolsCalled(chunks),
        spans: extractStreamSpans(chunks),
        traceJson: { agentTraceId, iteration },
      }).catch(() => {});

      // ── 4. Build and persist assistant message ─────────────────────
      const assistantMessage = { role: "assistant", content: contentBlocks.filter(Boolean) };

      if (conversationId) {
        await cmsClient
          .addMessage(user.id, conversationId, {
            role: "assistant",
            content: assistantMessage.content,
          })
          .catch((e) => console.warn("CMS addMessage (assistant) failed:", e));
      }

      // ── 5. If no tool calls, we're done ────────────────────────────
      if (stopReason !== "tool_use" || toolUses.length === 0) break;

      // ── 6. Execute tools server-side ───────────────────────────────
      iteration++;
      const toolResults = [];

      for (const tool of toolUses) {
        if (res.destroyed) break;

        writeLine(res, { toolExec: { name: tool.name, status: "started" } });
        const toolStart = Date.now();

        let result;
        if (isClientOnlyTool(tool.name)) {
          result = {
            toolUseId: tool.toolUseId,
            content: [
              {
                text: `Tool "${tool.name}" requires browser execution and is not available in server-side agent mode.`,
              },
            ],
          };
        } else {
          result = await executeTool(tool);
        }

        const durationMs = Date.now() - toolStart;
        toolResults.push(result);
        allToolsCalled.push(tool.name);

        writeLine(res, { toolExec: { name: tool.name, status: "complete", durationMs } });
      }

      if (res.destroyed) break;

      // ── 7. Build tool results message ──────────────────────────────
      const toolResultsContent = toolResults.map((r) => ({ toolResult: r }));

      if (iteration >= MAX_ITERATIONS) {
        toolResultsContent.push({
          text: "[SYSTEM: Tool call limit reached. You MUST respond to the user now with the information you have gathered so far. Do NOT call any more tools.]",
        });
      }

      const toolResultsMessage = { role: "user", content: toolResultsContent };

      // ── 8. Persist tool results to CMS ─────────────────────────────
      if (conversationId) {
        await cmsClient
          .addMessage(user.id, conversationId, {
            role: "user",
            content: toolResultsMessage.content,
          })
          .catch((e) => console.warn("CMS addMessage (tools) failed:", e));
      }

      // ── 9. Stream loop cycle event ─────────────────────────────────
      writeLine(res, {
        loopCycle: {
          iteration,
          toolResults: toolResults.map((r, i) => ({
            toolUseId: r.toolUseId,
            name: toolUses[i]?.name,
            summary: summarizeToolResult(r),
          })),
        },
      });

      // ── 10. Update messages for next iteration ─────────────────────
      messages = [...messages, assistantMessage, toolResultsMessage];
    }

    // ── Stream completion event ────────────────────────────────────────
    writeLine(res, {
      agentComplete: {
        iterations: iteration,
        totalDurationMs: Date.now() - startMs,
        toolsCalled: allToolsCalled,
      },
    });
  } catch (error) {
    console.error("Agent loop error:", error);
    writeLine(res, { error: error.message });
  } finally {
    if (!res.destroyed) res.end();
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Write a single NDJSON line to the response. */
function writeLine(res, data) {
  if (!res.destroyed) {
    res.write(JSON.stringify(data) + "\n");
  }
}

/**
 * Stream model output to the client while collecting content blocks.
 * Returns the assembled content, tool uses, stop reason, and raw chunks.
 */
async function streamAndCollect(res, stream) {
  const contentBlocks = [];
  const chunks = [];
  let stopReason = null;

  for await (const chunk of stream) {
    chunks.push(chunk);

    // Forward to client
    try {
      if (!res.destroyed) {
        res.write(JSON.stringify(chunk) + "\n");
      }
    } catch {
      // Client disconnected — continue collecting for trace/persistence
    }

    // ── Collect content blocks ──────────────────────────────────────
    if (chunk.contentBlockStart) {
      const idx = chunk.contentBlockStart.contentBlockIndex;
      const start = chunk.contentBlockStart.start;
      if (start?.toolUse) {
        contentBlocks[idx] = {
          toolUse: {
            toolUseId: start.toolUse.toolUseId,
            name: start.toolUse.name,
            input: "",
          },
        };
      }
    }

    if (chunk.contentBlockDelta) {
      const idx = chunk.contentBlockDelta.contentBlockIndex;
      const delta = chunk.contentBlockDelta.delta;

      if (delta.text) {
        if (!contentBlocks[idx]) contentBlocks[idx] = { text: "" };
        contentBlocks[idx].text = (contentBlocks[idx].text || "") + delta.text;
      }

      if (delta.toolUse) {
        if (!contentBlocks[idx]?.toolUse) {
          contentBlocks[idx] = contentBlocks[idx] || {};
          contentBlocks[idx].toolUse = { input: "" };
        }
        contentBlocks[idx].toolUse.input += delta.toolUse.input;
      }

      if (delta.reasoningContent) {
        if (!contentBlocks[idx]?.reasoningContent) {
          contentBlocks[idx] = {
            reasoningContent: {
              reasoningText: { text: "", signature: "" },
            },
          };
        }
        const rc = contentBlocks[idx].reasoningContent;
        if (delta.reasoningContent.text) {
          rc.reasoningText.text += delta.reasoningContent.text;
        }
        if (delta.reasoningContent.signature) {
          rc.reasoningText.signature += delta.reasoningContent.signature;
        }
        if (delta.reasoningContent.redactedContent) {
          rc.redactedContent = (rc.redactedContent || "") + delta.reasoningContent.redactedContent;
        }
      }
    }

    if (chunk.messageStop) {
      stopReason = chunk.messageStop.stopReason;
    }
  }

  // Parse accumulated JSON strings into objects for tool inputs
  for (const block of contentBlocks) {
    if (block?.toolUse && typeof block.toolUse.input === "string") {
      try {
        block.toolUse.input = JSON.parse(block.toolUse.input);
      } catch (e) {
        block.toolUse.input = { error: e.message, raw: block.toolUse.input };
      }
    }
  }

  const toolUses = contentBlocks.filter((b) => b?.toolUse).map((b) => b.toolUse);
  return { contentBlocks, toolUses, stopReason, chunks };
}

/** Create a brief summary of a tool result for the loopCycle event. */
function summarizeToolResult(result) {
  const content = result.content?.[0];
  if (content?.text) return content.text.substring(0, 200);
  if (content?.json?.results) {
    const r = content.json.results;
    if (typeof r === "string") return r.substring(0, 200);
    if (r.count !== undefined) return `${r.count} results`;
    if (Array.isArray(r)) return `${r.length} items`;
    if (r.web) return `${r.web?.length || 0} web, ${r.news?.length || 0} news results`;
    if (r.document_id) return `fetched: ${r.document_id}`;
    if (r.skill) return `loaded skill: ${r.skill}`;
    if (r.thought) return "thought recorded";
    return "completed";
  }
  return "completed";
}
