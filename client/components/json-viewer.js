import { ChevronRight, ChevronDown, Copy, Check } from "lucide-solid";
import { createSignal, For, Show } from "solid-js";
import html from "solid-js/html";

/**
 * Collapsible JSON tree viewer with copy button.
 *
 * @param {object} props
 * @param {any} props.data - JSON data to display
 * @param {string} [props.label] - Root label
 * @param {boolean} [props.expanded] - Start expanded (default false)
 */
export default function JsonViewer(props) {
  const [copied, setCopied] = createSignal(false);

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(props.data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return html`
    <div class="border rounded bg-light position-relative">
      <div
        class="d-flex justify-content-between align-items-center px-3 py-2 border-bottom bg-white"
      >
        <span class="fw-semibold small">${() => props.label || "JSON"}</span>
        <button
          class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
          onClick=${copyJson}
        >
          <${Show} when=${copied} fallback=${html`<${Copy} size=${14} />`}>
            <${Check} size=${14} class="text-success" />
          <//>
          <span class="small">${() => (copied() ? "Copied" : "Copy")}</span>
        </button>
      </div>
      <div class="p-3" style="max-height: 500px; overflow: auto;">
        <${JsonNode}
          data=${() => props.data}
          expanded=${() => props.expanded ?? false}
          depth=${0}
        />
      </div>
    </div>
  `;
}

function JsonNode(props) {
  const [open, setOpen] = createSignal(props.expanded?.() ?? false);

  const data = () => (typeof props.data === "function" ? props.data() : props.data);
  const isObject = () => data() !== null && typeof data() === "object";
  const isArray = () => Array.isArray(data());
  const entries = () => (isObject() ? Object.entries(data()) : []);
  const preview = () => {
    if (isArray()) return `Array(${data().length})`;
    if (isObject()) return `{${entries().length} keys}`;
    return "";
  };

  if (!isObject()) {
    const val = data();
    const color =
      typeof val === "string"
        ? "text-success"
        : typeof val === "number"
          ? "text-primary"
          : typeof val === "boolean"
            ? "text-warning"
            : "text-muted";
    return html`<span class=${`small font-monospace ${color}`}
      >${typeof val === "string" ? `"${val}"` : String(val)}</span
    >`;
  }

  return html`
    <div style=${() => `padding-left: ${props.depth > 0 ? 16 : 0}px`}>
      <span
        class="d-inline-flex align-items-center gap-1 user-select-none"
        style="cursor: pointer;"
        onClick=${() => setOpen(!open())}
      >
        <${Show} when=${open} fallback=${html`<${ChevronRight} size=${14} />`}>
          <${ChevronDown} size=${14} />
        <//>
        <span class="small text-muted font-monospace">${preview}</span>
      </span>
      <${Show} when=${open}>
        <div>
          <${For} each=${entries}>
            ${([key, value]) => html`
              <div class="d-flex align-items-start gap-1" style="padding-left: 8px;">
                <span class="small font-monospace text-info flex-shrink-0">${key}:</span>
                <${JsonNode}
                  data=${value}
                  expanded=${() => false}
                  depth=${(props.depth || 0) + 1}
                />
              </div>
            `}
          <//>
        </div>
      <//>
    </div>
  `;
}
