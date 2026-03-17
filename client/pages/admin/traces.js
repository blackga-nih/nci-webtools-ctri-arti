import { Activity, Clock, Download, Hash, Zap } from "lucide-solid";
import { createResource, createSignal, For, Show } from "solid-js";
import html from "solid-js/html";

import AdminPageHeader from "../../components/admin/page-header.js";
import JsonViewer from "../../components/json-viewer.js";

export default function TraceViewer() {
  const [page, setPage] = createSignal(1);
  const [selectedId, setSelectedId] = createSignal(null);
  const limit = 30;

  const [list] = createResource(
    () => page(),
    async (p) => {
      const offset = (p - 1) * limit;
      const res = await fetch(`/api/v1/admin/traces?limit=${limit}&offset=${offset}`);
      if (!res.ok) throw new Error("Failed to load traces");
      return res.json();
    }
  );

  const [detail] = createResource(
    () => selectedId(),
    async (traceId) => {
      if (!traceId) return null;
      const res = await fetch(`/api/v1/admin/traces/${traceId}`);
      if (!res.ok) throw new Error("Failed to load trace");
      return res.json();
    }
  );

  const downloadTrace = () => {
    const d = detail();
    if (!d?.traceJson) return;
    const blob = new Blob([JSON.stringify(d.traceJson, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trace-${d.traceId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge = (status) => {
    const cls =
      status === "success"
        ? "bg-green-50 text-green-700"
        : status === "error"
          ? "bg-red-50 text-red-700"
          : "bg-gray-100 text-gray-600";
    return html`<span class=${`text-xs px-2 py-1 rounded-full font-medium ${cls}`}
      >${status}</span
    >`;
  };

  const totalPages = () => Math.ceil((list()?.meta?.total || 0) / limit);

  return html`
    <div class="min-h-screen bg-gray-50">
      <div class="p-8 max-w-7xl mx-auto">
        <${AdminPageHeader}
          title="Trace Viewer"
          description="Inspect inference request traces"
          breadcrumbs=${[{ label: "Admin", href: "/_/admin" }, { label: "Traces" }]}
        />

        <div
          class="grid gap-6"
          style=${() => (selectedId() ? "grid-template-columns: 5fr 7fr" : "")}
        >
          <!-- Trace list -->
          <div>
            <${Show}
              when=${() => !list.loading}
              fallback=${html`
                <div class="flex justify-center py-20">
                  <div
                    class="w-8 h-8 border-4 border-nci-primary border-t-transparent rounded-full animate-spin"
                  ></div>
                </div>
              `}
            >
              <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div class="max-h-[70vh] overflow-y-auto">
                  <${For}
                    each=${() => list()?.data || []}
                    fallback=${html`
                      <div class="p-12 text-center">
                        <p class="text-sm text-gray-500">No traces recorded yet.</p>
                      </div>
                    `}
                  >
                    ${(trace) => html`
                      <button
                        class=${() =>
                          `w-full text-left px-5 py-4 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                            selectedId() === trace.traceId
                              ? "bg-nci-primary text-white hover:bg-nci-primary"
                              : ""
                          }`}
                        onClick=${() => setSelectedId(trace.traceId)}
                      >
                        <div class="flex justify-between items-center">
                          <code class="text-xs">${trace.traceId}</code>
                          ${statusBadge(trace.status)}
                        </div>
                        <div
                          class=${() =>
                            `flex gap-3 mt-1 text-xs ${selectedId() === trace.traceId ? "text-white/70" : "text-gray-500"}`}
                        >
                          <span class="flex items-center gap-1"
                            ><${Clock} size=${12} /> ${trace.durationMs ?? "—"}ms</span
                          >
                          <span class="flex items-center gap-1"
                            ><${Hash} size=${12} /> ${(trace.inputTokens || 0) +
                            (trace.outputTokens || 0)}
                            tok</span
                          >
                          <span>${new Date(trace.createdAt).toLocaleString()}</span>
                        </div>
                        <${Show} when=${() => trace.toolsCalled?.length}>
                          <div class="flex gap-1 mt-2 flex-wrap">
                            <${For} each=${() => trace.toolsCalled}>
                              ${(t) =>
                                html`<span
                                  class=${() =>
                                    `text-[10px] px-2 py-0.5 rounded-full font-medium ${selectedId() === trace.traceId ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"}`}
                                  >${t}</span
                                >`}
                            <//>
                          </div>
                        <//>
                      </button>
                    `}
                  <//>
                </div>
                <div class="flex justify-between items-center px-5 py-3 border-t border-gray-100">
                  <span class="text-sm text-gray-500"
                    >${() => list()?.meta?.total || 0} traces</span
                  >
                  <div class="flex gap-2">
                    <button
                      class="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                      disabled=${() => page() <= 1}
                      onClick=${() => setPage(Math.max(1, page() - 1))}
                    >
                      Prev
                    </button>
                    <span class="text-sm text-gray-500 self-center">${page} / ${totalPages}</span>
                    <button
                      class="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                      disabled=${() => page() >= totalPages()}
                      onClick=${() => setPage(page() + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            <//>
          </div>

          <!-- Trace detail -->
          <${Show} when=${() => selectedId()}>
            <div>
              <${Show}
                when=${() => !detail.loading && detail()}
                fallback=${html`
                  <div class="flex justify-center py-20">
                    <div
                      class="w-8 h-8 border-4 border-nci-primary border-t-transparent rounded-full animate-spin"
                    ></div>
                  </div>
                `}
              >
                <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div class="flex justify-between items-center px-6 py-4 border-b border-gray-100">
                    <span class="font-bold text-gray-900">Trace Detail</span>
                    <button
                      class="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                      onClick=${downloadTrace}
                    >
                      <${Download} size=${14} /> Download JSON
                    </button>
                  </div>
                  <div class="p-6 max-h-[70vh] overflow-y-auto">
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div>
                        <div class="text-xs text-gray-500 mb-1">Trace ID</div>
                        <code class="text-xs text-gray-900">${() => detail()?.traceId}</code>
                      </div>
                      <div>
                        <div class="text-xs text-gray-500 mb-1">Status</div>
                        ${() => statusBadge(detail()?.status)}
                      </div>
                      <div>
                        <div class="text-xs text-gray-500 mb-1">Duration</div>
                        <span class="text-sm font-semibold text-gray-900"
                          >${() => detail()?.durationMs ?? "—"}ms</span
                        >
                      </div>
                      <div>
                        <div class="text-xs text-gray-500 mb-1">Cost</div>
                        <span class="text-sm text-gray-900"
                          >${() => (detail()?.cost != null ? `$${detail().cost}` : "—")}</span
                        >
                      </div>
                      <div>
                        <div class="text-xs text-gray-500 mb-1">Input Tokens</div>
                        <span class="text-sm text-gray-900 tabular-nums"
                          >${() => (detail()?.inputTokens || 0).toLocaleString()}</span
                        >
                      </div>
                      <div>
                        <div class="text-xs text-gray-500 mb-1">Output Tokens</div>
                        <span class="text-sm text-gray-900 tabular-nums"
                          >${() => (detail()?.outputTokens || 0).toLocaleString()}</span
                        >
                      </div>
                      <div>
                        <div class="text-xs text-gray-500 mb-1">Created</div>
                        <span class="text-sm text-gray-900"
                          >${() =>
                            detail()?.createdAt
                              ? new Date(detail().createdAt).toLocaleString()
                              : "—"}</span
                        >
                      </div>
                    </div>

                    <${Show} when=${() => detail()?.toolsCalled?.length}>
                      <h4 class="text-sm font-bold text-gray-900 mb-2">Tools Called</h4>
                      <div class="flex gap-1 flex-wrap mb-4">
                        <${For} each=${() => detail()?.toolsCalled || []}>
                          ${(t) =>
                            html`<span
                              class="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium"
                              >${t}</span
                            >`}
                        <//>
                      </div>
                    <//>

                    <${Show} when=${() => detail()?.spans?.length}>
                      <h4 class="text-sm font-bold text-gray-900 mb-2">Spans</h4>
                      <div class="mb-4 space-y-1">
                        <${For} each=${() => detail()?.spans || []}>
                          ${(span) => html`
                            <div class="flex items-center gap-2">
                              <span
                                class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                                >${span.type}</span
                              >
                              <span class="text-sm font-medium text-gray-900">${span.name}</span>
                            </div>
                          `}
                        <//>
                      </div>
                    <//>

                    <${Show} when=${() => detail()?.traceJson}>
                      <${JsonViewer} data=${() => detail()?.traceJson} label="Full Trace" />
                    <//>
                  </div>
                </div>
              <//>
            </div>
          <//>
        </div>
      </div>
    </div>
  `;
}
