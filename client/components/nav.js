import { A, useLocation } from "@solidjs/router";
import {
  LogOut,
  MessageSquare,
  FolderKanban,
  LayoutDashboard,
  Wrench,
  Menu,
  X,
} from "lucide-solid";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import html from "solid-js/html";

import { useAuthContext } from "../contexts/auth-context.js";

const navLinks = [
  { href: "/tools/chat", label: "Chat", icon: MessageSquare },
  { href: "/tools/workflows", label: "Packages", icon: FolderKanban },
  { href: "/tools", label: "Tools", icon: Wrench, matchPrefix: true },
  { href: "/_/admin", label: "Admin", icon: LayoutDashboard, adminOnly: true },
];

export default function Nav(props) {
  const { user } = useAuthContext();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = createSignal(false);

  const isActive = (href, matchPrefix) => {
    const path = location.pathname;
    if (href === "/tools/chat") return path === "/tools/chat";
    if (href === "/_/admin") return path === "/_/admin" || path.startsWith("/_/admin/");
    if (matchPrefix) return path.startsWith(href);
    return path === href;
  };

  const isAdmin = () => user?.()?.Role?.id === 1;
  const displayName = () => user?.()?.firstName || user?.()?.email || "User";

  const handleClickOutside = (e) => {
    if (mobileOpen() && !e.target.closest("#eagle-nav")) setMobileOpen(false);
  };
  onMount(() => document.addEventListener("click", handleClickOutside, true));
  onCleanup(() => document.removeEventListener("click", handleClickOutside, true));

  return html`
    <header
      id="eagle-nav"
      class="bg-nci-blue text-white px-6 flex items-center justify-between shrink-0 z-30 relative"
      style="height:56px; box-shadow:0 2px 8px rgba(0,51,102,0.3)"
    >
      <!-- Left: branding -->
      <a href="/" class="flex items-center gap-3 no-underline text-white hover:no-underline">
        <span
          class="text-[28px] leading-none"
          style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3))"
        >
          🦅
        </span>
        <div>
          <h1 class="text-lg font-bold tracking-wider m-0">EAGLE</h1>
          <p class="text-[11px] text-white/70 tracking-wide m-0">Research Optimizer</p>
        </div>
      </a>

      <!-- Center: nav links (desktop) -->
      <nav class="hidden lg:flex items-center gap-1">
        <${For} each=${navLinks}>
          ${(link) => html`
            <${Show} when=${() => !link.adminOnly || isAdmin()}>
              <${A}
                href=${link.href}
                class=${() =>
                  `flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors no-underline ${
                    isActive(link.href, link.matchPrefix)
                      ? "bg-white/20 text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
              >
                <${link.icon} size=${16} />
                ${link.label}
              <//>
            <//>
          `}
        <//>
      </nav>

      <!-- Right: user + logout (desktop) -->
      <div class="hidden lg:flex items-center gap-4">
        <${Show} when=${() => user?.()}>
          <span class="text-sm text-white/85">${displayName}</span>
          <a
            href="/api/v1/logout"
            class="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors no-underline"
            title="Sign out"
          >
            <${LogOut} size=${16} />
          </a>
        <//>
        <${Show} when=${() => !user?.()}>
          <a
            href="/api/v1/login"
            class="px-4 py-1.5 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors no-underline"
          >
            Login
          </a>
        <//>
      </div>

      <!-- Mobile: hamburger -->
      <button
        class="lg:hidden p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg"
        onClick=${() => setMobileOpen(!mobileOpen())}
      >
        <${Show} when=${() => !mobileOpen()} fallback=${html`<${X} size=${20} />`}>
          <${Menu} size=${20} />
        <//>
      </button>

      <!-- Mobile menu -->
      <${Show} when=${mobileOpen}>
        <div
          class="absolute top-full left-0 right-0 bg-nci-blue border-t border-white/10 py-2 px-4 lg:hidden z-50"
          style="box-shadow:0 4px 12px rgba(0,51,102,0.4)"
        >
          <${For} each=${navLinks}>
            ${(link) => html`
              <${Show} when=${() => !link.adminOnly || isAdmin()}>
                <${A}
                  href=${link.href}
                  class=${() =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors no-underline ${
                      isActive(link.href, link.matchPrefix)
                        ? "bg-white/20 text-white"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  onClick=${() => setMobileOpen(false)}
                >
                  <${link.icon} size=${16} />
                  ${link.label}
                <//>
              <//>
            `}
          <//>
          <div class="border-t border-white/10 mt-2 pt-2">
            <${Show} when=${() => user?.()}>
              <div class="px-4 py-2 text-sm text-white/70">${displayName}</div>
              <a
                href="/api/v1/logout"
                class="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white no-underline"
              >
                <${LogOut} size=${16} /> Sign Out
              </a>
            <//>
          </div>
        </div>
      <//>
    </header>
  `;
}
