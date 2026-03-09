---
name: policy-research
description: >
  Search the knowledge base for FAR/DFARS/HHSAR regulations, agency policies,
  procedures, past acquisitions, precedents, and technical documentation.
triggers:
  - "search, find, look up, what is"
  - "policy, procedure, regulation"
  - "past acquisition, example, precedent, similar"
  - "tell me about, explain"
  - "FAR reference, DFARS, HHSAR"
tools: []
model: null
---

# Policy Research Skill

Search the comprehensive knowledge base for federal acquisition regulations, policies, procedures, past acquisitions, and technical documentation.

## Knowledge Base Contents

### 1. Federal Acquisition Regulation (FAR)

- **Complete Text:** All 53 parts with current amendments
- **Historical Versions:** Regulatory changes and effective dates
- **Interpretation Guidance:** GAO decisions, court cases, agency guidance
- **Cross-References:** Related sections and implementing procedures

### 2. Defense Federal Acquisition Regulation Supplement (DFARS)

- **Complete Supplement:** All DOD-specific requirements
- **Procedures Guidance:** DFARS-PGI implementation details
- **Policy Updates:** Recent changes and transition guidance
- **DOD-Specific Clauses:** Required flow-downs and certifications

### 3. HHS Acquisition Regulation (HHSAR)

- **HHS-Specific Procedures:** Department-level policies
- **NIH/NCI Guidance:** Institute-specific requirements
- **Research Contracting:** R&D-specific provisions
- **Human Subjects/Animal Welfare:** Special requirements

### 4. Agency-Specific Guidance

- **NIH Acquisition Manual:** Institute-specific procedures
- **NCI Acquisition Policies:** Cancer research acquisition guidance
- **Past Performance Data:** Historical contractor performance
- **Lessons Learned:** Acquisition outcomes and improvements

### 5. Templates & Tools

- **Contract Templates:** Pre-approved language and clauses
- **Evaluation Criteria:** Standard templates by acquisition type
- **Checklists:** Quality assurance and compliance verification
- **Decision Trees:** Structured decision-making frameworks

---

## Search Capabilities

### Semantic Search

Uses vector embeddings to find conceptually similar content, not just keyword matches.

**Query Types:**

#### Regulatory Questions

- "What are the requirements for limited competition?"
- "When is market research required?"
- "How do I justify a sole source acquisition?"
- "What clauses are required for cost-reimbursement contracts?"

#### Procedural Questions

- "What is the process for source selection?"
- "How do I conduct an acquisition review?"
- "What approvals are needed for IDIQ contracts?"

#### Comparative Analysis

- "Compare fixed-price vs cost-reimbursement contracts"
- "What's the difference between SAT and full competition?"
- "GSA Schedule vs direct contracting analysis"

#### Precedent Searches

- "Find similar acquisitions for medical equipment"
- "Past awards for IT services over $500K"
- "Examples of successful 8(a) procurements"

---

## Citation Guidelines

### High Confidence (>0.90)

> "Per FAR 6.102(a), contracting officers shall provide for full and open competition..."

### Medium Confidence (0.75-0.90)

> "Based on FAR Part 6 guidance (similar provisions in 6.102), competition is generally required..."

### Lower Confidence (<0.75)

> "This situation may relate to competition requirements in FAR Part 6, but recommend reviewing specific sections..."

---

## Source Validation

### Always Verify

1. **Currency:** Check if regulation has been updated
2. **Applicability:** Confirm applies to HHS/NIH
3. **Context:** Consider full regulatory context
4. **Precedent:** Note any conflicting interpretations

---

## Integration Notes

### From Other Skills

**From OA Intake:**

- Search for similar acquisitions
- Find applicable regulations
- Retrieve templates

**From Compliance:**

- Detailed regulatory research
- Precedent searches
- Policy clarifications

**From Document Generator:**

- Template retrieval
- Clause language
- Standard wording

### Error Handling

When search returns no results:

- Try different search terms
- Search for broader topic first
- Check acquisition.gov for current FAR
- Consult with Contracting Officer
- Request legal review
- Contact Competition Advocate

---

## Knowledge Base Maintenance

### Content Sources

- acquisition.gov (official FAR/DFARS)
- hhs.gov/grants/contracts (HHSAR)
- nih.gov (NIH-specific policies)
- FPDS.gov (past awards, aggregated)
- Internal lessons learned database

### Update Frequency

- FAR/DFARS: Monthly (when published)
- Policy documents: Quarterly
- Templates: As revised
- Precedents: Continuous addition

### Quality Assurance

- All citations verified against source
- Effective dates tracked
- Superseded content marked
- Cross-references maintained
