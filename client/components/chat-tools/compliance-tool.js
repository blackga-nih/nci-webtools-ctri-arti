import { Scale, Search } from "lucide-solid";
import { Show } from "solid-js";
import html from "solid-js/html";

import { getToolResult } from "../../utils/tools.js";

import ToolHeader from "./tool-header.js";

/**
 * Compliance Tool Component - displays FAR search and compliance matrix results.
 *
 * Handles search_far and query_compliance_matrix tools.
 */
export default function ComplianceTool(props) {
  const input = () => props.message?.toolUse?.input || {};
  const name = () => props.message?.toolUse?.name || "compliance";
  const result = () => getToolResult(props.message?.toolUse, props.messages);

  const isFarSearch = () => name() === "search_far";

  const title = () => {
    if (isFarSearch()) {
      return input().keyword ? `FAR: ${input().keyword}` : "Searching FAR…";
    }
    const op = input().operation || "query";
    const kw = input().keyword ? ` · ${input().keyword}` : "";
    return `Compliance: ${op}${kw}`;
  };

  const rightText = () => {
    const r = result();
    if (!r) return "loading…";
    if (Array.isArray(r)) return `${r.length} results`;
    if (r?.results && Array.isArray(r.results)) return `${r.results.length} results`;
    return "loaded";
  };

  const contentPreview = () => {
    const r = result();
    if (!r) return "";
    if (typeof r === "string") return r.slice(0, 5000);
    return JSON.stringify(r, null, 2).slice(0, 5000);
  };

  const icon = () =>
    isFarSearch()
      ? html`<${Search} size="16" class="text-muted-contrast" />`
      : html`<${Scale} size="16" class="text-muted-contrast" />`;

  return html`<article
    class="search-accordion border rounded-3 my-3 min-w-0"
    classList=${() => ({ "is-open": props.isOpen(), "shadow-sm bg-light": props.isOpen() })}
  >
    ${ToolHeader({
      icon,
      title,
      right: () => html`<small class="text-muted-contrast">${rightText}</small>`,
      isOpen: props.isOpen,
      onToggle: props.onToggle,
      bodyId: props.bodyId,
    })}

    <div
      id=${props.bodyId}
      class="search-accordion__body"
      classList=${() => ({ show: props.isOpen() })}
    >
      <div class="accordion-inner">
        <div class="mask-fade-bottom">
          <div class="overflow-auto pe-1 search-accordion__scroll">
            <pre class="p-2 m-0 small text-wrap" style="max-height: 300px; overflow: auto;">
${contentPreview}</pre
            >
          </div>
        </div>
      </div>
    </div>
  </article>`;
}
