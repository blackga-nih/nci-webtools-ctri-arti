# The Power and Simplicity of Skills

## Overview

Skills enable **progressive disclosure** — agents discover capabilities as needed rather than loading everything upfront. This prevents context window overload while giving agents rich capabilities.

---

## The Problem Skills Solve

Traditional approaches (MCP servers, long global rules) dump all tools/context into the LLM immediately — even capabilities it will never use in a given conversation. This overwhelms the agent.

**Skills fix this with 3 layers of progressive disclosure:**

1. **Layer 1 — Description (system prompt):** ~50–100 words describing the capability. Agent knows *when* to use it without loading full instructions. (~5% of total skill context)
2. **Layer 2 — skill.md:** Full instructions for the capability, loaded on demand via a tool call. (~300–500 lines, ~30% of total context)
3. **Layer 3 — Reference documents:** Optional deeper context (API references, scripts, forms) referenced from skill.md for complex sub-tasks.

---

## How to Build Skills into Any Agent

### System Prompt (Dynamic)
- Static base instructions + dynamically injected skill descriptions (YAML front matter from all `skill.md` files)
- Each skill entry includes: description + path to `skill.md`
- Tell the agent explicitly what skills are and how to invoke them — LLMs don't understand this by default

### Tools Needed
1. **`load_skill(name)`** — reads and returns the `skill.md` for a given skill; injects it into context
2. **`read_reference(skill, path)`** — reads a reference doc for a skill (layer 3)
3. **`list_references(skill)`** — lists available reference docs so agent can discover them even if not mentioned in `skill.md`

### Skill Directory Structure
```
skills/
  weather/
    skill.md          # YAML front matter (description) + full instructions
    reference/        # Optional: API docs, scripts, etc.
  recipe-finder/
    skill.md
  world-clock/
    skill.md          # Simple skill — no reference docs needed
```

---

## Building Skills

- Use **Claude Desktop → Settings → Capabilities → Skills → skill-creator** to scaffold new skills interactively
- skill-creator is itself a skill — it applies best practices from Anthropic's guide to help you build well-structured skills
- Drop the resulting `skill.md` (+ optional reference folder) into your skills directory — agent picks it up automatically on next run

---

## Reliability: Evals & Observability

### Evals (Local Testing)
- Use a YAML-based test suite: define questions + expected skill(s) that should be loaded
- Custom evaluator checks that the correct skill was invoked for each test case
- Run after every change to system prompt or skill descriptions
- Pydantic AI has a built-in eval framework; similar concepts apply to any framework
- Use a cheap/fast model (e.g. Haiku) for eval runs

### Observability (Production)
- **Logfire** (by Pydantic team) instruments all agent tool calls and LLM interactions as traces
- View token usage, costs, full tool call parameters for any user session
- Essential for debugging production issues and monitoring skill usage patterns

---

## Key Takeaways

- Skills are **framework-agnostic** — works with LangChain, Crew AI, Agno, raw API calls, local AI, any model
- The agent only pays the context cost for a skill when it actually needs it
- A well-described skill set of dozens of skills is still manageable because only 1–2 are loaded per conversation
- Evals + observability are non-negotiable for production agent deployments

---

## EAGLE Implementation Analysis

### Mapping to EAGLE's Architecture

| Concept | Claude Code Skills | EAGLE Equivalent | Status |
|---|---|---|---|
| Layer 1 (descriptions) | YAML frontmatter in SKILL.md | Tool descriptions in `config.js` system prompt | Exists |
| Layer 2 (full instructions) | `load_skill()` tool call | — | **Not yet built** |
| Layer 3 (reference docs) | `read_reference()` tool call | `browse` and `data` tools (partial) | Partial |
| Code execution | Bash, Read, Write | `code` tool (browser sandbox JS/HTML) | Exists (browser-only) |
| Tool dispatch loop | Claude Code internal | `hooks.js:623-768` (client-side agentic loop) | Exists |

### What EAGLE Already Has

- **7 tools**: `search`, `browse`, `code`, `editor`, `think`, `data`, `docxTemplate`
- **Code execution**: JavaScript/HTML in sandboxed iframe/Worker (no bash, no server-side eval)
- **S3 file access**: `data` tool reads from S3 buckets
- **Agentic loop**: Client-side tool dispatch with automatic tool_use → tool_result cycling
- **CloudWatch logging**: Captures every Bedrock call including tool invocations (`/eagle/inference`)

### What's Needed for Skills

No bash access required. Two new tools + a system prompt update:

1. **`load_skill(name)`** — fetches a skill's full instructions from S3/DB/filesystem, returns as context
2. **`list_skills()`** (optional) — returns available skill names + descriptions for discovery
3. **System prompt injection** — append short skill descriptions (Layer 1) dynamically so the model knows when to call `load_skill()`

Skills can be stored as markdown files in S3 (`rh-eagle-files` bucket), in the database `Tool` table, or in the `eagle-plugin/` directory. The `data` tool already reads S3, so `load_skill` is essentially a thin wrapper.

### Why Bash Access Isn't Needed

The progressive disclosure pattern is about **context management**, not code execution. The model loads instructions on demand and then uses its existing tools (`code`, `search`, `browse`, `editor`, `docxTemplate`) to act on them. The browser sandbox is sufficient for calculations, data processing, and document generation.

---

*Source: YouTube transcript — "The Power and Simplicity of Skills" (Pydantic AI skills agent walkthrough)*
