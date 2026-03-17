import { BookOpen, X, Zap } from "lucide-solid";
import { createResource, createSignal, For, Show } from "solid-js";
import html from "solid-js/html";

import AdminPageHeader from "../../components/admin/page-header.js";
import AdminStatCard from "../../components/admin/stat-card.js";
import { getMarked } from "../../utils/utils.js";

export default function SkillManagement() {
  const [skills] = createResource(async () => {
    const res = await fetch("/api/v1/skills");
    if (!res.ok) return [];
    return res.json();
  });

  const [viewSkill, setViewSkill] = createSignal(null);

  const [skillDetail] = createResource(
    () => viewSkill()?.name,
    async (name) => {
      if (!name) return null;
      const res = await fetch(`/api/v1/skill/${name}`);
      if (!res.ok) return null;
      const text = await res.text();
      return getMarked().parse(text);
    }
  );

  return html`
    <div class="min-h-screen bg-gray-50">
      <div class="p-8 max-w-7xl mx-auto">
        <${AdminPageHeader}
          title="Skills"
          description="Bundled acquisition skills from the EAGLE plugin"
          breadcrumbs=${[{ label: "Admin", href: "/_/admin" }, { label: "Skills" }]}
        />

        <${Show}
          when=${() => !skills.loading}
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
              icon=${Zap}
              value=${() => (skills() || []).length}
              label="Total Skills"
              color="bg-amber-500"
            />
          </div>

          <div
            class="grid gap-6"
            style=${() => (viewSkill() ? "grid-template-columns: 2fr 3fr" : "")}
          >
            <div
              class="grid grid-cols-1 ${() =>
                viewSkill() ? "" : "sm:grid-cols-2 lg:grid-cols-3"} gap-4"
            >
              <${For}
                each=${() => skills() || []}
                fallback=${html`
                  <div class="col-span-full p-12 text-center">
                    <p class="text-sm text-gray-500">No skills found.</p>
                  </div>
                `}
              >
                ${(skill) => html`
                  <div
                    class=${() =>
                      `bg-white rounded-2xl border cursor-pointer transition-all hover:shadow-md ${
                        viewSkill()?.name === skill.name
                          ? "border-nci-primary ring-2 ring-nci-primary/20"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    onClick=${() => setViewSkill(skill)}
                  >
                    <div class="p-5 flex flex-col h-full">
                      <div class="flex items-center gap-3 mb-3">
                        <div class="p-2.5 rounded-xl bg-amber-500 text-white">
                          <${Zap} size=${18} />
                        </div>
                        <h3 class="font-bold text-gray-900 text-sm">${skill.name}</h3>
                      </div>
                      <p
                        class="text-sm text-gray-500 flex-1 mb-3 line-clamp-2"
                        style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden"
                      >
                        ${skill.description || "No description available."}
                      </p>
                      <button
                        class="flex items-center gap-1.5 text-sm font-medium text-nci-primary hover:text-nci-primary-dark transition-colors"
                        onClick=${(e) => {
                          e.stopPropagation();
                          setViewSkill(skill);
                        }}
                      >
                        <${BookOpen} size=${14} /> View Details
                      </button>
                    </div>
                  </div>
                `}
              <//>
            </div>

            <!-- Skill detail panel -->
            <${Show} when=${viewSkill}>
              <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div class="flex justify-between items-center px-6 py-4 border-b border-gray-100">
                  <div>
                    <span class="font-bold text-gray-900">${() => viewSkill()?.name}</span>
                    <p class="text-sm text-gray-500 mt-0.5">${() => viewSkill()?.description}</p>
                  </div>
                  <button
                    class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    onClick=${() => setViewSkill(null)}
                  >
                    <${X} size=${16} />
                  </button>
                </div>
                <div class="p-6 max-h-[70vh] overflow-y-auto">
                  <${Show}
                    when=${() => !skillDetail.loading && skillDetail()}
                    fallback=${html`
                      <div class="flex justify-center py-12">
                        <div
                          class="w-6 h-6 border-4 border-nci-primary border-t-transparent rounded-full animate-spin"
                        ></div>
                      </div>
                    `}
                  >
                    <div class="prose prose-sm max-w-none text-gray-700" innerHTML=${skillDetail} />
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
