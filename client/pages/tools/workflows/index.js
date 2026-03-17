import { Check, Download, ExternalLink, FileText, Lock, Package, Send } from "lucide-solid";
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

  const [packages, { refetch: refetchPackages }] = createResource(async () => {
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

  const [pkgDetail] = createResource(
    () => selectedPkg()?.id,
    async (id) => {
      if (!id) return null;
      const [pkgRes, docsRes] = await Promise.all([
        fetch(`/api/v1/packages/${id}`),
        fetch(`/api/v1/packages/${id}/documents`),
      ]);
      const pkg = pkgRes.ok ? await pkgRes.json() : null;
      const docs = docsRes.ok ? await docsRes.json() : [];
      return { pkg, docs };
    }
  );
  const [submitting, setSubmitting] = createSignal(false);

  const handleSubmit = async () => {
    const id = selectedPkg()?.id;
    if (!id) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/packages/${id}/submit`, { method: "POST" });
      if (res.ok) {
        setSelectedPkg(null);
        refetchPackages();
      } else {
        const err = await res.json();
        alert(err.error || "Submit failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

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
            <${Show}
              when=${() => {
                const detail = pkgDetail();
                return (
                  detail?.pkg?.checklist?.missing?.length === 0 &&
                  detail?.pkg?.status === "drafting"
                );
              }}
            >
              <button
                class="btn btn-success d-flex align-items-center gap-1"
                disabled=${submitting}
                onClick=${handleSubmit}
              >
                <${Send} size=${14} /> Submit for Review
              </button>
            <//>
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
              when=${() => !pkgDetail.loading}
              fallback=${html` <div class="text-muted small">Loading...</div> `}
            >
              <${Show} when=${() => pkgDetail()?.pkg?.checklist}>
                <div class="mb-2">
                  <div class="progress mb-2" style="height: 6px;">
                    <div
                      class="progress-bar bg-success"
                      style=${() => `width: ${pkgDetail()?.pkg?.checklist?.pct || 0}%`}
                    ></div>
                  </div>
                  <div class="small text-muted mb-2">
                    ${() => pkgDetail()?.pkg?.checklist?.pct || 0}% complete
                  </div>
                </div>

                <${For} each=${() => pkgDetail()?.pkg?.checklist?.required || []}>
                  ${(item) => {
                    const doc = () => pkgDetail()?.docs?.find((d) => d.docType === item.docType);
                    const isComplete = () => !!doc();
                    return html`
                      <div
                        class="d-flex align-items-center gap-2 mb-2 p-2 rounded"
                        style=${() =>
                          isComplete()
                            ? "background: rgba(25,135,84,0.08);"
                            : "background: rgba(108,117,125,0.06);"}
                      >
                        <${Show}
                          when=${isComplete}
                          fallback=${html` <span class="text-muted opacity-50">&#9744;</span> `}
                        >
                          <${Check} size=${16} class="text-success" />
                        <//>
                        <${FileText}
                          size=${14}
                          class=${() => (isComplete() ? "text-success" : "text-muted")}
                        />
                        <span class="small flex-grow-1">${item.label}</span>
                        <${Show} when=${isComplete}>
                          <span class="badge bg-success-subtle text-success small">
                            v${() => doc()?.version || 1}
                          </span>
                          <${Show} when=${() => doc()?.status === "final"}>
                            <${Lock} size=${12} class="text-muted" title="Finalized" />
                          <//>
                          <${Show} when=${() => doc()?.downloadUrl}>
                            <a
                              href=${() => doc()?.downloadUrl}
                              target="_blank"
                              class="btn btn-sm btn-outline-primary py-0 px-1 d-flex align-items-center gap-1"
                              title="Download"
                              onClick=${(e) => e.stopPropagation()}
                            >
                              <${ExternalLink} size=${12} />
                            </a>
                          <//>
                        <//>
                      </div>
                    `;
                  }}
                <//>
              <//>

              <!-- Missing docs callout -->
              <${Show} when=${() => (pkgDetail()?.pkg?.checklist?.missing?.length || 0) > 0}>
                <div class="alert alert-warning small py-2 mt-2 mb-0">
                  ${() => pkgDetail()?.pkg?.checklist?.missing?.length} document(s) still needed
                  before this package can be submitted.
                </div>
              <//>
            <//>
          </div>
        <//>
      <//>
    </div>
  `;
}
