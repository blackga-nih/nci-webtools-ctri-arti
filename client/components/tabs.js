import { For } from "solid-js";
import html from "solid-js/html";

/**
 * Tab/pill bar with active state and optional counts.
 *
 * @param {object} props
 * @param {Array<{value: string, label: string, count?: number}>} props.items - Tab items
 * @param {Function} props.active - Getter for current active value
 * @param {Function} props.onSelect - Callback when a tab is selected
 * @param {string} [props.className] - Additional classes
 */
export default function Tabs(props) {
  const active = () => (typeof props.active === "function" ? props.active() : props.active);

  return html`
    <ul class=${() => `nav nav-pills gap-1 ${props.className || ""}`}>
      <${For} each=${() => props.items}>
        ${(item) => html`
          <li class="nav-item">
            <button
              class=${() => `nav-link px-3 py-1 small ${active() === item.value ? "active" : ""}`}
              onClick=${() => props.onSelect(item.value)}
            >
              ${item.label}
              ${() =>
                item.count != null
                  ? html`<span class="badge bg-light text-dark ms-1 rounded-pill"
                      >${item.count}</span
                    >`
                  : ""}
            </button>
          </li>
        `}
      <//>
    </ul>
  `;
}
