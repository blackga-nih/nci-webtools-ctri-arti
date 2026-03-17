/**
 * Server-side chat configuration (tools + system prompt).
 *
 * Mirrors client/pages/tools/chat/config.js but lives on the server so that
 * the client request body stays under the WAF 8 KB limit.  The client sends
 * `chatConfig: "eagle"` and a small `context` object; the server injects the
 * full tools array and rendered system prompt before forwarding to the model.
 */

const year = () => new Date().getFullYear();

const tools = [
  {
    toolSpec: {
      name: "search",
      description: `Search the web for up-to-date information, facts, news, and references. Use the current year whenever relevant. Always remember to use the browse tool to follow up on relevant search results, and to use search wisely (eg: don't keep searching for the same terms - use maximally disjoint searches to retrieve diverse information).`,
      inputSchema: {
        json: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: `Search query term. Use operators like quotes for exact phrases, site: for specific websites, or filetype: for specific document types. Remember to incorporate the current year to retrieve the latest news.`,
            },
          },
        },
      },
    },
  },
  {
    toolSpec: {
      name: "browse",
      description:
        "Provide multiple urls when possible. Extract and read the full content from webpages, PDFs, DOCXs, or multimedia objects. Use this tool to analyze articles, documentation, or any online content from trusted federal sources. Use this to follow up on search results.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            url: {
              type: "array",
              items: { type: "string" },
              description:
                "Full webpage URLs (including http:// or https://). Provide an array of full URLs to analyze. This tool can handle up to 20 urls at once.",
            },
            topic: {
              type: "string",
              description:
                "The specific question or information need about the documents. In your topic, think step by step about why you are accessing this document. Ask clear, focused questions that the document might answer.",
            },
          },
          required: ["url", "topic"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "code",
      description:
        "Run self-contained single-file javascript or html programs. **JavaScript** — browser-based (no node.js). **HTML** — render mini web applications or UI prototypes.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            language: {
              type: "string",
              description: 'Execution context: "javascript", or "html".',
              enum: ["javascript", "html"],
            },
            source: { type: "string", description: "The code to execute." },
            timeout: {
              type: "number",
              description: "Maximum runtime in milliseconds (default = 5000).",
              default: 5000,
            },
          },
          required: ["language", "source"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "editor",
      description:
        "Use this tool to view and edit your memory files with precise editing capabilities. Commands: view, str_replace, create, insert, undo_edit.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            command: {
              type: "string",
              enum: ["view", "str_replace", "create", "insert", "undo_edit"],
              description: "The operation to perform on the file.",
            },
            path: { type: "string", description: "Path to the file." },
            view_range: {
              type: "array",
              items: { type: "integer" },
              minItems: 2,
              maxItems: 2,
              description: "Start and end line numbers (1-indexed). Only for view.",
            },
            old_str: { type: "string", description: "Text to replace. Required for str_replace." },
            new_str: { type: "string", description: "Replacement text." },
            file_text: { type: "string", description: "Content for create command." },
            insert_line: {
              type: "integer",
              description: "Line number after which to insert (0 for beginning).",
            },
          },
          required: ["command", "path"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "think",
      description:
        "Use this tool to create a dedicated thinking space for complex reasoning. Include the complete information you need to analyze.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            thought: {
              type: "string",
              description: "The complete information to analyze.",
            },
          },
          required: ["thought"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "data",
      description:
        "Access data files from S3 buckets. List available files by omitting the key parameter, or fetch specific file contents.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            bucket: { type: "string", description: "The S3 bucket name." },
            key: { type: "string", description: "File path to fetch. Omit to list files." },
          },
          required: ["bucket"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "docxTemplate",
      description:
        "Fill out DOCX documents by finding and replacing text in blocks. Without replacements: returns numbered blocks. With replacements: use text keys or @index keys.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            docxUrl: { type: "string", description: "URL to the DOCX document." },
            replacements: { type: "object", description: "Map of replacements." },
          },
          required: ["docxUrl"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "search_far",
      description:
        "Search the Federal Acquisition Regulation (FAR) database for relevant sections, clauses, and guidance.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            keyword: { type: "string", description: "Search terms" },
            parts: {
              type: "array",
              items: { type: "string" },
              description: "Optional FAR part numbers to filter",
            },
          },
          required: ["keyword"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "query_compliance_matrix",
      description:
        "Get deterministic compliance analysis for a procurement scenario. Operations: query, list_methods, list_types, list_thresholds, search_far, suggest_vehicle.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              description: "Operation to perform",
              enum: [
                "query",
                "list_methods",
                "list_types",
                "list_thresholds",
                "search_far",
                "suggest_vehicle",
              ],
            },
            contract_value: { type: "number", description: "Estimated dollar value (for query)" },
            acquisition_method: { type: "string", description: "Method ID" },
            contract_type: { type: "string", description: "Type ID" },
            is_it: { type: "boolean" },
            is_services: { type: "boolean" },
            is_small_business: { type: "boolean" },
            is_rd: { type: "boolean" },
            is_human_subjects: { type: "boolean" },
            keyword: { type: "string", description: "Search term (for search_far)" },
          },
          required: ["operation"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "plugin_data",
      description:
        "Load EAGLE acquisition document templates for generating acquisition documents.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Template path (e.g. 'templates/sow-template.md')",
            },
          },
          required: ["path"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "knowledge_search",
      description:
        "Search the EAGLE knowledge base for acquisition documents, regulations, GAO cases, NIH policies, checklists, and guidance.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            agent: { type: "string", description: "Filter by agent folder" },
            keyword: { type: "string", description: "Search terms" },
            topic: { type: "string", description: "Filter by topic/subfolder" },
          },
        },
      },
    },
  },
  {
    toolSpec: {
      name: "knowledge_fetch",
      description: "Fetch full text content of a document from the EAGLE knowledge base.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            key: { type: "string", description: "S3 key from knowledge_search results" },
          },
          required: ["key"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "load_skill",
      description:
        "Load detailed instructions for a specialized capability. Available: oa-intake, document-generator, compliance, policy-research, technical-review, legal-counsel, market-intelligence, public-interest, policy-analyst, policy-librarian.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "The skill to load.",
              enum: [
                "oa-intake",
                "document-generator",
                "compliance",
                "policy-research",
                "technical-review",
                "legal-counsel",
                "market-intelligence",
                "public-interest",
                "policy-analyst",
                "policy-librarian",
              ],
            },
          },
          required: ["name"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "create_document",
      description:
        "Generate and save an acquisition document to an S3-backed package. Renders a Handlebars template with provided data, saves to S3, and tracks it in the package database.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            package_id: { type: "string", description: "Package ID" },
            doc_type: {
              type: "string",
              enum: ["sow", "igce", "market_research", "acquisition_plan", "justification"],
              description: "Document type",
            },
            title: { type: "string", description: "Document title" },
            data: { type: "object", description: "Template fields to populate" },
          },
          required: ["doc_type", "title", "data"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "manage_package",
      description: "Create or query an acquisition package. Operations: create, status, checklist.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            operation: { type: "string", enum: ["create", "status", "checklist"] },
            title: { type: "string" },
            estimated_value: { type: "number" },
            requirement_description: { type: "string" },
            acquisition_method: { type: "string" },
            contract_type: { type: "string" },
            flags: { type: "object" },
            package_id: { type: "string" },
          },
          required: ["operation"],
        },
      },
    },
  },
];

function systemPrompt(context = {}) {
  const time = context.time || new Date().toDateString();
  const memory = context.main || "";

  return `You are EAGLE, the NCI Office of Acquisitions intelligent intake assistant. You guide Contracting Officer Representatives (CORs), program staff, and contracting officers through the federal acquisition lifecycle — from initial need identification through document generation and package submission. You are knowledgeable about FAR, DFARS, HHSAR, and NCI-specific acquisition policies. Be professional, precise, and proactively helpful.

RESPONSE STYLE: Be concise. Lead with the key insight or action. Use bullet points for lists. Show accomplishments and next steps only. Do NOT repeat what the user said. Do NOT explain your reasoning at length. Keep responses under 300 words unless generating a document or detailed analysis.

The current date is ${time}. The current year is ${year()}.

INTAKE PHILOSOPHY: Act like 'Trish' — a senior contracting expert who intuitively knows what to do with any package. Don't require users to understand all the branching logic upfront. Instead: (1) Start minimal — collect just enough to begin (what, estimated cost, timeline). (2) Ask smart follow-ups — 2-3 questions at a time based on their answers. (3) Determine the pathway — acquisition type, contract type, competition strategy, and required documents. (4) Guide to completion — help generate every required document in the package.

FIVE-PHASE INTAKE WORKFLOW:
  Phase 1 — Minimal Intake: Collect requirement description, estimated cost range, and timeline.
  Phase 2 — Clarifying Questions: Product vs. service, vendor knowledge, funding status, existing vehicles, urgency drivers.
  Phase 3 — Pathway Determination: Micro-purchase (<$15K), Simplified ($15K-$350K, FAR Part 13), or Full Competition (>$350K, FAR Part 15); contract type (fixed-price, T&M, cost-reimbursement); set-aside evaluation.
  Phase 4 — Document Requirements: Identify required documents by acquisition type and generate them.
  Phase 5 — Summary & Handoff: Produce acquisition summary with determination table, document checklist, and next steps.

KEY THRESHOLDS (FAC 2025-06, effective October 1, 2025):
  Micro-Purchase Threshold (MPT): $15,000 — minimal documentation
  Simplified Acquisition Threshold (SAT): $350,000 — full competition above
  Cost/Pricing Data: $2,500,000 — certified cost data required above
  Subcontracting Plan: $750,000 — required for large business primes
  8(a) Sole Source: $4.5M (services/non-mfg), $7M (manufacturing)
  Synopsis Required: $25,000 — SAM.gov posting required above
  Congressional Notification: $4,500,000

SPECIALIST PERSPECTIVES — Apply these lenses when reviewing acquisitions:

Legal Counsel Lens: Assess legal risks in acquisition strategies. Consider GAO protest decisions, FAR compliance, fiscal law constraints, and appropriations law. Identify protest vulnerabilities, cite specific authorities (FAR 6.302-x), and flag litigation risks.

Technical Translator Lens: Bridge technical requirements with contract language. Translate scientific/technical needs into specific, measurable, achievable contract requirements.

Market Intelligence Lens: Analyze market conditions, vendor capabilities, and pricing. Leverage GSA rates, FPDS data, and small business program knowledge (8(a), HUBZone, WOSB, SDVOSB).

Public Interest Lens: Ensure fair competition, transparency, and public accountability.

# Tools

You have access to tools for research, compliance analysis, document generation, and skill loading. Use them proactively.

## Research Tools
search: Search the web for current information. Complete ALL searches before browsing.
browse: After searches complete, examine full content from URLs. Browse at least 5 URLs simultaneously.
think: Extended reasoning for complex analysis. Include the COMPLETE information that needs processing.
code: Run JavaScript or HTML for calculations, analysis, or visualizations.

## Knowledge Base Tools (USE THESE FIRST for policy, regulatory, and case law questions)
knowledge_search: Search the EAGLE knowledge base by agent, keyword, and topic.
knowledge_fetch: Fetch full text of a KB document using the s3_key from knowledge_search results.

## Acquisition Tools
search_far: Search the FAR/DFARS/HHSAR database by keyword.
query_compliance_matrix: Deterministic compliance analysis.
plugin_data: Load NCI document templates.
docxTemplate: Fill DOCX document templates.
data: Access files from S3 buckets.

## Package & Document Tools
manage_package: Create or query acquisition packages. ALWAYS create a package after completing intake before generating documents.
create_document: Generate and save acquisition documents. ALWAYS use this tool instead of outputting document text directly in chat.

## Skills (Progressive Disclosure)
load_skill: Load detailed instructions for specialized capabilities. Load the relevant skill FIRST when a user's request matches.

Available skills: oa-intake, document-generator, compliance, policy-research, technical-review, legal-counsel, market-intelligence, public-interest, policy-analyst, policy-librarian.

## Editor & Memory
editor: Manage workspace.txt to maintain context across conversations.

CRITICAL — PACKAGE WORKFLOW: When a user wants to acquire something:
1. Load the oa-intake skill and complete intake
2. After determining pathway, call manage_package(operation: "create")
3. For each required document, call create_document() with the package_id
4. After all documents, call manage_package(operation: "checklist")

CRITICAL — load_skill FIRST: Before responding to specialized requests, call load_skill with the matching skill name.

ACCURACY: NEVER fabricate FAR citations, threshold values, or regulatory guidance. Use search_far and query_compliance_matrix for authoritative data.

# Context
<memory>
${memory}
</memory>`;
}

export const chatConfigs = {
  eagle: { tools, systemPrompt },
};
