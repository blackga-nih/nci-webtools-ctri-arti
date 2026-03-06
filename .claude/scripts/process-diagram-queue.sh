#!/usr/bin/env bash
# =============================================================================
# EAGLE diagram queue processor
#
# Reads .claude/diagram-update-queue.json and reports which diagrams need
# regeneration.  Pass --clear to remove all processed entries from the queue.
#
# Usage:
#   bash .claude/scripts/process-diagram-queue.sh           # inspect only
#   bash .claude/scripts/process-diagram-queue.sh --clear   # inspect + clear
#   bash .claude/scripts/process-diagram-queue.sh --help
#
# To regenerate the diagrams themselves, run inside Claude Code:
#   /excalidraw update queued diagrams
# =============================================================================

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
QUEUE_FILE="${REPO_ROOT}/.claude/diagram-update-queue.json"

# ---------------------------------------------------------------------------
# usage
# ---------------------------------------------------------------------------
usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Options:
  --clear   Clear all entries from the queue after printing them
  --help    Show this help message

Examples:
  # Inspect the queue without modifying it
  bash .claude/scripts/process-diagram-queue.sh

  # Inspect and then clear the queue
  bash .claude/scripts/process-diagram-queue.sh --clear
EOF
}

# ---------------------------------------------------------------------------
# parse_args
# ---------------------------------------------------------------------------
DO_CLEAR=0
for arg in "$@"; do
    case "$arg" in
        --clear) DO_CLEAR=1 ;;
        --help|-h) usage; exit 0 ;;
        *) echo "Unknown option: $arg"; usage; exit 1 ;;
    esac
done

# ---------------------------------------------------------------------------
# Verify queue file exists
# ---------------------------------------------------------------------------
if [[ ! -f "$QUEUE_FILE" ]]; then
    echo "[EAGLE] Queue file not found: $QUEUE_FILE"
    echo "[EAGLE] Nothing to process."
    exit 0
fi

# ---------------------------------------------------------------------------
# Read and parse the queue.  We avoid requiring Python/jq by parsing the
# JSON manually with bash + grep/sed — valid for the simple object format
# written by the post-commit hook.
# ---------------------------------------------------------------------------

# Count entries: each entry starts with a `{` on its own line or inline
entry_count=0
declare -a entries=()

# Read non-empty lines that look like JSON objects
while IFS= read -r line; do
    line="${line#"${line%%[![:space:]]*}"}"  # ltrim
    line="${line%"${line##*[![:space:]]}"}"  # rtrim
    # Skip array brackets and empty lines
    [[ "$line" == "[" || "$line" == "]" || -z "$line" ]] && continue
    # Strip trailing comma if present
    line="${line%,}"
    [[ "$line" == "{"*"}" ]] && { entries+=("$line"); (( entry_count++ )) || true; }
done < "$QUEUE_FILE"

# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------
echo "============================================================"
echo " EAGLE Diagram Update Queue"
echo " File: $QUEUE_FILE"
echo "============================================================"

if (( entry_count == 0 )); then
    echo " Queue is empty — no diagrams pending regeneration."
    echo "============================================================"
    exit 0
fi

echo " Pending entries: ${entry_count}"
echo ""

# ---------------------------------------------------------------------------
# Extract fields from each JSON entry using parameter expansion.
# The format written by the hook is predictable:
#   {"timestamp":"...","expert":"...","diagram":"...","commit":"..."}
# ---------------------------------------------------------------------------
extract_field() {
    local json="$1"
    local field="$2"
    # Extract value after "field":"  up to the next "
    local value="${json#*\"${field}\":\"}"
    value="${value%%\"*}"
    echo "$value"
}

idx=1
for entry in "${entries[@]}"; do
    ts="$(extract_field "$entry" "timestamp")"
    expert="$(extract_field "$entry" "expert")"
    diagram="$(extract_field "$entry" "diagram")"
    commit="$(extract_field "$entry" "commit")"

    echo "  [${idx}] Expert   : ${expert}"
    echo "       Diagram  : ${diagram}"
    echo "       Commit   : ${commit}"
    echo "       Queued   : ${ts}"
    echo ""
    (( idx++ )) || true
done

echo "============================================================"
echo ""
echo "To regenerate these diagrams, run inside Claude Code:"
echo '  /excalidraw update queued diagrams'
echo ""

# ---------------------------------------------------------------------------
# Clear the queue if requested
# ---------------------------------------------------------------------------
if (( DO_CLEAR == 1 )); then
    echo "[]" > "$QUEUE_FILE"
    echo "[EAGLE] Queue cleared. ($entry_count entries removed)"
    echo ""
else
    echo "[EAGLE] Queue NOT cleared. Run with --clear to remove entries after regeneration."
    echo ""
fi
