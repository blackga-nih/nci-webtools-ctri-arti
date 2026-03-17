/**
 * Package tracking service — CRUD, pathway routing, and checklist logic
 * for acquisition packages stored in PGlite.
 */

import { randomUUID } from "crypto";
import db, { Package, PackageDocument } from "database";

import { eq, and, desc } from "drizzle-orm";

// ── Pathway routing ────────────────────────────────────────────────

const DOC_LABELS = {
  sow: "Statement of Work",
  igce: "IGCE",
  market_research: "Market Research Report",
  acquisition_plan: "Acquisition Plan",
  justification: "Justification & Approval (J&A)",
};

export function determinePathway(estimatedValue, method, flags = {}) {
  if (estimatedValue < 15_000) {
    return { pathway: "micro_purchase", requiredDocuments: ["market_research"] };
  }
  if (estimatedValue <= 350_000) {
    return {
      pathway: "simplified",
      requiredDocuments: ["sow", "igce", "market_research"],
    };
  }
  if (method === "sole") {
    return {
      pathway: "sole_source",
      requiredDocuments: ["sow", "igce", "justification", "market_research"],
    };
  }
  // Default: full competition (>$350K)
  return {
    pathway: "full_competition",
    requiredDocuments: ["sow", "igce", "market_research", "acquisition_plan"],
  };
}

// ── CRUD ───────────────────────────────────────────────────────────

export async function createPackage(data) {
  const {
    title,
    estimatedValue,
    requirementDescription,
    acquisitionMethod,
    contractType,
    flags = {},
    conversationId,
  } = data;

  const { pathway, requiredDocuments } = determinePathway(
    estimatedValue || 0,
    acquisitionMethod,
    flags
  );

  const id = `pkg-${randomUUID().slice(0, 12)}`;
  const pkg = {
    id,
    title,
    estimatedValue,
    requirementDescription,
    acquisitionMethod,
    contractType,
    pathway,
    requiredDocuments,
    status: "intake",
    flags,
    conversationId,
  };

  await db.insert(Package).values(pkg);
  return { ...pkg, documents: [], checklist: buildChecklist(requiredDocuments, []) };
}

export async function getPackage(id) {
  const rows = await db.select().from(Package).where(eq(Package.id, id)).limit(1);
  if (!rows.length) return null;
  const pkg = rows[0];
  const docs = await db.select().from(PackageDocument).where(eq(PackageDocument.packageId, id));
  return { ...pkg, documents: docs, checklist: buildChecklist(pkg.requiredDocuments, docs) };
}

export async function listPackages(conversationId) {
  const where = conversationId ? eq(Package.conversationId, conversationId) : undefined;
  const pkgs = where
    ? await db.select().from(Package).where(where)
    : await db.select().from(Package);
  return pkgs;
}

export async function updatePackageStatus(id, status) {
  await db.update(Package).set({ status }).where(eq(Package.id, id));
  return getPackage(id);
}

// ── Document tracking ──────────────────────────────────────────────

export async function addDocument(
  packageId,
  { docType, s3Key, contentHash, title, fileType, version }
) {
  const id = `doc-${randomUUID().slice(0, 12)}`;
  const doc = {
    id,
    packageId,
    docType,
    version: version || 1,
    s3Key,
    contentHash,
    status: "draft",
    title,
    fileType: fileType || "md",
  };
  await db.insert(PackageDocument).values(doc);

  // Auto-advance package status if all required docs are present
  const pkg = await getPackage(packageId);
  if (pkg && pkg.checklist.missing.length === 0 && pkg.requiredDocuments.length > 0) {
    await db.update(Package).set({ status: "review" }).where(eq(Package.id, packageId));
  }

  return doc;
}

export async function getNextVersion(packageId, docType) {
  const docs = await db
    .select()
    .from(PackageDocument)
    .where(and(eq(PackageDocument.packageId, packageId), eq(PackageDocument.docType, docType)));
  return docs.length + 1;
}

// ── Document queries ────────────────────────────────────────────

export async function listDocuments(packageId) {
  return db
    .select()
    .from(PackageDocument)
    .where(eq(PackageDocument.packageId, packageId))
    .orderBy(desc(PackageDocument.createdAt));
}

export async function getDocument(packageId, docType) {
  const docs = await db
    .select()
    .from(PackageDocument)
    .where(and(eq(PackageDocument.packageId, packageId), eq(PackageDocument.docType, docType)))
    .orderBy(desc(PackageDocument.version));
  return docs[0] || null;
}

export async function getDocumentHistory(packageId, docType) {
  return db
    .select()
    .from(PackageDocument)
    .where(and(eq(PackageDocument.packageId, packageId), eq(PackageDocument.docType, docType)))
    .orderBy(desc(PackageDocument.version));
}

export async function finalizeDocument(packageId, docType) {
  const doc = await getDocument(packageId, docType);
  if (!doc) return null;
  if (doc.status === "final") return doc;
  await db.update(PackageDocument).set({ status: "final" }).where(eq(PackageDocument.id, doc.id));
  return { ...doc, status: "final" };
}

// ── Checklist ──────────────────────────────────────────────────────

function buildChecklist(requiredDocuments, documents) {
  const required = requiredDocuments || [];
  const completedTypes = new Set(documents.map((d) => d.docType));
  const completed = required.filter((d) => completedTypes.has(d));
  const missing = required.filter((d) => !completedTypes.has(d));
  const pct = required.length > 0 ? Math.round((completed.length / required.length) * 100) : 100;
  return {
    required: required.map((d) => ({ docType: d, label: DOC_LABELS[d] || d })),
    completed: completed.map((d) => ({ docType: d, label: DOC_LABELS[d] || d })),
    missing: missing.map((d) => ({ docType: d, label: DOC_LABELS[d] || d })),
    pct,
  };
}

export async function getPackageChecklist(id) {
  const pkg = await getPackage(id);
  if (!pkg) return null;
  return pkg.checklist;
}
