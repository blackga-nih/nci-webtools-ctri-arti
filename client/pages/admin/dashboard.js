import {
  Activity,
  BookOpen,
  DollarSign,
  FileText,
  Key,
  LayoutDashboard,
  Package,
  Settings,
  Shield,
  Users,
  Zap,
} from "lucide-solid";
import { createResource, For, Show } from "solid-js";
import html from "solid-js/html";

import PageHeader from "../../components/page-header.js";
import StatCard from "../../components/stat-card.js";

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

  const quickActions = [
    { href: "/_/admin/traces", icon: Activity, label: "Traces", color: "text-info" },
    { href: "/_/admin/costs", icon: DollarSign, label: "Costs", color: "text-success" },
    { href: "/_/admin/skills", icon: Zap, label: "Skills", color: "text-warning" },
    { href: "/_/admin/templates", icon: FileText, label: "Templates", color: "text-secondary" },
    { href: "/_/admin/api-log", icon: BookOpen, label: "API Log", color: "text-danger" },
    { href: "/_/users", icon: Users, label: "Users", color: "text-primary" },
    { href: "/_/usage", icon: LayoutDashboard, label: "Usage", color: "text-info" },
  ];

  return html`
    <div class="container py-4">
      <${PageHeader} title="Admin Dashboard" description="System overview and quick actions" />

      <!-- Stats -->
      <${Show}
        when=${() => !stats.loading}
        fallback=${html`
          <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status"></div>
          </div>
        `}
      >
        <div class="row g-3 mb-4">
          <div class="col-sm-6 col-lg-3">
            <${StatCard}
              icon=${Package}
              value=${() => stats()?.packages ?? "—"}
              label="Packages"
              iconColor="text-primary"
            />
          </div>
          <div class="col-sm-6 col-lg-3">
            <${StatCard}
              icon=${DollarSign}
              value=${() => (stats()?.totalCost != null ? `$${stats().totalCost}` : "—")}
              label="Cost (30d)"
              iconColor="text-success"
            />
          </div>
          <div class="col-sm-6 col-lg-3">
            <${StatCard}
              icon=${Activity}
              value=${() => stats()?.totalRequests ?? "—"}
              label="Requests (30d)"
              iconColor="text-info"
            />
          </div>
          <div class="col-sm-6 col-lg-3">
            <${StatCard}
              icon=${Users}
              value=${() => stats()?.activeUsers ?? "—"}
              label="Active Users"
              iconColor="text-warning"
            />
          </div>
        </div>
      <//>

      <!-- Quick Actions -->
      <h5 class="fw-bold mb-3">Quick Actions</h5>
      <div class="row g-3 mb-4">
        <${For} each=${quickActions}>
          ${(action) => html`
            <div class="col-6 col-sm-4 col-md-3 col-lg-2">
              <a href=${action.href} class="card border-0 shadow-sm text-decoration-none h-100">
                <div class="card-body text-center p-3">
                  <${action.icon} size=${28} class=${action.color} />
                  <div class="small fw-semibold mt-2 text-dark">${action.label}</div>
                </div>
              </a>
            </div>
          `}
        <//>
      </div>

      <!-- System Health -->
      <h5 class="fw-bold mb-3">System Health</h5>
      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <${Show}
            when=${() => !health.loading}
            fallback=${html`<span class="text-muted small">Checking...</span>`}
          >
            <div class="d-flex align-items-center gap-2">
              <span
                class=${() =>
                  `badge ${health()?.database?.health === "ok" ? "bg-success" : "bg-danger"}`}
              >
                ${() => (health()?.database?.health === "ok" ? "Healthy" : "Unhealthy")}
              </span>
              <span class="text-muted small">
                Uptime:
                ${() => {
                  const s = health()?.uptime;
                  if (!s) return "—";
                  const h = Math.floor(s / 3600);
                  const m = Math.floor((s % 3600) / 60);
                  return `${h}h ${m}m`;
                }}
              </span>
              <${Show} when=${() => health()?.version}>
                <span class="text-muted small">Version: ${() => health().version}</span>
              <//>
            </div>
          <//>
        </div>
      </div>
    </div>
  `;
}
