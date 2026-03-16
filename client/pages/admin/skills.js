import { BookOpen, Zap } from "lucide-solid";
import { createResource, createSignal, For, Show } from "solid-js";
import html from "solid-js/html";

import Modal from "../../components/modal.js";
import PageHeader from "../../components/page-header.js";

export default function SkillManagement() {
  const [skills] = createResource(async () => {
    const res = await fetch("/api/v1/skills");
    if (!res.ok) return [];
    return res.json();
  });

  const [viewSkill, setViewSkill] = createSignal(null);

  return html`
    <div class="container py-4">
      <${PageHeader}
        title="Skills"
        description="Bundled acquisition skills from the EAGLE plugin"
        backHref="/_/admin"
        backLabel="Admin Dashboard"
      />

      <${Show}
        when=${() => !skills.loading}
        fallback=${html`
          <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status"></div>
          </div>
        `}
      >
        <div class="row g-3">
          <${For}
            each=${() => skills() || []}
            fallback=${html`
              <div class="col-12 text-center text-muted py-4">No skills found.</div>
            `}
          >
            ${(skill) => html`
              <div class="col-sm-6 col-md-4 col-lg-3">
                <div class="card border-0 shadow-sm h-100">
                  <div class="card-body d-flex flex-column">
                    <div class="d-flex align-items-center gap-2 mb-2">
                      <div
                        class="rounded-3 p-2 bg-light d-flex align-items-center justify-content-center"
                        style="width: 36px; height: 36px;"
                      >
                        <${Zap} size=${18} class="text-warning" />
                      </div>
                      <h6 class="mb-0 fw-bold">${skill.name}</h6>
                    </div>
                    <p class="text-muted small flex-grow-1 mb-2">
                      ${skill.description || "No description available."}
                    </p>
                    <button
                      class="btn btn-sm btn-outline-primary d-flex align-items-center gap-1 mt-auto"
                      onClick=${() => setViewSkill(skill)}
                    >
                      <${BookOpen} size=${14} /> View Details
                    </button>
                  </div>
                </div>
              </div>
            `}
          <//>
        </div>
      <//>

      <!-- Skill detail modal -->
      <${Modal}
        open=${() => !!viewSkill()}
        setOpen=${(v) => !v && setViewSkill(null)}
        title=${() => (viewSkill() ? html`<h5 class="mb-0 fw-bold">${viewSkill().name}</h5>` : "")}
        url=${() => (viewSkill() ? `/api/v1/skill/${viewSkill().name}` : null)}
        footer=${html`<button class="btn btn-secondary" onClick=${() => setViewSkill(null)}>
          Close
        </button>`}
      />
    </div>
  `;
}
