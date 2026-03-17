/**
 * End-to-end test for the Acquisition Package workflow.
 * Run: node tmp-e2e-test.mjs
 */

import { writeFileSync } from "fs";

const API_KEY = "test-integration-api-key";
const BASE = "http://localhost:8080/api/v1";
const h = { "Content-Type": "application/json", "X-API-Key": API_KEY };

const report = {
  testSuite: "Acquisition Package End-to-End",
  timestamp: new Date().toISOString(),
  environment: { node: process.version, platform: process.platform },
  tests: [],
  summary: { total: 0, passed: 0, failed: 0 },
};

function test(name, passed, details) {
  report.tests.push({ id: report.tests.length + 1, name, passed, ...details });
  report.summary.total++;
  if (passed) report.summary.passed++;
  else report.summary.failed++;
  console.log(passed ? "  PASS" : "  FAIL", `#${report.tests.length}`, name);
}

async function run() {
  console.log("=== Acquisition Package E2E Test Suite ===\n");

  // 1. Health
  const status = await fetch(BASE + "/status").then((r) => r.json());
  test("Health check", status.database?.health === "ok", { result: status });

  // 2. Create package ($750K negotiated → full_competition)
  const pkg = await fetch(BASE + "/packages", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      title: "Cloud Hosting Services - NCI Research Platform",
      estimatedValue: 750000,
      requirementDescription: "Enterprise cloud hosting, 3-year base + 2 option years",
      acquisitionMethod: "negotiated",
      contractType: "ffp",
      flags: { is_it: true, is_services: true },
    }),
  }).then((r) => r.json());
  test(
    "Create package ($750K negotiated)",
    !!pkg.id && pkg.pathway === "full_competition" && pkg.requiredDocuments.length === 4,
    { packageId: pkg.id, pathway: pkg.pathway, requiredDocuments: pkg.requiredDocuments, checklist: pkg.checklist }
  );

  // 3–6. Generate all 4 required documents
  const docSpecs = [
    {
      type: "sow",
      title: "Cloud Hosting Services SOW",
      data: {
        TITLE: "Cloud Hosting Services",
        REQUIREMENT_DESCRIPTION: "enterprise cloud hosting infrastructure",
        BACKGROUND_CONTEXT: "NCI requires scalable cloud infrastructure",
        PURPOSE_STATEMENT: "obtain cloud hosting services",
        SCOPE_DESCRIPTION: "provide cloud hosting and support",
        BASE_PERIOD: "36 months",
        TASK_1_TITLE: "Cloud Setup",
        TASK_1_OBJECTIVE: "Establish environment",
        TASK_1_REQUIREMENTS: "Configure VPC, IAM",
        TASK_1_ACCEPTANCE: "Passes security scan",
        DELIVERABLE_1: "Architecture Doc",
        DUE_DATE_1: "30 days",
        FORMAT_1: "PDF",
      },
    },
    { type: "igce", title: "Cloud Hosting IGCE", data: { TITLE: "Cloud Hosting IGCE" } },
    { type: "market_research", title: "Cloud Hosting Market Research", data: { TITLE: "Market Research Report", NAICS_CODE: "518210" } },
    { type: "acquisition_plan", title: "Cloud Hosting Acquisition Plan", data: { TITLE: "Acquisition Plan", ESTIMATED_VALUE: "750000" } },
  ];
  const expectedPct = [25, 50, 75, 100];

  for (let i = 0; i < docSpecs.length; i++) {
    const d = docSpecs[i];
    const res = await fetch(BASE + "/documents/generate", {
      method: "POST",
      headers: h,
      body: JSON.stringify({ package_id: pkg.id, doc_type: d.type, title: d.title, data: d.data }),
    }).then((r) => r.json());
    test(
      `Generate ${d.type.toUpperCase()}`,
      !!res.documentId && res.version === 1 && res.checklist?.pct === expectedPct[i],
      {
        documentId: res.documentId,
        docType: res.docType,
        version: res.version,
        s3Key: res.s3Key,
        contentHash: res.contentHash,
        hasDownloadUrl: !!res.downloadUrl,
        checklistPct: res.checklist?.pct,
        previewLength: res.preview?.length,
      }
    );
  }

  // 7. Package status auto-advanced to "review"
  const pkgStatus = await fetch(BASE + "/packages/" + pkg.id, { headers: h }).then((r) => r.json());
  test(
    "Package status auto-advanced to review",
    pkgStatus.status === "review" && pkgStatus.documents.length === 4,
    {
      status: pkgStatus.status,
      documentCount: pkgStatus.documents.length,
      documents: pkgStatus.documents.map((d) => ({ docType: d.docType, title: d.title, version: d.version, status: d.status })),
      checklist: pkgStatus.checklist,
    }
  );

  // 8. Checklist endpoint
  const cl = await fetch(BASE + "/packages/" + pkg.id + "/checklist", { headers: h }).then((r) => r.json());
  test("Checklist shows 100% complete", cl.pct === 100 && cl.missing.length === 0, { checklist: cl });

  // 9. List packages
  const list = await fetch(BASE + "/packages", { headers: h }).then((r) => r.json());
  test("List packages returns results", list.length >= 1, {
    count: list.length,
    packages: list.map((p) => ({ id: p.id, title: p.title, status: p.status })),
  });

  // 10. ZIP export
  const zipRes = await fetch(BASE + "/packages/" + pkg.id + "/export", { headers: h });
  const zipBuf = await zipRes.arrayBuffer();
  test("Export package as ZIP", zipRes.status === 200 && zipBuf.byteLength > 1000, {
    httpStatus: zipRes.status,
    zipSizeBytes: zipBuf.byteLength,
    contentType: zipRes.headers.get("content-type"),
  });

  // 11–13. Pathway routing edge cases
  const micro = await fetch(BASE + "/packages", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ title: "Office Supplies", estimatedValue: 5000 }),
  }).then((r) => r.json());
  test("Pathway: micro_purchase (<$15K)", micro.pathway === "micro_purchase" && micro.requiredDocuments.length === 1, {
    pathway: micro.pathway,
    requiredDocuments: micro.requiredDocuments,
  });

  const simplified = await fetch(BASE + "/packages", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ title: "Lab Equipment", estimatedValue: 200000 }),
  }).then((r) => r.json());
  test("Pathway: simplified ($15K–$350K)", simplified.pathway === "simplified" && simplified.requiredDocuments.length === 3, {
    pathway: simplified.pathway,
    requiredDocuments: simplified.requiredDocuments,
  });

  const sole = await fetch(BASE + "/packages", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ title: "Illumina Sequencer", estimatedValue: 500000, acquisitionMethod: "sole" }),
  }).then((r) => r.json());
  test("Pathway: sole_source (includes J&A)", sole.pathway === "sole_source" && sole.requiredDocuments.includes("justification"), {
    pathway: sole.pathway,
    requiredDocuments: sole.requiredDocuments,
  });

  // 14. Versioning
  const v2 = await fetch(BASE + "/documents/generate", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ package_id: pkg.id, doc_type: "sow", title: "Cloud Hosting SOW v2", data: { TITLE: "Updated SOW" } }),
  }).then((r) => r.json());
  test("Document versioning (v2)", v2.version === 2 && v2.s3Key.includes("/v2/"), {
    version: v2.version,
    s3Key: v2.s3Key,
  });

  // 15. Presigned URL
  const dlUrl = await fetch(BASE + "/documents/download-url?bucket=rh-eagle-files&key=" + encodeURIComponent(v2.s3Key), { headers: h }).then((r) => r.json());
  test("Presigned download URL", !!dlUrl.url && dlUrl.expiresIn === 900, {
    hasUrl: !!dlUrl.url,
    expiresIn: dlUrl.expiresIn,
  });

  // 16–18. Error handling
  const err1 = await fetch(BASE + "/documents/generate", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ doc_type: "invalid", title: "X", data: {} }),
  }).then((r) => r.json());
  test("Error: invalid doc type", !!err1.error && err1.error.includes("Unknown"), { error: err1.error });

  const err2 = await fetch(BASE + "/documents/generate", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ doc_type: "sow" }),
  }).then((r) => r.json());
  test("Error: missing required fields", !!err2.error, { error: err2.error });

  const err3Res = await fetch(BASE + "/packages/pkg-nonexistent", { headers: h });
  const err3 = await err3Res.json();
  test("Error: package not found (404)", err3Res.status === 404 && !!err3.error, {
    httpStatus: err3Res.status,
    error: err3.error,
  });

  // 19. Direct save
  const saved = await fetch(BASE + "/documents/save", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      bucket: "rh-eagle-files",
      key: "eagle/demo/test/direct-save-test.md",
      content: "# Test\n\nDirect save works.",
      contentType: "text/markdown",
    }),
  }).then((r) => r.json());
  test("Direct document save to S3", !!saved.contentHash && !!saved.url, {
    key: saved.key,
    contentHash: saved.contentHash,
    hasUrl: !!saved.url,
  });

  // ── Package Document Lifecycle (new routes) ──────────────────

  // 20. POST /packages/:id/documents — canonical package document route
  const pkgDoc = await fetch(BASE + "/packages/" + pkg.id + "/documents", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      doc_type: "sow",
      title: "Cloud Hosting SOW v3 (via package route)",
      data: { TITLE: "SOW v3 Package Route" },
    }),
  }).then((r) => r.json());
  test(
    "POST /packages/:id/documents creates document",
    !!pkgDoc.documentId && pkgDoc.version === 3 && pkgDoc.docType === "sow" && !!pkgDoc.downloadUrl,
    {
      documentId: pkgDoc.documentId,
      version: pkgDoc.version,
      docType: pkgDoc.docType,
      hasDownloadUrl: !!pkgDoc.downloadUrl,
      checklistPct: pkgDoc.checklist?.pct,
    }
  );

  // 21. POST /packages/:id/documents — accepts both doc_type and docType
  const pkgDocAlt = await fetch(BASE + "/packages/" + pkg.id + "/documents", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      docType: "igce",
      title: "IGCE v2 (docType key)",
      data: { TITLE: "IGCE v2" },
    }),
  }).then((r) => r.json());
  test(
    "POST /packages/:id/documents accepts docType key",
    !!pkgDocAlt.documentId && pkgDocAlt.docType === "igce",
    { documentId: pkgDocAlt.documentId, docType: pkgDocAlt.docType }
  );

  // 22. POST /packages/:id/documents — 404 for nonexistent package
  const pkgDocErr = await fetch(BASE + "/packages/pkg-nonexistent/documents", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ doc_type: "sow", title: "X", data: { TITLE: "X" } }),
  });
  test(
    "POST /packages/:id/documents 404 for missing package",
    pkgDocErr.status === 404,
    { httpStatus: pkgDocErr.status }
  );

  // 23. POST /packages/:id/documents — 400 for missing fields
  const pkgDocErr2 = await fetch(BASE + "/packages/" + pkg.id + "/documents", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ doc_type: "sow" }),
  });
  test(
    "POST /packages/:id/documents 400 for missing fields",
    pkgDocErr2.status === 400,
    { httpStatus: pkgDocErr2.status }
  );

  // 24. GET /packages/:id/documents — list all documents with download URLs
  const pkgDocs = await fetch(BASE + "/packages/" + pkg.id + "/documents", { headers: h }).then((r) => r.json());
  const allHaveUrls = pkgDocs.every((d) => !!d.downloadUrl);
  test(
    "GET /packages/:id/documents lists docs with download URLs",
    Array.isArray(pkgDocs) && pkgDocs.length >= 6 && allHaveUrls,
    {
      count: pkgDocs.length,
      allHaveUrls,
      docTypes: pkgDocs.map((d) => `${d.docType}@v${d.version}`),
    }
  );

  // 25. GET /packages/:id/documents/:docType — get latest version
  const latestSow = await fetch(BASE + "/packages/" + pkg.id + "/documents/sow", { headers: h }).then((r) => r.json());
  test(
    "GET /packages/:id/documents/:docType returns latest version",
    latestSow.docType === "sow" && latestSow.version === 3 && !!latestSow.downloadUrl,
    {
      docType: latestSow.docType,
      version: latestSow.version,
      hasDownloadUrl: !!latestSow.downloadUrl,
    }
  );

  // 26. GET /packages/:id/documents/:docType — 404 for missing doc type
  const missingDoc = await fetch(BASE + "/packages/" + pkg.id + "/documents/justification", { headers: h });
  test(
    "GET /packages/:id/documents/:docType 404 for missing doc",
    missingDoc.status === 404,
    { httpStatus: missingDoc.status }
  );

  // 27. GET /packages/:id/documents/:docType/history — version history
  const sowHistory = await fetch(BASE + "/packages/" + pkg.id + "/documents/sow/history", { headers: h }).then((r) => r.json());
  test(
    "GET /packages/:id/documents/:docType/history returns all versions",
    Array.isArray(sowHistory) && sowHistory.length === 3 && sowHistory[0].version === 3 && sowHistory[2].version === 1,
    {
      count: sowHistory.length,
      versions: sowHistory.map((d) => d.version),
      allHaveUrls: sowHistory.every((d) => !!d.downloadUrl),
    }
  );

  // ── Document Download Validation ─────────────────────────────

  // 28. Download document content via presigned URL
  const downloadRes = await fetch(latestSow.downloadUrl);
  const downloadContent = await downloadRes.text();
  test(
    "Download document via presigned URL returns content",
    downloadRes.ok && downloadContent.length > 100 && downloadContent.includes("SOW"),
    {
      httpStatus: downloadRes.status,
      contentLength: downloadContent.length,
      containsExpectedText: downloadContent.includes("SOW"),
      firstLine: downloadContent.split("\n")[0],
    }
  );

  // 29. Download from version history URL also works
  const v1Url = sowHistory[2]?.downloadUrl; // v1
  if (v1Url) {
    const v1Res = await fetch(v1Url);
    const v1Content = await v1Res.text();
    test(
      "Download v1 from history presigned URL works",
      v1Res.ok && v1Content.length > 100,
      { httpStatus: v1Res.status, contentLength: v1Content.length }
    );
  } else {
    test("Download v1 from history presigned URL works", false, { reason: "No v1 URL" });
  }

  // ── Document Finalization ────────────────────────────────────

  // 30. Finalize a document
  const finalized = await fetch(BASE + "/packages/" + pkg.id + "/documents/sow/finalize", {
    method: "POST",
    headers: h,
  }).then((r) => r.json());
  test(
    "POST /packages/:id/documents/:docType/finalize locks document",
    finalized.status === "final" && finalized.docType === "sow",
    { docType: finalized.docType, status: finalized.status, version: finalized.version }
  );

  // 31. Finalize idempotent (already final)
  const finalized2 = await fetch(BASE + "/packages/" + pkg.id + "/documents/sow/finalize", {
    method: "POST",
    headers: h,
  }).then((r) => r.json());
  test(
    "Finalize is idempotent (re-finalize returns same)",
    finalized2.status === "final" && finalized2.docType === "sow",
    { status: finalized2.status }
  );

  // 32. Finalize 404 for missing doc type
  const finErr = await fetch(BASE + "/packages/" + pkg.id + "/documents/justification/finalize", {
    method: "POST",
    headers: h,
  });
  test(
    "Finalize 404 for missing document type",
    finErr.status === 404,
    { httpStatus: finErr.status }
  );

  // ── Package Workflow (Submit / Approve) ──────────────────────

  // 33. Create a fresh package for submit/approve tests
  const wfPkg = await fetch(BASE + "/packages", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      title: "Workflow Test Package",
      estimatedValue: 10000,
      requirementDescription: "Test submit/approve workflow",
    }),
  }).then((r) => r.json());
  test(
    "Create workflow test package (micro_purchase)",
    wfPkg.pathway === "micro_purchase" && wfPkg.requiredDocuments.length === 1,
    { packageId: wfPkg.id, pathway: wfPkg.pathway, requiredDocuments: wfPkg.requiredDocuments }
  );

  // 34. Generate required market_research doc then submit
  await fetch(BASE + "/packages/" + wfPkg.id + "/documents", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ doc_type: "market_research", title: "WF Market Research", data: { TITLE: "WF MR" } }),
  });
  const wfSubmit = await fetch(BASE + "/packages/" + wfPkg.id + "/submit", {
    method: "POST",
    headers: h,
  }).then((r) => r.json());
  test(
    "Submit package sets status to review",
    wfSubmit.status === "review",
    { status: wfSubmit.status, checklist: wfSubmit.checklist }
  );

  // 35. Approve package sets status to complete
  const wfApprove = await fetch(BASE + "/packages/" + wfPkg.id + "/approve", {
    method: "POST",
    headers: h,
  }).then((r) => r.json());
  test(
    "Approve package sets status to complete",
    wfApprove.status === "complete",
    { status: wfApprove.status }
  );

  // 36. Submit fails when required docs missing
  const incompletePkg = await fetch(BASE + "/packages", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      title: "Incomplete Package",
      estimatedValue: 200000,
      requirementDescription: "Missing docs test",
    }),
  }).then((r) => r.json());
  const submitFail = await fetch(BASE + "/packages/" + incompletePkg.id + "/submit", {
    method: "POST",
    headers: h,
  });
  const submitFailBody = await submitFail.json();
  test(
    "Submit fails with 400 when required docs missing",
    submitFail.status === 400 && Array.isArray(submitFailBody.missing) && submitFailBody.missing.length > 0,
    {
      httpStatus: submitFail.status,
      error: submitFailBody.error,
      missingCount: submitFailBody.missing?.length,
    }
  );

  // 37. Submit/approve 404 for nonexistent package
  const submit404 = await fetch(BASE + "/packages/pkg-nonexistent/submit", { method: "POST", headers: h });
  const approve404 = await fetch(BASE + "/packages/pkg-nonexistent/approve", { method: "POST", headers: h });
  test(
    "Submit/approve 404 for missing package",
    submit404.status === 404 && approve404.status === 404,
    { submitStatus: submit404.status, approveStatus: approve404.status }
  );

  // ── Skill Endpoint Content Negotiation ───────────────────────

  // 38. Skill endpoint returns markdown by default
  const skillText = await fetch(BASE + "/skill/oa-intake", {
    headers: { ...h, Accept: "text/markdown" },
  });
  test(
    "Skill endpoint returns markdown for text/markdown accept",
    skillText.ok && skillText.headers.get("content-type")?.includes("text/markdown"),
    {
      httpStatus: skillText.status,
      contentType: skillText.headers.get("content-type"),
      bodyLength: (await skillText.text()).length,
    }
  );

  // 39. Skill endpoint returns JSON when Accept: application/json
  const skillJson = await fetch(BASE + "/skill/oa-intake", {
    headers: { ...h, Accept: "application/json" },
  });
  const skillData = await skillJson.json();
  test(
    "Skill endpoint returns JSON for application/json accept",
    skillJson.ok && skillData.skill === "oa-intake" && skillData.status === "loaded" && !!skillData.instructions,
    {
      skill: skillData.skill,
      status: skillData.status,
      instructionsLength: skillData.instructions?.length,
    }
  );

  // 40. Skill 404 for nonexistent skill
  const skillErr = await fetch(BASE + "/skill/nonexistent-skill", { headers: h });
  test(
    "Skill 404 for nonexistent skill",
    skillErr.status === 404,
    { httpStatus: skillErr.status }
  );

  // ── Full Lifecycle Integration ───────────────────────────────

  // 41. Complete lifecycle: create → generate docs → finalize all → submit → approve
  const lcPkg = await fetch(BASE + "/packages", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      title: "Lifecycle Test - Lab Supplies",
      estimatedValue: 100000,
      acquisitionMethod: "negotiated",
      contractType: "ffp",
    }),
  }).then((r) => r.json());

  // Generate all 3 required docs for simplified pathway
  for (const dt of lcPkg.requiredDocuments) {
    await fetch(BASE + "/packages/" + lcPkg.id + "/documents", {
      method: "POST",
      headers: h,
      body: JSON.stringify({ doc_type: dt, title: `LC ${dt}`, data: { TITLE: `LC ${dt}` } }),
    });
  }

  // Finalize all docs
  for (const dt of lcPkg.requiredDocuments) {
    await fetch(BASE + "/packages/" + lcPkg.id + "/documents/" + dt + "/finalize", {
      method: "POST",
      headers: h,
    });
  }

  // Verify all finalized
  const lcDocs = await fetch(BASE + "/packages/" + lcPkg.id + "/documents", { headers: h }).then((r) => r.json());
  const allFinalized = lcDocs.every((d) => d.status === "final");

  // Package auto-advanced to review (all docs present)
  const lcPkgFinal = await fetch(BASE + "/packages/" + lcPkg.id, { headers: h }).then((r) => r.json());

  // Approve
  const lcApproved = await fetch(BASE + "/packages/" + lcPkg.id + "/approve", {
    method: "POST",
    headers: h,
  }).then((r) => r.json());

  test(
    "Full lifecycle: create → docs → finalize → approve",
    lcPkg.pathway === "simplified" &&
      lcDocs.length === 3 &&
      allFinalized &&
      lcPkgFinal.checklist.pct === 100 &&
      lcApproved.status === "complete",
    {
      pathway: lcPkg.pathway,
      docCount: lcDocs.length,
      allFinalized,
      checklistPct: lcPkgFinal.checklist.pct,
      finalStatus: lcApproved.status,
    }
  );

  // ── PDF + DOCX Generation Tests ─────────────────────────────

  // 42. Generate response has PDF downloadUrl (.pdf presigned URL)
  // Use the first doc generation result from the full_competition package
  const pdfTestDoc = await fetch(BASE + "/documents/generate", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      package_id: pkg.id,
      doc_type: "sow",
      title: "PDF DOCX Test SOW",
      data: { TITLE: "PDF DOCX Test SOW" },
    }),
  }).then((r) => r.json());
  test(
    "Generate response has PDF downloadUrl",
    !!pdfTestDoc.downloadUrl && pdfTestDoc.downloadUrl.includes(".pdf"),
    {
      hasDownloadUrl: !!pdfTestDoc.downloadUrl,
      urlContainsPdf: pdfTestDoc.downloadUrl?.includes(".pdf"),
      hasMarkdownUrl: !!pdfTestDoc.markdownUrl,
      hasDocxUrl: !!pdfTestDoc.docxUrl,
    }
  );

  // 43. Download PDF → verify %PDF- magic bytes, size > 5KB
  if (pdfTestDoc.downloadUrl) {
    const pdfRes = await fetch(pdfTestDoc.downloadUrl);
    const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
    const pdfMagic = pdfBuf.slice(0, 5).toString("ascii");
    test(
      "Download PDF has valid magic bytes and size",
      pdfRes.ok && pdfMagic === "%PDF-" && pdfBuf.length > 5000,
      {
        httpStatus: pdfRes.status,
        magic: pdfMagic,
        sizeBytes: pdfBuf.length,
      }
    );
  } else {
    test("Download PDF has valid magic bytes and size", false, { reason: "No PDF URL" });
  }

  // 44. Download DOCX → verify PK magic bytes (ZIP format), size > 5KB
  if (pdfTestDoc.docxUrl) {
    const docxRes = await fetch(pdfTestDoc.docxUrl);
    const docxBuf = Buffer.from(await docxRes.arrayBuffer());
    const docxMagic = docxBuf.slice(0, 2).toString("ascii");
    test(
      "Download DOCX has valid magic bytes and size",
      docxRes.ok && docxMagic === "PK" && docxBuf.length > 5000,
      {
        httpStatus: docxRes.status,
        magic: docxMagic,
        sizeBytes: docxBuf.length,
      }
    );
  } else {
    test("Download DOCX has valid magic bytes and size", false, { reason: "No DOCX URL" });
  }

  // 45. Markdown URL still accessible → starts with #
  if (pdfTestDoc.markdownUrl) {
    const mdRes = await fetch(pdfTestDoc.markdownUrl);
    const mdContent = await mdRes.text();
    test(
      "Markdown URL still accessible and valid",
      mdRes.ok && mdContent.startsWith("#") && mdContent.length > 100,
      {
        httpStatus: mdRes.status,
        contentLength: mdContent.length,
        startsWithHash: mdContent.startsWith("#"),
      }
    );
  } else {
    test("Markdown URL still accessible and valid", false, { reason: "No markdown URL" });
  }

  // 46. ZIP export contains 3 formats per document
  const zipRes2 = await fetch(BASE + "/packages/" + pkg.id + "/export", { headers: h });
  const zipBuf2 = await zipRes2.arrayBuffer();
  test(
    "ZIP export size increased (multi-format)",
    zipRes2.status === 200 && zipBuf2.byteLength > zipBuf.byteLength,
    {
      httpStatus: zipRes2.status,
      newZipSize: zipBuf2.byteLength,
      originalZipSize: zipBuf.byteLength,
      sizeIncrease: zipBuf2.byteLength - zipBuf.byteLength,
    }
  );

  // --- Done ---
  console.log("\n=== Summary ===");
  console.log(`Total: ${report.summary.total}  Passed: ${report.summary.passed}  Failed: ${report.summary.failed}`);

  const outPath = "test-acq-package-report.json";
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to: ${outPath}`);

  process.exit(report.summary.failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
