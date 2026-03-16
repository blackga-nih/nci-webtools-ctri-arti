import { Package, CheckCircle, Circle, Download } from "lucide-solid";
import { For, Show } from "solid-js";
import html from "solid-js/html";

import { getToolResult } from "../../utils/tools.js";

import ToolHeader from "./tool-header.js";

const PATHWAY_LABELS = {
  micro_purchase: "Micro-Purchase",
  simplified: "Simplified Acquisition",
  full_competition: "Full & Open Competition",
  sole_source: "Sole Source",
};

const STATUS_COLORS = {
  intake: "bg-info-subtle text-info-emphasis",
  drafting: "bg-warning-subtle text-warning-emphasis",
  review: "bg-primary-subtle text-primary-emphasis",
  complete: "bg-success-subtle text-success-emphasis",
};

/**
 * Package Tool Component — displays manage_package results (create/status/checklist).
 */
export default function PackageTool(props) {
  const input = () => props.message?.toolUse?.input || {};
  const result = () => getToolResult(props.message?.toolUse, props.messages);

  const operation = () => input()?.operation || "status";

  const title = () => {
    const r = result();
    if (!r) return "Loading package…";
    if (r.title) return r.title;
    if (r.required) return "Package Checklist";
    return "Package";
  };

  const rightText = () => {
    const r = result();
    if (!r) return "loading…";
    if (r.checklist) return `${r.checklist.pct}% complete`;
    if (r.pct !== undefined) return `${r.pct}% complete`;
    if (r.id) return r.pathway ? PATHWAY_LABELS[r.pathway] || r.pathway : r.id;
    return "";
  };

  const checklist = () => {
    const r = result();
    if (!r) return null;
    // Direct checklist response (from operation: "checklist")
    if (r.required && !r.checklist) return r;
    // Nested checklist (from operation: "create" or "status")
    return r.checklist || null;
  };

  async function handleExport(e) {
    e.stopPropagation();
    const r = result();
    if (!r?.id) return;
    try {
      const res = await fetch(`/api/v1/packages/${encodeURIComponent(r.id)}/export`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${r.title || r.id}-package.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Package export error:", err);
    }
  }

  return html`<article
    class="search-accordion border rounded-3 my-3 min-w-0"
    classList=${() => ({ "is-open": props.isOpen(), "shadow-sm bg-light": props.isOpen() })}
  >
    ${ToolHeader({
      icon: () => html`<${Package} size="16" class="text-primary" />`,
      title,
      right: () => html`
        <${Show} when=${() => result()?.id && checklist()?.pct === 100}>
          <button
            type="button"
            class="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1 py-0 px-2"
            onClick=${handleExport}
            title="Export package as ZIP"
          >
            <${Download} size="14" />
            <small>Export</small>
          </button>
        <//>
        <small class="text-muted-contrast ms-1">${rightText}</small>
      `,
      isOpen: props.isOpen,
      onToggle: props.onToggle,
      bodyId: props.bodyId,
    })}

    <div
      id=${props.bodyId}
      class="search-accordion__body"
      classList=${() => ({ show: props.isOpen() })}
    >
      <div class="accordion-inner">
        <div class="mask-fade-bottom">
          <div class="overflow-auto pe-1 search-accordion__scroll">
            <${Show}
              when=${() => result()}
              fallback=${() => html`<div class="p-3 text-muted small">Loading…</div>`}
            >
              <div class="p-2">
                <!-- Package metadata -->
                <${Show} when=${() => result()?.id}>
                  <div class="d-flex flex-wrap gap-2 mb-2 small">
                    <span
                      class="badge ${() =>
                        STATUS_COLORS[result()?.status] || "bg-secondary-subtle"}"
                      >${() => result()?.status}</span
                    >
                    <${Show} when=${() => result()?.pathway}>
                      <span class="badge bg-body-secondary text-body"
                        >${() => PATHWAY_LABELS[result()?.pathway] || result()?.pathway}</span
                      >
                    <//>
                    <${Show} when=${() => result()?.estimatedValue}>
                      <span class="text-muted"
                        >$${() => result()?.estimatedValue?.toLocaleString()}</span
                      >
                    <//>
                    <span class="text-muted font-monospace">${() => result()?.id}</span>
                  </div>
                <//>

                <!-- Checklist -->
                <${Show} when=${checklist}>
                  <div class="mt-2">
                    <!-- Progress bar -->
                    <div class="d-flex align-items-center gap-2 mb-2">
                      <div
                        class="progress flex-grow-1"
                        role="progressbar"
                        style="height: 6px;"
                        aria-valuenow=${() => checklist()?.pct || 0}
                        aria-valuemin="0"
                        aria-valuemax="100"
                      >
                        <div
                          class="progress-bar ${() =>
                            checklist()?.pct === 100 ? "bg-success" : "bg-primary"}"
                          style=${() => `width: ${checklist()?.pct || 0}%`}
                        ></div>
                      </div>
                      <small class="text-muted"
                        >${() => checklist()?.completed?.length || 0}/${() =>
                          checklist()?.required?.length || 0}</small
                      >
                    </div>

                    <!-- Required documents list -->
                    <div class="list-group list-group-flush">
                      <${For} each=${() => checklist()?.required || []}>
                        ${(item) => {
                          const done = () =>
                            checklist()?.completed?.some((c) => c.docType === item.docType);
                          return html`
                            <div
                              class="list-group-item d-flex align-items-center gap-2 py-1 px-2 border-0 small"
                            >
                              <${Show}
                                when=${done}
                                fallback=${() =>
                                  html`<${Circle} size="14" class="text-muted flex-shrink-0" />`}
                              >
                                <${CheckCircle} size="14" class="text-success flex-shrink-0" />
                              <//>
                              <span class=${() => (done() ? "text-body-emphasis" : "text-muted")}
                                >${item.label}</span
                              >
                            </div>
                          `;
                        }}
                      <//>
                    </div>
                  </div>
                <//>
              </div>
            <//>
          </div>
        </div>
      </div>
    </div>
  </article>`;
}
