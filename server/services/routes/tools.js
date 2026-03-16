import db, { rawSql } from "database";
import { readFile, readdir } from "fs/promises";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

import { json, Router } from "express";
import JSZip from "jszip";

import { executeOperation, searchFar } from "../compliance-matrix.js";
import { generateDocument } from "../document-generator.js";
import { sendFeedback, sendLogReport } from "../email.js";
import { requireRole } from "../middleware.js";
import { parseDocument } from "../parsers.js";
import { proxyMiddleware } from "../proxy.js";
import { getFile, listFiles, putFile, deleteFile, getPresignedUrl } from "../s3.js";
import { textract } from "../textract.js";
import { getLanguages, translate } from "../translate.js";
import { search } from "../utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_PATH = process.env.EAGLE_PLUGIN_PATH || resolve(__dirname, "../../../eagle-plugin");
const { VERSION, S3_BUCKETS, EMAIL_DEV, EMAIL_ADMIN, EMAIL_USER_REPORTS } = process.env;
const api = Router();
api.use(json({ limit: 1024 ** 3 })); // 1GB

api.get("/status", async (req, res) => {
  const [health] = await rawSql`SELECT 'ok' AS health`;
  res.json({
    version: VERSION,
    uptime: process.uptime(),
    database: health,
  });
});

api.get("/search", requireRole(), async (req, res) => {
  res.json(await search(req.query));
});

api.all("/browse/*url", requireRole(), proxyMiddleware);

api.post("/textract", requireRole(), async (req, res) => {
  res.json(await textract(req.body));
});

api.post("/translate", requireRole(), async (req, res) => {
  res.json(await translate(req.body));
});

api.get("/translate/languages", requireRole(), async (req, res) => {
  res.json(await getLanguages());
});

api.post("/feedback", requireRole(), async (req, res) => {
  const { feedback, context } = req.body;
  const from = req.session?.user?.email;
  const results = await sendFeedback({ from, feedback, context });
  return res.json(results);
});

api.post("/log", async (req, res) => {
  const { metadata, reportSource } = req.body;

  const recipient =
    reportSource?.toUpperCase() === "USER" ? EMAIL_USER_REPORTS || EMAIL_ADMIN : EMAIL_DEV;

  const user = req.session?.user;
  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "N/A";

  const logData = {
    reportSource,
    userId: user?.id || "N/A",
    userName,
    metadata,
    recipient,
  };

  const results = await sendLogReport(logData);
  return res.json(results);
});

function getMimeTypeFromKey(key) {
  const ext = key.split(".").pop()?.toLowerCase();
  const mimeTypes = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
    json: "application/json",
    csv: "text/csv",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

api.get("/data", requireRole(), async (req, res) => {
  const { bucket, key, raw } = req.query;
  if (!S3_BUCKETS?.split(",").includes(bucket)) {
    return res.status(400).json({ error: "Invalid bucket" });
  }

  if (!key || key?.endsWith("/")) {
    const files = await listFiles(bucket);
    return res.json(files);
  } else {
    const data = await getFile(bucket, key);
    const contentType = data.ContentType || getMimeTypeFromKey(key);

    // Return raw binary content if raw=true is requested
    if (raw === "true") {
      res.setHeader("Content-Type", contentType);
      return data.Body.pipe(res);
    }

    // Parse document types that need text extraction
    const documentTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (documentTypes.includes(contentType)) {
      const chunks = [];
      for await (const chunk of data.Body) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      const text = await parseDocument(buffer, contentType);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.send(text);
    }

    // For other files, pipe raw content
    return data.Body.pipe(res);
  }
});

// Knowledge base — search and fetch documents from S3
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

api.get("/knowledge/search", requireRole(), async (req, res) => {
  const { agent, keyword, topic } = req.query;
  try {
    // Fuzzy-match agent name (e.g. "legal" -> "legal-counselor", "GAO" -> ignored)
    const matchedAgent = agent
      ? KB_AGENTS.find((a) => a === agent || a.includes(agent.toLowerCase()))
      : null;
    const prefix = matchedAgent ? `${matchedAgent}/` : "";
    const allFiles = await listFiles(KB_BUCKET, prefix);

    let results = allFiles
      .filter((key) => key.endsWith(".txt") || key.endsWith(".md") || key.endsWith(".json"))
      .map((key) => {
        const parts = key.split("/");
        const agentName = parts[0];
        const folder = parts.length > 2 ? parts[1] : "";
        const filename = parts[parts.length - 1];
        return { s3_key: key, agent: agentName, folder, filename };
      });

    // Filter by keyword against filename and path (normalize both sides)
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

    // Filter by topic (match against folder and path — treat as additional search terms)
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

    res.json({ count: results.length, results: results.slice(0, 30) });
  } catch (err) {
    console.error("Knowledge search error:", err);
    res.status(500).json({ error: "Knowledge search failed" });
  }
});

api.get("/knowledge/fetch", requireRole(), async (req, res) => {
  const { key } = req.query;
  if (!key) return res.status(400).json({ error: "key parameter required" });

  try {
    const data = await getFile(KB_BUCKET, key);
    const chunks = [];
    for await (const chunk of data.Body) {
      chunks.push(chunk);
    }
    const content = Buffer.concat(chunks).toString("utf-8");
    const MAX_CONTENT = 50000;
    res.json({
      document_id: key,
      content: content.substring(0, MAX_CONTENT),
      truncated: content.length > MAX_CONTENT,
      content_length: content.length,
    });
  } catch (err) {
    console.error("Knowledge fetch error:", err);
    res.status(404).json({ error: `Document not found: ${key}` });
  }
});

// ── Package management endpoints ───────────────────────────────────

import {
  createPackage,
  getPackage,
  listPackages,
  updatePackageStatus,
  getPackageChecklist,
} from "../packages.js";

api.post("/packages", requireRole(), async (req, res) => {
  try {
    const pkg = await createPackage(req.body);
    res.json(pkg);
  } catch (err) {
    console.error("Package create error:", err);
    res.status(500).json({ error: "Failed to create package" });
  }
});

api.get("/packages", requireRole(), async (req, res) => {
  try {
    const pkgs = await listPackages(
      req.query.conversation_id ? Number(req.query.conversation_id) : undefined
    );
    res.json(pkgs);
  } catch (err) {
    console.error("Package list error:", err);
    res.status(500).json({ error: "Failed to list packages" });
  }
});

api.get("/packages/:id", requireRole(), async (req, res) => {
  try {
    const pkg = await getPackage(req.params.id);
    if (!pkg) return res.status(404).json({ error: "Package not found" });
    res.json(pkg);
  } catch (err) {
    console.error("Package get error:", err);
    res.status(500).json({ error: "Failed to get package" });
  }
});

api.get("/packages/:id/checklist", requireRole(), async (req, res) => {
  try {
    const checklist = await getPackageChecklist(req.params.id);
    if (!checklist) return res.status(404).json({ error: "Package not found" });
    res.json(checklist);
  } catch (err) {
    console.error("Checklist error:", err);
    res.status(500).json({ error: "Failed to get checklist" });
  }
});

api.patch("/packages/:id/status", requireRole(), async (req, res) => {
  try {
    const pkg = await updatePackageStatus(req.params.id, req.body.status);
    if (!pkg) return res.status(404).json({ error: "Package not found" });
    res.json(pkg);
  } catch (err) {
    console.error("Package status update error:", err);
    res.status(500).json({ error: "Failed to update package status" });
  }
});

api.get("/packages/:id/export", requireRole(), async (req, res) => {
  try {
    const pkg = await getPackage(req.params.id);
    if (!pkg) return res.status(404).json({ error: "Package not found" });
    if (!pkg.documents?.length) {
      return res.status(400).json({ error: "No documents to export" });
    }

    const zip = new JSZip();

    // Add manifest
    zip.file(
      "manifest.json",
      JSON.stringify(
        {
          packageId: pkg.id,
          title: pkg.title,
          pathway: pkg.pathway,
          estimatedValue: pkg.estimatedValue,
          status: pkg.status,
          documents: pkg.documents.map((d) => ({
            docType: d.docType,
            title: d.title,
            version: d.version,
            fileType: d.fileType,
          })),
          exportedAt: new Date().toISOString(),
        },
        null,
        2
      )
    );

    // Fetch each document from S3 and add to ZIP
    for (const doc of pkg.documents) {
      if (!doc.s3Key) continue;
      try {
        const s3Data = await getFile(KB_BUCKET, doc.s3Key);
        const chunks = [];
        for await (const chunk of s3Data.Body) {
          chunks.push(chunk);
        }
        const content = Buffer.concat(chunks);
        const filename = `${doc.docType}/${doc.title || doc.docType}.${doc.fileType || "md"}`;
        zip.file(filename, content);
      } catch (err) {
        console.error(`Failed to fetch doc ${doc.s3Key}:`, err);
        zip.file(`${doc.docType}/ERROR.txt`, `Failed to fetch: ${doc.s3Key}`);
      }
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const safeName = pkg.title.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 60);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}-package.zip"`);
    res.send(zipBuffer);
  } catch (err) {
    console.error("Package export error:", err);
    res.status(500).json({ error: "Failed to export package" });
  }
});

// Document generation — render templates, save to S3, track in DB

api.post("/documents/generate", requireRole(), async (req, res) => {
  const { package_id, doc_type, title, data } = req.body;
  if (!doc_type || !title || !data) {
    return res.status(400).json({ error: "doc_type, title, and data are required" });
  }
  try {
    const result = await generateDocument({
      packageId: package_id,
      docType: doc_type,
      title,
      data,
    });
    res.json(result);
  } catch (err) {
    console.error("Document generation error:", err);
    res.status(500).json({ error: err.message || "Failed to generate document" });
  }
});

// Document storage — save and retrieve documents from S3
api.post("/documents/save", requireRole(), async (req, res) => {
  const { bucket, key, content, contentType } = req.body;
  if (!S3_BUCKETS?.split(",").includes(bucket)) {
    return res.status(400).json({ error: "Invalid bucket" });
  }
  if (!key || !content) {
    return res.status(400).json({ error: "key and content are required" });
  }
  try {
    const result = await putFile(bucket, key, content, contentType || "text/markdown");
    const url = await getPresignedUrl(bucket, key);
    res.json({ ...result, url });
  } catch (err) {
    console.error("Document save error:", err);
    res.status(500).json({ error: "Failed to save document" });
  }
});

api.get("/documents/download-url", requireRole(), async (req, res) => {
  const { bucket, key } = req.query;
  if (!S3_BUCKETS?.split(",").includes(bucket)) {
    return res.status(400).json({ error: "Invalid bucket" });
  }
  if (!key) {
    return res.status(400).json({ error: "key is required" });
  }
  try {
    const url = await getPresignedUrl(bucket, key, 900);
    res.json({ url, expiresIn: 900 });
  } catch (err) {
    console.error("Presigned URL error:", err);
    res.status(500).json({ error: "Failed to generate download URL" });
  }
});

// Skill loading — progressive disclosure for acquisition skills
api.get("/skill/:name", requireRole(), async (req, res) => {
  const name = req.params.name.replace(/[^a-z0-9-]/gi, "");
  const skillPath = join(PLUGIN_PATH, "skills", name, "SKILL.md");
  try {
    const content = await readFile(skillPath, "utf-8");
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.send(content);
  } catch {
    res.status(404).json({ error: `Skill "${name}" not found` });
  }
});

// List available skills (returns name + description from YAML frontmatter)
api.get("/skills", requireRole(), async (req, res) => {
  const skillsDir = join(PLUGIN_PATH, "skills");
  try {
    const dirs = await readdir(skillsDir, { withFileTypes: true });
    const skills = await Promise.all(
      dirs
        .filter((d) => d.isDirectory())
        .map(async (d) => {
          try {
            const content = await readFile(join(skillsDir, d.name, "SKILL.md"), "utf-8");
            const match = content.match(/^---\n([\s\S]*?)\n---/);
            if (!match) return { name: d.name, description: "" };
            const descMatch = match[1].match(/description:\s*(.+)/);
            return { name: d.name, description: descMatch?.[1]?.trim() || "" };
          } catch {
            return null;
          }
        })
    );
    res.json(skills.filter(Boolean));
  } catch {
    res.json([]);
  }
});

// List available templates with metadata
api.get("/templates", requireRole(), async (req, res) => {
  const templatesDir = join(PLUGIN_PATH, "data", "templates");
  try {
    const files = await readdir(templatesDir);
    const templates = await Promise.all(
      files
        .filter((f) => f.endsWith(".md"))
        .map(async (f) => {
          try {
            const content = await readFile(join(templatesDir, f), "utf-8");
            const lines = content.split("\n").slice(0, 10);
            const titleLine = lines.find((l) => l.startsWith("# "));
            const name = f.replace(/\.md$/, "");
            const docType = name.replace(/-template$/, "");
            return {
              name,
              filename: f,
              title: titleLine ? titleLine.replace(/^#\s+/, "") : name,
              docType,
              preview: content.substring(0, 500),
            };
          } catch {
            return null;
          }
        })
    );
    res.json(templates.filter(Boolean));
  } catch {
    res.json([]);
  }
});

// Compliance matrix — server-side deterministic analysis
api.post("/compliance", requireRole(), (req, res) => {
  res.json(executeOperation(req.body));
});

api.get("/compliance/search-far", requireRole(), (req, res) => {
  const { keyword, parts } = req.query;
  const partsList = parts ? parts.split(",") : undefined;
  res.json({ results: searchFar(keyword || "", partsList) });
});

// Serve plugin template files (data/templates/*.md) — must be before :file catch-all
api.get("/plugin/data/templates/:file", requireRole(), async (req, res) => {
  const file = req.params.file.replace(/[^a-z0-9.-]/gi, "");
  const filePath = join(PLUGIN_PATH, "data", "templates", file);
  try {
    const content = await readFile(filePath, "utf-8");
    const ct = file.endsWith(".json") ? "application/json" : "text/markdown; charset=utf-8";
    res.setHeader("Content-Type", ct);
    res.send(content);
  } catch {
    res.status(404).json({ error: `Template "${file}" not found` });
  }
});

// Serve plugin data files (matrix.json, thresholds.json, far-database.json, etc.)
api.get("/plugin/data/:file", requireRole(), async (req, res) => {
  const file = req.params.file.replace(/[^a-z0-9.-]/gi, "");
  const filePath = join(PLUGIN_PATH, "data", file);
  try {
    const content = await readFile(filePath, "utf-8");
    const ct = file.endsWith(".md") ? "text/markdown; charset=utf-8" : "application/json";
    res.setHeader("Content-Type", ct);
    res.send(content);
  } catch {
    res.status(404).json({ error: `Data file "${file}" not found` });
  }
});

export default api;
