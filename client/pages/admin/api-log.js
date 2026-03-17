import { Activity, AlertTriangle, Clock, Globe } from "lucide-solid";
import { createResource, createSignal, For, Show } from "solid-js";
import html from "solid-js/html";

import { AdminDataTable } from "../../components/admin/data-table.js";
import AdminPageHeader from "../../components/admin/page-header.js";
import AdminStatCard from "../../components/admin/stat-card.js";
import AdminTabs from "../../components/admin/tabs.js";

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "chat", label: "Chat" },
  { value: "documents", label: "Documents" },
  { value: "packages", label: "Packages" },
  { value: "admin", label: "Admin" },
];

export default function ApiLog() {
  const [category, setCategory] = createSignal("all");
  const [page, setPage] = createSignal(1);
  const limit = 30;

  const [data] = createResource(
    () => ({ category: category(), page: page() }),
    async ({ category, page }) => {
      const offset = (page - 1) * limit;
      const params = new URLSearchParams({ limit, offset });
      if (category !== "all") params.set("category", category);
      const res = await fetch(`/api/v1/admin/request-log?${params}`);
      if (!res.ok) throw new Error("Failed to load request log");
      return res.json();
    }
  );

  const methodBadge = (method) => {
    const colors = {
      GET: "bg-blue-50 text-blue-700",
      POST: "bg-green-50 text-green-700",
      PUT: "bg-amber-50 text-amber-700",
      PATCH: "bg-cyan-50 text-cyan-700",
      DELETE: "bg-red-50 text-red-700",
    };
    const cls = colors[method] || "bg-gray-100 text-gray-600";
    return html`<span class=${`text-xs px-2 py-1 rounded-full font-medium ${cls}`}
      >${method}</span
    >`;
  };

  const statusBadge = (code) => {
    const cls =
      code < 300
        ? "text-green-700 font-semibold"
        : code < 400
          ? "text-blue-600 font-semibold"
          : code < 500
            ? "text-amber-600 font-semibold"
            : "text-red-600 font-semibold";
    return html`<span class=${cls}>${code}</span>`;
  };

  const routeColumns = [
    {
      key: "method",
      title: "Method",
      render: (row) => methodBadge(row.method),
    },
    {
      key: "path",
      title: "Route",
      cellClass: "text-gray-900 font-mono text-sm",
    },
    {
      key: "calls",
      title: "Calls",
      cellClass: "text-gray-600 text-right tabular-nums",
      headerClass: "text-right",
      render: (row) => Number(row.calls).toLocaleString(),
    },
    {
      key: "avgMs",
      title: "Avg (ms)",
      cellClass: "text-gray-600 text-right tabular-nums",
      headerClass: "text-right",
      render: (row) => `${row.avgMs}ms`,
    },
    {
      key: "errors",
      title: "Errors",
      cellClass: "text-right tabular-nums",
      headerClass: "text-right",
      render: (row) =>
        html`<span class=${Number(row.errors) > 0 ? "text-red-600 font-bold" : "text-gray-400"}>
          ${row.errors}
        </span>`,
    },
  ];

  const recentColumns = [
    {
      key: "createdAt",
      title: "Time",
      cellClass: "text-gray-500",
      render: (row) => new Date(row.createdAt).toLocaleString(),
    },
    {
      key: "method",
      title: "Method",
      render: (row) => methodBadge(row.method),
    },
    {
      key: "path",
      title: "Path",
      cellClass: "text-gray-900 font-mono text-sm",
    },
    {
      key: "statusCode",
      title: "Status",
      render: (row) => statusBadge(row.statusCode),
    },
    {
      key: "durationMs",
      title: "Duration",
      cellClass: "text-gray-600 text-right tabular-nums",
      headerClass: "text-right",
      render: (row) => `${row.durationMs}ms`,
    },
  ];

  return html`
    <div class="min-h-screen bg-gray-50">
      <div class="p-8 max-w-7xl mx-auto">
        <${AdminPageHeader}
          title="API Request Log"
          description="Monitor API traffic and performance"
          breadcrumbs=${[{ label: "Admin", href: "/_/admin" }, { label: "API Log" }]}
        />

        <${AdminTabs}
          items=${CATEGORIES}
          active=${category}
          onSelect=${(v) => {
            setCategory(v);
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
              icon=${Activity}
              value=${() => (data()?.summary?.totalRequests ?? 0).toLocaleString()}
              label="Total Requests"
              color="bg-blue-500"
            />
            <${AdminStatCard}
              icon=${Clock}
              value=${() => `${data()?.summary?.avgResponseTime ?? 0}ms`}
              label="Avg Response Time"
              color="bg-cyan-500"
            />
            <${AdminStatCard}
              icon=${AlertTriangle}
              value=${() => data()?.summary?.errors ?? 0}
              label="Errors"
              color="bg-red-500"
            />
            <${AdminStatCard}
              icon=${Globe}
              value=${() => data()?.summary?.uniqueRoutes ?? 0}
              label="Unique Routes"
              color="bg-gray-500"
            />
          </div>

          <!-- Route stats table -->
          <${AdminDataTable}
            title="Route Statistics"
            description="Aggregated stats per route"
            data=${() => data()?.routeStats || []}
            columns=${routeColumns}
          />

          <div class="mt-6">
            <${AdminDataTable}
              remote=${true}
              title="Recent Requests"
              description="Individual API request log entries"
              data=${() => data()?.recent || []}
              columns=${recentColumns}
              totalItems=${() => data()?.meta?.total || 0}
              page=${page}
              rowsPerPage=${limit}
              onPageChange=${({ page: p }) => setPage(p)}
            />
          </div>
        <//>
      </div>
    </div>
  `;
}
