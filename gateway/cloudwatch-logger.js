/**
 * CloudWatch inference logger — captures every Bedrock Converse call
 * (request + response + usage) and emits structured JSON to CloudWatch Logs.
 *
 * Works with both streaming and non-streaming calls. Non-blocking —
 * failures are logged to stderr but never affect the inference pipeline.
 */

import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  CreateLogStreamCommand,
  PutLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";

// Lazy-init: defer client creation until first use so process.env is fully loaded
let cwClient;
let initialized = false;

function getClient() {
  if (!cwClient) {
    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
    cwClient = new CloudWatchLogsClient({ region });
  }
  return cwClient;
}

function getLogGroup() {
  return process.env.CW_INFERENCE_LOG_GROUP || "/eagle/inference";
}

function isEnabled() {
  return process.env.CW_INFERENCE_LOGGING !== "false";
}

// Daily log stream: inference-YYYY-MM-DD
function streamName() {
  return `inference-${new Date().toISOString().slice(0, 10)}`;
}

async function ensureLogGroup() {
  if (initialized) return;
  const client = getClient();
  const logGroup = getLogGroup();
  try {
    await client.send(new CreateLogGroupCommand({ logGroupName: logGroup }));
  } catch (err) {
    if (err.name !== "ResourceAlreadyExistsException") throw err;
  }
  try {
    await client.send(
      new CreateLogStreamCommand({ logGroupName: logGroup, logStreamName: streamName() })
    );
  } catch (err) {
    if (err.name !== "ResourceAlreadyExistsException") throw err;
  }
  initialized = true;
}

/**
 * Emit a structured log event to CloudWatch. Fire-and-forget.
 * @param {Object} event - JSON-serializable event payload
 */
async function emit(event) {
  try {
    await ensureLogGroup();
    await getClient().send(
      new PutLogEventsCommand({
        logGroupName: getLogGroup(),
        logStreamName: streamName(),
        logEvents: [
          {
            timestamp: Date.now(),
            message: JSON.stringify(event),
          },
        ],
      })
    );
  } catch (err) {
    console.error("[cw-logger] Failed to emit:", err.message);
  }
}

/**
 * Summarize a Converse request for logging (strips large binary content).
 */
function summarizeRequest(input) {
  const summary = {
    modelId: input.modelId,
    messageCount: input.messages?.length ?? 0,
    hasSystem: !!input.system,
    hasTools: !!input.toolConfig?.tools?.length,
    toolCount: input.toolConfig?.tools?.filter((t) => t.toolSpec)?.length ?? 0,
    hasThinking: !!input.additionalModelRequestFields?.thinking,
  };

  // Capture the last user message text (truncated) for debugging
  const lastUserMsg = [...(input.messages || [])].reverse().find((m) => m.role === "user");
  if (lastUserMsg) {
    const textContent = lastUserMsg.content?.find((c) => c.text);
    if (textContent) {
      summary.lastUserMessage = textContent.text.slice(0, 500);
    }
  }

  return summary;
}

/**
 * Log a non-streaming Converse call.
 * @param {Object} input - ConverseCommandInput
 * @param {Object} response - ConverseCommandOutput
 * @param {number} durationMs - Wall-clock time
 */
export function logConverse(input, response, durationMs) {
  if (!isEnabled()) return;

  // Extract tool calls from the response
  const toolsInvoked = (response.output?.message?.content ?? [])
    .filter((c) => c.toolUse)
    .map((c) => ({ name: c.toolUse.name, toolUseId: c.toolUse.toolUseId }));

  const event = {
    type: "converse",
    timestamp: new Date().toISOString(),
    durationMs,
    request: summarizeRequest(input),
    usage: response.usage ?? null,
    stopReason: response.stopReason ?? null,
    toolsInvoked: toolsInvoked.length > 0 ? toolsInvoked : undefined,
    responseContentTypes: response.output?.message?.content?.map(
      (c) => Object.keys(c).find((k) => k !== "undefined") ?? "unknown"
    ),
  };

  emit(event);
}

/**
 * Log a streaming ConverseStream call (called after stream completes).
 * @param {Object} input - ConverseStreamCommandInput
 * @param {Object} streamResult - Aggregated stream metadata
 * @param {number} durationMs - Wall-clock time
 */
export function logConverseStream(input, streamResult, durationMs) {
  if (!isEnabled()) return;

  const event = {
    type: "converseStream",
    timestamp: new Date().toISOString(),
    durationMs,
    request: summarizeRequest(input),
    usage: streamResult.usage ?? null,
    stopReason: streamResult.stopReason ?? null,
    toolsInvoked: streamResult.toolsInvoked?.length > 0 ? streamResult.toolsInvoked : undefined,
    chunkCount: streamResult.chunkCount ?? 0,
  };

  emit(event);
}
