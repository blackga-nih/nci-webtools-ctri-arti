/**
 * Document generator — renders Handlebars templates, saves to S3, tracks in DB.
 */

import { readFile } from "fs/promises";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

import Handlebars from "handlebars";

import { addDocument, getNextVersion, getPackage } from "./packages.js";
import { putFile, getPresignedUrl } from "./s3.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_PATH = process.env.EAGLE_PLUGIN_PATH || resolve(__dirname, "../../eagle-plugin");
const TEMPLATE_DIR = join(PLUGIN_PATH, "data", "templates");
const DOC_BUCKET = process.env.DOC_BUCKET || "rh-eagle-files";
const TENANT_ID = process.env.TENANT_ID || "demo";

const TEMPLATE_MAP = {
  sow: "sow-template.md",
  igce: "igce-template.md",
  market_research: "market-research-template.md",
  acquisition_plan: "acquisition-plan-template.md",
  justification: "justification-template.md",
};

function sanitizeFilename(name) {
  return name
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

/**
 * Generate a document: render template with data, save to S3, track in DB.
 *
 * @param {object} params
 * @param {string} [params.packageId] - Package to attach to (optional)
 * @param {string} params.docType - sow | igce | market_research | acquisition_plan | justification
 * @param {string} params.title - Document title
 * @param {object} params.data - Template fields (TITLE, DESCRIPTION, etc.)
 * @returns {Promise<object>} - Document metadata + download URL
 */
export async function generateDocument({ packageId, docType, title, data }) {
  // 1. Load template
  const templateFile = TEMPLATE_MAP[docType];
  if (!templateFile) {
    throw new Error(
      `Unknown document type: ${docType}. Valid types: ${Object.keys(TEMPLATE_MAP).join(", ")}`
    );
  }
  const templateContent = await readFile(join(TEMPLATE_DIR, templateFile), "utf-8");

  // 2. Render with Handlebars
  const compiled = Handlebars.compile(templateContent, { noEscape: true });
  const templateData = {
    ...data,
    TITLE: data.TITLE || title,
    DATE:
      data.DATE ||
      new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
  };
  const rendered = compiled(templateData);

  // 3. Determine version and S3 key
  const version = packageId ? await getNextVersion(packageId, docType) : 1;
  const filename = sanitizeFilename(title);
  const s3Key = packageId
    ? `eagle/${TENANT_ID}/packages/${packageId}/${docType}/v${version}/${filename}.md`
    : `eagle/${TENANT_ID}/generated/${docType}/${filename}-${Date.now()}.md`;

  // 4. Save to S3
  const { contentHash } = await putFile(DOC_BUCKET, s3Key, rendered, "text/markdown");

  // 5. Track in database if package exists
  let doc = null;
  if (packageId) {
    doc = await addDocument(packageId, {
      docType,
      s3Key,
      contentHash,
      title,
      fileType: "md",
      version,
    });
  }

  // 6. Generate download URL
  const downloadUrl = await getPresignedUrl(DOC_BUCKET, s3Key);

  // 7. Fetch updated package checklist if applicable
  let checklist = null;
  if (packageId) {
    const pkg = await getPackage(packageId);
    checklist = pkg?.checklist || null;
  }

  return {
    documentId: doc?.id || null,
    packageId: packageId || null,
    docType,
    title,
    version,
    s3Key,
    contentHash,
    downloadUrl,
    checklist,
    preview: rendered.slice(0, 2000),
  };
}
