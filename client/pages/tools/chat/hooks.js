import { createSignal } from "solid-js";
import { createStore, unwrap } from "solid-js/store";

import { getDB } from "../../../models/database.js";
import { MODEL_OPTIONS } from "../../../models/model-options.js";
import { handleError, handleHttpError, showError } from "../../../utils/alerts.js";
import { readStream } from "../../../utils/files.js";
import { fileToBase64, splitFilename } from "../../../utils/parsers.js";
import { getClientContext, runTool } from "../../../utils/tools.js";
import { jsonToXml } from "../../../utils/xml.js";

import { systemPrompt, tools } from "./config.js";

/**
 * Normalize message content to array format, handling various edge cases
 * @param {any} content - Raw content from storage
 * @returns {Array} - Normalized content array
 */
export function normalizeMessageContent(content) {
  // Handle null/undefined
  if (content === null || content === undefined) {
    return [{ text: "" }];
  }

  // If already an array, return as-is
  if (Array.isArray(content)) {
    return content.length > 0 ? content : [{ text: "" }];
  }

  // If it's a string, try to parse as JSON first
  if (typeof content === "string") {
    // Empty string
    if (content.trim() === "") {
      return [{ text: "" }];
    }

    // Try JSON parsing
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.length > 0 ? parsed : [{ text: "" }];
      }
      // If parsed but not array, treat as text
      return [{ text: String(parsed) }];
    } catch (_error) {
      // Not JSON, treat as plain text
      return [{ text: content }];
    }
  }

  // For any other type, convert to string
  return [{ text: String(content) }];
}

/**
 * Sanitize generated title to ensure it is in the right format.
 *
 * @param {*} rawTitle - The raw title string to sanitize.
 * @returns {string} - The sanitized title, or empty string if invalid.
 */
function sanitizeTitle(rawTitle) {
  if (!rawTitle || typeof rawTitle !== "string") {
    return "";
  }

  // Remove line breaks and trim
  let title = String(rawTitle).replace(/\r?\n|\r/g, " ");
  title = title.replace(/\s+/g, " ").trim();

  // Remove all non-alphanumeric characters except spaces
  title = title.replace(/[^a-zA-Z0-9 ]/g, "");

  // Collapse spaces again after stripping
  title = title.replace(/\s+/g, " ").trim();

  if (!title) {
    return "";
  }

  return title.slice(0, 30);
}

/**
 * Get current project ID from URL
 * @returns {string} - "2" for FedPulse, "1" for Default
 */
function getCurrentProjectId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("fedpulse") === "1" ? "2" : "1";
}

export function useChat() {
  const [messages, setMessages] = createStore([]);
  const [conversation, setConversation] = createStore({ id: null, title: "", messages });
  const [conversations, setConversations] = createStore([]);
  const [loading, setLoading] = createSignal(false);
  const [userEmail, setUserEmail] = createSignal(null);
  const [db, setDB] = createSignal(null);
  const [serverConversationId, setServerConversationId] = createSignal(null);

  // Initialize user session and database
  const initializeDatabase = async () => {
    try {
      const { user } = await fetch("/api/v1/session").then((res) => res.json());
      if (user?.email) {
        setUserEmail(user.email);
        const database = await getDB(user.email);
        setDB(database);

        // Load conversation from URL if present
        const urlParams = new URLSearchParams(window.location.search);
        const conversationId = urlParams.get("id");
        if (conversationId) {
          await loadConversation(conversationId);
        }

        // Load recent conversations for sidebar
        await loadRecentConversations();
      }
    } catch (error) {
      console.error("Failed to initialize database:", error);
      const wrappedError = new Error("Something went wrong while initializing your session.");
      wrappedError.cause = error;
      handleError(wrappedError, "Session Initialization Error");
    }
  };

  // Initialize on mount
  initializeDatabase();

  // Load conversation from database
  const loadConversation = async (conversationId) => {
    const database = db();
    if (!database) return;

    try {
      const conv = await database.getConversation(conversationId);
      if (conv) {
        setConversation({
          id: conv.id,
          title: conv.title,
          projectId: conv.projectId,
        });

        // Load messages for this conversation
        const msgs = await database.getMessages(conversationId);
        const normalizedMsgs = msgs.map((msg) => {
          const content = normalizeMessageContent(msg.content);
          return {
            role: msg.role,
            content,
            timestamp: msg.timestamp,
            metadata: msg.metadata,
          };
        });
        setMessages(normalizedMsgs);

        // Create server-side conversation and sync existing messages (WAF bypass)
        try {
          const serverConv = await fetch("/api/v1/conversations", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ title: conv.title || "" }),
          }).then((r) => r.json());
          if (serverConv?.id) {
            setServerConversationId(serverConv.id);
            // Sync existing messages to server
            const toSync = normalizedMsgs
              .filter((m) => m.role === "user" || m.role === "assistant")
              .map((m) => ({ role: m.role, content: m.content }));
            if (toSync.length) {
              await fetch(`/api/v1/conversations/${serverConv.id}/messages`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ messages: toSync }),
              });
            }
          }
        } catch (e) {
          console.warn("Failed to create server conversation for existing chat:", e);
        }
      }
    } catch (error) {
      console.error("Failed to load conversation:", error);
      const wrappedError = new Error("Something went wrong while loading the conversation.");
      wrappedError.cause = error;
      handleError(wrappedError, "Load Conversation Error");
    }
  };

  // Load recent conversations for sidebar
  const loadRecentConversations = async () => {
    const database = db();
    if (!database) return;

    try {
      const currentProjectId = getCurrentProjectId();
      const recentConvs = await database.getRecentConversationsByProject(currentProjectId, 20);
      setConversations(
        recentConvs.map((conv) => ({
          id: conv.id,
          title: conv.title,
          lastMessageAt: conv.lastMessageAt,
          messageCount: conv.messageCount,
          projectId: conv.projectId,
        }))
      );
    } catch (error) {
      console.error("Failed to load conversations:", error);
      const wrappedError = new Error("Something went wrong while loading conversations.");
      wrappedError.cause = error;
      handleError(wrappedError, "Load Conversations Error");
    }
  };

  // Update conversation title
  const updateConversation = async (updates, conversationId = null) => {
    const database = db();
    const targetConversationId = conversationId || conversation?.id;
    if (!database || !targetConversationId) return;

    try {
      await database.updateConversation(targetConversationId, updates);

      if (targetConversationId === conversation?.id) {
        setConversation((prev) => ({ ...prev, ...updates }));
      }

      // Refresh conversations list if title changed
      if (updates.title) {
        await loadRecentConversations();
      }
    } catch (error) {
      console.error("Failed to update conversation:", error);
      const wrappedError = new Error("Something went wrong while updating the conversation.");
      wrappedError.cause = error;
      handleError(wrappedError, "Update Conversation Error");
    }
  };

  /**
   * Generate a conversation title after the first completed exchange.
   * Uses the existing systemPrompt and full message history.
   *
   * @param {Object} params
   * @param {string} params.model - The model identifier to use.
   * @param {Object} params.context - Client context object.
   */
  const generateConversationTitle = async ({ model, context }) => {
    if (!conversation?.id) {
      return;
    }

    const database = db();
    if (!database) {
      return;
    }

    try {
      const baseMessages = structuredClone(unwrap(messages));
      const titleSystemPrompt = systemPrompt(getClientContext(context));
      const titleInstructionMessage = {
        role: "user",
        content: [
          {
            text:
              "You are helping name this chat between a user and an AI assistant.\n\n" +
              "Based on the entire conversation so far, respond with ONLY a short title that follows ALL of these rules:\n" +
              "- Maximum 30 characters (count spaces).\n" +
              "- Clear, specific, and relevant to what the user and assistant discussed.\n" +
              "- Use only letters, numbers, and spaces (no punctuation, emojis, or other special characters).\n" +
              "- No quotation marks.\n" +
              "- No line breaks.\n" +
              "- If your draft is longer than 30 characters, shorten it before responding.\n\n" +
              "Respond with the title text only.",
          },
        ],
      };

      const response = await fetch("/api/v1/model", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          chatConfig: "eagle",
          context: getClientContext(context),
          messages: [...baseMessages, titleInstructionMessage],
          thoughtBudget: 0,
          stream: false,
        }),
      });

      if (!response.ok) {
        await handleHttpError(response, "generating conversation title");
        return;
      }

      const json = await response.json();

      const contentBlocks = json?.output?.message?.content;
      let rawTitle = "";

      if (Array.isArray(contentBlocks)) {
        rawTitle = contentBlocks
          .map((block) => (typeof block?.text === "string" ? block.text : ""))
          .join(" ")
          .trim();
      }

      const sanitizedTitle = sanitizeTitle(rawTitle);
      if (!sanitizedTitle) {
        return;
      }

      await updateConversation({ title: sanitizedTitle });
    } catch (error) {
      console.error("Failed to generate conversation title:", error);
      const wrappedError = new Error(
        "Something went wrong while generating the conversation title."
      );
      wrappedError.cause = error;
      handleError(wrappedError, "Generate Title Error");
    }
  };

  /**
   * Deletes a conversation by ID.
   *
   * @param {string} conversationId - The optional ID of the conversation to delete. Otherwise, deletes the current conversation.
   * @param {Object} opts - Options for deleting the conversation.
   * @param {boolean} opts.skipWindowConfirm - If true, skips the window confirmation dialog. False by default.
   * @returns {Promise<void>}
   */
  const deleteConversation = async (conversationId = "", opts = { skipWindowConfirm: false }) => {
    const database = db();
    const targetConversationId = conversationId || conversation?.id;
    if (!database || !targetConversationId) return;

    if (!opts?.skipWindowConfirm) {
      const confirmDelete = window.confirm(
        "Are you sure you want to delete this conversation? This action cannot be undone."
      );
      if (!confirmDelete) return;
    }

    try {
      await database.deleteConversation(targetConversationId);
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      showError("Something went wrong while deleting the conversation.");
    }

    // If deleting current conversation, clear state
    const isCurrentConversation = targetConversationId === conversation?.id;
    if (conversation?.id?.length > 0 && (!conversationId?.length || isCurrentConversation)) {
      // Clear current conversation
      setConversation({ id: null, title: "", messages: [] });
      setMessages([]);
      setServerConversationId(null);

      // Update URL to remove conversation ID
      const url = new URL(window.location);
      url.searchParams.delete("id");
      window.history.replaceState({}, "", url);
    }

    // Refresh conversations list
    await loadRecentConversations();
  };

  // Update URL with conversation ID
  const updateURL = (conversationId) => {
    if (conversationId) {
      const url = new URL(window.location);
      url.searchParams.set("id", conversationId);
      window.history.replaceState({}, "", url);
    }
  };

  /**
   * Sync messages to the server-side conversation for WAF bypass.
   * When a server conversation exists, messages are stored server-side so the
   * /model endpoint can fetch them by conversationId instead of receiving
   * the full message history in the POST body (which can exceed the 8KB WAF limit).
   */
  async function syncToServer(messagesToSync) {
    const serverId = serverConversationId();
    if (!serverId) return;

    // Truncate large tool results to fit within WAF 8KB body limit.
    // Keep the first portion so the model knows what the tool returned.
    const MAX_RESULT_CHARS = 1500;
    const truncated = messagesToSync.map((msg) => {
      if (msg.role !== "user" || !Array.isArray(msg.content)) return msg;
      return {
        ...msg,
        content: msg.content.map((c) => {
          if (!c.toolResult) return c;
          const raw = JSON.stringify(c.toolResult.content);
          if (raw.length <= MAX_RESULT_CHARS) return c;
          // Truncate each content block, keeping the beginning for context
          const trimmedContent = c.toolResult.content.map((block) => {
            if (block.json) {
              const s = JSON.stringify(block.json);
              if (s.length <= MAX_RESULT_CHARS) return block;
              return { text: s.substring(0, MAX_RESULT_CHARS) + "... [truncated]" };
            }
            if (block.text && block.text.length > MAX_RESULT_CHARS) {
              return { text: block.text.substring(0, MAX_RESULT_CHARS) + "... [truncated]" };
            }
            return block;
          });
          return { toolResult: { ...c.toolResult, content: trimmedContent } };
        }),
      };
    });

    try {
      const response = await fetch(`/api/v1/conversations/${serverId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: truncated }),
      });
      if (!response.ok) {
        console.warn("Sync to server failed:", response.status);
      }
    } catch (e) {
      console.warn("Failed to sync messages to server:", e);
    }
  }

  /**
   * Submit a message along with optional files.
   * @param {Object} params
   * @param {string} params.message - The text message.
   * @param {FileList} [params.inputFiles] - Any files attached.
   * @param {boolean} params.reasoningMode - Whether reasoning mode is enabled.
   * @param {string} params.model - The model to use.
   */
  async function submitMessage({
    message,
    inputFiles,
    reasoningMode,
    model,
    context = {},
    reset = () => {},
  }) {
    // CRITICAL FIX: Wait for database to be initialized before proceeding
    let database = db();
    let retries = 0;
    while (!database && retries < 10) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      database = db();
      retries++;
    }

    if (!database) {
      console.error("Database not initialized after waiting");
      // Continue without database for now, but this should be fixed
    }

    const isFirstUserMessage = messages?.filter((m) => m.role === "user")?.length === 0;

    const text = jsonToXml({
      message: {
        text: message,
        metadata: {
          timestamp: new Date().toLocaleString(),
          reminders:
            "Search and browse for current information if needed. If necessary, interleave tool calls with the think tool to perform complex analysis. Only update the workspace when necessary. Always include APA-style source citations with full URLs when sources are used.",
        },
      },
    });
    const userMessage = {
      role: "user",
      content: [{ text }],
    };

    // Create new conversation if this is the first message
    if (!messages.length && database) {
      try {
        const currentProjectId = getCurrentProjectId();
        const newConversation = await database.createConversation({
          title: "",
          projectId: currentProjectId,
        });

        setConversation({
          id: newConversation.id,
          title: newConversation.title,
          projectId: newConversation.projectId,
        });

        // Create server-side conversation for message storage (WAF bypass)
        try {
          const serverConv = await fetch("/api/v1/conversations", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ title: "" }),
          }).then((r) => r.json());
          if (serverConv?.id) setServerConversationId(serverConv.id);
        } catch (e) {
          console.warn("Server conversation creation failed, using inline messages:", e);
        }

        // Update URL with new conversation ID
        updateURL(newConversation.id);

        // Refresh conversations list
        await loadRecentConversations();
      } catch (error) {
        console.error("Failed to create conversation:", error);
        const wrappedError = new Error("Something went wrong while creating the conversation.");
        wrappedError.cause = error;
        handleError(wrappedError, "Create Conversation Error");
        // Fallback to local storage behavior
        const currentProjectId = getCurrentProjectId();
        setConversation({
          id: Math.random().toString(36).substr(2, 9),
          title: "",
          projectId: currentProjectId,
        });
      }
    } else if (!messages.length) {
      // Fallback if no database
      const currentProjectId = getCurrentProjectId();
      setConversation({
        id: Math.random().toString(36).substr(2, 9),
        title: "",
        projectId: currentProjectId,
      });
    }

    if (inputFiles && inputFiles.length) {
      for (const file of inputFiles) {
        const byteLengthLimit = 1024 * 1024 * 5; // 5MB
        const imageTypes = ["gif", "jpg", "jpeg", "png", "webp"];
        const documentTypes = ["pdf", "csv", "doc", "docx", "xls", "xlsx", "html", "txt", "md"];
        let [name, format] = splitFilename(file.name);
        if (format === "jpg") format = "jpeg"; //bedrock
        name =
          name.replace(/[^a-zA-Z0-9\s[\]()-]/g, "_").replace(/\s{2,}/g, " ") + new Date().getTime();
        const bytes = await fileToBase64(file, true);
        const contentType = imageTypes.includes(format) ? "image" : "document";
        if (!documentTypes.concat(imageTypes).includes(format)) format = "txt";
        if (file.size > byteLengthLimit) {
          console.warn(`File ${file.name} exceeds the 5MB limit and will not be sent.`);
          continue;
        }
        userMessage.content.unshift({
          [contentType]: { name, format, source: { bytes } },
        });
      }
    }

    // Update the state with the user message
    setMessages(messages.length, userMessage);
    reset?.();

    // Store user message in database (as array)
    if (database && conversation.id) {
      try {
        await database.addMessage(conversation.id, {
          role: userMessage.role,
          content: userMessage.content, // Store as array directly
        });
      } catch (error) {
        console.error("Failed to store user message:", error);
        const wrappedError = new Error("Something went wrong while storing your message.");
        wrappedError.cause = error;
        handleError(wrappedError, "Store Message Error");
      }
    }

    // Sync user message to server-side conversation (WAF bypass)
    await syncToServer([userMessage]);

    try {
      let isComplete = false;
      let toolIterations = 0;
      const MAX_TOOL_ITERATIONS = 15; // prevent infinite tool loops
      setLoading(true);

      // Langfuse tracing: one traceId per user turn, sessionId = conversation
      const langfuseTraceId = crypto.randomUUID();
      const langfuseSessionId = conversation.id || undefined;
      const langfuseTurnLabel = message?.slice(0, 60) || undefined;

      while (!isComplete) {
        // Use server-side conversationId when available to avoid WAF body size limits.
        // Falls back to inline messages for callers without a server conversation.
        const useServerMessages = !!serverConversationId();
        const response = await fetch("/api/v1/model", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model,
            chatConfig: "eagle",
            context: getClientContext(context),
            ...(useServerMessages ? { conversationId: serverConversationId() } : { messages }),
            thoughtBudget: reasoningMode ? 8000 : 0,
            stream: true,
            langfuseSessionId,
            langfuseTraceId,
            langfuseTurnLabel,
          }),
        });

        if (!response.ok) {
          await handleHttpError(response, "sending message");
          return; // Stop execution on error
        }

        const decoder = new TextDecoder();
        let assistantMessage = { role: "assistant", content: [] };
        setMessages(messages.length, assistantMessage);

        // CRITICAL FIX: Store assistant message immediately when created
        // This ensures it's persisted even if tool calls or errors occur
        let assistantMessageId = null;
        if (database && conversation.id) {
          try {
            const storedMessage = await database.addMessage(conversation.id, {
              role: assistantMessage.role,
              content: assistantMessage.content,
            });
            assistantMessageId = storedMessage.id;
          } catch (error) {
            console.error("Failed to store initial assistant message:", error);
            const wrappedError = new Error("Something went wrong while storing the response.");
            wrappedError.cause = error;
            handleError(wrappedError, "Store Response Error");
          }
        }

        // Process streaming chunks from the API
        for await (const chunk of readStream(response)) {
          const values = decoder
            .decode(chunk, { stream: true })
            .trim()
            .split("\n")
            .map((e) => JSON.parse(e));

          for (const value of values) {
            const { contentBlockStart, contentBlockDelta, contentBlockStop, messageStop } = value;
            const toolUse = contentBlockStart?.start?.toolUse;
            const stopReason = messageStop?.stopReason;

            if (toolUse) {
              toolUse.input = "";
              const { contentBlockIndex } = contentBlockStart;
              setMessages(messages.length - 1, "content", contentBlockIndex, { toolUse });
            } else if (contentBlockDelta) {
              const { contentBlockIndex, delta } = contentBlockDelta;
              const { reasoningContent, text, toolUse } = delta;

              if (reasoningContent) {
                if (!messages.at(-1).content[contentBlockIndex]?.reasoningContent) {
                  setMessages(messages.length - 1, "content", contentBlockIndex, {
                    reasoningContent: {
                      reasoningText: {
                        text: "",
                        signature: "",
                      },
                      redactedContent: "",
                    },
                  });
                }
                if (reasoningContent.text) {
                  setMessages(
                    messages.length - 1,
                    "content",
                    contentBlockIndex,
                    "reasoningContent",
                    "reasoningText",
                    "text",
                    (prev) => prev + reasoningContent.text
                  );
                } else if (reasoningContent.signature) {
                  setMessages(
                    messages.length - 1,
                    "content",
                    contentBlockIndex,
                    "reasoningContent",
                    "reasoningText",
                    "signature",
                    (prev) => prev + reasoningContent.signature
                  );
                  setMessages(
                    messages.length - 1,
                    "content",
                    contentBlockIndex,
                    "reasoningContent",
                    "redactedContent",
                    undefined
                  );
                } else if (reasoningContent.redactedContent) {
                  setMessages(
                    messages.length - 1,
                    "content",
                    contentBlockIndex,
                    "reasoningContent",
                    "redactedContent",
                    (prev) => prev + reasoningContent.redactedContent
                  );
                  setMessages(
                    messages.length - 1,
                    "content",
                    contentBlockIndex,
                    "reasoningContent",
                    "reasoningText",
                    undefined
                  );
                }
              } else if (text) {
                if (!messages.at(-1).content[contentBlockIndex]?.text) {
                  setMessages(messages.length - 1, "content", contentBlockIndex, { text: "" });
                }
                setMessages(
                  messages.length - 1,
                  "content",
                  contentBlockIndex,
                  "text",
                  (prev) => prev + text
                );
              } else if (toolUse) {
                setMessages(
                  messages.length - 1,
                  "content",
                  contentBlockIndex,
                  "toolUse",
                  "input",
                  (prev) => prev + toolUse.input
                );
              }
            } else if (contentBlockStop) {
              const { contentBlockIndex } = contentBlockStop;
              const { toolUse } = messages.at(-1).content[contentBlockIndex];
              const parse = (input) => {
                try {
                  return JSON.parse(input);
                } catch (e) {
                  return { error: e.message, input };
                }
              };
              if (toolUse)
                setMessages(
                  messages.length - 1,
                  "content",
                  contentBlockIndex,
                  "toolUse",
                  "input",
                  (prev) => parse(prev)
                );
            } else if (stopReason) {
              // Update the stored assistant message with final content
              if (database && conversation.id && assistantMessageId) {
                try {
                  const currentAssistantMessage = messages.at(-1);
                  if (currentAssistantMessage && currentAssistantMessage.role === "assistant") {
                    // CRITICAL FIX: Deep clone the content to remove any reactive references
                    const serializedContent = JSON.parse(
                      JSON.stringify(currentAssistantMessage.content)
                    );
                    await database.updateMessage(assistantMessageId, {
                      content: serializedContent,
                    });
                  }
                } catch (error) {
                  console.error("Failed to update assistant message:", error);
                  const wrappedError = new Error(
                    "Something went wrong while updating the response."
                  );
                  wrappedError.cause = error;
                  handleError(wrappedError, "Update Response Error");
                }
              }

              if (stopReason === "tool_use") {
                toolIterations++;
                const toolUses = messages
                  .at(-1)
                  .content.filter((c) => c.toolUse)
                  .map((c) => c.toolUse);
                const toolResults = await Promise.all(toolUses.map((t) => runTool(t)));

                // If we've hit the iteration limit, force the model to respond
                // by appending a stop instruction to the tool results
                const resultContent = toolResults.map((r) => ({ toolResult: r }));
                if (toolIterations >= MAX_TOOL_ITERATIONS) {
                  resultContent.push({
                    text: "[SYSTEM: Tool call limit reached. You MUST respond to the user now with the information you have gathered so far. Do NOT call any more tools.]",
                  });
                }

                const toolResultsMessage = {
                  role: "user",
                  content: resultContent,
                };
                setMessages(messages.length, toolResultsMessage);

                // CRITICAL FIX: Store tool results message immediately when created
                if (database && conversation.id) {
                  try {
                    await database.addMessage(conversation.id, {
                      role: toolResultsMessage.role,
                      content: toolResultsMessage.content,
                    });
                  } catch (error) {
                    console.error("Failed to store tool results message:", error);
                    const wrappedError = new Error(
                      "Something went wrong while storing tool results."
                    );
                    wrappedError.cause = error;
                    handleError(wrappedError, "Store Tool Results Error");
                  }
                }

                // Sync assistant + tool results to server (WAF bypass).
                // The next /model call will use conversationId to fetch these.
                const assistantMsg = messages.at(-2); // assistant with tool_use
                if (assistantMsg?.role === "assistant") {
                  const serialized = JSON.parse(JSON.stringify(assistantMsg.content));
                  await syncToServer([
                    { role: "assistant", content: serialized },
                    toolResultsMessage,
                  ]);
                } else {
                  await syncToServer([toolResultsMessage]);
                }
              } else {
                // Sync final assistant message to server
                const finalMsg = messages.at(-1);
                if (finalMsg?.role === "assistant") {
                  const serialized = JSON.parse(JSON.stringify(finalMsg.content));
                  await syncToServer([{ role: "assistant", content: serialized }]);
                }
                isComplete = true;
              }
            }
          }
        }
      }

      if (isFirstUserMessage) {
        await generateConversationTitle({
          model: MODEL_OPTIONS.AWS_BEDROCK.HAIKU.v4_5,
          context,
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const wrappedError = new Error("Something went wrong while sending your message.");
      wrappedError.cause = error;
      handleError(wrappedError, "Send Message Error");
    } finally {
      setLoading(false);
    }
  }

  return {
    messages,
    submitMessage,
    conversation,
    updateConversation,
    deleteConversation,
    conversations,
    loading,
    loadConversation,
    userEmail,
  };
}
