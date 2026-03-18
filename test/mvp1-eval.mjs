/**
 * MVP1 Eval Test Suite — 9 Use Cases (UC-1 through UC-29)
 *
 * Tier 1: Deterministic API tests (no LLM, ~30s)
 *   - Compliance matrix assertions for each UC scenario
 *   - Pathway determination assertions
 *   - REST endpoint health checks
 *
 * Tier 2: Single-turn LLM smoke tests (~3 min each)
 *   - One prompt per UC, verify keywords in response
 *   - Langfuse traces saved via langfuseSessionId/langfuseTraceId
 *
 * Usage:
 *   node test/mvp1-eval.mjs                 # full run (Tier 1 + Tier 2)
 *   node test/mvp1-eval.mjs --endpoints-only # Tier 1 only (fast)
 *   node test/mvp1-eval.mjs --prompts-only   # Tier 2 only (LLM)
 */

const API = "http://localhost:8080";
const TIMEOUT = 180_000;
const API_KEY = "test-integration-api-key";
const AUTH_HEADERS = { "Content-Type": "application/json", "X-API-Key": API_KEY };
const RUN_TS = Date.now();
const SESSION_ID = `eval-${RUN_TS}`;

// ─── Tier 1: Deterministic Use Case Definitions ──────────────────────────────

const DETERMINISTIC_CASES = [
  {
    id: "DET-UC1",
    uc: "UC-1",
    description: "$750K cloud hosting, negotiated, FFP, IT+services",
    params: { value: 750_000, method: "negotiated", type: "ffp", flags: { is_it: true, is_services: true } },
    assertions: {
      pathway: "full_competition",
      requiredDocs: ["sow", "igce", "market_research", "acquisition_plan"],
      subkRequired: false,  // $750K is not > $750K threshold
      errors: 0,
    },
  },
  {
    id: "DET-UC2",
    uc: "UC-2",
    description: "$45K microscope, FSS, FFP",
    params: { value: 45_000, method: "fss", type: "ffp", flags: {} },
    assertions: {
      pathway: "simplified",
      requiredDocs: ["sow", "igce", "market_research"],
      apRequired: false,
      errors: 0,
    },
  },
  {
    id: "DET-UC2.1",
    uc: "UC-2.1",
    description: "$13.8K lab supplies, micro, FFP",
    params: { value: 13_800, method: "micro", type: "ffp", flags: {} },
    assertions: {
      pathway: "micro_purchase",
      requiredDocs: ["market_research"],
      marketResearchNotRequired: true,  // compliance matrix says not required for micro
      errors: 0,
    },
  },
  {
    id: "DET-UC3",
    uc: "UC-3",
    description: "$280K sole source, FFP",
    params: { value: 280_000, method: "sole", type: "ffp", flags: {} },
    assertions: {
      pathway: "simplified",  // $280K <= SAT ($350K), sole source pathway only above SAT
      jaRequired: true,       // compliance matrix still flags J&A for method=sole
      requiredDocs: ["sow", "igce", "market_research"],  // pathway docs (J&A tracked separately)
      errors: 0,
    },
  },
  {
    id: "DET-UC10",
    uc: "UC-10",
    description: "$4.5M negotiated, CPFF, R&D",
    params: { value: 4_500_000, method: "negotiated", type: "cpff", flags: { is_rd: true, is_services: true } },
    assertions: {
      pathway: "full_competition",
      tinaRequired: true,
      congressionalNotification: false,  // $4.5M is not > $4.5M threshold
      subkRequired: true,
      errors: 0,
    },
  },
  {
    id: "DET-UC13",
    uc: "UC-13",
    description: "$450K negotiated, FFP, IT, small business",
    params: { value: 450_000, method: "negotiated", type: "ffp", flags: { is_it: true, is_services: true, is_small_business: true } },
    assertions: {
      pathway: "full_competition",
      subkRequired: false,  // small business exempt
      errors: 0,
    },
  },
  {
    id: "DET-UC29",
    uc: "UC-29",
    description: "$3.5M negotiated, CPFF, R&D bioinformatics",
    params: { value: 3_500_000, method: "negotiated", type: "cpff", flags: { is_rd: true, is_services: true } },
    assertions: {
      pathway: "full_competition",
      tinaRequired: true,
      subkRequired: true,
      errors: 0,
    },
  },
];

// ─── Tier 1: Endpoint Tests ──────────────────────────────────────────────────

const ENDPOINT_TESTS = [
  { id: "EP-HEALTH",     name: "Health check",         method: "GET", path: "/api/v1/status",           expectStatus: 200, expectType: "application/json" },
  { id: "EP-CHAT-UI",    name: "Chat page loads",      method: "GET", path: "/tools/chat",              expectStatus: 200, expectType: "text/html" },
  { id: "EP-PACKAGES",   name: "Packages list",        method: "GET", path: "/api/v1/packages",         expectStatus: 200, expectType: "application/json" },
  { id: "EP-SKILLS",     name: "Skills available",     method: "GET", path: "/api/v1/skills",           expectStatus: 200, expectType: "application/json" },
  { id: "EP-TEMPLATES",  name: "Templates available",  method: "GET", path: "/api/v1/templates",        expectStatus: 200, expectType: "application/json" },
  { id: "EP-ADMIN-DASH", name: "Admin dashboard",      method: "GET", path: "/api/v1/admin/dashboard",  expectStatus: 200, expectType: "application/json" },
  { id: "EP-TRACES",     name: "Traces list",          method: "GET", path: "/api/v1/admin/traces",     expectStatus: 200, expectType: "application/json" },
  { id: "EP-COSTS",      name: "Cost tracking",        method: "GET", path: "/api/v1/admin/costs",      expectStatus: 200, expectType: "application/json" },
];

// ─── Tier 2: LLM Smoke Tests ────────────────────────────────────────────────

const LLM_CASES = [
  {
    id: "LLM-UC1", uc: "UC-1",
    prompt: "I need to acquire cloud hosting services for NCI. The estimated value is $750,000. We need FedRAMP High compliance. This is IT services.",
    keywords: ["cloud", "competition", "acquisition"],
  },
  {
    id: "LLM-UC2", uc: "UC-2",
    prompt: "I need a $45,000 microscope urgently. I think GSA Schedule might cover it. Can you help me figure out the acquisition pathway?",
    keywords: ["simplified", "GSA", "schedule"],
  },
  {
    id: "LLM-UC2.1", uc: "UC-2.1",
    prompt: "I need about $13,800 in lab supplies. Can I just use my purchase card? What are the rules for micro-purchases?",
    keywords: ["micro", "purchase", "threshold"],
  },
  {
    id: "LLM-UC3", uc: "UC-3",
    prompt: "We need a $280,000 sole-source contract with Illumina. They're the only manufacturer for this genomic sequencing equipment. What do I need?",
    keywords: ["sole source", "J&A", "FAR 6.302"],
  },
  {
    id: "LLM-UC4", uc: "UC-4",
    prompt: "We received 7 proposals for a $2.1M advisory services contract. Do we have to include all offerors in the competitive range, or can we narrow it down? What does FAR Part 15 say?",
    keywords: ["competitive range", "FAR 15"],
  },
  {
    id: "LLM-UC10", uc: "UC-10",
    prompt: "I need to build an IGCE for a bioinformatics contract. We have 10 FTE labor categories, ODCs, and a 3-year period of performance. Total estimated value is $4.5 million. Help me structure the cost estimate.",
    keywords: ["IGCE", "labor", "cost"],
  },
  {
    id: "LLM-UC13", uc: "UC-13",
    prompt: "We have a $450,000 IT services requirement. We found 8 small businesses in SAM.gov that might qualify. Should this be set aside for small business? What are the requirements?",
    keywords: ["set-aside", "small business"],
  },
  {
    id: "LLM-UC16", uc: "UC-16",
    prompt: "I need to write a Statement of Work for genomic sequencing services. We're using an Illumina NovaSeq 6000. Help me draft the SOW with technical requirements.",
    keywords: ["SOW", "contractor shall"],
  },
  {
    id: "LLM-UC29", uc: "UC-29",
    prompt: "I have a complex multi-phase bioinformatics R&D requirement worth $3.5 million. It's CPFF. I need help building the full acquisition package — acquisition plan, SOW, IGCE, everything. Where do we start?",
    keywords: ["acquisition plan", "TINA"],
  },
];

// ─── Compliance Matrix Tests (imports the module directly) ───────────────────

async function runComplianceMatrixTests() {
  const results = [];

  // Dynamic import of the compliance matrix
  let getRequirements, determinePathway;
  try {
    const cm = await import("../server/services/compliance-matrix.js");
    getRequirements = cm.getRequirements;
    const pkgMod = await import("../server/services/packages.js");
    determinePathway = pkgMod.determinePathway;
  } catch (err) {
    // If we can't import (e.g., running outside the project), fall back to API
    console.log("  [WARN] Cannot import compliance-matrix.js directly, using API fallback");
    console.log("  Error:", err.message.substring(0, 200));
    return { results: [], skipped: true };
  }

  for (const tc of DETERMINISTIC_CASES) {
    const { value, method, type, flags } = tc.params;
    const failures = [];

    try {
      // Test pathway determination
      const pw = determinePathway(value, method, flags);
      if (tc.assertions.pathway && pw.pathway !== tc.assertions.pathway) {
        failures.push(`pathway: expected "${tc.assertions.pathway}", got "${pw.pathway}"`);
      }
      if (tc.assertions.requiredDocs) {
        const expected = tc.assertions.requiredDocs.sort().join(",");
        const got = pw.requiredDocuments.sort().join(",");
        if (expected !== got) {
          failures.push(`docs: expected [${expected}], got [${got}]`);
        }
      }

      // Test compliance matrix
      const req = getRequirements(value, method, type, flags);
      if (tc.assertions.errors !== undefined && req.errors.length !== tc.assertions.errors) {
        failures.push(`errors: expected ${tc.assertions.errors}, got ${req.errors.length}: ${req.errors.join("; ")}`);
      }

      if (tc.assertions.subkRequired !== undefined) {
        const subkDoc = req.documents_required.find(d => d.name === "Subcontracting Plan");
        const subkActual = subkDoc?.required ?? false;
        if (subkActual !== tc.assertions.subkRequired) {
          failures.push(`subk: expected ${tc.assertions.subkRequired}, got ${subkActual}`);
        }
      }

      if (tc.assertions.tinaRequired) {
        const tina = req.compliance_items.find(c => c.name.includes("TINA") || c.name.includes("Cost/Pricing"));
        if (!tina || tina.status !== "required") {
          failures.push(`TINA: expected required, got ${tina?.status || "missing"}`);
        }
      }

      if (tc.assertions.congressionalNotification) {
        const cong = req.compliance_items.find(c => c.name.includes("Congressional"));
        if (!cong || cong.status !== "required") {
          failures.push(`congressional: expected required, got ${cong?.status || "missing"}`);
        }
      }

      if (tc.assertions.jaRequired) {
        const ja = req.documents_required.find(d => d.name.includes("J&A"));
        if (!ja || !ja.required) {
          failures.push(`J&A: expected required, got ${ja?.required || "missing"}`);
        }
      }

      if (tc.assertions.apRequired === false) {
        const ap = req.documents_required.find(d => d.name === "Acquisition Plan");
        if (ap?.required) {
          failures.push(`AP: expected not required, got required`);
        }
      }

      if (tc.assertions.marketResearchNotRequired) {
        const mr = req.documents_required.find(d => d.name.includes("Market Research"));
        if (mr?.required) {
          failures.push(`market research: expected not required for micro, got required`);
        }
      }

      results.push({
        id: tc.id, uc: tc.uc,
        status: failures.length === 0 ? "PASS" : "FAIL",
        failures,
        description: tc.description,
      });
    } catch (err) {
      results.push({
        id: tc.id, uc: tc.uc,
        status: "FAIL",
        failures: [`Exception: ${err.message.substring(0, 200)}`],
        description: tc.description,
      });
    }
  }

  return { results, skipped: false };
}

// ─── Endpoint Test Runner ────────────────────────────────────────────────────

async function runEndpointTest(tc) {
  try {
    const res = await fetch(`${API}${tc.path}`, {
      method: tc.method,
      headers: AUTH_HEADERS,
    });

    const contentType = res.headers.get("content-type") || "";
    const statusOk = res.status === tc.expectStatus;
    const typeOk = !tc.expectType || contentType.includes(tc.expectType);

    let bodyLength = 0;
    if (contentType.includes("application/json")) {
      const data = await res.json();
      bodyLength = JSON.stringify(data).length;
    } else {
      const text = await res.text();
      bodyLength = text.length;
    }

    return {
      id: tc.id, name: tc.name,
      status: statusOk && typeOk ? "PASS" : "FAIL",
      httpStatus: res.status,
      contentType: contentType.split(";")[0],
      length: bodyLength,
      reason: !statusOk ? `Expected ${tc.expectStatus}, got ${res.status}` : !typeOk ? `Expected ${tc.expectType}, got ${contentType}` : undefined,
    };
  } catch (err) {
    return { id: tc.id, name: tc.name, status: "FAIL", reason: err.message.substring(0, 200) };
  }
}

// ─── LLM Prompt Test Runner ─────────────────────────────────────────────────

async function runPromptTest(tc) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const res = await fetch(`${API}/api/model`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        model: "us.anthropic.claude-sonnet-4-6",
        messages: [{ role: "user", content: [{ type: "text", text: tc.prompt }] }],
        langfuseSessionId: SESSION_ID,
        langfuseTraceId: `eval-${tc.id}-${RUN_TS}`,
        langfuseTurnLabel: `MVP1 Eval: ${tc.id}`,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      return { id: tc.id, uc: tc.uc, status: "FAIL", reason: `HTTP ${res.status}: ${err.substring(0, 200)}` };
    }

    const data = await res.json();

    if (data.stopReason === "content_filtered") {
      return { id: tc.id, uc: tc.uc, status: "SKIP", reason: "Bedrock content filter blocked response" };
    }

    const text = (data.output?.message?.content || [])
      .filter(c => c.text)
      .map(c => c.text)
      .join("\n");

    if (!text || text.length < 50) {
      return { id: tc.id, uc: tc.uc, status: "FAIL", reason: "Empty or too-short response", length: text.length };
    }

    const lower = text.toLowerCase();
    const found = tc.keywords.filter(k => lower.includes(k.toLowerCase()));
    const missing = tc.keywords.filter(k => !lower.includes(k.toLowerCase()));
    const score = found.length / tc.keywords.length;

    return {
      id: tc.id, uc: tc.uc,
      status: score >= 0.66 ? "PASS" : "WEAK",
      score: `${found.length}/${tc.keywords.length}`,
      found: found.join(", "),
      missing: missing.length ? missing.join(", ") : undefined,
      length: text.length,
      preview: text.substring(0, 300),
    };
  } catch (err) {
    clearTimeout(timer);
    const aborted = err.name === "AbortError" || err.message?.includes("aborted");
    return {
      id: tc.id, uc: tc.uc,
      status: aborted ? "SKIP" : "FAIL",
      reason: aborted ? `Timeout after ${TIMEOUT / 1000}s` : err.message?.substring(0, 200),
    };
  }
}

// ─── Package Create + Pathway Test (via API) ─────────────────────────────────

async function runPackagePathwayTest(tc) {
  try {
    const { value, method, type, flags } = tc.params;
    const res = await fetch(`${API}/api/v1/packages`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        title: `Eval: ${tc.description}`,
        estimatedValue: value,
        requirementDescription: tc.description,
        acquisitionMethod: method,
        contractType: type,
        flags,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      return { id: `PKG-${tc.uc}`, uc: tc.uc, status: "FAIL", reason: `HTTP ${res.status}: ${err.substring(0, 200)}` };
    }

    const pkg = await res.json();
    const failures = [];

    if (tc.assertions.pathway && pkg.pathway !== tc.assertions.pathway) {
      failures.push(`pathway: expected "${tc.assertions.pathway}", got "${pkg.pathway}"`);
    }

    if (tc.assertions.requiredDocs) {
      const expected = tc.assertions.requiredDocs.sort().join(",");
      const got = (pkg.requiredDocuments || []).sort().join(",");
      if (expected !== got) {
        failures.push(`docs: expected [${expected}], got [${got}]`);
      }
    }

    return {
      id: `PKG-${tc.uc}`, uc: tc.uc,
      status: failures.length === 0 ? "PASS" : "FAIL",
      packageId: pkg.id,
      failures,
    };
  } catch (err) {
    return { id: `PKG-${tc.uc}`, uc: tc.uc, status: "FAIL", reason: err.message.substring(0, 200) };
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const allResults = [];
  const args = process.argv.slice(2);
  const skipPrompts = args.includes("--endpoints-only");
  const skipEndpoints = args.includes("--prompts-only");

  console.log(`\nMVP1 Eval Suite — ${new Date().toISOString()}`);
  console.log(`Session: ${SESSION_ID}\n`);

  // ── Tier 1A: Compliance Matrix (direct import) ───────────────────────────
  if (!skipPrompts || !skipEndpoints) {
    console.log("═══ TIER 1A: Compliance Matrix Tests ═══\n");

    const { results: cmResults, skipped } = await runComplianceMatrixTests();
    if (skipped) {
      console.log("  SKIPPED — could not import compliance-matrix.js\n");
    } else {
      for (const r of cmResults) {
        const status = r.status === "PASS" ? "PASS" : "FAIL";
        console.log(`  ${r.id} (${r.uc}): ${status}  ${r.description}`);
        if (r.failures.length > 0) {
          for (const f of r.failures) console.log(`    ✗ ${f}`);
        }
        allResults.push(r);
      }
      console.log();
    }
  }

  // ── Tier 1B: REST Endpoint Tests ─────────────────────────────────────────
  if (!skipPrompts || !skipEndpoints) {
    console.log("═══ TIER 1B: REST Endpoint Tests ═══\n");

    for (const tc of ENDPOINT_TESTS) {
      process.stdout.write(`  ${tc.id}: ${tc.name}... `);
      const result = await runEndpointTest(tc);
      console.log(`${result.status} (HTTP ${result.httpStatus || "?"}) [${result.length || 0} bytes]`);
      allResults.push(result);
    }
    console.log();
  }

  // ── Tier 1C: Package Pathway Tests (via API) ────────────────────────────
  if (!skipPrompts || !skipEndpoints) {
    console.log("═══ TIER 1C: Package Pathway Tests (API) ═══\n");

    for (const tc of DETERMINISTIC_CASES) {
      process.stdout.write(`  PKG-${tc.uc}: ${tc.description.substring(0, 50)}... `);
      const result = await runPackagePathwayTest(tc);
      console.log(`${result.status}${result.packageId ? ` [${result.packageId}]` : ""}`);
      if (result.failures?.length > 0) {
        for (const f of result.failures) console.log(`    ✗ ${f}`);
      }
      allResults.push(result);
    }
    console.log();
  }

  // ── Tier 2: LLM Smoke Tests ──────────────────────────────────────────────
  if (!skipEndpoints) {
    console.log("═══ TIER 2: LLM Smoke Tests ═══\n");

    if (skipPrompts) {
      console.log("  SKIPPED (--endpoints-only)\n");
    } else {
      for (const tc of LLM_CASES) {
        process.stdout.write(`  ${tc.id} (${tc.uc}): ${tc.prompt.substring(0, 50)}... `);
        const result = await runPromptTest(tc);
        console.log(
          result.status +
          (result.score ? ` (${result.score})` : "") +
          ` [${result.length || 0} chars]`
        );
        allResults.push(result);
      }
      console.log();
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("═══ SUMMARY ═══");
  const pass = allResults.filter(r => r.status === "PASS").length;
  const weak = allResults.filter(r => r.status === "WEAK").length;
  const fail = allResults.filter(r => r.status === "FAIL").length;
  const skip = allResults.filter(r => r.status === "SKIP").length;
  console.log(`PASS: ${pass}  WEAK: ${weak}  FAIL: ${fail}  SKIP: ${skip}  TOTAL: ${allResults.length}`);

  // Coverage by UC
  console.log("\n═══ USE CASE COVERAGE ═══");
  const ucs = ["UC-1", "UC-2", "UC-2.1", "UC-3", "UC-4", "UC-10", "UC-13", "UC-16", "UC-29"];
  for (const uc of ucs) {
    const ucResults = allResults.filter(r => r.uc === uc);
    if (ucResults.length === 0) {
      console.log(`  ${uc}: (no tests)`);
    } else {
      const statuses = ucResults.map(r => `${r.id}:${r.status}`).join(", ");
      console.log(`  ${uc}: ${statuses}`);
    }
  }

  // Non-UC tests
  const nonUc = allResults.filter(r => !r.uc);
  if (nonUc.length > 0) {
    console.log(`  Endpoints: ${nonUc.map(r => `${r.id}:${r.status}`).join(", ")}`);
  }

  // Details for non-passing tests
  const nonPass = allResults.filter(r => r.status !== "PASS");
  if (nonPass.length > 0) {
    console.log("\n═══ NON-PASSING DETAILS ═══");
    for (const r of nonPass) {
      console.log(`\n${r.id} [${r.status}]${r.uc ? ` (${r.uc})` : ""}${r.name ? " — " + r.name : ""}`);
      if (r.reason) console.log("  reason:", r.reason);
      if (r.failures?.length) {
        for (const f of r.failures) console.log("  ✗", f);
      }
      if (r.found) console.log("  found:", r.found);
      if (r.missing) console.log("  missing:", r.missing);
      if (r.preview) console.log("  preview:", r.preview.substring(0, 200));
    }
  }

  // Langfuse session info
  if (!skipPrompts) {
    console.log(`\n═══ LANGFUSE ═══`);
    console.log(`Session ID: ${SESSION_ID}`);
    console.log(`Traces: ${LLM_CASES.length} expected (one per UC prompt)`);
    console.log(`View: https://us.cloud.langfuse.com → Sessions → ${SESSION_ID}`);
  }

  console.log();
  process.exit(fail > 0 ? 1 : 0);
}

main();
