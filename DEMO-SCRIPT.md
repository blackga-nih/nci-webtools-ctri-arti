# EAGLE Acquisition Package Demo Script

**Date:** Friday, March 20, 2026
**Duration:** ~15 minutes
**URL:** http://localhost:8080

---

## Pre-Demo Checklist

```bash
# 1. Refresh AWS credentials
aws sso login --profile eagle

# 2. Start server (if not running)
cd ~/Desktop/eagle/nci-webtools-ctri-arti && npm start

# 3. Verify health
curl -s http://localhost:8080/api/v1/status
# Expected: {"version":"1.0.0", ...}
```

---

## Demo Flow (12 steps)

### Act 1: Intelligent Intake

#### Step 1: Open Chat UI

- Navigate to **http://localhost:8080/tools/chat**
- Log in via local OIDC (any email)
- Show the clean interface: model selector (Sonnet 4.6 default), tool icons

#### Step 2: Start Acquisition Intake

**Type this prompt:**

> I need to procure cloud hosting services for our research data platform. Estimated value around $750,000.

**Expected behavior:**

- EAGLE loads the `oa-intake` skill (tool call visible in trace)
- Asks 2-3 clarifying questions (period of performance, existing vehicles, data sensitivity)
- Does NOT jump straight to document generation

#### Step 3: Answer Clarifying Questions

**Type this response:**

> 3-year base period plus 2 option years, starting October 2026. No existing vehicles — new standalone contract. We need FedRAMP High for PII and genomics research data. Full and open competition preferred. Fixed-price.

**Expected behavior:**

- EAGLE determines pathway: **Full Competition** (>$350K threshold)
- Calls `manage_package` to create the package
- Shows checklist: SOW, IGCE, Market Research, Acquisition Plan (4 docs required)
- Suggests generating the Statement of Work first

#### Step 4: Show Packages Page

- Open **http://localhost:8080/tools/workflows** in a new tab
- The new package card should appear with:
  - Title: "Cloud Hosting Services..."
  - Pathway badge: `full_competition`
  - Status: `intake`
  - Progress: 0/4 documents

### Act 2: Document Generation

#### Step 5: Generate the Statement of Work

**Back in chat, type:**

> Generate the Statement of Work

**Expected behavior:**

- EAGLE loads `document-generator` skill
- Calls `create_document` with template data
- Shows tool result card with NCI-branded PDF download link
- Package progress updates to 1/4 (25%)
- Note the **DRAFT** watermark visible in the PDF output

#### Step 6: Generate Remaining Documents

**Type this prompt:**

> Generate the IGCE, Market Research Report, and Acquisition Plan for this package.

**Expected behavior:**

- EAGLE calls `create_document` three times in sequence
- Each call shows a tool result card with its own download link
- Package progress updates: 2/4 → 3/4 → 4/4 (100%)
- Package status auto-advances to `review`

**Talking point:** One conversation generates an entire acquisition package — no switching between tools or copy-pasting.

### Act 3: Review & Revise

#### Step 7: Revise a Document

**Type this prompt:**

> The SOW needs a Section 508 accessibility requirement added under Task 2. Please regenerate it.

**Expected behavior:**

- EAGLE calls `create_document` again with the updated requirement
- SOW version increments to v2
- Old v1 still accessible in version history
- Download link points to the new v2 PDF

**Talking point:** Documents are living artifacts — versioned, editable, never locked until finalized.

### Act 4: Package Export

#### Step 8: Export Package as ZIP

- Switch to the **Packages** page (`/tools/workflows`)
- Click the package card to open the detail modal
- Click the **Export ZIP** button
- Open the downloaded ZIP and show:
  - `manifest.json` — package metadata snapshot
  - `/sow/` folder — `.md`, `.pdf`, `.docx` (NCI-branded, DRAFT watermark)
  - `/igce/`, `/market_research/`, `/acquisition_plan/` — same three formats each
- **Total: 12 files** (4 doc types × 3 formats) + manifest

**Talking point:** Entire package exported in one click. PDF/DOCX branded with NCI headers/footers. Ready for submission or further review.

### Act 5: Admin & Observability

#### Step 9: Show Admin Dashboard

- Navigate to **http://localhost:8080/\_/admin**
- Highlight:
  - Total packages count
  - Total requests and cost
  - Active users

#### Step 10: Show Skills Page

- Click through to **http://localhost:8080/\_/admin/skills**
- 10 specialist skills listed with descriptions
- Point out: oa-intake, document-generator, compliance, legal-counsel

#### Step 11: Show Templates Page

- Navigate to **http://localhost:8080/\_/admin/templates**
- 5 document templates: SOW, IGCE, Acquisition Plan, J&A, Market Research
- Each shows Handlebars placeholders

#### Step 12: Show Trace Viewer & Cost Tracking

- Navigate to **http://localhost:8080/\_/admin/traces**
- Click on the most recent trace
- Show tool calls: `load_skill`, `manage_package`, `create_document`
- Show input/output tokens, latency
- Navigate to **http://localhost:8080/\_/admin/costs**
- Token costs per request, model breakdown
- Total spend across all conversations

---

## Talking Points

**Architecture:**

- Single-agent with progressive disclosure (skills loaded on demand, not all at once)
- 10 specialist skills, only 1-2 loaded per conversation
- Deterministic compliance matrix (no hallucinated thresholds)
- S3-backed document storage with versioning

**Key Thresholds (FAC 2025-06):**

- Micro-purchase: <$15K
- Simplified Acquisition: $15K-$350K
- Full Competition: >$350K
- Subcontracting Plan: >$750K

**Document Pipeline:**

- Markdown → PDF + DOCX generated in parallel on the server
- NCI branding: blue headers/footers, DRAFT watermarks, Calibri font
- Versioned in S3 with full history (v1, v2, ...)
- ZIP export includes manifest.json for package reconstruction

**Lifecycle:**

- Intake → Generate → Review/Edit → Export → Submit
- All within one conversation thread
- Package status auto-advances as documents complete

**Model:** Claude Sonnet 4.6 (1M context, cross-region inference via Bedrock)

---

## Fallback: If Bedrock is Slow or Creds Expire

1. The Packages page always shows pre-existing packages (12 already seeded)
2. Admin pages are data-driven from DB — always render
3. If model is unresponsive, show the admin pages and explain the chat flow verbally
4. Re-authenticate: `aws sso login --profile eagle`, then restart server

---

## Key Metrics to Quote

- 10 skills, 5 templates, 256 knowledge base documents
- 5 acquisition pathways (micro, simplified, full competition, sole source, IDIQ)
- Deterministic compliance: FAR/DFARS/HHSAR coverage
- Sub-3-second inference latency on Sonnet 4.6
