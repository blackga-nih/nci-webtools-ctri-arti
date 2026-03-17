import {
  Activity,
  ArrowRight,
  BarChart2,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  FileText,
  Key,
  LayoutDashboard,
  Package,
  Users,
  Zap,
} from "lucide-solid";
import { createResource, For, Show } from "solid-js";
import html from "solid-js/html";

import AdminPageHeader from "../../components/admin/page-header.js";
import AdminStatCard from "../../components/admin/stat-card.js";

export default function AdminDashboard() {
  const [stats] = createResource(async () => {
    const res = await fetch("/api/v1/admin/dashboard");
    if (!res.ok) throw new Error("Failed to load dashboard");
    return res.json();
  });

  const [health] = createResource(async () => {
    const res = await fetch("/api/v1/status");
    if (!res.ok) return { status: "error" };
    return res.json();
  });

  const statCards = () => [
    { label: "Packages", value: stats()?.packages ?? "—", icon: Package, color: "bg-blue-500" },
    {
      label: "Cost (30d)",
      value: stats()?.totalCost != null ? `$${stats().totalCost}` : "—",
      icon: DollarSign,
      color: "bg-green-500",
    },
    {
      label: "Requests (30d)",
      value: stats()?.totalRequests ?? "—",
      icon: Activity,
      color: "bg-purple-500",
    },
    {
      label: "Active Users",
      value: stats()?.activeUsers ?? "—",
      icon: Users,
      color: "bg-amber-500",
    },
  ];

  const quickActions = [
    { href: "/_/admin/traces", icon: Activity, label: "Traces", count: null },
    { href: "/_/admin/costs", icon: DollarSign, label: "Costs", count: null },
    { href: "/_/admin/skills", icon: Zap, label: "Skills", count: null },
    { href: "/_/admin/templates", icon: FileText, label: "Templates", count: null },
    { href: "/_/admin/api-log", icon: BookOpen, label: "API Log", count: null },
    { href: "/_/users", icon: Users, label: "Users", count: null },
    { href: "/_/usage", icon: LayoutDashboard, label: "Usage", count: null },
    { href: "/_/admin/documents", icon: FileText, label: "Documents", count: null },
    { href: "/_/admin/analytics", icon: BarChart2, label: "Analytics", count: null },
    { href: "/_/admin/knowledge", icon: BookOpen, label: "Knowledge", count: null },
  ];

  return html`
    <div class="min-h-screen bg-gray-50">
      <div class="p-8 max-w-7xl mx-auto">
        <${AdminPageHeader} title="Admin Dashboard" description="System overview and management" />

        <${Show}
          when=${() => !stats.loading}
          fallback=${html`
            <div class="flex justify-center py-20">
              <div
                class="w-8 h-8 border-4 border-nci-primary border-t-transparent rounded-full animate-spin"
              ></div>
            </div>
          `}
        >
          <!-- Stats Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <${For} each=${statCards}>
              ${(card) => html`
                <${AdminStatCard}
                  icon=${card.icon}
                  value=${card.value}
                  label=${card.label}
                  color=${card.color}
                />
              `}
            <//>
          </div>
        <//>

        <!-- Quick Actions + System Health -->
        <div class="grid lg:grid-cols-3 gap-6 mb-8">
          <div class="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 class="font-bold text-gray-900 mb-4">Quick Actions</h3>
            <div class="space-y-1">
              <${For} each=${quickActions}>
                ${(action) => html`
                  <a
                    href=${action.href}
                    class="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group no-underline"
                  >
                    <div
                      class="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors"
                    >
                      <${action.icon} size=${20} />
                    </div>
                    <div class="flex-1">
                      <p
                        class="font-medium text-gray-900 group-hover:text-blue-600 transition-colors m-0"
                      >
                        ${action.label}
                      </p>
                    </div>
                    <${ArrowRight}
                      size=${16}
                      class="text-gray-400 group-hover:text-blue-600 transition-colors"
                    />
                  </a>
                `}
              <//>
            </div>
          </div>

          <div class="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6">
            <h3 class="font-bold text-gray-900 mb-4">System Health</h3>
            <${Show}
              when=${() => !health.loading}
              fallback=${html`<span class="text-sm text-gray-400">Checking...</span>`}
            >
              <div class="grid md:grid-cols-3 gap-4">
                <div class="flex items-center gap-3 p-4 bg-green-50 rounded-xl">
                  <${CheckCircle2} size=${32} class="text-green-500" />
                  <div>
                    <p class="font-semibold text-gray-900 m-0">Database</p>
                    <p class="text-sm text-green-600 m-0">
                      ${() => (health()?.database?.health === "ok" ? "Connected" : "Disconnected")}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-3 p-4 bg-green-50 rounded-xl">
                  <${CheckCircle2} size=${32} class="text-green-500" />
                  <div>
                    <p class="font-semibold text-gray-900 m-0">Uptime</p>
                    <p class="text-sm text-green-600 m-0">
                      ${() => {
                        const s = health()?.uptime;
                        if (!s) return "—";
                        const h = Math.floor(s / 3600);
                        const m = Math.floor((s % 3600) / 60);
                        return `${h}h ${m}m`;
                      }}
                    </p>
                  </div>
                </div>
                <${Show} when=${() => health()?.version}>
                  <div class="flex items-center gap-3 p-4 bg-blue-50 rounded-xl">
                    <${AlertCircle} size=${32} class="text-blue-500" />
                    <div>
                      <p class="font-semibold text-gray-900 m-0">Version</p>
                      <p class="text-sm text-blue-600 m-0">${() => health().version}</p>
                    </div>
                  </div>
                <//>
              </div>
            <//>
          </div>
        </div>
      </div>
    </div>
  `;
}
