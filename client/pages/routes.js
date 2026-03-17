import { useAuthContext } from "../contexts/auth-context.js";

import AuthorizedImport from "./auth.js";
import Home from "./home.js";

const Chat = AuthorizedImport({ path: "./tools/chat/index.js" });
const ChatV2 = AuthorizedImport({ path: "./tools/chat-v2/index.js" });
const ConsentCrafterV2 = AuthorizedImport({ path: "./tools/consent-crafter-v2/index.js" });
const Translate = AuthorizedImport({ path: "./tools/translate/index.js" });
const SemanticSearch = AuthorizedImport({ path: "./tools/semantic-search.js" });
const ExportConversations = AuthorizedImport({ path: "./tools/export-conversations/index.js" });
const Workflows = AuthorizedImport({ path: "./tools/workflows/index.js" });
const Users = AuthorizedImport({ path: "./users/index.js", roles: [1] });
const UserEdit = AuthorizedImport({ path: "./users/edit.js", roles: [1] });
const UserProfile = AuthorizedImport({ path: "./users/profile.js" });
const Usage = AuthorizedImport({ path: "./users/usage.js", roles: [1] });
const UserUsage = AuthorizedImport({ path: "./users/user-usage.js", roles: [1] });
const AdminDashboard = AuthorizedImport({ path: "./admin/dashboard.js", roles: [1] });
const Traces = AuthorizedImport({ path: "./admin/traces.js", roles: [1] });
const Costs = AuthorizedImport({ path: "./admin/costs.js", roles: [1] });
const Skills = AuthorizedImport({ path: "./admin/skills.js", roles: [1] });
const Templates = AuthorizedImport({ path: "./admin/templates.js", roles: [1] });
const ApiLog = AuthorizedImport({ path: "./admin/api-log.js", roles: [1] });
const Documents = AuthorizedImport({ path: "./admin/documents.js", roles: [1] });
const AnalyticsPage = AuthorizedImport({ path: "./admin/analytics.js", roles: [1] });
const KnowledgeBase = AuthorizedImport({ path: "./admin/knowledge.js", roles: [1] });

/**
 * Generate site routes.
 *
 * @returns {Array} - Array of route configurations
 */
export default function getRoutes() {
  const { user } = useAuthContext();

  const hasRole = (roleIds) => user?.() && roleIds.includes(user?.()?.Role?.id);

  return [
    {
      path: "",
      title: "Home",
      component: Home,
      hidden: false,
    },
    {
      path: "*",
      title: "Home",
      component: Home,
      hidden: true,
    },
    {
      path: "/tools",
      title: "Tools",
      children: [
        {
          path: "chat",
          title: "Chat",
          component: Chat,
        },
        {
          path: "chat-v2",
          title: "Chat v2",
          component: ChatV2,
          hidden: true,
        },
        {
          path: "consent-crafter",
          title: "ConsentCrafter",
          component: ConsentCrafterV2,
        },
        {
          path: "translator",
          title: "Translator",
          component: Translate,
        },
        {
          path: "semantic-search",
          title: "Semantic Search",
          component: SemanticSearch,
          hidden: true,
        },
        {
          path: "workflows",
          title: "Packages",
          component: Workflows,
        },
        {
          path: "export-conversations",
          title: "Export Conversations",
          component: ExportConversations,
          hidden: true,
        },
      ],
    },
    {
      path: "/_",
      rawPath: !user?.() ? "/api/v1/login" : undefined,
      title: user?.() ? user?.().firstName || "User" : "Login",
      class: "ms-lg-auto",
      children: user?.()?.id && [
        {
          path: "profile",
          title: "My Profile",
          component: UserProfile,
        },
        {
          path: "users",
          title: "Manage Users",
          component: Users,
          hidden: !hasRole([1]),
        },
        {
          path: "users/:id",
          title: "Edit User",
          component: UserEdit,
          hidden: true,
        },
        {
          path: "usage",
          title: "AI Usage Dashboard",
          component: Usage,
          hidden: !hasRole([1]),
        },
        {
          path: "users/:id/usage",
          title: "User Usage",
          component: UserUsage,
          hidden: true,
        },
        {
          path: "admin",
          title: "Admin",
          component: AdminDashboard,
          hidden: !hasRole([1]),
        },
        {
          path: "admin/traces",
          title: "Traces",
          component: Traces,
          hidden: true,
        },
        {
          path: "admin/costs",
          title: "Costs",
          component: Costs,
          hidden: true,
        },
        {
          path: "admin/skills",
          title: "Skills",
          component: Skills,
          hidden: true,
        },
        {
          path: "admin/templates",
          title: "Templates",
          component: Templates,
          hidden: true,
        },
        {
          path: "admin/api-log",
          title: "API Log",
          component: ApiLog,
          hidden: true,
        },
        {
          path: "admin/documents",
          title: "Documents",
          component: Documents,
          hidden: true,
        },
        {
          path: "admin/analytics",
          title: "Analytics",
          component: AnalyticsPage,
          hidden: true,
        },
        {
          path: "admin/knowledge",
          title: "Knowledge Base",
          component: KnowledgeBase,
          hidden: true,
        },
        {
          rawPath: "/api/v1/logout",
          title: "Logout",
        },
      ],
    },
  ];
}
