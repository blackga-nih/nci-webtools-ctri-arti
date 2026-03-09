import { Zap } from "lucide-solid";
import { Show } from "solid-js";
import html from "solid-js/html";

import { getToolResult } from "../../utils/tools.js";

import ToolHeader from "./tool-header.js";

const SKILL_LABELS = {
  "oa-intake": "Acquisition Intake",
  "document-generator": "Document Generator",
  compliance: "Compliance",
  "policy-research": "Policy Research",
  "technical-review": "Technical Review",
  "legal-counsel": "Legal Counsel",
  "market-intelligence": "Market Intelligence",
  "public-interest": "Public Interest Guardian",
  "policy-analyst": "Policy Analyst",
  "policy-librarian": "Policy Librarian",
};

export default function LoadSkillTool(props) {
  const skillName = () => props.message?.toolUse?.input?.name || "skill";
  const label = () => SKILL_LABELS[skillName()] || skillName();
  const result = () => getToolResult(props.message?.toolUse, props.messages);
  const status = () => result()?.status || "loading";
  const instructions = () => result()?.instructions;

  return html`<article
    class="search-accordion border rounded-3 my-3 min-w-0"
    classList=${() => ({ "is-open": props.isOpen(), "shadow-sm bg-light": props.isOpen() })}
  >
    ${ToolHeader({
      icon: html`<${Zap} size="16" class="text-muted-contrast" />`,
      title: () => `Loaded skill: ${label()}`,
      right: () =>
        html`<small class="text-muted-contrast"
          >${() => (status() === "loaded" ? skillName() : "loading…")}</small
        >`,
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
            <div class="p-2 small">
              <${Show}
                when=${instructions}
                fallback=${html`<span class="text-muted-contrast">No instructions loaded.</span>`}
              >
                <pre class="mb-0 text-prewrap font-monospace">${instructions}</pre>
              <//>
            </div>
          </div>
        </div>
      </div>
    </div>
  </article>`;
}
