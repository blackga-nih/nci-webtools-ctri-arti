import { BookOpen, FileText, Search } from "lucide-solid";
import { createResource, createSignal, For, Show } from "solid-js";
import html from "solid-js/html";

import AdminPageHeader from "../../components/admin/page-header.js";
import AdminStatCard from "../../components/admin/stat-card.js";
import AdminTabs from "../../components/admin/tabs.js";

const AGENT_TABS = [
  { value: "", label: "All" },
  { value: "compliance-strategist", label: "Compliance" },
  { value: "financial-advisor", label: "Financial" },
  { value: "legal-counselor", label: "Legal" },
  { value: "market-intelligence", label: "Market Intel" },
  { value: "public-interest-guardian", label: "Public Interest" },
  { value: "shared", label: "Shared" },
  { value: "supervisor-core", label: "Supervisor" },
  { value: "technical-translator", label: "Technical" },
];

export default function KnowledgeBase() {
  const [agent, setAgent] = createSignal("");
  const [keyword, setKeyword] = createSignal("");
  const [searchInput, setSearchInput] = createSignal("");
  const [selectedKey, setSelectedKey] = createSignal(null);

  const [results] = createResource(
    () => ({ agent: agent(), keyword: keyword() }),
    async ({ agent, keyword }) => {
      const params = new URLSearchParams();
      if (agent) params.set("agent", agent);
      if (keyword) params.set("keyword", keyword);
      const res = await fetch(`/api/v1/knowledge/search?${params}`);
      if (!res.ok) throw new Error("Failed to search knowledge base");
      return res.json();
    }
  );

  const [docContent] = createResource(selectedKey, async (key) => {
    if (!key) return null;
    const res = await fetch(`/api/v1/knowledge/fetch?key=${encodeURIComponent(key)}`);
    if (!res.ok) throw new Error("Failed to fetch document");
    return res.json();
  });

  const handleSearch = (e) => {
    e.preventDefault();
    setKeyword(searchInput());
  };

  return html`
    <div class="min-h-screen bg-gray-50">
      <div class="p-8 max-w-7xl mx-auto">
        <${AdminPageHeader}
          title="Knowledge Base"
          description="Browse the S3-stored knowledge base documents by agent"
          breadcrumbs=${[{ label: "Admin", href: "/_/admin" }, { label: "Knowledge Base" }]}
        />

        <${AdminTabs}
          items=${AGENT_TABS}
          active=${agent}
          onSelect=${(v) => {
            setAgent(v);
            setSelectedKey(null);
          }}
        />

        <!-- Search bar -->
        <form class="mb-6" onSubmit=${handleSearch}>
          <div class="flex gap-2">
            <input
              type="text"
              class="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              placeholder="Search by keyword..."
              value=${searchInput()}
              onInput=${(e) => setSearchInput(e.target.value)}
            />
            <button
              type="submit"
              class="flex items-center gap-2 px-4 py-2.5 bg-nci-primary text-white rounded-xl text-sm font-medium hover:bg-nci-primary-dark transition-colors"
            >
              <${Search} size=${16} /> Search
            </button>
          </div>
        </form>

        <${Show}
          when=${() => !results.loading}
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
              value=${() => results()?.count ?? 0}
              label="Documents Found"
              color="bg-blue-500"
            />
            <${AdminStatCard} icon=${BookOpen} value=${8} label="KB Agents" color="bg-green-500" />
          </div>

          <!-- Two-panel layout -->
          <div
            class="grid gap-6"
            style=${() => (selectedKey() ? "grid-template-columns: 2fr 3fr" : "")}
          >
            <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div class="max-h-[600px] overflow-y-auto">
                <${For}
                  each=${() => results()?.results || []}
                  fallback=${html`
                    <div class="p-12 text-center">
                      <${FileText} size=${40} class="text-gray-300 mx-auto mb-3" />
                      <p class="text-sm font-medium text-gray-500">No documents found</p>
                    </div>
                  `}
                >
                  ${(item) => html`
                    <button
                      class=${() =>
                        `w-full text-left px-5 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                          selectedKey() === item.s3_key
                            ? "bg-nci-primary text-white hover:bg-nci-primary"
                            : ""
                        }`}
                      onClick=${() => setSelectedKey(item.s3_key)}
                    >
                      <div class="font-medium text-sm truncate">${item.filename}</div>
                      <div
                        class=${() =>
                          `text-xs mt-0.5 ${selectedKey() === item.s3_key ? "text-white/70" : "text-gray-500"}`}
                      >
                        ${item.agent}${item.folder ? ` / ${item.folder}` : ""}
                      </div>
                    </button>
                  `}
                <//>
              </div>
            </div>

            <${Show} when=${selectedKey}>
              <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-100">
                  <span class="font-semibold text-sm text-gray-900">${() => selectedKey()}</span>
                </div>
                <${Show}
                  when=${() => !docContent.loading}
                  fallback=${html`
                    <div class="flex justify-center py-12">
                      <div
                        class="w-6 h-6 border-4 border-nci-primary border-t-transparent rounded-full animate-spin"
                      ></div>
                    </div>
                  `}
                >
                  <pre
                    class="p-6 text-sm text-gray-700 overflow-auto"
                    style="max-height:550px;white-space:pre-wrap;word-break:break-word"
                  >
${() => docContent()?.content || "No content"}</pre
                  >
                  <${Show} when=${() => docContent()?.truncated}>
                    <div class="px-6 py-3 border-t border-gray-100 text-center">
                      <span class="text-xs text-amber-600 font-medium">
                        Content truncated (${() => docContent()?.content_length?.toLocaleString()}
                        chars total)
                      </span>
                    </div>
                  <//>
                <//>
              </div>
            <//>
          </div>
        <//>
      </div>
    </div>
  `;
}
