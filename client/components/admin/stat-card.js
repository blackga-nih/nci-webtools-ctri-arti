import { Show } from "solid-js";
import html from "solid-js/html";

export default function AdminStatCard(props) {
  return html`
    <div class="bg-white rounded-2xl border border-gray-200 p-5">
      <div class="flex items-start justify-between mb-4">
        <div class=${() => `p-3 rounded-xl text-white ${props.color || "bg-blue-500"}`}>
          <${Show} when=${() => props.icon}>
            <${() => props.icon} size=${20} />
          <//>
        </div>
        <${Show} when=${() => props.description}>
          <span class="text-xs text-gray-400 font-medium">${() => props.description}</span>
        <//>
      </div>
      <p class="text-2xl font-bold text-gray-900">${() => props.value}</p>
      <p class="text-sm text-gray-500">${() => props.label}</p>
    </div>
  `;
}
