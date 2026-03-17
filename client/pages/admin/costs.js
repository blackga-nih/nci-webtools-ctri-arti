import { Activity, DollarSign, Hash, Users } from "lucide-solid";
import { createResource, createSignal, Show } from "solid-js";
import html from "solid-js/html";

import { AdminDataTable } from "../../components/admin/data-table.js";
import AdminPageHeader from "../../components/admin/page-header.js";
import AdminStatCard from "../../components/admin/stat-card.js";
import AdminTabs from "../../components/admin/tabs.js";

const DATE_RANGES = [
  { value: "7", label: "7d" },
  { value: "30", label: "30d" },
  { value: "90", label: "90d" },
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
      cellClass: "text-gray-700",
      render: (row) => row.userName || row.userEmail || "—",
    },
    {
      key: "modelName",
      title: "Model",
      render: (row) =>
        html`<span class="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium"
          >${row.modelName}</span
        >`,
    },
    {
      key: "inputTokens",
      title: "Input Tokens",
      cellClass: "text-gray-600 text-right tabular-nums",
      headerClass: "text-right",
      render: (row) => Math.round(row.inputTokens || 0).toLocaleString(),
    },
    {
      key: "outputTokens",
      title: "Output Tokens",
      cellClass: "text-gray-600 text-right tabular-nums",
      headerClass: "text-right",
      render: (row) => Math.round(row.outputTokens || 0).toLocaleString(),
    },
    {
      key: "cost",
      title: "Cost",
      cellClass: "font-semibold text-gray-900 text-right tabular-nums",
      headerClass: "text-right",
      render: (row) => `$${Number(row.cost || 0).toFixed(4)}`,
    },
    {
      key: "createdAt",
      title: "Date",
      cellClass: "text-gray-500",
      render: (row) => new Date(row.createdAt).toLocaleString(),
    },
  ];

  return html`
    <div class="min-h-screen bg-gray-50">
      <div class="p-8 max-w-7xl mx-auto">
        <${AdminPageHeader}
          title="Cost Management"
          description="Monitor AI usage costs and token consumption"
          breadcrumbs=${[{ label: "Admin", href: "/_/admin" }, { label: "Costs" }]}
        />

        <${AdminTabs}
          items=${DATE_RANGES}
          active=${days}
          onSelect=${(v) => {
            setDays(v);
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
              icon=${DollarSign}
              value=${() => `$${data()?.summary?.totalCost ?? "0"}`}
              label="Total Cost"
              color="bg-green-500"
              description=${() => `Last ${days()} days`}
            />
            <${AdminStatCard}
              icon=${Activity}
              value=${() => `$${data()?.summary?.avgCostPerRequest ?? "0"}`}
              label="Avg Cost/Request"
              color="bg-blue-500"
              description="Per API call"
            />
            <${AdminStatCard}
              icon=${Hash}
              value=${() => (data()?.summary?.totalTokens ?? 0).toLocaleString()}
              label="Total Tokens"
              color="bg-purple-500"
              description="Input + Output"
            />
            <${AdminStatCard}
              icon=${Users}
              value=${() => data()?.summary?.activeUsers ?? "0"}
              label="Active Users"
              color="bg-amber-500"
              description="With API activity"
            />
          </div>

          <${AdminDataTable}
            remote=${true}
            title="Usage Details"
            description=${() => `Individual cost entries for the last ${days()} days`}
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
