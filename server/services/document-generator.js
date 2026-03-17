/**
 * Document generator — renders Handlebars templates, saves to S3, tracks in DB.
 */

import { readFile } from "fs/promises";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

import Handlebars from "handlebars";

import { generateDocx } from "./docx-generator.js";
import { addDocument, getNextVersion, getPackage } from "./packages.js";
import { generatePdf } from "./pdf-generator.js";
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

  // 4. Save markdown to S3
  const { contentHash } = await putFile(DOC_BUCKET, s3Key, rendered, "text/markdown");

  // 4b. Generate PDF and DOCX, upload alongside markdown
  const pdfKey = s3Key.replace(/\.md$/, ".pdf");
  const docxKey = s3Key.replace(/\.md$/, ".docx");
  const genDate =
    templateData.DATE ||
    new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const genOptions = { title, docType, isDraft: true, date: genDate };

  try {
    const [pdfBuffer, docxBuffer] = await Promise.all([
      generatePdf(rendered, genOptions),
      generateDocx(rendered, genOptions),
    ]);
    await Promise.all([
      putFile(DOC_BUCKET, pdfKey, pdfBuffer, "application/pdf"),
      putFile(
        DOC_BUCKET,
        docxKey,
        docxBuffer,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ),
    ]);
  } catch (err) {
    // Log but don't fail — markdown is the source of truth
    console.error("PDF/DOCX generation warning:", err.message);
  }

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

  // 6. Generate download URLs (PDF is primary, markdown and DOCX also available)
  const [downloadUrl, markdownUrl, docxUrl] = await Promise.all([
    getPresignedUrl(DOC_BUCKET, pdfKey),
    getPresignedUrl(DOC_BUCKET, s3Key),
    getPresignedUrl(DOC_BUCKET, docxKey),
  ]);

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
    markdownUrl,
    docxUrl,
    checklist,
    preview: rendered.slice(0, 2000),
  };
}
