---
description: Test a full complex acquisition package flow — intake, IGCE, SOW, Acquisition Plan, document viewer refinement, and download all three docs as Word
argument-hint: [url]
---

# EAGLE Complex Acquisition Package Test

End-to-end flow for a complex ($2.1M, full-and-open competitive) IT services acquisition. Tests the
full lifecycle: OA intake → IGCE generation → SOW generation → Acquisition Plan → document viewer
refinement → multi-doc download. Covers specialist routing (market-intelligence, legal-counsel,
document-generator) and multi-turn context retention.

## Variables

| Variable | Value | Description |
| -------- | ----- | ----------- |
| SKILL | `claude-bowser` | Uses your real Chrome |
| MODE | `headed` | Visible browser |
| URL | `{PROMPT}` or `http://localhost:3000` | Base URL |

If {PROMPT} contains a URL use it, otherwise default to `http://localhost:3000`.

---

## Pre-flight

1. Navigate to `{URL}/chat`
2. Wait up to 10 seconds for the page to load
3. If a login page appears, report **FAIL — Not authenticated** and stop
4. Click "New Chat" in the sidebar to start a clean session
5. Wait for the welcome screen to appear
6. Take a screenshot — save as `acq-pkg-00-preflight.png`

---

## Phase 1: Acquisition Intake

7. Click the chat textarea and type exactly:
   `I need to procure IT advisory and program management services for NCI's Cancer Informatics program. Estimated value is $2.1M over a 3-year base plus two 1-year options. We want full-and-open competition. The current contract expires in 6 months. We have a previous contract — HHSN261201800042I — as our baseline. What does EAGLE need to start the acquisition?`
8. Press Enter and wait up to 60 seconds for EAGLE to respond
9. Take a screenshot — save as `acq-pkg-01-intake.png`
10. Verify the response addresses **at least 4** of:
    - Contract value / ceiling: `$2.1M`, `ceiling`, `IDIQ`, or `total value`
    - Period of performance: `3-year`, `base period`, `option year`, or `PoP`
    - Competition: `full-and-open`, `FAR Part 15`, `competitive`, or `open competition`
    - Requirements: `PWS`, `SOW`, `market research`, `requirements document`
    - Timeline: `6 months`, `expiration`, `bridge`, or `acquisition lead time`
    - Prior contract: `HHSN`, `previous contract`, `incumbent`, or `bridge contract`

---

## Phase 2: Market Research Follow-up

11. Click the textarea and type exactly:
    `Run market research for this. Look for small business set-aside potential, NAICS code, and any active GSA vehicles we should consider.`
12. Press Enter and wait up to 60 seconds for EAGLE to respond
13. Take a screenshot — save as `acq-pkg-02-market-research.png`
14. Verify the response contains **at least 3** of:
    - NAICS code: `541511`, `541512`, `541519`, `541611`, `NAICS`, or `principal NAICS`
    - Small business: `small business`, `set-aside`, `Rule of Two`, `8(a)`, or `HUBZone`
    - GSA vehicles: `GSA`, `OASIS`, `8(a) STARS`, `Alliant`, `CIO-SP`, `GWACs`, or `governmentwide`
    - FAR authority: `FAR 19`, `FAR 8.4`, `FAR 16.5`, `task order`, or `set-aside threshold`

---

## Phase 3: IGCE Generation

15. Click the textarea and type exactly:
    `Generate an Independent Government Cost Estimate (IGCE) for this acquisition. Base it on the prior contract value, assume 3% annual escalation, and include labor categories: Program Manager (1 FTE), Senior IT Analyst (3 FTE), IT Specialist (4 FTE). 3-year base plus two option years.`
16. Press Enter and wait up to 90 seconds for EAGLE to respond (doc generation takes longer)
17. Take a screenshot — save as `acq-pkg-03-igce-response.png`
18. Verify a document was generated — look for:
    - A document card/attachment below the response
    - OR text confirming IGCE creation: `IGCE`, `cost estimate`, `generated`, `created`
    - OR a link/button to view the document
19. Verify the response contains labor rate detail: `Program Manager`, `FTE`, `escalation`, `3%`, `option year`, or `Year 1`

---

## Phase 4: SOW Generation

20. Click the textarea and type exactly:
    `Now generate the Statement of Work for this IT advisory and program management contract. Include scope, deliverables with acceptance criteria, key personnel requirements, and a performance monitoring section.`
21. Press Enter and wait up to 90 seconds for EAGLE to respond
22. Take a screenshot — save as `acq-pkg-04-sow-response.png`
23. Verify a second document was generated — look for:
    - A second document card/attachment
    - OR text: `Statement of Work`, `SOW`, `generated`, `created`
24. Verify response quality — contains **at least 3** of:
    - Scope section: `scope`, `objective`, `background`, or `purpose`
    - Deliverables: `deliverable`, `acceptance criteria`, `due date`, or `CDRLs`
    - Key personnel: `key personnel`, `Program Manager`, `resume`, or `substitution`
    - Performance: `performance`, `QASP`, `SLA`, `metric`, or `surveillance`

---

## Phase 5: Acquisition Plan Generation

25. Click the textarea and type exactly:
    `Generate the Acquisition Plan (AP) for this procurement. Reference the IGCE and SOW we just created. Include the acquisition strategy, source selection approach, evaluation factors, and milestone schedule.`
26. Press Enter and wait up to 90 seconds for EAGLE to respond
27. Take a screenshot — save as `acq-pkg-05-ap-response.png`
28. Verify a third document was generated — look for:
    - A third document card/attachment
    - OR text: `Acquisition Plan`, `AP`, `generated`, `created`
29. Verify response quality — contains **at least 3** of:
    - Strategy: `acquisition strategy`, `competitive`, `full-and-open`, or `FAR Part 15`
    - Source selection: `source selection`, `evaluation`, `SSEB`, `technical`, or `past performance`
    - Eval factors: `evaluation factor`, `technical approach`, `management`, or `price/cost`
    - Milestone: `milestone`, `solicitation`, `RFP`, `award date`, or `schedule`

---

## Phase 6: Navigate to Documents and Verify All Three

30. Navigate to `{URL}/documents`
31. Wait up to 5 seconds for the page to load
32. Take a screenshot — save as `acq-pkg-06-doc-list.png`
33. Verify **at least 3 documents** are listed — the IGCE, SOW, and AP from this session
34. Verify each document entry shows: document type badge, title, status, and timestamp

---

## Phase 7: Open SOW Viewer and Refine

35. Click on the SOW document in the list
36. Wait up to 5 seconds for the document viewer to load
37. Take a screenshot — save as `acq-pkg-07-sow-viewer.png`
38. Verify the viewer shows:
    - Left panel: document title, View/Edit toggle, Download button, non-empty SOW content
    - Right panel: Document Assistant chat header + textarea
39. In the right panel textarea, type:
    `Add a section on Government-Furnished Equipment (GFE) and data rights, with a placeholder for the list of GFE items.`
40. Press Enter and wait up to 45 seconds for the assistant to respond
41. Take a screenshot — save as `acq-pkg-08-sow-refined.png`
42. Verify:
    - The Document Assistant responded in the right panel
    - The left panel SOW content updated (may show "Updated" badge briefly)
    - The new content contains `GFE`, `government-furnished`, `data rights`, or `intellectual property`

---

## Phase 8: Download All Three Documents

43. While still in the SOW viewer, click the Download button
44. If a format dropdown appears, click the Word (.docx) option
45. Wait up to 10 seconds — verify the file download starts
46. Take a screenshot — save as `acq-pkg-09-sow-download.png`
47. Navigate back to `{URL}/documents`
48. Click on the IGCE document
49. Download it as Word — verify download starts
50. Take a screenshot — save as `acq-pkg-10-igce-download.png`
51. Navigate back to `{URL}/documents`
52. Click on the AP document
53. Download it as Word — verify download starts
54. Take a screenshot — save as `acq-pkg-11-ap-download.png`

---

## Phase 9: Report Results

Report **PASS** or **FAIL** for each check:

| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| Intake response: 4+ indicators | Contract value, PoP, competition, timeline | | |
| Market research: 3+ indicators | NAICS, small business, GSA vehicles | | |
| IGCE generated | Document card or confirmation text | | |
| IGCE contains labor detail | FTE, escalation, option years | | |
| SOW generated | Document card or confirmation text | | |
| SOW quality: 3+ indicators | Scope, deliverables, key personnel, QASP | | |
| AP generated | Document card or confirmation text | | |
| AP quality: 3+ indicators | Strategy, source selection, eval factors | | |
| Documents page: 3 docs listed | IGCE + SOW + AP visible | | |
| SOW viewer loads | Left content + right assistant panels | | |
| SOW refinement works | GFE/data rights section added | | |
| SOW downloaded | .docx download initiates | | |
| IGCE downloaded | .docx download initiates | | |
| AP downloaded | .docx download initiates | | |

**Overall result**: PASS only if ALL 14 checks pass.

If any check fails, include:
- Which specialist agent handled each phase (check activity panel or console)
- Whether document cards appeared in chat or only text confirmation
- Whether /documents showed all 3 docs or fewer
- Whether the Document Assistant updated the left panel content
- Any routing errors, empty responses, or streaming failures
- Console errors related to document generation or specialist dispatch
