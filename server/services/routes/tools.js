import db, { rawSql } from "database";
import { readFile, readdir } from "fs/promises";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

import { json, Router } from "express";

import { executeOperation, searchFar } from "../compliance-matrix.js";
import { sendFeedback, sendLogReport } from "../email.js";
import { requireRole } from "../middleware.js";
import { parseDocument } from "../parsers.js";
import { proxyMiddleware } from "../proxy.js";
import { getFile, listFiles } from "../s3.js";
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
