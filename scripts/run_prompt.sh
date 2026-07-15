#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <prompt-file> [workspace]" >&2
  exit 2
fi

PROMPT_FILE="$1"
WORKSPACE="${2:-$(pwd)}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -f "$PROMPT_FILE" ]]; then
  if [[ -f "$ROOT/$PROMPT_FILE" ]]; then
    PROMPT_FILE="$ROOT/$PROMPT_FILE"
  else
    echo "Prompt not found: $PROMPT_FILE" >&2
    exit 2
  fi
fi

if ! command -v codex >/dev/null 2>&1; then
  echo "Codex CLI is not installed or not on PATH." >&2
  echo "Open the prompt manually from: $PROMPT_FILE" >&2
  exit 127
fi

mkdir -p "$WORKSPACE/.codex-runs"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="$WORKSPACE/.codex-runs/$(basename "$PROMPT_FILE" .md)-$STAMP.jsonl"

cd "$WORKSPACE"
# Review `codex exec --help` after upgrading the CLI. This command deliberately
# grants workspace write access, not unrestricted host access.
codex exec --sandbox workspace-write --json "$(cat "$PROMPT_FILE")" | tee "$LOG"
echo "Codex trace: $LOG"
