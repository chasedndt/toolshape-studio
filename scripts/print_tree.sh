#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if command -v tree >/dev/null 2>&1; then
  tree -a -I '.git|*.zip' "$ROOT"
else
  find "$ROOT" -path '*/.git' -prune -o -type f -print | sed "s#^$ROOT/##" | sort
fi
