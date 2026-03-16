import { FileText } from "lucide-solid";
import { createResource, createSignal, For, Show } from "solid-js";
import html from "solid-js/html";

import Modal from "../../components/modal.js";
import PageHeader from "../../components/page-header.js";

export default function TemplateManagement() {
  const [templates] = createResource(async () => {
    const res = await fetch("/api/v1/templates");
    if (!res.ok) return [];
    return res.json();
  });

  const [viewTemplate, setViewTemplate] = createSignal(null);

  const docTypeBadge = (docType) => {
    const colors = {
      "acquisition-plan": "bg-primary",
      igce: "bg-success",
      justification: "bg-warning text-dark",
      "market-research": "bg-info text-dark",
      sow: "bg-secondary",
    };
    return html`<span class=${`badge ${colors[docType] || "bg-light text-dark border"} small`}>
      ${docType}
    </span>`;
  };

  return html`
    <div class="container py-4">
      <${PageHeader}
        title="Templates"
        description="Document templates used for acquisition package generation"
        backHref="/_/admin"
        backLabel="Admin Dashboard"
      />

      <${Show}
        when=${() => !templates.loading}
        fallback=${html`
          <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status"></div>
          </div>
        `}
      >
        <div class="row g-3">
          <${For}
            each=${() => templates() || []}
            fallback=${html`
              <div class="col-12 text-center text-muted py-4">No templates found.</div>
            `}
          >
            ${(tpl) => html`
              <div class="col-sm-6 col-md-4">
                <div class="card border-0 shadow-sm h-100">
                  <div class="card-body d-flex flex-column">
                    <div class="d-flex align-items-center gap-2 mb-2">
                      <${FileText} size=${20} class="text-secondary flex-shrink-0" />
                      <h6 class="mb-0 fw-bold">${tpl.title}</h6>
                    </div>
                    <div class="mb-2">${docTypeBadge(tpl.docType)}</div>
                    <p
                      class="text-muted small flex-grow-1 mb-2"
                      style="max-height: 80px; overflow: hidden;"
                    >
                      ${tpl.preview?.substring(0, 200) || ""}...
                    </p>
                    <button
                      class="btn btn-sm btn-outline-primary mt-auto"
                      onClick=${() => setViewTemplate(tpl)}
                    >
                      Preview Template
                    </button>
                  </div>
                </div>
              </div>
            `}
          <//>
        </div>
      <//>

      <!-- Template preview modal -->
      <${Modal}
        open=${() => !!viewTemplate()}
        setOpen=${(v) => !v && setViewTemplate(null)}
        title=${() =>
          viewTemplate() ? html`<h5 class="mb-0 fw-bold">${viewTemplate().title}</h5>` : ""}
        url=${() =>
          viewTemplate() ? `/api/v1/plugin/data/templates/${viewTemplate().filename}` : null}
        footer=${html`<button class="btn btn-secondary" onClick=${() => setViewTemplate(null)}>
          Close
        </button>`}
      />
    </div>
  `;
}
