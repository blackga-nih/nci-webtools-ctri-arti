import { Download, FileText, Package } from "lucide-solid";
import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import html from "solid-js/html";

import Modal from "../../../components/modal.js";
import PageHeader from "../../../components/page-header.js";
import Tabs from "../../../components/tabs.js";

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "intake", label: "Intake" },
  { value: "drafting", label: "Drafting" },
  { value: "review", label: "Review" },
  { value: "complete", label: "Complete" },
];

const STATUS_COLORS = {
  intake: "bg-info text-dark",
  drafting: "bg-warning text-dark",
  review: "bg-primary",
  complete: "bg-success",
};

const PATHWAY_COLORS = {
  SAP: "bg-secondary",
  FAR: "bg-dark",
  "8(a)": "bg-info text-dark",
  GWAC: "bg-primary",
  BPA: "bg-warning text-dark",
};

function formatCurrency(value) {
  if (!value) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function Workflows() {
  const [status, setStatus] = createSignal("all");
  const [search, setSearch] = createSignal("");
  const [selectedPkg, setSelectedPkg] = createSignal(null);

  const [packages] = createResource(async () => {
    const res = await fetch("/api/v1/packages");
    if (!res.ok) return [];
    return res.json();
  });

  const filtered = createMemo(() => {
    let pkgs = packages() || [];
    const s = status();
    if (s !== "all") pkgs = pkgs.filter((p) => p.status === s);
    const q = search().toLowerCase();
    if (q) pkgs = pkgs.filter((p) => p.title?.toLowerCase().includes(q));
    return pkgs;
  });

  const [checklist] = createResource(
    () => selectedPkg()?.id,
    async (id) => {
      if (!id) return null;
      const res = await fetch(`/api/v1/packages/${id}/checklist`);
      if (!res.ok) return null;
      return res.json();
    }
  );

  return html`
    <div class="container py-4">
      <${PageHeader}
        title="Acquisition Packages"
        description="Track and manage acquisition workflow packages"
      />

      <div class="d-flex flex-wrap gap-3 align-items-center mb-4">
        <${Tabs} items=${STATUS_TABS} active=${status} onSelect=${setStatus} />
        <input
          type="text"
          class="form-control form-control-sm"
          style="max-width: 250px;"
          placeholder="Search packages..."
          value=${search}
          onInput=${(e) => setSearch(e.target.value)}
        />
      </div>

      <${Show}
        when=${() => !packages.loading}
        fallback=${html`
          <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status"></div>
          </div>
        `}
      >
        <${Show}
          when=${() => filtered().length}
          fallback=${html`
            <div class="text-center text-muted py-5">
              <${Package} size=${48} class="mb-3 opacity-25" />
              <div>No packages found.</div>
            </div>
          `}
        >
          <div class="row g-3">
            <${For} each=${filtered}>
              ${(pkg) => {
                const docCount = pkg.documents?.length || 0;
                const totalDocs = pkg.requiredDocuments?.length || docCount;
                return html`
                  <div class="col-sm-6 col-lg-4">
                    <div
                      class="card border-0 shadow-sm h-100"
                      style="cursor: pointer;"
                      onClick=${() => setSelectedPkg(pkg)}
                    >
                      <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                          <h6 class="fw-bold mb-0 lh-sm">${pkg.title}</h6>
                        </div>
                        <div class="d-flex gap-2 mb-2 flex-wrap">
                          <span class=${`badge ${STATUS_COLORS[pkg.status] || "bg-secondary"}`}>
                            ${pkg.status}
                          </span>
                          <${Show} when=${pkg.pathway}>
                            <span
                              class=${`badge ${PATHWAY_COLORS[pkg.pathway] || "bg-light text-dark border"}`}
                            >
                              ${pkg.pathway}
                            </span>
                          <//>
                        </div>
                        <div class="text-muted small mb-1">
                          Est. Value: <strong>${formatCurrency(pkg.estimatedValue)}</strong>
                        </div>
                        <div class="text-muted small mb-2">
                          Documents: ${docCount} / ${totalDocs}
                        </div>
                        <${Show} when=${totalDocs > 0}>
                          <div class="progress" style="height: 4px;">
                            <div
                              class="progress-bar bg-success"
                              style=${`width: ${Math.round((docCount / totalDocs) * 100)}%`}
                            ></div>
                          </div>
                        <//>
                        <div class="text-muted small mt-2">${formatDate(pkg.createdAt)}</div>
                      </div>
                    </div>
                  </div>
                `;
              }}
            <//>
          </div>
        <//>
      <//>

      <!-- Package detail modal -->
      <${Modal}
        open=${() => !!selectedPkg()}
        setOpen=${(v) => !v && setSelectedPkg(null)}
        title=${() =>
          selectedPkg() ? html`<h5 class="mb-0 fw-bold">${selectedPkg().title}</h5>` : ""}
        footer=${html`
          <${Show} when=${() => selectedPkg()}>
            <a
              href=${() => `/api/v1/packages/${selectedPkg()?.id}/export`}
              class="btn btn-primary d-flex align-items-center gap-1"
              target="_blank"
            >
              <${Download} size=${14} /> Export ZIP
            </a>
          <//>
          <button class="btn btn-secondary" onClick=${() => setSelectedPkg(null)}>Close</button>
        `}
      >
        <${Show} when=${() => selectedPkg()}>
          <div>
            <div class="row g-3 mb-3">
              <div class="col-sm-6">
                <div class="small text-muted">Status</div>
                <span
                  class=${() => `badge ${STATUS_COLORS[selectedPkg()?.status] || "bg-secondary"}`}
                >
                  ${() => selectedPkg()?.status}
                </span>
              </div>
              <div class="col-sm-6">
                <div class="small text-muted">Pathway</div>
                <span>${() => selectedPkg()?.pathway || "—"}</span>
              </div>
              <div class="col-sm-6">
                <div class="small text-muted">Estimated Value</div>
                <span>${() => formatCurrency(selectedPkg()?.estimatedValue)}</span>
              </div>
              <div class="col-sm-6">
                <div class="small text-muted">Acquisition Method</div>
                <span>${() => selectedPkg()?.acquisitionMethod || "—"}</span>
              </div>
            </div>

            <${Show} when=${() => selectedPkg()?.requirementDescription}>
              <div class="mb-3">
                <div class="small text-muted fw-bold mb-1">Description</div>
                <p class="small">${() => selectedPkg()?.requirementDescription}</p>
              </div>
            <//>

            <div class="fw-bold small mb-2">Document Checklist</div>
            <${Show}
              when=${() => !checklist.loading}
              fallback=${html` <div class="text-muted small">Loading checklist...</div> `}
            >
              <${For}
                each=${() => checklist()?.checklist || []}
                fallback=${html` <div class="text-muted small">No documents yet.</div> `}
              >
                ${(item) => html`
                  <div class="d-flex align-items-center gap-2 mb-2">
                    <${Show}
                      when=${item.generated}
                      fallback=${html` <span class="text-muted">&#9744;</span> `}
                    >
                      <span class="text-success">&#9745;</span>
                    <//>
                    <${FileText} size=${14} class="text-muted" />
                    <span class="small">${item.docType}</span>
                    <${Show} when=${item.generated}>
                      <span class="badge bg-success small">v${item.document?.version || 1}</span>
                    <//>
                  </div>
                `}
              <//>
            <//>
          </div>
        <//>
      <//>
    </div>
  `;
}
