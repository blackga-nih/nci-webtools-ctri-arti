/**
 * Server-Side Tool Executor
 *
 * Maps each tool name to a server-side function that calls the underlying
 * service directly (no HTTP round-trip). Used by the agent loop to execute
 * tools without sending results through the WAF.
 */

import { readFile } from "fs/promises";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

import { executeOperation, searchFar } from "./compliance-matrix.js";
import { generateDocument } from "./document-generator.js";
import { createPackage, getPackage, getPackageChecklist } from "./packages.js";
import { parseDocument } from "./parsers.js";
import { getAuthorizedUrl, getAuthorizedHeaders } from "./proxy.js";
import { getFile, listFiles } from "./s3.js";
import { search } from "./utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_PATH = process.env.EAGLE_PLUGIN_PATH || resolve(__dirname, "../../eagle-plugin");
const KB_BUCKET = "rh-eagle-files";
const KB_AGENTS = [
  "compliance-strategist",
  "financial-advisor",
  "legal-counselor",
  "market-intelligence",
  "public-interest-guardian",
  "shared",
  "supervisor-core",
  "technical-translator",
];

/** Tools that require browser APIs and cannot run server-side */
const CLIENT_ONLY_TOOLS = new Set(["code", "editor"]);

export function isClientOnlyTool(name) {
  return CLIENT_ONLY_TOOLS.has(name);
}

/**
 * Execute a tool by name. Returns a tool_result content block.
 * @param {{ toolUseId: string, name: string, input: object }} toolUse
 * @returns {Promise<{ toolUseId: string, content: Array }>}
 */
export async function executeTool(toolUse) {
  const { toolUseId, name, input } = toolUse;
  try {
    const handler = serverTools[name];
    if (!handler) {
      return { toolUseId, content: [{ text: `Unknown tool: ${name}` }] };
    }
    const results = await handler(input);
    return { toolUseId, content: [{ json: { results } }] };
  } catch (error) {
    console.error(`Tool ${name} error:`, error);
    const errorText = error.stack || error.message || String(error);
    return { toolUseId, content: [{ text: `Error running ${name}: ${errorText}` }] };
  }
}

// ── Tool implementations ──────────────────────────────────────────────

const serverTools = {
  async search({ query }) {
    const response = await search({ q: query });
    const extract = (r) => ({
      url: r.url,
      title: r.title,
      description: r.description,
      extra_snippets: r.extra_snippets,
      age: r.age,
      page_age: r.page_age,
      article: r.article,
    });
    return {
      web: response.web?.web?.results?.map(extract),
      news: response.news?.results?.map(extract),
      gov: response.gov?.results,
    };
  },

  async browse({ url, topic }) {
    if (!Array.isArray(url)) url = [url];
    if (url.length === 0) return "No URLs provided";

    const results = await Promise.all(
      url.map(async (u) => {
        try {
          const targetUrl = new URL(u.startsWith("http") ? u : "https://" + u);
          const authorizedUrl = getAuthorizedUrl(targetUrl);
          const headers = getAuthorizedHeaders(new URL(u.startsWith("http") ? u : "https://" + u));

          const response = await fetch(authorizedUrl, { headers, redirect: "follow" });
          if (!response.ok) return `Failed to read ${u}: ${response.status} ${response.statusText}`;

          const contentType = response.headers.get("content-type") || "text/html";
          const buffer = Buffer.from(await response.arrayBuffer());
          const text = await parseDocument(buffer, contentType, u);

          // Truncate very large documents
          const maxLen = 100_000;
          const truncated =
            text.length > maxLen ? text.substring(0, maxLen) + "\n... [truncated]" : text;
          return ["## " + u, truncated].join("\n\n");
        } catch (err) {
          return `Failed to read ${u}: ${err.message}`;
        }
      })
    );
    return results.join("\n\n---\n\n");
  },

  async think({ thought }) {
    return { thought };
  },

  async data({ bucket, key }) {
    const allowedBuckets = (process.env.S3_BUCKETS || "").split(",");
    if (!allowedBuckets.includes(bucket)) throw new Error("Invalid bucket");

    if (!key || key.endsWith("/")) {
      return await listFiles(bucket, key || "");
    }

    const data = await getFile(bucket, key);
    const contentType = data.ContentType || "";
    const documentTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    const chunks = [];
    for await (const chunk of data.Body) chunks.push(chunk);
    const raw = Buffer.concat(chunks);

    if (documentTypes.includes(contentType)) {
      return await parseDocument(raw, contentType);
    }

    const text = raw.toString("utf-8");
    if (key.endsWith(".json")) {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }
    return text;
  },

  async search_far({ keyword, parts }) {
    return { results: searchFar(keyword || "", parts) };
  },

  async query_compliance_matrix(params) {
    return executeOperation(params);
  },

  async knowledge_search({ agent, keyword, topic }) {
    const matchedAgent = agent
      ? KB_AGENTS.find((a) => a === agent || a.includes(agent.toLowerCase()))
      : null;
    const prefix = matchedAgent ? `${matchedAgent}/` : "";
    const allFiles = await listFiles(KB_BUCKET, prefix);

    let results = allFiles
      .filter((key) => key.endsWith(".txt") || key.endsWith(".md") || key.endsWith(".json"))
      .map((key) => {
        const parts = key.split("/");
        return {
          s3_key: key,
          agent: parts[0],
          folder: parts.length > 2 ? parts[1] : "",
          filename: parts[parts.length - 1],
        };
      });

    if (keyword) {
      const normalize = (s) => s.toLowerCase().replace(/[_-]/g, " ");
      const terms = normalize(keyword)
        .split(/\s+/)
        .filter((t) => t.length >= 3);
      if (terms.length > 0) {
        results = results
          .map((r) => {
            const text = normalize(r.s3_key);
            const matched = terms.filter((t) => text.includes(t));
            return { ...r, _score: matched.length / terms.length };
          })
          .filter((r) => r._score > 0)
          .sort((a, b) => b._score - a._score);
      }
    }

    if (topic) {
      const normalize = (s) => s.toLowerCase().replace(/[_-]/g, " ");
      const topicTerms = normalize(topic)
        .split(/\s+/)
        .filter((t) => t.length >= 3);
      if (topicTerms.length > 0) {
        results = results.filter((r) => {
          const text = normalize(r.s3_key);
          return topicTerms.some((t) => text.includes(t));
        });
      }
    }

    return { count: results.length, results: results.slice(0, 30) };
  },

  async knowledge_fetch({ key }) {
    if (!key) throw new Error("key parameter required");
    const data = await getFile(KB_BUCKET, key);
    const chunks = [];
    for await (const chunk of data.Body) chunks.push(chunk);
    const content = Buffer.concat(chunks).toString("utf-8");
    const MAX_CONTENT = 50_000;
    return {
      document_id: key,
      content: content.substring(0, MAX_CONTENT),
      truncated: content.length > MAX_CONTENT,
      content_length: content.length,
    };
  },

  async plugin_data({ path: filePath }) {
    const safePath = filePath.replace(/\.\./g, "").replace(/[^a-z0-9./_-]/gi, "");
    const fullPath = join(PLUGIN_PATH, "data", safePath);
    const content = await readFile(fullPath, "utf-8");
    if (fullPath.endsWith(".json")) {
      try {
        return JSON.parse(content);
      } catch {
        return { content };
      }
    }
    return { content };
  },

  async load_skill({ name }) {
    const safeName = name.replace(/[^a-z0-9-]/gi, "");
    const skillPath = join(PLUGIN_PATH, "skills", safeName, "SKILL.md");
    const content = await readFile(skillPath, "utf-8");
    return { skill: safeName, status: "loaded", instructions: content };
  },

  async create_document({ package_id, doc_type, title, data }) {
    return await generateDocument({ packageId: package_id, docType: doc_type, title, data });
  },

  async manage_package(params) {
    const { operation, package_id, ...createData } = params;
    if (operation === "create") {
      return await createPackage({
        title: createData.title,
        estimatedValue: createData.estimated_value,
        requirementDescription: createData.requirement_description,
        acquisitionMethod: createData.acquisition_method,
        contractType: createData.contract_type,
        flags: createData.flags,
      });
    }
    if (operation === "status") {
      return await getPackage(package_id);
    }
    if (operation === "checklist") {
      return await getPackageChecklist(package_id);
    }
    throw new Error(`Unknown operation: ${operation}`);
  },

  async docxTemplate({ docxUrl, replacements }) {
    let buffer;
    if (docxUrl.startsWith("s3://")) {
      const match = docxUrl.match(/^s3:\/\/([^/]+)\/(.+)$/);
      if (!match) throw new Error("Invalid S3 URL format. Expected: s3://bucket/key");
      const [, bucket, key] = match;
      const data = await getFile(bucket, key);
      const chunks = [];
      for await (const chunk of data.Body) chunks.push(chunk);
      buffer = Buffer.concat(chunks);
    } else {
      const targetUrl = new URL(docxUrl.startsWith("http") ? docxUrl : "https://" + docxUrl);
      const response = await fetch(getAuthorizedUrl(targetUrl), {
        headers: getAuthorizedHeaders(
          new URL(docxUrl.startsWith("http") ? docxUrl : "https://" + docxUrl)
        ),
      });
      if (!response.ok) throw new Error(`Failed to fetch document: ${response.status}`);
      buffer = Buffer.from(await response.arrayBuffer());
    }

    // Use mammoth for server-side DOCX processing
    const mammoth = await import("mammoth");

    if (!replacements) {
      const result = await mammoth.default.extractRawText({ buffer });
      return { text: result.value, templateDownloadUrl: docxUrl };
    }

    const result = await mammoth.default.convertToHtml({ buffer });
    return {
      html: result.value,
      warnings: result.messages.filter((m) => m.type === "warning").map((m) => m.message),
    };
  },
};
