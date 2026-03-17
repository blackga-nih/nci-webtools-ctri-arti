import html from "solid-js/html";

export default function Header() {
  return html`
    <div class="bg-gray-100 text-gray-700">
      <div class="max-w-7xl mx-auto px-6">
        <div class="flex items-center py-1 gap-1">
          <img src="assets/images/icon-flag.svg" alt="U.S. Flag" width="16" class="mr-1" />
          <small class="text-xs">An official website of the United States government</small>
        </div>
      </div>
    </div>
  `;
}
