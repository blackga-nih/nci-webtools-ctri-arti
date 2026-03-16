import { Show } from "solid-js";
import html from "solid-js/html";

/**
 * Summary metric card with icon, value, label, and optional trend.
 *
 * @param {object} props
 * @param {Function} props.icon - Lucide icon component
 * @param {string|number} props.value - Main metric value
 * @param {string} props.label - Description label
 * @param {string} [props.trend] - Trend text (e.g., "+12%")
 * @param {string} [props.trendType] - "up" | "down" | "neutral"
 * @param {string} [props.iconColor] - Bootstrap text color class (default: "text-primary")
 */
export default function StatCard(props) {
  const trendClass = () => {
    switch (props.trendType) {
      case "up":
        return "text-success";
      case "down":
        return "text-danger";
      default:
        return "text-muted";
    }
  };

  return html`
    <div class="card border-0 shadow-sm h-100">
      <div class="card-body d-flex align-items-center gap-3 p-3">
        <div
          class="rounded-3 p-2 bg-light d-flex align-items-center justify-content-center"
          style="width: 48px; height: 48px;"
        >
          <${Show} when=${() => props.icon}>
            <${() => props.icon} size=${22} class=${() => props.iconColor || "text-primary"} />
          <//>
        </div>
        <div class="flex-grow-1">
          <div class="fs-4 fw-bold lh-1 mb-1">${() => props.value}</div>
          <div class="text-muted small">${() => props.label}</div>
          <${Show} when=${() => props.trend}>
            <div class=${() => `small fw-semibold ${trendClass()}`}>${() => props.trend}</div>
          <//>
        </div>
      </div>
    </div>
  `;
}
