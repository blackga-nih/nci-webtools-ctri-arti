import { For } from "solid-js";
import html from "solid-js/html";

export default function AdminTabs(props) {
  const active = () => (typeof props.active === "function" ? props.active() : props.active);

  return html`
    <div class=${() => `mb-6 ${props.className || ""}`}>
      <div class="inline-flex items-center bg-white border border-gray-200 rounded-xl p-1">
        <${For} each=${() => props.items}>
          ${(item) => html`
            <button
              class=${() =>
                `px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  active() === item.value
                    ? "bg-nci-primary text-white shadow-md"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              onClick=${() => props.onSelect(item.value)}
            >
              ${item.label}
            </button>
          `}
        <//>
      </div>
    </div>
  `;
}
