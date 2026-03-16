import { Show } from "solid-js";
import html from "solid-js/html";

/**
 * Standardized page header with title, description, and action slot.
 *
 * @param {object} props
 * @param {string} props.title - Page title
 * @param {string} [props.description] - Subtitle / description text
 * @param {Function} [props.actions] - Action buttons slot (JSX function)
 * @param {string} [props.backHref] - Back link URL
 * @param {string} [props.backLabel] - Back link text
 */
export default function PageHeader(props) {
  return html`
    <div class="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-2">
      <div>
        <${Show} when=${() => props.backHref}>
          <a
            href=${() => props.backHref}
            class="text-decoration-none small text-muted mb-1 d-block"
          >
            ← ${() => props.backLabel || "Back"}
          </a>
        <//>
        <h1 class="fs-3 fw-bold mb-1">${() => props.title}</h1>
        <${Show} when=${() => props.description}>
          <p class="text-muted mb-0 small">${() => props.description}</p>
        <//>
      </div>
      <${Show} when=${() => props.actions}>
        <div class="d-flex gap-2 align-items-center">${() => props.actions?.()}</div>
      <//>
    </div>
  `;
}
