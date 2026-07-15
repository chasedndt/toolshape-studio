#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec "$ROOT/scripts/run_prompt.sh" "$ROOT/prompts/02-studio-foundation.md" "${1:-$PWD}"
