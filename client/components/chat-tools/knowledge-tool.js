import { BookOpen, FileText, Search } from "lucide-solid";
import { For, Show } from "solid-js";
import html from "solid-js/html";

import { getToolResult } from "../../utils/tools.js";

import ToolHeader from "./tool-header.js";

/**
 * Knowledge Tool Component - displays KB search/fetch results
 *
 * Handles both knowledge_search (file listing) and knowledge_fetch (document content).
 */
export default function KnowledgeTool(props) {
  const input = () => props.message?.toolUse?.input || {};
  const name = () => props.message?.toolUse?.name || "knowledge";
  const result = () => getToolResult(props.message?.toolUse, props.messages);

  const isFetch = () => name() === "knowledge_fetch";

  const title = () => {
    if (isFetch()) {
      const key = input().key || input().s3_key || "";
      return key.split("/").pop() || "Fetching document…";
    }
    const parts = [];
    if (input().keyword) parts.push(input().keyword);
    if (input().agent) parts.push(`agent:${input().agent}`);
    if (input().topic) parts.push(`topic:${input().topic}`);
    return parts.length > 0 ? parts.join(" · ") : "Searching KB…";
  };

  const rightText = () => {
    const r = result();
    if (!r) return "loading…";
    if (isFetch()) {
      const content = r?.content || (typeof r === "string" ? r : "");
      return content ? `${content.length} chars` : "loaded";
    }
    const count = r?.count ?? (Array.isArray(r?.results) ? r.results.length : 0);
    return `${count} results`;
  };

  const searchResults = () => {
    const r = result();
    if (!r) return [];
    return Array.isArray(r?.results) ? r.results : [];
  };

  const fetchContent = () => {
    const r = result();
    if (!r) return "";
    if (typeof r === "string") return r.slice(0, 5000);
    if (r?.content) return r.content.slice(0, 5000);
    return JSON.stringify(r, null, 2).slice(0, 5000);
  };

  const icon = () =>
    isFetch()
      ? html`<${FileText} size="16" class="text-muted-contrast" />`
      : html`<${BookOpen} size="16" class="text-muted-contrast" />`;

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
            <${Show}
              when=${() => !isFetch()}
              fallback=${() => html`
                <pre class="p-2 m-0 small text-wrap" style="max-height: 300px; overflow: auto;">
${fetchContent}</pre
                >
              `}
            >
              <div class="list-group list-group-flush">
                <${For} each=${searchResults}>
                  ${(item) => html`
                    <div
                      class="list-group-item d-flex align-items-center gap-2 py-1 px-2 border-0 small"
                    >
                      <span class="text-muted"><${FileText} size="14" /></span>
                      <div class="d-flex flex-column min-w-0">
                        <span class="text-truncate text-body-emphasis"
                          >${item.filename || item.s3_key || "—"}</span
                        >
                        <${Show} when=${item.agent}>
                          <small class="text-muted-contrast">${item.agent}</small>
                        <//>
                      </div>
                    </div>
                  `}
                <//>
              </div>
            <//>
          </div>
        </div>
      </div>
    </div>
  </article>`;
}
