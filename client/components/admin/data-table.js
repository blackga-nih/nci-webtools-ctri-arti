import { createMemo, createSignal, For, Show } from "solid-js";
import html from "solid-js/html";

export function AdminDataTable(props) {
  const [internalPage, setInternalPage] = createSignal(1);
  const isRemote = props.remote || false;
  const rowsPerPage = props.rowsPerPage || 20;

  const currentPage = () =>
    isRemote ? (typeof props.page === "function" ? props.page() : props.page) || 1 : internalPage();

  const processedData = createMemo(() => {
    if (isRemote) return props.data || [];
    let data = props.data || [];
    const start = (currentPage() - 1) * rowsPerPage;
    return data.slice(start, start + rowsPerPage);
  });

  const totalPages = createMemo(() => {
    if (isRemote) return Math.ceil((props.totalItems || 0) / rowsPerPage);
    return Math.ceil((props.data || []).length / rowsPerPage);
  });

  const handlePageChange = (newPage) => {
    if (isRemote) {
      props.onPageChange?.({ page: newPage });
    } else {
      setInternalPage(newPage);
    }
  };

  return html`
    <div class=${() => `bg-white rounded-2xl border border-gray-200 ${props.className || ""}`}>
      <${Show} when=${() => props.title}>
        <div class="p-6 border-b border-gray-100">
          <h3 class="font-bold text-gray-900">${() => props.title}</h3>
          <${Show} when=${() => props.description}>
            <p class="text-sm text-gray-500 mt-1">${() => props.description}</p>
          <//>
        </div>
      <//>

      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-gray-100">
              <${For} each=${() => props.columns}>
                ${(col) => html`
                  <th
                    class=${() =>
                      `text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3 ${col.headerClass || ""}`}
                  >
                    ${col.title}
                  </th>
                `}
              <//>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            <${For}
              each=${processedData}
              fallback=${html`
                <tr>
                  <td colspan=${() => props.columns?.length || 1} class="px-6 py-12 text-center">
                    <p class="text-sm font-medium text-gray-500">No data available</p>
                  </td>
                </tr>
              `}
            >
              ${(row) => html`
                <tr class="hover:bg-gray-50 transition-colors">
                  <${For} each=${() => props.columns}>
                    ${(col) => html`
                      <td class=${() => `px-6 py-4 text-sm ${col.cellClass || ""}`}>
                        ${col.render ? col.render(row) : row[col.key]}
                      </td>
                    `}
                  <//>
                </tr>
              `}
            <//>
          </tbody>
        </table>
      </div>

      <${Show} when=${() => totalPages() > 0}>
        <div class="flex justify-between items-center px-6 py-3 border-t border-gray-100">
          <span class="text-sm text-gray-500">
            Page ${() => currentPage()} of ${() => totalPages()}
          </span>
          <div class="flex gap-2">
            <button
              class="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled=${() => currentPage() <= 1}
              onClick=${() => handlePageChange(Math.max(1, currentPage() - 1))}
            >
              Previous
            </button>
            <button
              class="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled=${() => currentPage() >= totalPages()}
              onClick=${() => handlePageChange(Math.min(totalPages(), currentPage() + 1))}
            >
              Next
            </button>
          </div>
        </div>
      <//>
    </div>
  `;
}
