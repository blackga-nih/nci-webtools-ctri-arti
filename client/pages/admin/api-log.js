import { Activity, AlertTriangle, Clock, Globe } from "lucide-solid";
import { createResource, createSignal, For, Show } from "solid-js";
import html from "solid-js/html";

import PageHeader from "../../components/page-header.js";
import StatCard from "../../components/stat-card.js";
import { DataTable } from "../../components/table.js";
import Tabs from "../../components/tabs.js";

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
      GET: "bg-primary",
      POST: "bg-success",
      PUT: "bg-warning",
      PATCH: "bg-info",
      DELETE: "bg-danger",
    };
    return html`<span class=${`badge ${colors[method] || "bg-secondary"}`}>${method}</span>`;
  };

  const statusBadge = (code) => {
    const cls =
      code < 300
        ? "text-success"
        : code < 400
          ? "text-info"
          : code < 500
            ? "text-warning"
            : "text-danger";
    return html`<span class=${`fw-semibold ${cls}`}>${code}</span>`;
  };

  const routeColumns = [
    {
      key: "method",
      title: "Method",
      cellClassName: "small",
      render: (row) => methodBadge(row.method),
    },
    { key: "path", title: "Route", cellClassName: "small font-monospace" },
    {
      key: "calls",
      title: "Calls",
      cellClassName: "small font-monospace",
      render: (row) => Number(row.calls).toLocaleString(),
    },
    {
      key: "avgMs",
      title: "Avg (ms)",
      cellClassName: "small font-monospace",
      render: (row) => `${row.avgMs}ms`,
    },
    {
      key: "errors",
      title: "Errors",
      cellClassName: "small font-monospace",
      render: (row) =>
        html`<span class=${Number(row.errors) > 0 ? "text-danger fw-bold" : ""}
          >${row.errors}</span
        >`,
    },
  ];

  const recentColumns = [
    {
      key: "createdAt",
      title: "Time",
      cellClassName: "small text-muted",
      render: (row) => new Date(row.createdAt).toLocaleString(),
    },
    {
      key: "method",
      title: "Method",
      cellClassName: "small",
      render: (row) => methodBadge(row.method),
    },
    { key: "path", title: "Path", cellClassName: "small font-monospace" },
    {
      key: "statusCode",
      title: "Status",
      cellClassName: "small",
      render: (row) => statusBadge(row.statusCode),
    },
    {
      key: "durationMs",
      title: "Duration",
      cellClassName: "small font-monospace",
      render: (row) => `${row.durationMs}ms`,
    },
  ];

  return html`
    <div class="container py-4">
      <${PageHeader}
        title="API Request Log"
        description="Monitor API traffic and performance"
        backHref="/_/admin"
        backLabel="Admin Dashboard"
      />

      <${Tabs}
        items=${CATEGORIES}
        active=${category}
        onSelect=${(v) => {
          setCategory(v);
          setPage(1);
        }}
        className="mb-4"
      />

      <${Show}
        when=${() => !data.loading}
        fallback=${html`
          <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status"></div>
          </div>
        `}
      >
        <!-- Summary cards -->
        <div class="row g-3 mb-4">
          <div class="col-sm-6 col-lg-3">
            <${StatCard}
              icon=${Activity}
              value=${() => (data()?.summary?.totalRequests ?? 0).toLocaleString()}
              label="Total Requests"
              iconColor="text-primary"
            />
          </div>
          <div class="col-sm-6 col-lg-3">
            <${StatCard}
              icon=${Clock}
              value=${() => `${data()?.summary?.avgResponseTime ?? 0}ms`}
              label="Avg Response Time"
              iconColor="text-info"
            />
          </div>
          <div class="col-sm-6 col-lg-3">
            <${StatCard}
              icon=${AlertTriangle}
              value=${() => data()?.summary?.errors ?? 0}
              label="Errors"
              iconColor="text-danger"
            />
          </div>
          <div class="col-sm-6 col-lg-3">
            <${StatCard}
              icon=${Globe}
              value=${() => data()?.summary?.uniqueRoutes ?? 0}
              label="Unique Routes"
              iconColor="text-secondary"
            />
          </div>
        </div>

        <!-- Route stats table -->
        <h5 class="fw-bold mb-3">Route Statistics</h5>
        <${DataTable}
          data=${() => data()?.routeStats || []}
          columns=${routeColumns}
          className="mb-4"
        />

        <!-- Recent requests table -->
        <h5 class="fw-bold mb-3">Recent Requests</h5>
        <${DataTable}
          remote=${true}
          data=${() => data()?.recent || []}
          columns=${recentColumns}
          totalItems=${() => data()?.meta?.total || 0}
          page=${page}
          rowsPerPage=${limit}
          onPageChange=${({ page: p }) => setPage(p)}
        />
      <//>
    </div>
  `;
}
