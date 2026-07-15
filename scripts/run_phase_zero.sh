#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec "$ROOT/scripts/run_prompt.sh" "$ROOT/prompts/00-phase-zero-reference-kernel.md" "${1:-$PWD}"
