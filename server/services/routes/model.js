import { appendFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { json, Router } from "express";

import { runAgentLoop } from "../agent-loop.js";
import { chatConfigs } from "../chat-config.js";
import { cmsClient } from "../clients/cms.js";
import { invoke, listModels } from "../clients/gateway.js";
import { requireRole } from "../middleware.js";
import {
  insertTrace,
  extractToolsCalled,
  extractStreamUsage,
  extractStreamToolsCalled,
  extractStreamSpans,
} from "../trace-writer.js";
import { createHttpError } from "../utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENT_LOOP_ENABLED = process.env.AGENT_LOOP_ENABLED !== "false"; // on by default
const TRACE_DIR = join(__dirname, "..", "..", "..", "traces");
const TRACE_ENABLED = process.env.TRACE_INFERENCE !== "false"; // on by default

async function writeTrace(entry) {
  if (!TRACE_ENABLED) return;
  await mkdir(TRACE_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const file = join(TRACE_DIR, `inference-${date}.jsonl`);
  await appendFile(file, JSON.stringify(entry) + "\n");
}

const api = Router();
api.use(json({ limit: 1024 ** 3 })); // 1GB

api.post("/model", requireRole(), async (req, res, next) => {
  const user = req.session?.user;
  if (!user) return res.status(401).json({ error: "Authentication required" });
  const ip = req.ip || req.socket.remoteAddress;
  const traceId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    // Resolve server-side chat config (tools + system prompt) when chatConfig is set.
    // This keeps the client request body small enough to pass through the WAF (< 8 KB).
    if (req.body.chatConfig && chatConfigs[req.body.chatConfig]) {
      const cfg = chatConfigs[req.body.chatConfig];
      req.body.tools = cfg.tools;
      req.body.system = cfg.systemPrompt(req.body.context || {});
      delete req.body.context;
      delete req.body.chatConfig;
    }

    // Resolve messages from server-side conversation when conversationId is provided.
    // This avoids sending the full message history in the POST body (WAF 8KB limit).
    if (req.body.conversationId && !req.body.messages) {
      const dbMessages = await cmsClient.getMessages(user.id, req.body.conversationId);
      if (!dbMessages?.length) {
        return res.status(400).json({ error: "No messages found for conversation" });
      }
      req.body.messages = dbMessages.map((m) => ({ role: m.role, content: m.content }));
    }

    // When agentLoop is requested, run the full tool loop server-side.
    // Tool results stay on the server — never cross the WAF.
    if (req.body.agentLoop && AGENT_LOOP_ENABLED) {
      await writeTrace({
        traceId,
        type: "agent-loop-request",
        timestamp: new Date().toISOString(),
        userID: user.id,
        model: req.body.model,
        conversationId: req.body.conversationId,
        messageCount: req.body.messages?.length,
      });
      return runAgentLoop({ req, res, body: req.body, user });
    }

    // Log the request
    await writeTrace({
      traceId,
      type: "request",
      timestamp: new Date().toISOString(),
      userID: user.id,
      model: req.body.model,
      stream: req.body.stream ?? false,
      system: req.body.system,
      tools: req.body.tools,
      messages: req.body.messages,
      thoughtBudget: req.body.thoughtBudget,
    });

    const result = await invoke({
      userID: user.id,
      ip,
      ...req.body,
      // Langfuse trace context — allows callers to group model calls
      langfuseTraceId: req.body.langfuseTraceId,
      langfuseSessionId: req.body.langfuseSessionId,
      langfuseTurnLabel: req.body.langfuseTurnLabel,
    });

    // Handle rate limit error
    if (result.status === 429) {
      return res.status(429).json({ error: result.error });
    }

    // For non-streaming responses
    if (!result?.stream) {
      await writeTrace({ traceId, type: "response", timestamp: new Date().toISOString(), result });
      insertTrace({
        traceId,
        userID: user.id,
        status: "success",
        durationMs: Date.now() - parseInt(traceId),
        inputTokens: result?.usage?.input_tokens,
        outputTokens: result?.usage?.output_tokens,
        toolsCalled: extractToolsCalled(result),
        traceJson: { request: req.body, response: result },
      }).catch(() => {});
      return res.json(result);
    }

    // For streaming responses — collect chunks for trace
    const startMs = Date.now();
    const chunks = [];
    for await (const message of result.stream) {
      try {
        chunks.push(message);
        res.write(JSON.stringify(message) + "\n");
      } catch (err) {
        console.error("Error processing stream message:", err);
      }
    }

    await writeTrace({
      traceId,
      type: "stream-response",
      timestamp: new Date().toISOString(),
      chunks,
    });

    // Insert trace row from stream chunks
    const usage = extractStreamUsage(chunks);
    insertTrace({
      traceId,
      userID: user.id,
      status: "success",
      durationMs: Date.now() - startMs,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      toolsCalled: extractStreamToolsCalled(chunks),
      spans: extractStreamSpans(chunks),
      traceJson: { request: req.body, chunks },
    }).catch(() => {});

    res.end();
  } catch (error) {
    console.error("Error in model API:", error);
    await writeTrace({
      traceId,
      type: "error",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
    insertTrace({
      traceId,
      userID: user.id,
      status: "error",
      durationMs: Date.now() - parseInt(traceId),
      traceJson: { request: req.body, error: error.message },
    }).catch(() => {});
    next(createHttpError(500, error, "An error occurred while processing the model request"));
  }
});

api.get("/model/list", requireRole(), async (req, res, next) => {
  try {
    const results = await listModels();
    res.json(results);
  } catch (error) {
    console.error("Error listing models:", error);
    next(createHttpError(500, error, "An error occurred while fetching models"));
  }
});

export default api;
