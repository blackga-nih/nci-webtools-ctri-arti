export const tools = [
  {
    toolSpec: {
      name: "search",
      description: `Search the web for up-to-date information, facts, news, and references. Use the current year (${new Date().getFullYear()}) whenever relevant. Always remember to use the browse tool to follow up on relevant search results, and to use search wisely (eg: don't keep searching for the same terms - use maximally disjoint searches to retrieve diverse information).`,
      inputSchema: {
        json: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: `Search query term. Use operators like quotes for exact phrases, site: for specific websites, or filetype: for specific document types. Remember to incorporate the current year (${new Date().getFullYear()}) to retrieve the latest news.`,
            },
          },
        },
      },
    },
  },
  {
    toolSpec: {
      name: "browse",
      description: `Provide multiple urls when possible. Extract and read the full content from webpages, PDFs, DOCXs, or multimedia objects. Use this tool to analyze articles, documentation, or any online content from trusted federal sources. Use this to follow up on search results.`,
      inputSchema: {
        json: {
          type: "object",
          properties: {
            url: {
              type: "array",
              items: {
                type: "string",
              },
              description:
                "Full webpage URLs (including http:// or https://). Provide an array of full URLs to analyze. This tool can handle up to 20 urls at once.",
            },
            topic: {
              type: "string",
              description:
                "The specific question or information need about the documents. In your topic, think step by step about why you are accessing this document (for example - relevance to user query or academic interest). Ask clear, focused questions that the document might answer. Start with basic structural questions (e.g., 'What are the main sections of this document?') before asking about specific content. Phrase questions precisely using terminology likely found in the document. For best results, ask one specific question per query rather than multiple questions or vague requests. When asking questions, always include the full context for any question being asked.",
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
        'Run self-contained single-file javascript or html programs for any purpose. **JavaScript** — browser-based (no node.js). perform fast one-off calculations, test algorithms, or experiment with browser-friendly libraries (e.g. transformers.js) via CDN ES-module imports (eg: import { AutoModel } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.4.2/+esm").  **HTML** — render mini web applications or UI prototypes on the fly; ideal for visualising results, building interactive widgets, or sketching layouts.\n\nJust pass the `language`, your `source` code, and (optionally) a `timeout` in milliseconds. The tool returns an object that includes any captured console output (`logs`) and, for HTML, the rendered markup (`html`).\n\nExample calls\n```javascript\nawait code({\n  language: "javascript",\n  source: "console.log(2 ** 10)"\n});\n\nawait code({\n  language: "html",\n  source: "<h1>Hello <script>console.log(\'hi\')</"+"script></h1>"\n});\n```',
      inputSchema: {
        json: {
          type: "object",
          properties: {
            language: {
              type: "string",
              description: 'Execution context: "javascript", or "html".',
              enum: ["javascript", "html"],
            },
            source: {
              type: "string",
              description: "The code to execute.",
            },
            timeout: {
              type: "number",
              description:
                "Maximum runtime in milliseconds before the sandbox is terminated (default = 5000).",
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
        "Use this tool to view and edit your memory files with precise editing capabilities. Do not use this tool for any other purpose. Use the memory editor tool to view your memories (stored as text files), make targeted text replacements, create new files, insert content at specific locations, and undo previous edits.\n\n**IMPORTANT FOR MULTI-LINE TEXT:**\n- When working with multi-line text in parameters like `old_str`, `new_str`, or `file_text`, use literal line breaks in your JSON values.\n- For `str_replace` command, the text to replace must exist exactly once in the file, including all line breaks.\n- The old_str parameter cannot be empty for str_replace operations.\n",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            command: {
              type: "string",
              enum: ["view", "str_replace", "create", "insert", "undo_edit"],
              description:
                "The operation to perform on the file. Required for all commands. View the file, replace a string, create a new file, insert text at a specific line, or undo the last edit.",
            },
            path: {
              type: "string",
              description: "Path to the file to view or modify. Required for all commands.",
            },
            view_range: {
              type: "array",
              items: {
                type: "integer",
              },
              minItems: 2,
              maxItems: 2,
              description:
                "Optional array of two integers specifying the start and end line numbers to view (1-indexed, -1 for end of file). Only used with 'view' command.",
            },
            old_str: {
              type: "string",
              description:
                "The text to replace (must match exactly one location). ONLY use this to replace existing text. To insert a new line, simply use new_str. For multi-line text, use literal line breaks in your JSON values. Required for 'str_replace' command and cannot be empty. To replace empty content, use insert_line instead.",
            },
            new_str: {
              type: "string",
              description:
                "The new text to insert in place of the old text (for 'str_replace') or text to insert at insert_line (for 'insert'). For multi-line text, use literal line breaks in your JSON values. Required for 'str_replace' and 'insert' commands.",
            },
            file_text: {
              type: "string",
              description:
                "The content to write to a new file. For multi-line text, use literal line breaks in your JSON values. Required for 'create' command.",
            },
            insert_line: {
              type: "integer",
              description:
                "The line number after which to insert text (0 for beginning of file). Required for 'insert' command.",
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
        "Use this tool to create a dedicated thinking space for complex reasoning. Include the complete information you need to analyze in the thought parameter - providing the full content that needs analysis. This tool is most valuable when processing search results, analyzing documents, planning multi-step implementations, or evaluating complex tradeoffs.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            thought: {
              type: "string",
              description:
                "The complete information to analyze, including relevant context, data, and constraints. Include the full content that needs analysis.",
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
        "Access data files from S3 buckets. List available files by omitting the key parameter, or fetch specific file contents for analysis. Supports CSV, JSON, text, and other file formats.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            bucket: {
              type: "string",
              description: "The S3 bucket name to access.",
            },
            key: {
              type: "string",
              description: "The file path to fetch. Omit to list all available files.",
            },
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
        'Fill out DOCX documents by finding and replacing text in blocks. Without replacements: returns the document\'s text as numbered blocks (paragraphs and table cells) with style info and row/col for cells. With replacements: use text-based keys ("original text": "new text") or index-based keys ("@0": "replacement for block 0") to fill in content.',
      inputSchema: {
        json: {
          type: "object",
          properties: {
            docxUrl: {
              type: "string",
              description: "URL to the DOCX document. Supports s3://bucket/key or https:// URLs.",
            },
            replacements: {
              type: "object",
              description:
                'Map of replacements. Use text keys for text-based replacement (use only when text spans a single block): {"text to find": "replacement"}. In most cases, use @index keys for index-based replacement: {"@0": "text for block 0", "@5": "text for block 5"}. Both modes can be mixed. Index-based is useful for long text, text that needs to be deleted, table cells or blocks with duplicate/empty content.',
            },
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
        "Search the Federal Acquisition Regulation (FAR) database for relevant sections, clauses, and guidance. Returns matching FAR entries sorted by relevance. Use this when the user asks about FAR requirements, clauses, or regulatory guidance.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            keyword: {
              type: "string",
              description:
                "Search terms (e.g. 'competitive range', 'small business set-aside', 'cost realism')",
            },
            parts: {
              type: "array",
              items: { type: "string" },
              description: "Optional FAR part numbers to filter (e.g. ['15', '19'])",
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
        "Get deterministic compliance analysis for a procurement scenario. Returns required documents, compliance items, competition rules, thresholds, timeline estimates, approvals, and risk allocation.\n\nOperations:\n- **query**: Full compliance analysis (requires contract_value, acquisition_method, contract_type, and optional flags)\n- **list_methods**: List all acquisition methods (micro, sap, negotiated, fss, bpa-est, bpa-call, idiq, idiq-order, sole)\n- **list_types**: List all contract types (ffp, fp-epa, fpi, cpff, cpif, cpaf, tm, lh)\n- **list_thresholds**: List all procurement threshold tiers\n- **search_far**: Search FAR database (keyword required)\n- **suggest_vehicle**: Recommend contract vehicles (flags: is_it, is_services, is_small_business)",
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
            acquisition_method: {
              type: "string",
              description:
                "Method ID: micro, sap, negotiated, fss, bpa-est, bpa-call, idiq, idiq-order, sole",
            },
            contract_type: {
              type: "string",
              description: "Type ID: ffp, fp-epa, fpi, cpff, cpif, cpaf, tm, lh",
            },
            is_it: { type: "boolean", description: "IT acquisition?" },
            is_services: { type: "boolean", description: "Services (vs products)?" },
            is_small_business: { type: "boolean", description: "Small business awardee?" },
            is_rd: { type: "boolean", description: "R&D contract?" },
            is_human_subjects: { type: "boolean", description: "Involves human subjects?" },
            keyword: { type: "string", description: "Search term (for search_far operation)" },
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
        "Load EAGLE acquisition document templates for generating acquisition documents.\n\nAvailable templates:\n- `templates/sow-template.md` — Statement of Work\n- `templates/igce-template.md` — IGCE\n- `templates/acquisition-plan-template.md` — Acquisition Plan\n- `templates/justification-template.md` — Sole Source J&A\n- `templates/market-research-template.md` — Market Research Report",
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
        "Search the EAGLE knowledge base for acquisition documents, regulations, GAO cases, NIH policies, checklists, and guidance. Returns a list of matching documents with S3 keys that can be fetched with knowledge_fetch.\n\nThe KB is organized by agent specialization:\n- **compliance-strategist**: FAR guidance, HHSAR, NIH policies, PMR checklists, SOPs\n- **financial-advisor**: Appropriations law, contract financing, cost analysis\n- **legal-counselor**: GAO cases, protest guidance, ethics, IP/data rights, appropriations law\n- **market-intelligence**: Market research guides, small business, vehicle info\n- **technical-translator**: Technical standards, agile contracting, human subjects\n- **public-interest-guardian**: Ethics, transparency requirements\n- **supervisor-core**: Core procedures, checklists, templates\n- **shared**: Cross-cutting reference materials",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            agent: {
              type: "string",
              description:
                "Filter by agent folder: compliance-strategist, financial-advisor, legal-counselor, market-intelligence, technical-translator, public-interest-guardian, supervisor-core, shared",
            },
            keyword: {
              type: "string",
              description:
                "Search terms to match against file names and paths (e.g. 'IDIQ', 'protest', 'threshold', 'B-302358')",
            },
            topic: {
              type: "string",
              description:
                "Filter by topic/subfolder (e.g. 'appropriations-law', 'FAR-guidance', 'protest-guidance', 'PMR-checklists')",
            },
          },
        },
      },
    },
  },
  {
    toolSpec: {
      name: "knowledge_fetch",
      description:
        "Fetch the full text content of a document from the EAGLE knowledge base. Use the s3_key from knowledge_search results. Returns document text (up to 50KB).",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description: "The S3 key of the document to fetch (from knowledge_search results)",
            },
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
        "Load detailed instructions for a specialized capability. Use this when the user's request matches one of the available skills listed below. The skill instructions will be returned as context to guide your response.\n\nAvailable skills:\n- **oa-intake**: Guide users through the NCI acquisition intake process. Collects minimal information, asks clarifying questions, determines acquisition pathway.\n- **document-generator**: Generate acquisition documents (SOW, IGCE, Acquisition Plan, J&A, Market Research) using templates and intake context.\n- **compliance**: Ensure FAR/DFAR/HHSAR compliance, search regulations, identify required clauses, recommend contract vehicles.\n- **policy-research**: Search the knowledge base for FAR/DFARS/HHSAR regulations, agency policies, procedures, precedents, and templates.\n- **technical-review**: Validate technical specifications, translate scientific/IT needs into contract language, review installation/training/support, Section 508 accessibility, evaluation criteria.\n- **legal-counsel**: Assess legal risks, protest vulnerabilities, FAR compliance, appropriations law, GAO case precedents.\n- **market-intelligence**: Research market conditions, vendors, pricing, GSA schedules, small business opportunities and set-asides.\n- **public-interest**: Ensure fair competition, transparency, public accountability. Evaluate taxpayer value and flag fairness issues.\n- **policy-analyst**: Strategic regulatory intelligence. Monitor FAR changes, analyze CO review patterns, assess organizational impact.\n- **policy-librarian**: KB curator and quality control. Detect contradictions, version conflicts, gaps, staleness, citation errors.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description:
                "The skill to load. One of: oa-intake, document-generator, compliance, policy-research, technical-review, legal-counsel, market-intelligence, public-interest, policy-analyst, policy-librarian",
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
        "Generate and save an acquisition document to an S3-backed package. Renders a Handlebars template with the provided data fields, saves the result to S3, and tracks it in the package database. Returns a download URL and updated package checklist.\n\nTemplate fields vary by doc_type:\n- SOW: TITLE, REQUIREMENT_DESCRIPTION, BACKGROUND_CONTEXT, PURPOSE_STATEMENT, SCOPE_DESCRIPTION, BASE_PERIOD, TASK_1_TITLE, TASK_1_OBJECTIVE, TASK_1_REQUIREMENTS, DELIVERABLE_1, etc.\n- IGCE: TITLE, line items in data object\n- Market Research: TITLE, NAICS_CODE, DESCRIPTION_OF_NEED, vendors, vehicles\n- Acquisition Plan: TITLE, ESTIMATED_VALUE, statement of need, competition strategy\n- Justification: TITLE, ESTIMATED_VALUE, authority, proposed contractor, rationale",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            package_id: {
              type: "string",
              description: "Package ID to attach document to (from manage_package create)",
            },
            doc_type: {
              type: "string",
              enum: ["sow", "igce", "market_research", "acquisition_plan", "justification"],
              description: "Type of acquisition document to generate",
            },
            title: {
              type: "string",
              description: "Document title (e.g. 'Cloud Hosting Services SOW')",
            },
            data: {
              type: "object",
              description:
                "Template fields to populate. Keys should match Handlebars placeholders in the template (e.g. TITLE, REQUIREMENT_DESCRIPTION, BACKGROUND_CONTEXT, etc.). Any unmatched placeholders will remain as-is for manual completion.",
            },
          },
          required: ["doc_type", "title", "data"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "manage_package",
      description:
        "Create or query an acquisition package. Use 'create' after intake to persist the package with auto-determined pathway and required documents. Use 'status' to get full package details. Use 'checklist' to see document completion progress.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: ["create", "status", "checklist"],
              description: "Operation: create a new package, get status, or get checklist",
            },
            title: { type: "string", description: "Package title (for create)" },
            estimated_value: { type: "number", description: "Estimated dollar value (for create)" },
            requirement_description: {
              type: "string",
              description: "What is being acquired (for create)",
            },
            acquisition_method: {
              type: "string",
              description:
                "Method ID: micro, sap, negotiated, fss, bpa-est, bpa-call, idiq, idiq-order, sole",
            },
            contract_type: {
              type: "string",
              description: "Type ID: ffp, fp-epa, fpi, cpff, cpif, cpaf, tm, lh",
            },
            flags: {
              type: "object",
              description: "Flags: is_it, is_services, is_small_business, is_rd, is_human_subjects",
            },
            package_id: { type: "string", description: "Package ID (for status/checklist)" },
          },
          required: ["operation"],
        },
      },
    },
  },
];

export function systemPrompt(context) {
  return `You are EAGLE, the NCI Office of Acquisitions intelligent intake assistant. You guide Contracting Officer Representatives (CORs), program staff, and contracting officers through the federal acquisition lifecycle — from initial need identification through document generation and package submission. You are knowledgeable about FAR, DFARS, HHSAR, and NCI-specific acquisition policies. Be professional, precise, and proactively helpful.

RESPONSE STYLE: Be concise. Lead with the key insight or action. Use bullet points for lists. Show accomplishments and next steps only. Do NOT repeat what the user said. Do NOT explain your reasoning at length. Keep responses under 300 words unless generating a document or detailed analysis.

The current date is ${context.time}.

INTAKE PHILOSOPHY: Act like ‘Trish’ — a senior contracting expert who intuitively knows what to do with any package. Don’t require users to understand all the branching logic upfront. Instead: (1) Start minimal — collect just enough to begin (what, estimated cost, timeline). (2) Ask smart follow-ups — 2-3 questions at a time based on their answers. (3) Determine the pathway — acquisition type, contract type, competition strategy, and required documents. (4) Guide to completion — help generate every required document in the package.

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

Technical Translator Lens: Bridge technical requirements with contract language. Translate scientific/technical needs into specific, measurable, achievable contract requirements. Develop clear evaluation criteria and performance standards that CORs and contracting officers both understand.

Market Intelligence Lens: Analyze market conditions, vendor capabilities, and pricing. Leverage GSA rates, FPDS data, and small business program knowledge (8(a), HUBZone, WOSB, SDVOSB). Identify set-aside opportunities and validate cost reasonableness.

Public Interest Lens: Ensure fair competition, transparency, and public accountability. Evaluate taxpayer value, assess congressional/media sensitivity, and protect acquisition integrity. Flag fairness issues and appearance problems before they become protests.

# Tools

You have access to tools for research, compliance analysis, document generation, and skill loading. Use them proactively.

## Research Tools
search: Search the web for current information. Use ${new Date().getFullYear()} for recent events. Complete ALL searches before browsing. Use diverse queries — don’t repeat similar terms.
browse: After searches complete, examine full content from URLs. Browse at least 5 URLs simultaneously. Ask focused questions about each document.
think: Extended reasoning for complex analysis. Include the COMPLETE information that needs processing.
code: Run JavaScript or HTML for calculations, analysis, or visualizations.

## Knowledge Base Tools (USE THESE FIRST for policy, regulatory, and case law questions)
knowledge_search: Search the EAGLE knowledge base by agent, keyword, and topic. The KB contains 256 documents organized by agent specialization (compliance-strategist, financial-advisor, legal-counselor, market-intelligence, technical-translator, public-interest-guardian, supervisor-core, shared). Returns document keys for fetching. ALWAYS search the KB before answering questions about thresholds, GAO cases, appropriations law, NIH policies, or FAR guidance.
knowledge_fetch: Fetch full text of a KB document using the s3_key from knowledge_search results. Returns up to 50KB of document content. Use this to get actual document text for detailed answers.

## Acquisition Tools
search_far: Search the FAR/DFARS/HHSAR database by keyword. Returns relevant sections sorted by relevance.
query_compliance_matrix: Deterministic compliance analysis. Operations: “query” (full analysis with contract_value, acquisition_method, contract_type, and flags), “list_methods”, “list_types”, “list_thresholds”, “suggest_vehicle”.
plugin_data: Load NCI document templates (SOW, IGCE, Acquisition Plan, J&A, Market Research) from templates/ directory.
docxTemplate: Fill DOCX document templates with content using text or index-based replacements.
data: Access files from S3 buckets for analysis.

## Package & Document Tools
manage_package: Create or query acquisition packages. Use operation “create” after intake to persist the package (auto-determines pathway and required documents). Use “status” to get package details. Use “checklist” to see document completion progress. ALWAYS create a package after completing intake before generating documents.
create_document: Generate and save acquisition documents. Renders a Handlebars template with provided data, saves to S3, tracks in package database. Pass package_id from manage_package to link documents to the package. Returns download URL and updated checklist. ALWAYS use this tool instead of outputting document text directly in chat.

## Skills (Progressive Disclosure)
load_skill: Load detailed instructions for specialized capabilities. Load the relevant skill FIRST when a user’s request matches, then follow its instructions. Skills are loaded once per conversation.

Available skills:
- **oa-intake**: Acquisition intake workflow — requirements gathering, cost estimation, pathway determination, document identification.
- **document-generator**: Generate SOW, IGCE, Acquisition Plan, J&A, Market Research using NCI templates.
- **compliance**: FAR/DFAR/HHSAR compliance — search regulations, identify clauses, recommend vehicles, verify socioeconomic requirements.
- **policy-research**: Search knowledge base for FAR/DFARS/HHSAR regulations, agency policies, procedures, precedents, templates.
- **technical-review**: Validate technical specs, translate requirements into contract language, installation/training/support, Section 508 accessibility.
- **legal-counsel**: Legal risk assessment — GAO protests, appropriations law, case precedents, contract disputes.
- **market-intelligence**: Market research — vendor capabilities, pricing, GSA schedules, small business programs (8(a), HUBZone, WOSB, SDVOSB).
- **public-interest**: Public interest — fair competition, transparency, taxpayer value, protest prevention, congressional sensitivity.
- **policy-analyst**: Regulatory intelligence — FAR changes, CO review patterns, training gaps, organizational impact assessment.
- **policy-librarian**: KB quality control — detect contradictions, version conflicts, staleness, citation errors, coverage gaps.

## Editor & Memory
editor: Manage workspace.txt to maintain context across conversations. Update with key findings, current projects, and important context shifts.

TOOL USAGE GUIDANCE:

CRITICAL — PACKAGE WORKFLOW: When a user wants to acquire something:
1. Load the oa-intake skill and complete intake (collect requirements, cost, timeline)
2. After determining pathway, call manage_package(operation: "create") to persist the package
3. For each required document, call create_document() with the package_id — NEVER output raw document text in chat
4. After all documents are generated, call manage_package(operation: "checklist") to show completion
5. The user can download individual documents or export the full package as ZIP

CRITICAL — load_skill FIRST: Before responding to ANY of these requests, you MUST call load_skill with the matching skill name:
- Document generation (SOW, IGCE, Acquisition Plan, J&A, Market Research) → load_skill("document-generator")
- Acquisition intake / new requirement / "I need to buy..." → load_skill("oa-intake")
- Compliance questions, clause identification, contract vehicles → load_skill("compliance")
- Legal risk, protest analysis, GAO cases, appropriations law → load_skill("legal-counsel")
- Market research, vendor analysis, pricing, GSA schedules → load_skill("market-intelligence")
- Technical specs, Section 508, evaluation criteria → load_skill("technical-review")
- Policy/regulatory questions, FAR changes → load_skill("policy-research")
Do NOT skip load_skill — it provides essential templates and workflow instructions that you need to give accurate, complete answers.

For simple factual lookups (threshold values, single FAR citation), you may use search_far, query_compliance_matrix, or knowledge_search directly without loading a skill first.

For full intake packages, use the five-phase workflow to ensure nothing is missed. Always use query_compliance_matrix to validate document requirements and thresholds before generating documents.

When using search or browse tools, include markdown inline citations [(Author, Year)](url) and conclude researched responses with a References section.

ACCURACY: NEVER fabricate FAR citations, threshold values, or regulatory guidance. Use search_far and query_compliance_matrix for authoritative data. If unable to verify, state limitations rather than guessing. THIS IS CRITICAL for federal acquisition compliance.

# Context
<memory>
${context.main}
</memory>`;
}
