import { Activity, DollarSign, Hash, Users } from "lucide-solid";
import { createResource, createSignal, Show } from "solid-js";
import html from "solid-js/html";

import PageHeader from "../../components/page-header.js";
import StatCard from "../../components/stat-card.js";
import { DataTable } from "../../components/table.js";
import Tabs from "../../components/tabs.js";

const DATE_RANGES = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

export default function CostTracking() {
  const [days, setDays] = createSignal("30");
  const [page, setPage] = createSignal(1);
  const limit = 20;

  const [data] = createResource(
    () => ({ days: days(), page: page() }),
    async ({ days, page }) => {
      const offset = (page - 1) * limit;
      const res = await fetch(`/api/v1/admin/costs?days=${days}&limit=${limit}&offset=${offset}`);
      if (!res.ok) throw new Error("Failed to load costs");
      return res.json();
    }
  );

  const columns = [
    {
      key: "userName",
      title: "User",
      cellClassName: "small",
      render: (row) => row.userName || row.userEmail || "—",
    },
    { key: "modelName", title: "Model", cellClassName: "small" },
    {
      key: "inputTokens",
      title: "Input Tokens",
      cellClassName: "small font-monospace",
      render: (row) => Math.round(row.inputTokens || 0).toLocaleString(),
    },
    {
      key: "outputTokens",
      title: "Output Tokens",
      cellClassName: "small font-monospace",
      render: (row) => Math.round(row.outputTokens || 0).toLocaleString(),
    },
    {
      key: "cost",
      title: "Cost",
      cellClassName: "small font-monospace",
      render: (row) => `$${Number(row.cost || 0).toFixed(4)}`,
    },
    {
      key: "createdAt",
      title: "Date",
      cellClassName: "small text-muted",
      render: (row) => new Date(row.createdAt).toLocaleString(),
    },
  ];

  return html`
    <div class="container py-4">
      <${PageHeader}
        title="Cost Tracking"
        description="Monitor API usage costs and token consumption"
        backHref="/_/admin"
        backLabel="Admin Dashboard"
      />

      <${Tabs}
        items=${DATE_RANGES}
        active=${days}
        onSelect=${(v) => {
          setDays(v);
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
              icon=${DollarSign}
              value=${() => `$${data()?.summary?.totalCost ?? "0"}`}
              label="Total Cost"
              iconColor="text-success"
            />
          </div>
          <div class="col-sm-6 col-lg-3">
            <${StatCard}
              icon=${Activity}
              value=${() => `$${data()?.summary?.avgCostPerRequest ?? "0"}`}
              label="Avg Cost/Request"
              iconColor="text-info"
            />
          </div>
          <div class="col-sm-6 col-lg-3">
            <${StatCard}
              icon=${Hash}
              value=${() => (data()?.summary?.totalTokens ?? 0).toLocaleString()}
              label="Total Tokens"
              iconColor="text-primary"
            />
          </div>
          <div class="col-sm-6 col-lg-3">
            <${StatCard}
              icon=${Users}
              value=${() => data()?.summary?.activeUsers ?? "0"}
              label="Active Users"
              iconColor="text-warning"
            />
          </div>
        </div>

        <!-- Usage table -->
        <${DataTable}
          remote=${true}
          data=${() => data()?.data || []}
          columns=${columns}
          totalItems=${() => data()?.meta?.total || 0}
          page=${page}
          rowsPerPage=${limit}
          onPageChange=${({ page: p }) => setPage(p)}
        />
      <//>
    </div>
  `;
}
