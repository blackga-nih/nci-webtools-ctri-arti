# EAGLE Diagram Update Hook

## Overview

The post-commit git hook at `.git/hooks/post-commit` watches every commit and
automatically queues Excalidraw architecture diagram updates for any expert
domains whose source files were touched.

The hook is intentionally **fast** — it only writes to a queue file.  No
diagram regeneration happens at commit time.  You control when regeneration
runs.

---

## How It Works

```
git commit
    └── .git/hooks/post-commit
            ├── git diff HEAD~1..HEAD --name-only  (list changed files)
            ├── map each file → expert domain(s)   (pattern matching table)
            ├── look up domain in diagram registry
            └── append JSON entry to .claude/diagram-update-queue.json
```

After one or more commits have queued updates you run the processor:

```bash
# Inspect what is pending (non-destructive)
bash .claude/scripts/process-diagram-queue.sh

# Ask Claude Code to regenerate the diagrams
# (inside a Claude Code session)
/excalidraw update queued diagrams

# Clear the queue once diagrams have been regenerated
bash .claude/scripts/process-diagram-queue.sh --clear
```

---

## File-to-Expert Mapping

| File path pattern | Expert domain(s) |
|---|---|
| `infrastructure/cdk-eagle/**` | `deployment` |
| `.github/workflows/**` | `deployment`, `git` |
| `server/app/**` | `backend` |
| `server/tests/**` | `test` |
| `client/**` | `frontend` |
| `eagle-plugin/**` | `backend` |
| `.claude/commands/experts/deployment/**` | `deployment` |
| `.claude/commands/experts/frontend/**` | `frontend` |
| `.claude/commands/experts/test/**` | `test` |
| `.claude/commands/experts/backend/**` | `backend` |
| `.claude/commands/experts/aws/**` | `aws` |
| `.claude/commands/experts/cloudwatch/**` | `cloudwatch` |
| `.claude/commands/experts/eval/**` | `eval` |
| `.claude/commands/experts/git/**` | `git` |

A single changed file can map to **multiple** domains (e.g. a workflow file
maps to both `deployment` and `git`).

---

## Diagram Registry

Only domains with a registered diagram file trigger a queue entry.  The
registry lives inside `.git/hooks/post-commit` in the `DIAGRAM_MAP` array:

```bash
DIAGRAM_MAP["deployment"]="docs/architecture/diagrams/excalidraw/20260306-120000-arch-expert-deployment-v1.excalidraw"
DIAGRAM_MAP["frontend"]="docs/architecture/diagrams/excalidraw/20260306-120100-arch-expert-frontend-v1.excalidraw"
DIAGRAM_MAP["test"]="docs/architecture/diagrams/excalidraw/20260306-120200-arch-expert-test-v1.excalidraw"
```

Domains without an entry in `DIAGRAM_MAP` (`backend`, `aws`, `cloudwatch`,
`eval`, `git`) are detected but silently skipped.

---

## Adding a New Diagram Mapping

1. Create the Excalidraw diagram file following the naming convention:
   ```
   docs/architecture/diagrams/excalidraw/YYYYMMDD-HHMMSS-arch-expert-{domain}-v1.excalidraw
   ```

2. Add an entry to the `DIAGRAM_MAP` in `.git/hooks/post-commit`:
   ```bash
   DIAGRAM_MAP["backend"]="docs/architecture/diagrams/excalidraw/20260307-100000-arch-expert-backend-v1.excalidraw"
   ```

3. If you need to map additional file patterns to a domain, add a condition
   in the `map_file_to_domains()` function in the same hook file.

---

## Queue File Format

`.claude/diagram-update-queue.json` stores a JSON array where each element
is an object written by the hook:

```json
[
  {
    "timestamp": "2026-03-06T14:23:01Z",
    "expert": "deployment",
    "diagram": "docs/architecture/diagrams/excalidraw/20260306-120000-arch-expert-deployment-v1.excalidraw",
    "commit": "b6f4bc5abc1234..."
  }
]
```

The file is valid JSON at all times.  The processor script resets it to `[]`
when called with `--clear`.

---

## Reinstalling the Hook

The hook lives in `.git/hooks/` which is not tracked by git.  If you clone the
repo fresh you need to reinstall it:

```bash
cp .claude/hooks/post-commit.template .git/hooks/post-commit  # if a template is added later
# or re-run the setup that created it originally
chmod +x .git/hooks/post-commit
```

Consider adding the hook source to a tracked location
(e.g. `.claude/hooks/post-commit.sh`) and symlinking or copying it into
`.git/hooks/` as part of your dev environment bootstrap.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Hook does not run | Not executable | `chmod +x .git/hooks/post-commit` |
| Queue file missing | First run | Hook auto-creates it via `ensure_queue_file()` |
| No entries queued after commit | Changed files matched no domain | Check `map_file_to_domains()` patterns |
| Domain matched but no queue entry | Domain has no diagram registered | Add entry to `DIAGRAM_MAP` in the hook |
| JSON parse error in processor | Manual edit corrupted the file | Reset with `echo '[]' > .claude/diagram-update-queue.json` |
