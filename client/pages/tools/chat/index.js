import {
  EllipsisVertical,
  LogOut,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-solid";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Index,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import html from "solid-js/html";

import { AlertContainer } from "../../../components/alert.js";
import AttachmentsPreview from "../../../components/attachments-preview.js";
import Loader from "../../../components/loader.js";
import ScrollTo from "../../../components/scroll-to.js";
import Tooltip from "../../../components/tooltip.js";
import { useAuthContext } from "../../../contexts/auth-context.js";
import { MODEL_OPTIONS } from "../../../models/model-options.js";
import { alerts, clearAlert } from "../../../utils/alerts.js";
import {
  registerErrorDataCollector,
  unregisterErrorDataCollector,
} from "../../../utils/global-error-handler.js";

import DeleteConversation from "./delete-conversation.js";
import { useChat } from "./hooks.js";
import Message from "./message.js";

const MAX_TITLE_LENGTH = 30;

export default function Page() {
  const { user } = useAuthContext();

  const {
    conversation,
    deleteConversation,
    updateConversation,
    conversations,
    messages,
    loading,
    submitMessage,
  } = useChat();
  const [toggles, setToggles] = createSignal({ conversations: true, activity: true });
  const [isAtBottom, setIsAtBottom] = createSignal(true);
  const [chatHeight, setChatHeight] = createSignal(0);
  const [deleteConversationId, setDeleteConversationId] = createSignal(null);
  const [isStreaming, setIsStreaming] = createSignal(false);

  const [openMenu, setOpenMenu] = createSignal(null);
  const [editingState, setEditingState] = createSignal({ id: null, context: null, title: "" });
  const [activityTab, setActivityTab] = createSignal("tools");

  // Extract tool calls, documents, and skills from messages for the activity panel
  const toolCalls = createMemo(() => {
    const calls = [];
    for (const msg of messages) {
      if (msg.role !== "assistant" || !Array.isArray(msg.content)) continue;
      for (const block of msg.content) {
        if (!block.toolUse) continue;
        const hasResult = messages.some(
          (m) =>
            m.role === "user" &&
            Array.isArray(m.content) &&
            m.content.some((c) => c?.toolResult?.toolUseId === block.toolUse.toolUseId)
        );
        calls.push({ name: block.toolUse.name, input: block.toolUse.input, hasResult });
      }
    }
    return calls;
  });

  const docCalls = createMemo(() =>
    toolCalls()
      .filter((c) => c.name === "create_document")
      .map((c) => c.input || {})
  );

  const skillCalls = createMemo(() =>
    toolCalls()
      .filter((c) => c.name === "load_skill")
      .map((c) => ({ name: c.input?.name || "unknown" }))
  );

  // User display helpers
  const userName = () => {
    const u = user?.();
    if (!u) return "User";
    return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "User";
  };
  const userInitials = () => {
    const u = user?.();
    if (!u) return "?";
    const first = (u.firstName || "")[0] || "";
    const last = (u.lastName || "")[0] || "";
    return (first + last).toUpperCase() || (u.email || "?")[0].toUpperCase();
  };

  let titleInputRef;

  const isFedPulse = new URLSearchParams(location.search).get("fedpulse") === "1";
  let bottomEl;
  let chatRef;
  let inputFilesEl;
  let attachmentsReset;
  let formRef;

  const chatId = createMemo(() => new URLSearchParams(location.search).get("id") || "");
  const hasChatId = createMemo(() => chatId()?.length > 0 || conversation?.id?.length > 0);

  const isEditing = (context, conversationId) => {
    const state = editingState();
    return state.context === context && state.id === conversationId;
  };

  const isMenuOpen = (conversationId) => {
    const menu = openMenu();
    if (!menu) {
      return false;
    }

    return menu.type === "conversation" && menu.id === conversationId;
  };

  const updateEditingTitle = (value) =>
    setEditingState((prev) => {
      const newTitle = (value.trim() || "").slice(0, MAX_TITLE_LENGTH);

      if (newTitle === prev.title) {
        return prev;
      }

      return { ...prev, title: newTitle };
    });

  function stopEditingTitle() {
    setEditingState({ id: null, context: null, title: "" });
  }

  const handleDocumentClick = (event) => {
    const target = event.target;

    const inDropdownOrToggle =
      target.closest(".conv-menu") ||
      target.closest(".conv-menu-btn") ||
      target.closest(".header-icon-btn");

    const inTitleInput = target.closest(".conv-title-input");

    // On clickaway, close menus and stop editing titles
    if (!inDropdownOrToggle && !inTitleInput) {
      setOpenMenu(null);
      stopEditingTitle();
    }
  };

  onMount(() => {
    const resizeObserver = new ResizeObserver(() => setChatHeight(chatRef?.offsetHeight || 0));
    if (chatRef) resizeObserver.observe(chatRef);

    const observer = new IntersectionObserver(
      (entries) => {
        const isIntersecting = entries[0]?.isIntersecting ?? false;
        if (isAtBottom() === isIntersecting) {
          return;
        }
        setIsAtBottom(isIntersecting);
      },
      { root: null, threshold: 0 }
    );

    if (bottomEl) observer.observe(bottomEl);

    document.addEventListener("click", handleDocumentClick, true);

    registerErrorDataCollector("chat", collectAdditionalErrorData);

    onCleanup(() => {
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("click", handleDocumentClick, true);
      unregisterErrorDataCollector("chat");
    });
  });

  let initScroll = false;
  createEffect(() => {
    if (!initScroll && messages?.length > 0 && bottomEl) {
      requestAnimationFrame(() => {
        bottomEl?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
      initScroll = true;
    }
  });

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey && !loading()) {
      event.preventDefault();
      event.target?.closest("form")?.requestSubmit();
    }
  }

  const toggle = (key) => (event) => {
    event.target.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const message = form.message.value;
    const inputFiles = form.inputFiles.files;
    const reasoningMode = form.reasoningMode.checked;
    const defaultModel = MODEL_OPTIONS.AWS_BEDROCK.SONNET.v4_6;
    const model = form.model?.value || defaultModel;
    setIsStreaming(true);
    await submitMessage({
      message,
      inputFiles,
      reasoningMode,
      model,
      reset: () => clearChat(),
    }).finally(() => setIsStreaming(false));
  }

  function handleOnDeleteConversationClick(e, conversationId) {
    e.preventDefault();
    setDeleteConversationId(conversationId);
  }

  async function handleDeleteConversation() {
    if (!deleteConversationId()?.length) {
      return;
    }

    await deleteConversation(deleteConversationId(), { skipWindowConfirm: true });
    setDeleteConversationId(null);
  }

  function clearChat() {
    if (!formRef) {
      return;
    }

    formRef.message.value = "";
    formRef.inputFiles.value = "";
    attachmentsReset && attachmentsReset();
  }

  function startEditingTitle(conversationId, currentTitle, context) {
    if (!conversationId) {
      return;
    }

    const rawtitle = currentTitle && currentTitle.trim().length > 0 ? currentTitle : "Untitled";
    const title = rawtitle.slice(0, MAX_TITLE_LENGTH);

    setEditingState({ id: conversationId, context, title });
    setOpenMenu(null);
  }

  async function handleTitleKeyDown(event, conversationId) {
    if (event.key !== "Enter" && event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    if (event.key === "Enter") {
      onTitleSubmit(conversationId);
      return;
    }

    stopEditingTitle();
  }

  async function onTitleSubmit(conversationId) {
    const { title } = editingState() || {};
    const newTitle = title?.trim() || "";

    if (!newTitle || !conversationId) {
      stopEditingTitle();
      return;
    }

    try {
      await updateConversation({ title: newTitle }, conversationId);
    } finally {
      stopEditingTitle();
    }
  }

  function handleConversationMenuToggle(event, conversationId) {
    event.preventDefault();
    event.stopPropagation();

    setOpenMenu((prev) =>
      prev?.type === "conversation" && prev?.id === conversationId
        ? null
        : { type: "conversation", id: conversationId }
    );
  }

  function handleConversationMenuEdit(event, conv) {
    event.preventDefault();
    event.stopPropagation();

    startEditingTitle(conv.id, conv.title, "sidebar");
  }

  function handleConversationMenuDelete(event, convId) {
    event.preventDefault();
    event.stopPropagation();

    setOpenMenu(null);
    handleOnDeleteConversationClick(event, convId);
  }

  function attachAndFocusTitleInput(el) {
    if (!el) {
      return;
    }

    titleInputRef = el;
    requestAnimationFrame(() => {
      if (!titleInputRef) {
        return;
      }

      titleInputRef.focus();
      if (typeof titleInputRef.setSelectionRange === "function") {
        titleInputRef.setSelectionRange(0, titleInputRef.value?.length ?? 0);
      }
    });
  }

  // ============= Error Data Collection =============

  const collectAdditionalErrorData = async () => ({
    "Tool Name": isFedPulse ? "FedPulse" : "Chat",
    "Chat ID": conversation?.id || null,
    "Reasoning Mode": formRef?.reasoningMode?.checked || false,
    Model: formRef?.model?.value || "sonnet-4.5",
    "Last 3 chat messages": messages.slice(-3).map((m) => ({
      role: m.role,
      preview: m.content?.[0]?.text || "",
    })),
  });

  // ============= Template =============

  return html`
    <div class="flex overflow-hidden" style="flex:1 1 0;min-height:0">
      <!-- ═══════════════ LEFT SIDEBAR ═══════════════ -->
      <aside
        class="bg-white flex flex-col shrink-0 transition-all duration-200"
        style=${() =>
          toggles().conversations
            ? "width:16rem; border-right:1px solid #D8DEE6"
            : "width:auto; border-right:1px solid #D8DEE6"}
      >
        <!-- Collapsed: centered toggle strip -->
        <${Show} when=${() => !toggles().conversations}>
          <div class="flex flex-col items-center justify-center flex-1">
            <button
              type="button"
              class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              onClick=${toggle("conversations")}
              title="Open sidebar"
            >
              <${PanelLeftOpen} size=${18} />
            </button>
          </div>
        <//>

        <!-- Expanded sidebar content -->
        <${Show} when=${() => toggles().conversations}>
          <!-- Sidebar header -->
          <div class="p-3 space-y-3">
            <div class="flex items-center justify-between">
              <a
                href="/tools/chat"
                target="_self"
                class="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-white rounded-xl text-sm font-medium transition-colors no-underline"
                style="background:#003366; box-shadow:0 2px 8px rgba(0,51,102,0.25)"
                onMouseEnter=${(e) => {
                  e.currentTarget.style.background = "#004488";
                }}
                onMouseLeave=${(e) => {
                  e.currentTarget.style.background = "#003366";
                }}
              >
                <${Plus} size=${16} />
                New Chat
              </a>
              <button
                type="button"
                class="ml-2 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
                onClick=${toggle("conversations")}
                title="Close sidebar"
              >
                <${PanelLeftClose} size=${18} />
              </button>
            </div>
          </div>

          <!-- Conversation list -->
          <div class="flex items-center justify-between px-4 mb-2">
            <span class="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
              Recent ${isFedPulse ? "FedPulse" : ""} Chats
            </span>
            <a
              href="/tools/export-conversations"
              target="_self"
              class="text-[10px] text-gray-400 hover:text-gray-600 no-underline"
              title="Export conversations"
              >Export</a
            >
          </div>

          <div
            class="flex-1 overflow-y-auto px-2"
            style="scrollbar-width:thin;scrollbar-color:#ccc transparent"
          >
            <${For} each=${conversations}>
              ${(conv) => {
                const href = isFedPulse
                  ? `/tools/chat?fedpulse=1&id=${conv.id}`
                  : `/tools/chat?id=${conv.id}`;
                return html`
                  <a
                    href=${href}
                    target="_self"
                    class=${() =>
                      `group flex items-center gap-2.5 px-3 py-2 rounded-lg mb-0.5 no-underline transition-colors ${
                        conv.id === conversation?.id
                          ? "bg-blue-50 text-blue-700"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                  >
                    <${MessageSquare}
                      size=${14}
                      class=${() =>
                        conv.id === conversation?.id
                          ? "text-blue-500 shrink-0"
                          : "text-gray-300 shrink-0"}
                    />
                    <div class="flex-1 min-w-0">
                      <${Show}
                        when=${() => isEditing("sidebar", conv.id)}
                        fallback=${html`
                          <span class="text-xs font-medium truncate block">
                            ${() => conv.title || "Untitled"}
                          </span>
                          <span class="text-gray-400 block truncate" style="font-size:10px">
                            ${() => {
                              const d = conv.createdAt ? new Date(conv.createdAt) : null;
                              if (!d) return "";
                              const now = Date.now();
                              const diff = now - d.getTime();
                              const mins = Math.floor(diff / 60000);
                              const hrs = Math.floor(diff / 3600000);
                              const days = Math.floor(diff / 86400000);
                              const time =
                                days > 0
                                  ? `${days}d ago`
                                  : hrs > 0
                                    ? `${hrs}h ago`
                                    : `${mins}m ago`;
                              return (
                                time +
                                (conv.messageCount != null ? ` · ${conv.messageCount} msgs` : "")
                              );
                            }}
                          </span>
                        `}
                      >
                        <input
                          type="text"
                          class="conv-title-input w-full text-xs font-medium bg-white rounded px-1.5 py-0.5 outline-none"
                          style="border:1px solid #93c5fd"
                          value=${() => editingState().title}
                          maxlength=${MAX_TITLE_LENGTH}
                          onInput=${(event) => updateEditingTitle(event.currentTarget.value || "")}
                          onKeyDown=${(event) => handleTitleKeyDown(event, conv.id)}
                          onBlur=${() => stopEditingTitle()}
                          onClick=${(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          ref=${attachAndFocusTitleInput}
                        />
                      <//>
                    </div>

                    <${Show} when=${() => !isEditing("sidebar", conv.id)}>
                      <div class="relative">
                        <button
                          type="button"
                          class="conv-menu-btn opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 rounded transition-opacity"
                          aria-label="Chat options"
                          onClick=${(event) => handleConversationMenuToggle(event, conv.id)}
                        >
                          <${EllipsisVertical} size=${14} />
                        </button>
                        <${Show} when=${() => isMenuOpen(conv.id)}>
                          <div
                            class="conv-menu absolute right-0 top-full mt-1 bg-white rounded-xl py-1 z-20 min-w-[140px]"
                            style="border:1px solid #D8DEE6; box-shadow:0 8px 24px rgba(0,0,0,0.12)"
                          >
                            <button
                              type="button"
                              class="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              onClick=${(event) => handleConversationMenuEdit(event, conv)}
                            >
                              <${Pencil} size=${12} /> Edit title
                            </button>
                            <button
                              type="button"
                              class="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                              onClick=${(event) => handleConversationMenuDelete(event, conv.id)}
                            >
                              <${Trash2} size=${12} /> Delete
                            </button>
                          </div>
                        <//>
                      </div>
                    <//>
                  </a>
                `;
              }}
            <//>
          </div>

          <!-- User profile card -->
          <div class="mt-auto p-3" style="border-top:1px solid #f3f4f6">
            <div class="flex items-center gap-3 p-2.5 bg-gray-50 rounded-xl">
              <div
                class="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0"
                style="background:linear-gradient(135deg,#003149,#7740A4)"
              >
                ${userInitials}
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-gray-900 truncate">${userName}</div>
                <div class="text-gray-500" style="font-size:10px">
                  ${() => user?.()?.Role?.name || "User"}
                </div>
              </div>
              <a
                href="/api/v1/logout"
                target="_self"
                class="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg no-underline"
                title="Sign out"
              >
                <${LogOut} size=${14} />
              </a>
            </div>
          </div>
        <//>
      </aside>

      <!-- ═══════════════ MAIN CHAT AREA ═══════════════ -->
      <div class="flex-1 flex flex-col min-w-0" style="background:#F5F7FA">
        <!-- Chat form -->
        <form
          ref=${(el) => (formRef = el)}
          onSubmit=${handleSubmit}
          class="flex-1 flex flex-col relative"
          style="min-height:0"
        >
          <${AlertContainer}
            alerts=${alerts}
            onDismiss=${clearAlert}
            onCollectAdditionalData=${() => collectAdditionalErrorData()}
          />

          <!-- Messages area / Welcome state -->
          <div
            class="flex-1 overflow-y-auto"
            style="scrollbar-width:thin;scrollbar-color:#ccc transparent"
          >
            <${Show}
              when=${() => hasChatId()}
              fallback=${html`
                <!-- ── Welcome state ── -->
                <div
                  class="flex flex-col items-center justify-center p-8 text-center"
                  style="min-height:60vh"
                >
                  <div
                    class="mb-4"
                    style="font-size:64px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.15))"
                  >
                    🦅
                  </div>
                  <h1 class="text-2xl font-bold mb-2" style="color:#003366">Welcome to EAGLE</h1>
                  <p class="text-sm leading-relaxed mb-6" style="color:#4A5568; max-width:520px">
                    ${() =>
                      isFedPulse
                        ? "Search U.S. federal websites for policies, guidelines, executive orders, and other official content."
                        : "AI-powered acquisition intake, compliance analysis, and document generation for the federal acquisition lifecycle."}
                  </p>
                  <${Show} when=${() => !isFedPulse}>
                    <div class="flex gap-4 flex-wrap justify-center">
                      ${[
                        {
                          label: "Acquisition Intake",
                          prompt:
                            "I need to start a new acquisition. Can you guide me through the intake process?",
                          emoji: "📋",
                        },
                        {
                          label: "Generate Documents",
                          prompt: "Help me generate acquisition documents for my package.",
                          emoji: "📝",
                        },
                        {
                          label: "FAR/DFARS Search",
                          prompt:
                            "Search the FAR for guidance on competitive range determinations.",
                          emoji: "📚",
                        },
                        {
                          label: "Compliance Check",
                          prompt: "Check compliance requirements for a $500K IT services contract.",
                          emoji: "💰",
                        },
                      ].map(
                        (card) => html`
                          <button
                            type="button"
                            class="bg-white rounded-xl p-4 text-center cursor-pointer"
                            style="width:180px; border:1px solid #D8DEE6; transition:all 0.2s"
                            onMouseEnter=${(e) => {
                              e.currentTarget.style.transform = "translateY(-2px)";
                              e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)";
                            }}
                            onMouseLeave=${(e) => {
                              e.currentTarget.style.transform = "translateY(0)";
                              e.currentTarget.style.boxShadow = "none";
                            }}
                            onClick=${() => {
                              const textarea = formRef?.querySelector("textarea[name=message]");
                              if (textarea) {
                                textarea.value = card.prompt;
                                textarea.focus();
                              }
                            }}
                          >
                            <div style="font-size:28px" class="mb-1.5">${card.emoji}</div>
                            <div class="text-xs font-semibold" style="color:#003366">
                              ${card.label}
                            </div>
                          </button>
                        `
                      )}
                    </div>
                  <//>
                </div>
              `}
            >
              <!-- ── Messages ── -->
              <div class="mx-auto px-4 py-3" style="max-width:64rem">
                <${Index} each=${messages}>
                  ${(message, index) => html`
                    <${Message}
                      message=${message}
                      index=${index}
                      messages=${messages}
                      isStreaming=${() => isStreaming}
                      class="small markdown shadow-sm rounded mb-3 p-2 position-relative"
                    />
                  `}
                <//>
                <${Show} when=${loading}>
                  <${Loader}
                    style="display: block; height: 1.1rem; width: 100%; margin: 1rem 0; opacity: 0.5"
                  />
                <//>
                <div
                  ref=${(el) => {
                    bottomEl = el;
                  }}
                  style=${() => `scroll-margin-bottom: ${chatHeight()}px`}
                />
              </div>
            <//>
          </div>

          <${ScrollTo}
            targetRef=${() => bottomEl}
            hidden=${() => isAtBottom || messages.length === 0}
            label="Scroll to bottom"
          />

          <!-- ── Input footer ── -->
          <div
            ref=${(el) => {
              chatRef = el;
            }}
            class="shrink-0 bg-white px-4 py-2"
            style="border-top:1px solid #D8DEE6"
          >
            <div class="mx-auto" style="max-width:64rem">
              <${AttachmentsPreview}
                inputRef=${() => inputFilesEl}
                onResetRef=${(fn) => (attachmentsReset = fn)}
              />

              <!-- Quick action pills -->
              <${Show} when=${() => !isFedPulse}>
                <div class="flex items-center justify-center gap-2 mb-2 flex-wrap">
                  ${[
                    {
                      emoji: "🆕",
                      label: "New Intake",
                      prompt:
                        "I need to start a new acquisition. Can you guide me through the intake process?",
                    },
                    {
                      emoji: "📄",
                      label: "Generate SOW",
                      prompt: "Help me generate a Statement of Work for my acquisition package.",
                    },
                    {
                      emoji: "📚",
                      label: "Search FAR",
                      prompt: "Search the FAR for guidance on competitive range determinations.",
                    },
                    {
                      emoji: "💰",
                      label: "Cost Estimate",
                      prompt: "Check compliance requirements for a $500K IT services contract.",
                    },
                    {
                      emoji: "🏢",
                      label: "Small Business",
                      prompt:
                        "What are the small business subcontracting requirements for contracts over $750K?",
                    },
                  ].map(
                    (pill) => html`
                      <button
                        type="button"
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
                        style="color:#003366; background:#EEF2F7; border:1px solid #D8DEE6"
                        onMouseEnter=${(e) => {
                          e.currentTarget.style.background = "#003366";
                          e.currentTarget.style.color = "white";
                          e.currentTarget.style.borderColor = "#003366";
                        }}
                        onMouseLeave=${(e) => {
                          e.currentTarget.style.background = "#EEF2F7";
                          e.currentTarget.style.color = "#003366";
                          e.currentTarget.style.borderColor = "#D8DEE6";
                        }}
                        onClick=${() => {
                          const textarea = formRef?.querySelector("textarea[name=message]");
                          if (textarea) {
                            textarea.value = pill.prompt;
                            textarea.focus();
                          }
                        }}
                      >
                        ${pill.emoji} ${pill.label}
                      </button>
                    `
                  )}
                </div>
              <//>

              <!-- Input row: textarea + send button -->
              <div class="flex items-end gap-3">
                <div
                  class="flex-1 bg-white rounded-xl overflow-hidden transition-all"
                  style="border:1px solid #D8DEE6"
                  onfocusin=${(e) => {
                    e.currentTarget.style.borderColor = "#2196F3";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(33,150,243,0.15)";
                  }}
                  onfocusout=${(e) => {
                    e.currentTarget.style.borderColor = "#D8DEE6";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <label for="message" class="sr-only">Chat Message</label>
                  <textarea
                    onKeyDown=${handleKeyDown}
                    class="w-full resize-none px-4 py-3 text-sm text-gray-900 bg-transparent outline-none"
                    style="border:none; font-family:Inter,system-ui,sans-serif"
                    id="message"
                    name="message"
                    placeholder=${isFedPulse
                      ? "Ask about federal policies, guidelines, executive orders..."
                      : "Ask EAGLE about acquisitions, type / or press Ctrl+K for commands\u2026"}
                    rows="1"
                    autofocus
                    required
                  />
                </div>

                <!-- Circular send button -->
                <button
                  type="submit"
                  class="shrink-0 flex items-center justify-center rounded-xl text-white transition-all disabled:opacity-30"
                  style="width:48px; height:48px; background:#003366; box-shadow:0 2px 8px rgba(0,51,102,0.25)"
                  onMouseEnter=${(e) => {
                    if (!loading()) e.currentTarget.style.background = "#004488";
                  }}
                  onMouseLeave=${(e) => {
                    e.currentTarget.style.background = "#003366";
                  }}
                  disabled=${loading}
                >
                  <${Send} size=${18} />
                </button>
              </div>

              <!-- Hidden controls (functionality preserved) -->
              <div class="flex items-center justify-between mt-2">
                <div class="flex items-center gap-2">
                  <input
                    ref=${(el) => (inputFilesEl = el)}
                    type="file"
                    id="inputFiles"
                    name="inputFiles"
                    aria-label="Input files"
                    class="hidden"
                    accept="image/*,text/*,.pdf,.xls,.xlsx,.doc,.docx"
                    multiple
                  />
                  <${Tooltip}
                    title="Enable for thorough responses to complex problems. Requires additional time."
                    placement="top"
                    arrow=${true}
                    class="text-white bg-primary"
                  >
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        class="form-check-input mt-0 cursor-pointer"
                        type="checkbox"
                        id="reasoningMode"
                        name="reasoningMode"
                        style="width:2.5em;height:1.25em"
                      />
                    </label>
                  <//>
                </div>

                <div class="flex items-center gap-2">
                  <${Show} when=${() => user?.()?.Role?.name === "admin"}>
                    <label for="model" class="sr-only">Model</label>
                    <select
                      class="px-2 py-1 bg-white rounded-lg text-gray-500 outline-none cursor-pointer"
                      style="font-size:11px; border:1px solid #D8DEE6"
                      name="model"
                      id="model"
                      required
                    >
                      <option value=${MODEL_OPTIONS.AWS_BEDROCK.OPUS.v4_6}>Opus 4.6</option>
                      <option value=${MODEL_OPTIONS.AWS_BEDROCK.SONNET.v4_6} selected>
                        Sonnet 4.6
                      </option>
                      <option value=${MODEL_OPTIONS.AWS_BEDROCK.HAIKU.v4_5}>Haiku 4.5</option>
                    </select>
                  <//>
                </div>
              </div>

              <!-- Footer text -->
              <div class="text-center mt-1" style="font-size:10px;color:#8896A6">
                EAGLE · National Cancer Institute
              </div>
            </div>
          </div>
        </form>
      </div>

      <!-- ═══════════════ RIGHT ACTIVITY PANEL ═══════════════ -->

      <!-- Collapsed strip -->
      <${Show} when=${() => !toggles().activity}>
        <button
          type="button"
          class="shrink-0 flex flex-col items-center justify-center cursor-pointer transition-colors"
          style="width:36px; border-left:1px solid #D8DEE6; background:#F5F7FA"
          onMouseEnter=${(e) => {
            e.currentTarget.style.background = "#EDF0F4";
          }}
          onMouseLeave=${(e) => {
            e.currentTarget.style.background = "#F5F7FA";
          }}
          onClick=${toggle("activity")}
          title="Open activity panel"
        >
          <${PanelRightOpen} size=${16} class="text-gray-400" />
        </button>
      <//>

      <!-- Expanded panel -->
      <${Show} when=${() => toggles().activity}>
        <aside
          class="bg-white flex flex-col shrink-0 min-h-0 overflow-hidden"
          style="width:380px; border-left:1px solid #D8DEE6"
        >
          <!-- Tab bar -->
          <div
            class="flex flex-wrap items-center gap-1 p-2"
            style="background:#F5F7FA; border-bottom:1px solid #D8DEE6"
          >
            ${["tools", "docs", "skills"].map((tab) => {
              const labels = { tools: "Tool Calls", docs: "Documents", skills: "Skills" };
              return html`
                <button
                  type="button"
                  class=${() =>
                    `flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      (activityTab() || "tools") === tab
                        ? "bg-white shadow-sm"
                        : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
                    }`}
                  style=${() =>
                    (activityTab() || "tools") === tab
                      ? "color:#003366; border:1px solid #D8DEE6"
                      : "border:1px solid transparent"}
                  onClick=${() => setActivityTab(tab)}
                >
                  ${labels[tab]}
                  <${Show}
                    when=${() => {
                      const counts = {
                        tools: toolCalls().length,
                        docs: docCalls().length,
                        skills: skillCalls().length,
                      };
                      return counts[tab] > 0;
                    }}
                  >
                    <span
                      class="ml-0.5 px-1.5 py-0.5 rounded-full text-white font-bold text-center"
                      style="font-size:9px; background:#003366; min-width:18px"
                    >
                      ${() => {
                        const counts = {
                          tools: toolCalls().length,
                          docs: docCalls().length,
                          skills: skillCalls().length,
                        };
                        return counts[tab];
                      }}
                    </span>
                  <//>
                </button>
              `;
            })}
            <button
              type="button"
              class="ml-auto p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
              onClick=${toggle("activity")}
              title="Collapse panel"
            >
              <${PanelRightClose} size=${16} />
            </button>
          </div>

          <!-- Tab content -->
          <div
            class="flex-1 overflow-y-auto p-4"
            style="scrollbar-width:thin;scrollbar-color:#ccc transparent"
          >
            <!-- Tool Calls tab -->
            <${Show} when=${() => (activityTab() || "tools") === "tools"}>
              <${Show}
                when=${() => toolCalls().length > 0}
                fallback=${html`
                  <div
                    class="flex flex-col items-center justify-center text-center px-4"
                    style="padding-top:4rem"
                  >
                    <div
                      class="w-10 h-10 rounded-full flex items-center justify-center mb-3"
                      style="background:#f3f4f6"
                    >
                      <span style="font-size:18px">⚡</span>
                    </div>
                    <p class="text-sm text-gray-500">No tool calls yet.</p>
                    <p class="text-xs text-gray-400 mt-1">
                      Tool activity will appear here as the assistant works.
                    </p>
                  </div>
                `}
              >
                <div class="space-y-2">
                  <${For} each=${() => toolCalls()}>
                    ${(call) => html`
                      <div
                        class="rounded-lg bg-white p-3 transition"
                        style="border:1px solid #D8DEE6"
                        onMouseEnter=${(e) => {
                          e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
                        }}
                        onMouseLeave=${(e) => {
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      >
                        <div class="flex items-start gap-2">
                          <span
                            class=${() =>
                              `shrink-0 w-2 h-2 rounded-full mt-1.5 ${
                                call.hasResult ? "bg-green-500" : "bg-blue-500 animate-pulse"
                              }`}
                          ></span>
                          <div class="min-w-0 flex-1">
                            <div class="flex items-center justify-between">
                              <span class="text-xs font-semibold truncate" style="color:#003366"
                                >${call.name}</span
                              >
                              <span
                                class=${`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                                  call.hasResult
                                    ? "bg-green-50 text-green-700"
                                    : "bg-blue-50 text-blue-600"
                                }`}
                              >
                                ${call.hasResult ? "done" : "running"}
                              </span>
                            </div>
                            <${Show} when=${call.input}>
                              <div
                                class="text-gray-400 mt-1 truncate"
                                style="font-size:10px"
                                title=${JSON.stringify(call.input)}
                              >
                                ${() => {
                                  const keys = Object.keys(call.input || {});
                                  return keys.length > 0
                                    ? keys
                                        .map((k) => k + ": " + String(call.input[k]).slice(0, 30))
                                        .join(", ")
                                    : "";
                                }}
                              </div>
                            <//>
                          </div>
                        </div>
                      </div>
                    `}
                  <//>
                </div>
              <//>
            <//>

            <!-- Documents tab -->
            <${Show} when=${() => activityTab() === "docs"}>
              <${Show}
                when=${() => docCalls().length > 0}
                fallback=${html`
                  <div
                    class="flex flex-col items-center justify-center text-center px-4"
                    style="padding-top:4rem"
                  >
                    <div
                      class="w-10 h-10 rounded-full flex items-center justify-center mb-3"
                      style="background:#f3f4f6"
                    >
                      <span style="font-size:18px">📄</span>
                    </div>
                    <p class="text-sm text-gray-500">No documents generated yet.</p>
                    <p class="text-xs text-gray-400 mt-1">
                      Documents will appear here as they're created.
                    </p>
                  </div>
                `}
              >
                <div class="space-y-2">
                  <${For} each=${() => docCalls()}>
                    ${(doc) => html`
                      <div
                        class="rounded-lg bg-white p-3 transition"
                        style="border:1px solid #D8DEE6"
                        onMouseEnter=${(e) => {
                          e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
                        }}
                        onMouseLeave=${(e) => {
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      >
                        <div class="flex items-start gap-2">
                          <span class="text-lg shrink-0">📄</span>
                          <div class="min-w-0 flex-1">
                            <p class="text-sm font-medium truncate" style="color:#003366">
                              ${doc.title || doc.doc_type || "Document"}
                            </p>
                            <div
                              class="flex items-center gap-2 mt-1"
                              style="font-size:10px; color:#9ca3af"
                            >
                              <span class="uppercase font-medium"
                                >${doc.doc_type || "unknown"}</span
                              >
                              ${doc.package_id
                                ? html`<span
                                    >· <span class="font-mono">${doc.package_id}</span></span
                                  >`
                                : ""}
                            </div>
                          </div>
                        </div>
                      </div>
                    `}
                  <//>
                </div>
              <//>
            <//>

            <!-- Skills tab -->
            <${Show} when=${() => activityTab() === "skills"}>
              <${Show}
                when=${() => skillCalls().length > 0}
                fallback=${html`
                  <div
                    class="flex flex-col items-center justify-center text-center px-4"
                    style="padding-top:4rem"
                  >
                    <div
                      class="w-10 h-10 rounded-full flex items-center justify-center mb-3"
                      style="background:#f3f4f6"
                    >
                      <span style="font-size:18px">🧩</span>
                    </div>
                    <p class="text-sm text-gray-500">No skills loaded yet.</p>
                    <p class="text-xs text-gray-400 mt-1">
                      Skills are loaded on-demand based on your request.
                    </p>
                  </div>
                `}
              >
                <div class="space-y-2">
                  <${For} each=${() => skillCalls()}>
                    ${(skill) => html`
                      <div
                        class="rounded-lg p-3 transition"
                        style="border:1px solid #D8DEE6; background:#F5F7FA"
                        onMouseEnter=${(e) => {
                          e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
                        }}
                        onMouseLeave=${(e) => {
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      >
                        <div class="flex items-start gap-2">
                          <span class="text-lg shrink-0">🧩</span>
                          <div class="min-w-0 flex-1">
                            <div class="text-xs font-semibold" style="color:#003366">
                              ${skill.name}
                            </div>
                            <div class="text-gray-400 mt-1" style="font-size:10px">
                              Loaded in this conversation
                            </div>
                          </div>
                        </div>
                      </div>
                    `}
                  <//>
                </div>
              <//>
            <//>
          </div>
        </aside>
      <//>

      <!-- Delete Confirmation Dialog -->
      <${Show} when=${() => deleteConversationId()?.length > 0}>
        <${DeleteConversation}
          conversationId=${() => deleteConversationId()}
          onClose=${() => setDeleteConversationId(null)}
          onDelete=${handleDeleteConversation}
        />
      <//>
    </div>
  `;
}
