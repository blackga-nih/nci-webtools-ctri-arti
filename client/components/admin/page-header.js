import { ArrowLeft } from "lucide-solid";
import { For, Show } from "solid-js";
import html from "solid-js/html";

export default function AdminPageHeader(props) {
  return html`
    <div class="mb-8">
      <${Show} when=${() => props.breadcrumbs?.length}>
        <nav class="mb-4">
          <ol class="flex items-center gap-2 text-sm text-gray-500">
            <${For} each=${() => props.breadcrumbs}>
              ${(crumb, i) => html`
                <li class="flex items-center gap-2">
                  <${Show} when=${() => i() > 0}>
                    <span>/</span>
                  <//>
                  <${Show}
                    when=${() => crumb.href}
                    fallback=${html`<span class="text-gray-900">${crumb.label}</span>`}
                  >
                    <a
                      href=${crumb.href}
                      class="hover:text-blue-600 transition-colors no-underline"
                    >
                      ${crumb.label}
                    </a>
                  <//>
                </li>
              `}
            <//>
          </ol>
        </nav>
      <//>

      <${Show} when=${() => props.backHref}>
        <a
          href=${() => props.backHref}
          class="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors no-underline"
        >
          <${ArrowLeft} size=${16} />
          ${() => props.backLabel || "Back"}
        </a>
      <//>

      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">${() => props.title}</h1>
          <${Show} when=${() => props.description}>
            <p class="mt-1 text-gray-500">${() => props.description}</p>
          <//>
        </div>
        <${Show} when=${() => props.actions}>
          <div class="flex items-center gap-3">${() => props.actions?.()}</div>
        <//>
      </div>
    </div>
  `;
}
