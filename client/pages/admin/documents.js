import { DollarSign, Download, FileText, Hash } from "lucide-solid";
import { createResource, createSignal, Show } from "solid-js";
import html from "solid-js/html";

import { AdminDataTable } from "../../components/admin/data-table.js";
import AdminPageHeader from "../../components/admin/page-header.js";
import AdminStatCard from "../../components/admin/stat-card.js";
import AdminTabs from "../../components/admin/tabs.js";

const DOC_TYPES = [
  { value: "all", label: "All" },
  { value: "statement_of_work", label: "Statement of Work" },
  { value: "market_research", label: "Market Research" },
  { value: "igce", label: "IGCE" },
  { value: "acquisition_plan", label: "Acquisition Plan" },
  { value: "justification", label: "Justification" },
];

export default function Documents() {
  const [docType, setDocType] = createSignal("all");
  const [page, setPage] = createSignal(1);
  const limit = 20;

  const [data] = createResource(
    () => ({ docType: docType(), page: page() }),
    async ({ docType, page }) => {
      const offset = (page - 1) * limit;
      const params = new URLSearchParams({ limit, offset });
      if (docType !== "all") params.set("docType", docType);
      const res = await fetch(`/api/v1/admin/documents?${params}`);
      if (!res.ok) throw new Error("Failed to load documents");
      return res.json();
    }
  );

  const columns = [
    {
      key: "title",
      title: "Title",
      cellClass: "text-gray-900 font-medium",
      render: (row) => row.title || row.docType || "—",
    },
    {
      key: "docType",
      title: "Doc Type",
      render: (row) =>
        html`<span class="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium">
          ${(row.docType || "").replace(/_/g, " ")}
        </span>`,
    },
    {
      key: "packageTitle",
      title: "Package",
      cellClass: "text-gray-500",
      render: (row) => row.packageTitle || "—",
    },
    {
      key: "status",
      title: "Status",
      render: (row) => {
        const colors = {
          draft: "bg-gray-100 text-gray-600",
          final: "bg-green-50 text-green-700",
          approved: "bg-blue-50 text-blue-700",
        };
        return html`<span
          class=${`text-xs px-2 py-1 rounded-full font-medium ${colors[row.status] || "bg-gray-100 text-gray-600"}`}
          >${row.status}</span
        >`;
      },
    },
    {
      key: "version",
      title: "Version",
      cellClass: "text-gray-600 tabular-nums text-center",
      render: (row) => `v${row.version || 1}`,
    },
    {
      key: "createdAt",
      title: "Created",
      cellClass: "text-gray-500",
      render: (row) => new Date(row.createdAt).toLocaleString(),
    },
    {
      key: "actions",
      title: "",
      cellClass: "text-right",
      render: (row) =>
        row.s3Key
          ? html`<a
              href=${`/api/v1/documents/download-url?bucket=rh-eagle-files&key=${encodeURIComponent(row.s3Key)}`}
              target="_blank"
              class="p-2 text-gray-400 hover:text-nci-primary rounded-lg transition-colors no-underline"
              title="Download"
              ><${Download} size=${16}
            /></a>`
          : "",
    },
  ];

  return html`
    <div class="min-h-screen bg-gray-50">
      <div class="p-8 max-w-7xl mx-auto">
        <${AdminPageHeader}
          title="Documents"
          description="Browse all generated documents across acquisition packages"
          breadcrumbs=${[{ label: "Admin", href: "/_/admin" }, { label: "Documents" }]}
        />

        <${AdminTabs}
          items=${DOC_TYPES}
          active=${docType}
          onSelect=${(v) => {
            setDocType(v);
            setPage(1);
          }}
        />

        <${Show}
          when=${() => !data.loading}
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
              value=${() => data()?.meta?.total ?? 0}
              label="Total Documents"
              color="bg-blue-500"
            />
            <${AdminStatCard}
              icon=${Hash}
              value=${() => data()?.meta?.docTypes ?? 0}
              label="Document Types"
              color="bg-purple-500"
            />
          </div>

          <${AdminDataTable}
            remote=${true}
            title="Document Library"
            data=${() => data()?.data || []}
            columns=${columns}
            totalItems=${() => data()?.meta?.total || 0}
            page=${page}
            rowsPerPage=${limit}
            onPageChange=${({ page: p }) => setPage(p)}
          />
        <//>
      </div>
    </div>
  `;
}
