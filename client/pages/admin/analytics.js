import { Activity, DollarSign, Hash, Users } from "lucide-solid";
import { createResource, createSignal, For, Show } from "solid-js";
import html from "solid-js/html";

import { AdminDataTable } from "../../components/admin/data-table.js";
import AdminPageHeader from "../../components/admin/page-header.js";
import AdminStatCard from "../../components/admin/stat-card.js";
import AdminTabs from "../../components/admin/tabs.js";

const GROUP_TABS = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "model", label: "By Model" },
  { value: "user", label: "By User" },
];

export default function Analytics() {
  const [groupBy, setGroupBy] = createSignal("day");
  const [page, setPage] = createSignal(1);
  const limit = 50;

  const [data] = createResource(
    () => ({ groupBy: groupBy(), page: page() }),
    async ({ groupBy, page }) => {
      const offset = (page - 1) * limit;
      const res = await fetch(
        `/api/v1/admin/analytics?groupBy=${groupBy}&limit=${limit}&offset=${offset}`
      );
      if (!res.ok) throw new Error("Failed to load analytics");
      return res.json();
    }
  );

  const summary = () => {
    const rows = data()?.data || [];
    if (!rows.length) return { cost: 0, requests: 0, users: 0, avgCost: 0 };
    const cost = rows.reduce((s, r) => s + Number(r.totalCost || 0), 0);
    const requests = rows.reduce((s, r) => s + Number(r.totalRequests || 0), 0);
    const users = groupBy() === "user" ? rows.length : rows.length;
    return {
      cost: cost.toFixed(4),
      requests,
      users,
      avgCost: requests > 0 ? (cost / requests).toFixed(6) : "0",
    };
  };

  const timeColumns = [
    { key: "period", title: "Period", cellClass: "text-gray-900 font-mono" },
    {
      key: "totalRequests",
      title: "Requests",
      cellClass: "text-gray-600 text-right tabular-nums",
      headerClass: "text-right",
      render: (row) => Number(row.totalRequests || 0).toLocaleString(),
    },
    {
      key: "totalCost",
      title: "Cost",
      cellClass: "font-semibold text-gray-900 text-right tabular-nums",
      headerClass: "text-right",
      render: (row) => `$${Number(row.totalCost || 0).toFixed(4)}`,
    },
    {
      key: "totalInputTokens",
      title: "Input Tokens",
      cellClass: "text-gray-600 text-right tabular-nums",
      headerClass: "text-right",
      render: (row) => Math.round(Number(row.totalInputTokens || 0)).toLocaleString(),
    },
    {
      key: "totalOutputTokens",
      title: "Output Tokens",
      cellClass: "text-gray-600 text-right tabular-nums",
      headerClass: "text-right",
      render: (row) => Math.round(Number(row.totalOutputTokens || 0)).toLocaleString(),
    },
    {
      key: "uniqueUsers",
      title: "Users",
      cellClass: "text-gray-600 text-center tabular-nums",
      headerClass: "text-center",
      render: (row) => row.uniqueUsers ?? "—",
    },
  ];

  const modelColumns = [
    {
      key: "modelName",
      title: "Model",
      cellClass: "text-gray-900",
      render: (row) => row.Model?.name || `ID ${row.modelID}`,
    },
    {
      key: "totalRequests",
      title: "Requests",
      cellClass: "text-gray-600 text-right tabular-nums",
      headerClass: "text-right",
      render: (row) => Number(row.totalRequests || 0).toLocaleString(),
    },
    {
      key: "totalCost",
      title: "Cost",
      cellClass: "font-semibold text-gray-900 text-right tabular-nums",
      headerClass: "text-right",
      render: (row) => `$${Number(row.totalCost || 0).toFixed(4)}`,
    },
    {
      key: "totalInputTokens",
      title: "Input Tokens",
      cellClass: "text-gray-600 text-right tabular-nums",
      headerClass: "text-right",
      render: (row) => Math.round(Number(row.totalInputTokens || 0)).toLocaleString(),
    },
    {
      key: "totalOutputTokens",
      title: "Output Tokens",
      cellClass: "text-gray-600 text-right tabular-nums",
      headerClass: "text-right",
      render: (row) => Math.round(Number(row.totalOutputTokens || 0)).toLocaleString(),
    },
  ];

  const userColumns = [
    {
      key: "userName",
      title: "User",
      cellClass: "text-gray-900",
      render: (row) =>
        [row.User?.firstName, row.User?.lastName].filter(Boolean).join(" ") ||
        row.User?.email ||
        "—",
    },
    {
      key: "totalRequests",
      title: "Requests",
      cellClass: "text-gray-600 text-right tabular-nums",
      headerClass: "text-right",
      render: (row) => Number(row.totalRequests || 0).toLocaleString(),
    },
    {
      key: "totalCost",
      title: "Cost",
      cellClass: "font-semibold text-gray-900 text-right tabular-nums",
      headerClass: "text-right",
      render: (row) => `$${Number(row.totalCost || 0).toFixed(4)}`,
    },
    {
      key: "totalInputTokens",
      title: "Input Tokens",
      cellClass: "text-gray-600 text-right tabular-nums",
      headerClass: "text-right",
      render: (row) => Math.round(Number(row.totalInputTokens || 0)).toLocaleString(),
    },
    {
      key: "totalOutputTokens",
      title: "Output Tokens",
      cellClass: "text-gray-600 text-right tabular-nums",
      headerClass: "text-right",
      render: (row) => Math.round(Number(row.totalOutputTokens || 0)).toLocaleString(),
    },
  ];

  const getColumns = () => {
    if (groupBy() === "model") return modelColumns;
    if (groupBy() === "user") return userColumns;
    return timeColumns;
  };

  const BarChart = () => {
    const rows = data()?.data || [];
    if (!rows.length) return "";
    const maxCost = Math.max(...rows.map((r) => Number(r.totalCost || 0)), 0.0001);
    return html`
      <div class="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <h3 class="font-bold text-gray-900 mb-4">Cost Over Time</h3>
        <${For} each=${rows.slice(0, 20)}>
          ${(row) => {
            const cost = Number(row.totalCost || 0);
            const pct = Math.max((cost / maxCost) * 100, 1);
            return html`
              <div class="flex items-center gap-3 mb-2">
                <span class="text-sm text-gray-500 font-mono" style="min-width:90px"
                  >${row.period}</span
                >
                <div class="flex-1">
                  <div
                    class="bg-nci-primary rounded h-5 transition-all"
                    style=${`width:${pct}%`}
                  ></div>
                </div>
                <span
                  class="text-sm font-semibold text-gray-900 tabular-nums"
                  style="min-width:80px;text-align:right"
                  >$${cost.toFixed(4)}</span
                >
              </div>
            `;
          }}
        <//>
      </div>
    `;
  };

  return html`
    <div class="min-h-screen bg-gray-50">
      <div class="p-8 max-w-7xl mx-auto">
        <${AdminPageHeader}
          title="Analytics"
          description="Usage analytics with groupBy breakdown"
          breadcrumbs=${[{ label: "Admin", href: "/_/admin" }, { label: "Analytics" }]}
        />

        <${AdminTabs}
          items=${GROUP_TABS}
          active=${groupBy}
          onSelect=${(v) => {
            setGroupBy(v);
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
              value=${() => `$${summary().cost}`}
              label="Total Cost"
              color="bg-green-500"
            />
            <${AdminStatCard}
              icon=${Activity}
              value=${() => summary().requests.toLocaleString()}
              label="Total Requests"
              color="bg-blue-500"
            />
            <${AdminStatCard}
              icon=${Users}
              value=${() => summary().users}
              label="Unique Users"
              color="bg-amber-500"
            />
            <${AdminStatCard}
              icon=${Hash}
              value=${() => `$${summary().avgCost}`}
              label="Avg Cost/Request"
              color="bg-purple-500"
            />
          </div>

          <${Show} when=${() => !["model", "user"].includes(groupBy())}>
            <${BarChart} />
          <//>

          <${AdminDataTable}
            remote=${true}
            data=${() => data()?.data || []}
            columns=${getColumns()}
            totalItems=${() => data()?.meta?.total || (data()?.data || []).length}
            page=${page}
            rowsPerPage=${limit}
            onPageChange=${({ page: p }) => setPage(p)}
          />
        <//>
      </div>
    </div>
  `;
}
