import { Download, FileText, CheckCircle } from "lucide-solid";
import { Show } from "solid-js";
import html from "solid-js/html";

import { downloadText } from "../../utils/files.js";
import { getToolResult } from "../../utils/tools.js";

import ToolHeader from "./tool-header.js";

const DOC_TYPE_LABELS = {
  sow: "Statement of Work",
  igce: "IGCE",
  market_research: "Market Research Report",
  acquisition_plan: "Acquisition Plan",
  justification: "Justification & Approval",
};

/**
 * Document Tool Component — displays create_document results with download.
 */
export default function DocumentTool(props) {
  const input = () => props.message?.toolUse?.input || {};
  const result = () => getToolResult(props.message?.toolUse, props.messages);

  const title = () => {
    const r = result();
    return r?.title || input()?.title || "Generating document…";
  };

  const docTypeLabel = () => DOC_TYPE_LABELS[input()?.doc_type] || input()?.doc_type || "Document";

  const rightText = () => {
    const r = result();
    if (!r) return "generating…";
    if (r.error) return "error";
    return `v${r.version || 1}`;
  };

  async function handleDownload(e) {
    e.stopPropagation();
    const r = result();
    if (!r?.downloadUrl) return;
    try {
      const res = await fetch(r.downloadUrl);
      if (res.ok) {
        const text = await res.text();
        const filename = `${r.title || "document"}.md`;
        downloadText(filename, text);
      }
    } catch (err) {
      // Fallback: download preview content
      if (r.preview) {
        downloadText(`${r.title || "document"}.md`, r.preview);
      }
    }
  }

  return html`<article
    class="search-accordion border rounded-3 my-3 min-w-0"
    classList=${() => ({ "is-open": props.isOpen(), "shadow-sm bg-light": props.isOpen() })}
  >
    ${ToolHeader({
      icon: () => html`<${FileText} size="16" class="text-success" />`,
      title: () => html`<span>${docTypeLabel}: <strong>${title}</strong></span>`,
      right: () => html`
        <${Show} when=${() => result()?.downloadUrl}>
          <button
            type="button"
            class="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1 py-0 px-2"
            onClick=${handleDownload}
            title="Download document"
          >
            <${Download} size="14" />
            <small>Download</small>
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
              fallback=${() => html`<div class="p-3 text-muted small">Generating document…</div>`}
            >
              <${Show} when=${() => result()?.error}>
                <div class="p-3 text-danger small">${() => result()?.error}</div>
              <//>
              <${Show} when=${() => !result()?.error}>
                <div class="p-2">
                  <div class="d-flex gap-3 mb-2 small">
                    <span class="badge bg-success-subtle text-success-emphasis">
                      <${CheckCircle} size="12" class="me-1" />${docTypeLabel}
                    </span>
                    <${Show} when=${() => result()?.packageId}>
                      <span class="text-muted">Package: ${() => result()?.packageId}</span>
                    <//>
                    <${Show} when=${() => result()?.s3Key}>
                      <span class="text-muted text-truncate" style="max-width: 300px;"
                        >${() => result()?.s3Key}</span
                      >
                    <//>
                  </div>
                  <${Show} when=${() => result()?.preview}>
                    <pre
                      class="p-2 m-0 small text-wrap bg-body-tertiary rounded"
                      style="max-height: 300px; overflow: auto;"
                    >
${() => result()?.preview}</pre
                    >
                  <//>
                </div>
              <//>
            <//>
          </div>
        </div>
      </div>
    </div>
  </article>`;
}
