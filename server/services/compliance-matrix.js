/**
 * NCI/NIH Contract Requirements Decision Tree — JS port of compliance_matrix.py.
 *
 * Deterministic compliance logic backed by JSON data files in eagle-plugin/data/:
 *   - thresholds.json, contract-vehicles.json, far-database.json
 *
 * All functions are read-only (no tenant state, no side effects).
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../eagle-plugin/data");

function loadJSON(filename) {
  return JSON.parse(readFileSync(resolve(DATA_DIR, filename), "utf-8"));
}

const THRESHOLDS_DATA = loadJSON("thresholds.json");
const VEHICLES_DATA = loadJSON("contract-vehicles.json");
const FAR_DATABASE = loadJSON("far-database.json");

const METHODS = [
  { id: "micro", label: "Micro-Purchase", sub: "FAR 13.2 — up to $15K", far: "13.2" },
  { id: "sap", label: "Simplified (SAP)", sub: "FAR 13 — $15K to $350K", far: "13" },
  { id: "negotiated", label: "Negotiated", sub: "FAR 15 — above $350K", far: "15" },
  { id: "fss", label: "FSS Direct Order", sub: "FAR 8.4 — Schedule pricing", far: "8.4" },
  { id: "bpa-est", label: "BPA Establishment", sub: "FAR 8.4 — Blanket agreement", far: "8.4" },
  { id: "bpa-call", label: "BPA Call Order", sub: "FAR 8.4 — Order under BPA", far: "8.4" },
  { id: "idiq", label: "IDIQ Parent Award", sub: "FAR 16.5 — Indefinite delivery", far: "16.5" },
  {
    id: "idiq-order",
    label: "IDIQ Task/Delivery Order",
    sub: "FAR 16.5 — Order under IDIQ",
    far: "16.5",
  },
  { id: "sole", label: "Sole Source / J&A", sub: "FAR 6.3 — Limited competition", far: "6.3" },
];

const TYPES = [
  { id: "ffp", label: "Firm-Fixed-Price (FFP)", risk: 95, category: "fp" },
  { id: "fp-epa", label: "FP w/ Economic Price Adj", risk: 80, category: "fp" },
  { id: "fpi", label: "Fixed-Price Incentive (FPI)", risk: 65, category: "fp" },
  { id: "cpff", label: "Cost-Plus-Fixed-Fee (CPFF)", risk: 25, category: "cr" },
  { id: "cpif", label: "Cost-Plus-Incentive-Fee (CPIF)", risk: 35, category: "cr" },
  { id: "cpaf", label: "Cost-Plus-Award-Fee (CPAF)", risk: 20, category: "cr" },
  { id: "tm", label: "Time & Materials (T&M)", risk: 15, category: "loe" },
  { id: "lh", label: "Labor-Hour (LH)", risk: 15, category: "loe" },
];

const THRESHOLD_TIERS = [
  { value: 15_000, label: "$15K MPT", short: "$15K" },
  { value: 25_000, label: "$25K Synopsis", short: "$25K" },
  { value: 350_000, label: "$350K SAT", short: "$350K" },
  { value: 750_000, label: "$750K SubK", short: "$750K" },
  { value: 900_000, label: "$900K J&A", short: "$900K" },
  { value: 2_500_000, label: "$2.5M TINA", short: "$2.5M" },
  { value: 4_500_000, label: "$4.5M Congress", short: "$4.5M" },
  { value: 6_000_000, label: "$6M IDIQ Enh", short: "$6M" },
  { value: 20_000_000, label: "$20M AP", short: "$20M" },
  { value: 50_000_000, label: "$50M HCA", short: "$50M" },
  { value: 90_000_000, label: "$90M SPE J&A", short: "$90M" },
  { value: 100_000_000, label: "$100M SPE", short: "$100M" },
  { value: 150_000_000, label: "$150M OAP", short: "$150M" },
];

const METHODS_BY_ID = Object.fromEntries(METHODS.map((m) => [m.id, m]));
const TYPES_BY_ID = Object.fromEntries(TYPES.map((t) => [t.id, t]));

function apApproval(v) {
  if (v > 150_000_000) return "HHS/OAP approval required (> $150M)";
  if (v > 50_000_000) return "HCA-NIH approval required ($50M-$150M)";
  if (v > 20_000_000) return "OA Director approval by HCA ($20M-$50M)";
  return "One level above CO (SAT-$20M)";
}

function jaApproval(v) {
  if (v > 90_000_000) return "SPE through HHS/OAP (> $90M) - FAR 6.304(a)(4)";
  if (v > 20_000_000) return "HCA + additional reviews ($20M-$90M) - FAR 6.304(a)(3)";
  if (v > 900_000) return "HCA + NIH Competition Advocate ($900K-$20M) - FAR 6.304(a)(2)";
  return "CO approval (<= $900K) - FAR 6.304(a)(1)";
}

/**
 * Deterministic compliance analysis for a given procurement scenario.
 */
export function getRequirements(contractValue, acquisitionMethod, contractType, flags = {}) {
  const v = Number(contractValue);
  const m = acquisitionMethod;
  const t = contractType;

  const {
    is_it = false,
    is_small_business = false,
    is_rd = false,
    is_human_subjects = false,
    is_services = true,
  } = flags;

  const tObj = TYPES_BY_ID[t];
  if (!tObj) return { errors: [`Unknown contract type: ${t}`], warnings: [] };
  const mObj = METHODS_BY_ID[m];
  if (!mObj) return { errors: [`Unknown acquisition method: ${m}`], warnings: [] };

  const isCr = tObj.category === "cr";
  const isLoe = tObj.category === "loe";

  const warnings = [];
  const errors = [];

  if (isCr) {
    warnings.push(
      "Cost-reimbursement requires written AP approval, adequate contractor accounting system, and designated COR (FAR 16.301)."
    );
    if (is_rd) warnings.push("CPFF fee cap for R&D: 15% of estimated cost (FAR 16.304).");
  }
  if (isLoe) {
    warnings.push(
      "T&M/LH is LEAST PREFERRED. CO must prepare D&F that no other contract type is suitable (FAR 16.601)."
    );
    if (m === "bpa-est" && v > 350_000)
      warnings.push("T&M/LH BPAs > 3 years require HCA approval.");
  }
  if (t === "cpaf")
    warnings.push(
      "CPAF requires approved award-fee plan before award. Rollover of unearned fee is PROHIBITED (FAR 16.402-2)."
    );
  if (m === "micro" && v > 15_000)
    errors.push("Micro-purchase threshold is $15,000 (HHS). Value exceeds MPT.");
  if (m === "sap" && v > 350_000)
    errors.push("SAP threshold is $350,000 (SAT). Value exceeds SAT - use Negotiated (FAR 15).");

  // Documents required
  const docs = [];
  docs.push({ name: "Purchase Request", required: true, note: "FAR 4.803(a)(1)" });

  if (m !== "micro") {
    docs.push({
      name: is_services ? "SOW / PWS" : "Statement of Need (SON)",
      required: true,
      note: is_services ? "Performance-based with QASP (FAR 37.6)" : "Product specifications",
    });
  } else {
    docs.push({ name: "SOW / PWS", required: false, note: "Not required for micro-purchase" });
  }

  docs.push({
    name: "IGCE",
    required: m !== "micro",
    note:
      v > 350_000
        ? "Detailed breakdown required (HHSAM 307.105-71)"
        : "Sufficient detail/breakdown",
  });

  if (v > 350_000)
    docs.push({
      name: "Market Research Report",
      required: true,
      note: "HHS template required (HHSAM 310.000)",
    });
  else if (v > 15_000)
    docs.push({
      name: "Market Research",
      required: true,
      note: "Documented justification (less formal)",
    });
  else
    docs.push({
      name: "Market Research",
      required: false,
      note: "Not required for micro-purchase",
    });

  if (v > 350_000) docs.push({ name: "Acquisition Plan", required: true, note: apApproval(v) });
  else
    docs.push({
      name: "Acquisition Plan",
      required: false,
      note: "Not required below SAT ($350K)",
    });

  const needsJa = m === "sole" || (m === "fss" && v > 350_000) || (m === "bpa-call" && v > 350_000);
  docs.push({
    name: "J&A / Justification",
    required: needsJa,
    note: needsJa ? jaApproval(v) : "Only if sole source / limited competition",
  });

  const needsDf = isLoe || (isCr && v > 350_000) || t === "fpi" || t === "cpaf";
  docs.push({
    name: "D&F (Determination & Findings)",
    required: needsDf,
    note: isLoe
      ? "Required: no other type suitable (FAR 16.601)"
      : isCr
        ? "Required for cost-reimbursement"
        : "Required for incentive/award-fee",
  });

  const needsSsp = m === "negotiated" && v > 350_000;
  docs.push({
    name: "Source Selection Plan",
    required: needsSsp,
    note: needsSsp ? "Evaluation factors with relative importance" : "N/A for this method",
  });

  const needsSubk = v > 750_000 && !is_small_business;
  docs.push({
    name: "Subcontracting Plan",
    required: needsSubk,
    note: needsSubk
      ? "Required for non-SB > $750K (FAR 19.705)"
      : is_small_business
        ? "Exempt - small business awardee"
        : "Below $750K threshold",
  });

  const needsQasp = is_services && m !== "micro";
  docs.push({
    name: "QASP",
    required: needsQasp,
    note: needsQasp
      ? "Required for performance-based services (FAR 46)"
      : "Products / micro-purchase",
  });
  docs.push({
    name: "HHS-653 Small Business Review",
    required: v > 15_000,
    note: v > 15_000 ? "Required > MPT (AA 2023-02 Amendment 3)" : "Below MPT",
  });

  if (is_it) {
    docs.push({
      name: "IT Security & Privacy Certification",
      required: true,
      note: "HHSAM 339.101(c)(1)",
    });
    docs.push({
      name: "Section 508 ICT Evaluation",
      required: v > 15_000,
      note: "Required for IT > MPT",
    });
  }
  if (is_human_subjects)
    docs.push({
      name: "Human Subjects Provisions",
      required: true,
      note: "HHSAR 370.3, 45 CFR 46",
    });

  // Thresholds
  const triggered = THRESHOLD_TIERS.filter((th) => v >= th.value);
  const notTriggered = THRESHOLD_TIERS.filter((th) => v < th.value);

  // Compliance items
  const compliance = [];
  compliance.push({
    name: "Section 889 Compliance",
    status: "required",
    note: "FAR 52.204-25 - all solicitations/contracts",
  });
  compliance.push({
    name: "BAA/TAA Checklist",
    status: m !== "micro" ? "required" : "conditional",
    note: "HHSAM 325.102-70",
  });
  compliance.push({
    name: "SAM.gov Synopsis",
    status: v > 25_000 ? "required" : "n/a",
    note: v > 25_000 ? "Required > $25K (FAR 5.101)" : "Below $25K",
  });
  compliance.push({
    name: "CPARS Evaluation",
    status: v > 350_000 ? "required" : "n/a",
    note: v > 350_000 ? "Required > SAT" : "Below SAT",
  });
  compliance.push({
    name: "Congressional Notification",
    status: v > 4_500_000 ? "required" : "n/a",
    note: v > 4_500_000 ? "Required > $4.5M - email grantfax@hhs.gov" : "Below $4.5M",
  });
  compliance.push({
    name: "Certified Cost/Pricing Data (TINA)",
    status: v > 2_500_000 ? "required" : "n/a",
    note: v > 2_500_000 ? "Required > $2.5M (with exceptions)" : "Below $2.5M",
  });
  if (is_it) {
    compliance.push({
      name: "Section 508 ICT Accessibility",
      status: "required",
      note: "Required for IT acquisitions",
    });
    compliance.push({
      name: "IT Security & Privacy Language",
      status: "required",
      note: "HHSAM Part 339.105",
    });
  }
  if (is_human_subjects)
    compliance.push({
      name: "Human Subjects Protection (45 CFR 46)",
      status: "required",
      note: "HHSAR 370.3",
    });
  if (is_services)
    compliance.push({
      name: "Severable Services <= 1yr/period",
      status: "required",
      note: "FAR 37.106(b), 32.703-3(b)",
    });

  // Competition rules
  const competitionMap = {
    micro: "Single quote acceptable. Government purchase card preferred.",
    sap:
      v > 25_000
        ? "Maximum practicable competition. Minimum 3 sources if practicable. Synopsis on SAM.gov."
        : "Reasonable competition. Minimum 3 sources if practicable.",
    negotiated:
      "Full and open competition required (FAR Part 6). Synopsis, evaluation factors, source selection.",
    fss:
      v > 350_000
        ? "eBuy posting OR RFQ to enough contractors for 3 quotes. Price reduction attempt required."
        : "Consider quotes from at least 3 schedule contractors.",
    "bpa-est":
      v > 350_000
        ? "eBuy posting to ALL schedule holders OR 3-quote effort. Document award decision."
        : "Seek quotes from at least 3 schedule holders.",
    "bpa-call":
      v > 350_000
        ? "RFQ to all BPA holders OR limited sources justification. Fair opportunity required."
        : "Fair opportunity to all BPA holders > MPT, or justification.",
    idiq: "Full and open competition for parent contract. Multiple award preference unless exception (FAR 16.504).",
    "idiq-order":
      v > 7_500_000
        ? "Fair opportunity to all IDIQ holders. Clear requirements, evaluation factors with relative importance, post-award notifications/debriefings."
        : v > 350_000
          ? "Fair opportunity. Provide fair notice, issue solicitation/RFQ, document award basis."
          : "Fair opportunity. May place without further solicitation if fair consideration documented.",
    sole: "Exception to competition - FAR 6.302 authority required. Full J&A with CO certification.",
  };
  let competition = competitionMap[m] || "";
  if (m === "idiq-order" && v > 6_000_000)
    competition +=
      " ENHANCED: Detailed evaluation factors + relative importance + post-award notification + debriefing (> $6M).";

  // PMR checklist
  const pmrMap = {
    micro: "Micro-Purchase - Minimal file documentation",
    sap: "HHS PMR SAP Checklist",
    negotiated: v <= 350_000 ? "HHS PMR SAP Checklist" : "HHS PMR Negotiated + Common Requirements",
    fss: "HHS PMR FSS Order Checklist",
    "bpa-est": "HHS PMR BPA Checklist",
    "bpa-call": "HHS PMR BPA Checklist",
    idiq: "HHS PMR IDIQ Checklist",
    "idiq-order": "HHS PMR IDIQ Checklist",
    sole: "HHS PMR SAP or Negotiated + J&A Requirements",
  };
  const pmr = pmrMap[m] || "HHS PMR Common Requirements";

  // Timeline
  const timelines = {
    micro: [0, 1],
    sap: [2, 6],
    negotiated: [12, 36],
    fss: [2, 8],
    "bpa-est": [4, 12],
    "bpa-call": [1, 4],
    idiq: [16, 52],
    "idiq-order": [2, 12],
    sole: [4, 16],
  };
  let [timeMin, timeMax] = timelines[m] || [1, 5];
  if (v > 90_000_000) {
    timeMin += 6;
    timeMax += 8;
  } else if (v > 50_000_000) {
    timeMin += 4;
    timeMax += 6;
  } else if (v > 20_000_000) {
    timeMin += 2;
    timeMax += 4;
  }

  // Fee caps
  const feeCaps = [];
  if (isCr) {
    if (is_rd) feeCaps.push("R&D: <= 15% of est. cost");
    feeCaps.push("Other CPFF: <= 10% of est. cost");
    feeCaps.push("A-E public works: <= 6% of est. construction");
    feeCaps.push("Cost-plus-%-of-cost: PROHIBITED");
  }

  // Approvals
  const approvals = [];
  if (v > 350_000) approvals.push({ type: "Acquisition Plan", authority: apApproval(v) });
  if (needsJa) approvals.push({ type: "J&A", authority: jaApproval(v) });
  if (needsDf) approvals.push({ type: "D&F", authority: isLoe ? "One level above CO" : "CO" });
  if (v > 2_500_000)
    approvals.push({
      type: "TINA / Cost Data",
      authority: "Certified cost or pricing data required",
    });

  return {
    errors,
    warnings,
    documents_required: docs,
    compliance_items: compliance,
    competition_rules: competition,
    thresholds_triggered: triggered,
    thresholds_not_triggered: notTriggered,
    timeline_estimate: { min_weeks: timeMin, max_weeks: timeMax },
    risk_allocation: { contractor_risk_pct: tObj.risk, category: tObj.category },
    fee_caps: feeCaps,
    pmr_checklist: pmr,
    approvals_required: approvals,
    method: mObj,
    contract_type: tObj,
  };
}

/**
 * Search FAR database by keyword with optional part filter.
 */
export function searchFar(keyword, parts) {
  const terms = keyword.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const scored = [];
  for (const entry of FAR_DATABASE) {
    if (parts?.length && !parts.includes(entry.part)) continue;
    const searchable = [
      entry.title || "",
      entry.summary || "",
      entry.section || "",
      ...(entry.keywords || []),
    ]
      .join(" ")
      .toLowerCase();
    let score = terms.filter((t) => searchable.includes(t)).length;
    const entryKw = (entry.keywords || []).map((k) => k.toLowerCase());
    score += terms.filter((t) => entryKw.includes(t)).length * 2;
    if (score > 0) scored.push({ score, entry });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.entry);
}

/**
 * Recommend contract vehicles based on requirement flags.
 */
export function suggestVehicle(flags = {}) {
  const { is_it = false, is_services = false, is_small_business = false } = flags;
  const recommendations = VEHICLES_DATA.selection_guide?.recommendations || {};
  const vehicles = VEHICLES_DATA.vehicles || {};
  const suggested = [];

  if (is_it && is_services) {
    suggested.push({
      recommendation: recommendations.it_services_complex || "",
      vehicle: "nitaac",
      detail: vehicles.nitaac || {},
    });
  } else if (is_it) {
    suggested.push({
      recommendation: recommendations.it_commodities || "",
      vehicle: "gsa_schedules",
      detail: vehicles.gsa_schedules || {},
    });
  } else if (is_services) {
    suggested.push({
      recommendation: recommendations.professional_services || "",
      vehicle: "gsa_schedules",
      detail: vehicles.gsa_schedules || {},
    });
  } else {
    suggested.push({
      recommendation: recommendations.unique_requirements || "Full and open competition",
      vehicle: "open_competition",
      detail: { name: "Full and Open Competition", description: "Standard FAR Part 15 process" },
    });
  }

  return {
    suggested_vehicles: suggested,
    decision_factors: VEHICLES_DATA.selection_guide?.decision_factors || [],
    notes: VEHICLES_DATA.notes || [],
  };
}

/**
 * Dispatch a compliance matrix operation.
 */
export function executeOperation(params) {
  const op = params.operation;
  if (op === "query")
    return getRequirements(
      params.contract_value || 0,
      params.acquisition_method || "sap",
      params.contract_type || "ffp",
      {
        is_it: params.is_it,
        is_small_business: params.is_small_business,
        is_rd: params.is_rd,
        is_human_subjects: params.is_human_subjects,
        is_services: params.is_services ?? true,
      }
    );
  if (op === "list_methods") return { methods: METHODS };
  if (op === "list_types") return { types: TYPES };
  if (op === "list_thresholds")
    return { threshold_tiers: THRESHOLD_TIERS, threshold_data: THRESHOLDS_DATA };
  if (op === "search_far") return { results: searchFar(params.keyword || "", params.parts) };
  if (op === "suggest_vehicle")
    return suggestVehicle({
      is_it: params.is_it,
      is_services: params.is_services,
      is_small_business: params.is_small_business,
    });
  return {
    error: `Unknown operation: ${op}. Valid: query, list_methods, list_types, list_thresholds, search_far, suggest_vehicle`,
  };
}
