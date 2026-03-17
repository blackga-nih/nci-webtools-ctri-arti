import { FileText, X } from "lucide-solid";
import { createResource, createSignal, For, Show } from "solid-js";
import html from "solid-js/html";

import AdminPageHeader from "../../components/admin/page-header.js";
import AdminStatCard from "../../components/admin/stat-card.js";
import { getMarked } from "../../utils/utils.js";

const DOC_TYPE_COLORS = {
  "acquisition-plan": "bg-blue-50 text-blue-700",
  igce: "bg-green-50 text-green-700",
  justification: "bg-amber-50 text-amber-700",
  "market-research": "bg-cyan-50 text-cyan-700",
  sow: "bg-gray-100 text-gray-600",
};

export default function TemplateManagement() {
  const [templates] = createResource(async () => {
    const res = await fetch("/api/v1/templates");
    if (!res.ok) return [];
    return res.json();
  });

  const [viewTemplate, setViewTemplate] = createSignal(null);

  const [templateContent] = createResource(
    () => viewTemplate()?.filename,
    async (filename) => {
      if (!filename) return null;
      const res = await fetch(`/api/v1/plugin/data/templates/${filename}`);
      if (!res.ok) return null;
      const text = await res.text();
      return getMarked().parse(text);
    }
  );

  const docTypeBadge = (docType) => {
    const cls = DOC_TYPE_COLORS[docType] || "bg-gray-100 text-gray-600";
    return html`<span class=${`text-xs px-2 py-1 rounded-full font-medium ${cls}`}
      >${docType}</span
    >`;
  };

  return html`
    <div class="min-h-screen bg-gray-50">
      <div class="p-8 max-w-7xl mx-auto">
        <${AdminPageHeader}
          title="Templates"
          description="Document templates used for acquisition package generation"
          breadcrumbs=${[{ label: "Admin", href: "/_/admin" }, { label: "Templates" }]}
        />

        <${Show}
          when=${() => !templates.loading}
          fallback=${html`
            <div class="flex justify-center py-20">
              <div
                class="w-8 h-8 border-4 border-nci-primary border-t-transparent rounded-full animate-spin"
              ></div>
            </div>
          `}
        >
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <${AdminStatCard}
              icon=${FileText}
              value=${() => (templates() || []).length}
              label="Total Templates"
              color="bg-purple-500"
            />
          </div>

          <div
            class="grid gap-6"
            style=${() => (viewTemplate() ? "grid-template-columns: 2fr 3fr" : "")}
          >
            <div
              class="grid grid-cols-1 ${() =>
                viewTemplate() ? "" : "sm:grid-cols-2 lg:grid-cols-3"} gap-4"
            >
              <${For}
                each=${() => templates() || []}
                fallback=${html`
                  <div class="col-span-full p-12 text-center">
                    <${FileText} size=${40} class="text-gray-300 mx-auto mb-3" />
                    <p class="text-sm text-gray-500">No templates found.</p>
                  </div>
                `}
              >
                ${(tpl) => html`
                  <div
                    class=${() =>
                      `bg-white rounded-2xl border cursor-pointer transition-all hover:shadow-md ${
                        viewTemplate()?.filename === tpl.filename
                          ? "border-nci-primary ring-2 ring-nci-primary/20"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    onClick=${() => setViewTemplate(tpl)}
                  >
                    <div class="p-5 flex flex-col h-full">
                      <div class="flex items-center gap-3 mb-3">
                        <div class="p-2.5 rounded-xl bg-purple-500 text-white">
                          <${FileText} size=${18} />
                        </div>
                        <h3 class="font-bold text-gray-900 text-sm truncate">${tpl.title}</h3>
                      </div>
                      <div class="mb-2">${docTypeBadge(tpl.docType)}</div>
                      <p
                        class="text-sm text-gray-500 flex-1 mb-3"
                        style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden"
                      >
                        ${tpl.preview?.substring(0, 200) || ""}
                      </p>
                      <span class="text-sm font-medium text-nci-primary">Preview Template</span>
                    </div>
                  </div>
                `}
              <//>
            </div>

            <!-- Template preview panel -->
            <${Show} when=${viewTemplate}>
              <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div class="flex justify-between items-center px-6 py-4 border-b border-gray-100">
                  <div class="min-w-0 flex-1">
                    <span class="font-bold text-gray-900">${() => viewTemplate()?.title}</span>
                    <div class="mt-1">${() => docTypeBadge(viewTemplate()?.docType)}</div>
                  </div>
                  <button
                    class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors ml-3 shrink-0"
                    onClick=${() => setViewTemplate(null)}
                  >
                    <${X} size=${16} />
                  </button>
                </div>
                <div class="p-6 max-h-[70vh] overflow-y-auto">
                  <${Show}
                    when=${() => !templateContent.loading && templateContent()}
                    fallback=${html`
                      <div class="flex justify-center py-12">
                        <div
                          class="w-6 h-6 border-4 border-nci-primary border-t-transparent rounded-full animate-spin"
                        ></div>
                      </div>
                    `}
                  >
                    <div
                      class="prose prose-sm max-w-none text-gray-700"
                      innerHTML=${templateContent}
                    />
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
