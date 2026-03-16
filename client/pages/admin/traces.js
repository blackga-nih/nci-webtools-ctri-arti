import { Activity, Clock, Download, Hash, Zap } from "lucide-solid";
import { createResource, createSignal, For, Show } from "solid-js";
import html from "solid-js/html";

import JsonViewer from "../../components/json-viewer.js";
import PageHeader from "../../components/page-header.js";

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
      status === "success" ? "bg-success" : status === "error" ? "bg-danger" : "bg-secondary";
    return html`<span class=${`badge ${cls}`}>${status}</span>`;
  };

  const totalPages = () => Math.ceil((list()?.meta?.total || 0) / limit);

  return html`
    <div class="container-fluid py-4">
      <${PageHeader}
        title="Trace Viewer"
        description="Inspect inference request traces"
        backHref="/_/admin"
        backLabel="Admin Dashboard"
      />

      <div class="row g-3">
        <!-- Left: Trace list -->
        <div class=${() => (selectedId() ? "col-lg-5" : "col-12")}>
          <${Show}
            when=${() => !list.loading}
            fallback=${html`
              <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status"></div>
              </div>
            `}
          >
            <div class="card border-0 shadow-sm">
              <div class="list-group list-group-flush" style="max-height: 70vh; overflow-y: auto;">
                <${For}
                  each=${() => list()?.data || []}
                  fallback=${html`
                    <div class="text-center text-muted py-4 small">No traces recorded yet.</div>
                  `}
                >
                  ${(trace) => html`
                    <button
                      class=${() =>
                        `list-group-item list-group-item-action ${selectedId() === trace.traceId ? "active" : ""}`}
                      onClick=${() => setSelectedId(trace.traceId)}
                    >
                      <div class="d-flex justify-content-between align-items-center">
                        <code class="small">${trace.traceId}</code>
                        ${statusBadge(trace.status)}
                      </div>
                      <div class="d-flex gap-3 mt-1 small text-muted">
                        <span><${Clock} size=${12} /> ${trace.durationMs ?? "—"}ms</span>
                        <span
                          ><${Hash} size=${12} /> ${(trace.inputTokens || 0) +
                          (trace.outputTokens || 0)}
                          tok</span
                        >
                        <span>${new Date(trace.createdAt).toLocaleString()}</span>
                      </div>
                      <${Show} when=${() => trace.toolsCalled?.length}>
                        <div class="d-flex gap-1 mt-1 flex-wrap">
                          <${For} each=${() => trace.toolsCalled}>
                            ${(t) =>
                              html`<span class="badge bg-light text-dark border small">${t}</span>`}
                          <//>
                        </div>
                      <//>
                    </button>
                  `}
                <//>
              </div>
              <div class="card-footer d-flex justify-content-between align-items-center small">
                <span>${() => list()?.meta?.total || 0} traces</span>
                <div class="d-flex gap-2">
                  <button
                    class="btn btn-sm btn-outline-primary"
                    disabled=${() => page() <= 1}
                    onClick=${() => setPage(Math.max(1, page() - 1))}
                  >
                    Prev
                  </button>
                  <span class="align-self-center">${page} / ${totalPages}</span>
                  <button
                    class="btn btn-sm btn-outline-primary"
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

        <!-- Right: Trace detail -->
        <${Show} when=${() => selectedId()}>
          <div class="col-lg-7">
            <${Show}
              when=${() => !detail.loading && detail()}
              fallback=${html`
                <div class="text-center py-5">
                  <div class="spinner-border text-primary" role="status"></div>
                </div>
              `}
            >
              <div class="card border-0 shadow-sm">
                <div class="card-header d-flex justify-content-between align-items-center bg-white">
                  <span class="fw-bold">Trace Detail</span>
                  <button
                    class="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
                    onClick=${downloadTrace}
                  >
                    <${Download} size=${14} /> Download JSON
                  </button>
                </div>
                <div class="card-body" style="max-height: 70vh; overflow-y: auto;">
                  <!-- Metadata -->
                  <div class="row g-2 mb-3">
                    <div class="col-sm-6">
                      <div class="small text-muted">Trace ID</div>
                      <code class="small">${() => detail()?.traceId}</code>
                    </div>
                    <div class="col-sm-3">
                      <div class="small text-muted">Status</div>
                      ${() => statusBadge(detail()?.status)}
                    </div>
                    <div class="col-sm-3">
                      <div class="small text-muted">Duration</div>
                      <span class="small fw-semibold">${() => detail()?.durationMs ?? "—"}ms</span>
                    </div>
                    <div class="col-sm-3">
                      <div class="small text-muted">Input Tokens</div>
                      <span class="small"
                        >${() => (detail()?.inputTokens || 0).toLocaleString()}</span
                      >
                    </div>
                    <div class="col-sm-3">
                      <div class="small text-muted">Output Tokens</div>
                      <span class="small"
                        >${() => (detail()?.outputTokens || 0).toLocaleString()}</span
                      >
                    </div>
                    <div class="col-sm-3">
                      <div class="small text-muted">Cost</div>
                      <span class="small"
                        >${() => (detail()?.cost != null ? `$${detail().cost}` : "—")}</span
                      >
                    </div>
                    <div class="col-sm-3">
                      <div class="small text-muted">Created</div>
                      <span class="small"
                        >${() =>
                          detail()?.createdAt
                            ? new Date(detail().createdAt).toLocaleString()
                            : "—"}</span
                      >
                    </div>
                  </div>

                  <!-- Tools Called -->
                  <${Show} when=${() => detail()?.toolsCalled?.length}>
                    <h6 class="fw-bold small">Tools Called</h6>
                    <div class="d-flex gap-1 flex-wrap mb-3">
                      <${For} each=${() => detail()?.toolsCalled || []}>
                        ${(t) => html`<span class="badge bg-info text-dark">${t}</span>`}
                      <//>
                    </div>
                  <//>

                  <!-- Spans -->
                  <${Show} when=${() => detail()?.spans?.length}>
                    <h6 class="fw-bold small">Spans</h6>
                    <div class="mb-3">
                      <${For} each=${() => detail()?.spans || []}>
                        ${(span) => html`
                          <div class="d-flex align-items-center gap-2 mb-1">
                            <span class="badge bg-secondary">${span.type}</span>
                            <span class="small fw-semibold">${span.name}</span>
                          </div>
                        `}
                      <//>
                    </div>
                  <//>

                  <!-- Full JSON -->
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
  `;
}
