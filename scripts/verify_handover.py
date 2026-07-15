#!/usr/bin/env python3
"""Static verification for the Toolshape harness-native handover pack.

This validates the handover itself. It does not claim that future product code,
Windows integration, media rendering, model providers, or legal clearance have
been implemented or proven.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from urllib.parse import unquote

try:
    from jsonschema import Draft202012Validator
    from referencing import Registry, Resource
except ImportError as exc:  # pragma: no cover - environment guard
    print("ERROR: install jsonschema>=4.18 to run schema validation", file=sys.stderr)
    raise SystemExit(2) from exc

ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = ROOT / "VALIDATION.md"
TREE_PATH = ROOT / "TREE.txt"
MANIFEST_PATH = ROOT / "MANIFEST.sha256"


@dataclass
class Result:
    checks: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    def ok(self, message: str) -> None:
        self.checks.append(message)

    def warn(self, message: str) -> None:
        self.warnings.append(message)

    def fail(self, message: str) -> None:
        self.errors.append(message)


REQUIRED_FILES = [
    "README.md",
    "AGENTS.md",
    "decisions.json",
    "docs/01-agent-native-constitution.md",
    "docs/02-chaseos-hierarchy.md",
    "docs/03-reference-architecture.md",
    "docs/11-security-secrets-privacy.md",
    "products/voice/PRD.md",
    "products/voice/WINDOWS-INTEGRATION.md",
    "products/voice/CODEX-HANDOVER.md",
    "products/studio/PRD.md",
    "products/studio/FEATURES-21.md",
    "products/studio/CODEX-HANDOVER.md",
    "platform/semantic-kernel/HANDOFF.md",
    "platform/conformance/HANDOFF.md",
    "research/SOURCES.json",
    "research/READING-PACK.md",
    "book/harness-native-software-playbook.md",
    "naming/COLLISION-SCAN.md",
    "naming/NAME-CANDIDATES.md",
    "prompts/00-phase-zero-reference-kernel.md",
    "prompts/01-voice-foundation.md",
    "prompts/02-studio-foundation.md",
    "prompts/03-security-conformance.md",
    "prompts/04-research-refresh.md",
    "prompts/05-parallel-orchestrator.md",
]

EXAMPLE_TO_SCHEMA = {
    "anac-manifest.example.json": "anac-manifest.schema.json",
    "capability.example.json": "capability.schema.json",
    "operation.example.json": "operation-envelope.schema.json",
    "operation-result.example.json": "operation-result.schema.json",
    "job.example.json": "job.schema.json",
    "approval.example.json": "approval.schema.json",
    "error.example.json": "error.schema.json",
    "artifact.example.json": "artifact.schema.json",
    "provenance.example.json": "provenance.schema.json",
    "secret-handle.example.json": "secret-handle.schema.json",
    "style-profile.example.json": "style-profile.schema.json",
    "workflow-recipe.example.json": "workflow-recipe.schema.json",
}

IGNORED_GENERATED = {REPORT_PATH, TREE_PATH, MANIFEST_PATH}


def iter_files() -> list[Path]:
    return sorted(
        p
        for p in ROOT.rglob("*")
        if p.is_file() and ".git" not in p.parts and p not in IGNORED_GENERATED
    )


def check_required(result: Result) -> None:
    missing = [name for name in REQUIRED_FILES if not (ROOT / name).is_file()]
    if missing:
        for name in missing:
            result.fail(f"Missing required file: `{name}`")
    else:
        result.ok(f"Required-file check passed ({len(REQUIRED_FILES)} files).")


def parse_json(result: Result) -> dict[Path, object]:
    parsed: dict[Path, object] = {}
    json_files = sorted(ROOT.rglob("*.json"))
    for path in json_files:
        try:
            parsed[path] = json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001 - report every parse failure
            result.fail(f"JSON parse failed for `{path.relative_to(ROOT)}`: {exc}")
    if len(parsed) == len(json_files):
        result.ok(f"All JSON files parsed ({len(parsed)} files).")
    return parsed


def schema_registry(parsed: dict[Path, object], result: Result) -> Registry:
    registry = Registry()
    schema_paths = sorted((ROOT / "specs").glob("*.schema.json"))
    for path in schema_paths:
        contents = parsed.get(path)
        if not isinstance(contents, dict):
            continue
        schema_id = contents.get("$id")
        if not isinstance(schema_id, str):
            result.fail(f"Schema has no string $id: `{path.relative_to(ROOT)}`")
            continue
        try:
            Draft202012Validator.check_schema(contents)
            registry = registry.with_resource(schema_id, Resource.from_contents(contents))
        except Exception as exc:  # noqa: BLE001
            result.fail(f"Invalid Draft 2020-12 schema `{path.relative_to(ROOT)}`: {exc}")
    if not any("Invalid Draft" in error for error in result.errors):
        result.ok(f"Schema meta-validation passed ({len(schema_paths)} schemas).")
    return registry


def validate_examples(
    parsed: dict[Path, object], registry: Registry, result: Result
) -> None:
    passed = 0
    for example_name, schema_name in EXAMPLE_TO_SCHEMA.items():
        example_path = ROOT / "specs" / "examples" / example_name
        schema_path = ROOT / "specs" / schema_name
        example = parsed.get(example_path)
        schema = parsed.get(schema_path)
        if example is None or not isinstance(schema, dict):
            result.fail(f"Cannot validate `{example_name}` against `{schema_name}`")
            continue
        validator = Draft202012Validator(schema, registry=registry)
        errors = sorted(validator.iter_errors(example), key=lambda item: list(item.path))
        if errors:
            for error in errors:
                location = "/".join(str(part) for part in error.path) or "<root>"
                result.fail(
                    f"Schema validation failed `{example_name}` at `{location}`: "
                    f"{error.message}"
                )
        else:
            passed += 1
    if passed == len(EXAMPLE_TO_SCHEMA):
        result.ok(f"All schema examples validated ({passed} examples).")


def markdown_targets(path: Path) -> Iterable[tuple[str, int]]:
    text = path.read_text(encoding="utf-8", errors="replace")
    pattern = re.compile(r"(?<!!)\[[^\]]*\]\(([^)]+)\)")
    for line_number, line in enumerate(text.splitlines(), 1):
        for match in pattern.finditer(line):
            target = match.group(1).strip().strip("<>")
            yield target, line_number


def check_markdown_links(result: Result) -> None:
    broken: list[str] = []
    checked = 0
    for path in sorted(ROOT.rglob("*.md")):
        for target, line_number in markdown_targets(path):
            if not target or target.startswith(("#", "http://", "https://", "mailto:", "skills://", "sandbox:")):
                continue
            target = unquote(target.split("#", 1)[0].split("?", 1)[0])
            if not target:
                continue
            checked += 1
            candidate = (path.parent / target).resolve()
            try:
                candidate.relative_to(ROOT.resolve())
            except ValueError:
                broken.append(
                    f"`{path.relative_to(ROOT)}:{line_number}` escapes root: `{target}`"
                )
                continue
            if not candidate.exists():
                broken.append(
                    f"`{path.relative_to(ROOT)}:{line_number}` missing target `{target}`"
                )
    if broken:
        for message in broken:
            result.fail(f"Broken Markdown link: {message}")
    else:
        result.ok(f"Relative Markdown-link check passed ({checked} links).")


def check_mermaid(result: Result) -> None:
    files = sorted((ROOT / "diagrams").glob("*.mmd"))
    failures = 0
    for path in files:
        text = path.read_text(encoding="utf-8").strip()
        if not text:
            result.fail(f"Empty Mermaid file: `{path.relative_to(ROOT)}`")
            failures += 1
        elif not re.match(r"^(flowchart|graph|sequenceDiagram|stateDiagram|classDiagram)", text):
            result.fail(
                f"Mermaid file has unrecognized first declaration: `{path.relative_to(ROOT)}`"
            )
            failures += 1
    if not failures:
        result.ok(f"Mermaid source check passed ({len(files)} diagrams).")


def check_placeholders(result: Result) -> None:
    hits: list[str] = []
    terms = ("TO" + "DO", "T" + "BD", "FIX" + "ME", "PLACE" + "HOLDER")
    pattern = re.compile(r"\b(" + "|".join(terms) + r")\b")
    for path in iter_files():
        if path.resolve() == Path(__file__).resolve():
            continue
        if path.suffix.lower() not in {".md", ".json", ".mmd", ".py", ".sh"}:
            continue
        for line_number, line in enumerate(
            path.read_text(encoding="utf-8", errors="replace").splitlines(), 1
        ):
            if pattern.search(line):
                hits.append(f"`{path.relative_to(ROOT)}:{line_number}`")
    if hits:
        result.warn("Placeholder markers remain: " + ", ".join(hits[:20]))
    else:
        result.ok("No unfinished-work placeholder markers found.")


def check_secret_canaries(result: Result) -> None:
    # Detect realistic live-token shapes, not explanatory phrases such as "sk-...".
    patterns = {
        "OpenAI-style token": re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b"),
        "AWS access key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
        "GitHub token": re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b"),
        "Private key block": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    }
    hits: list[str] = []
    for path in iter_files():
        if path.suffix.lower() in {".zip", ".png", ".jpg", ".jpeg", ".webp"}:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for label, pattern in patterns.items():
            if pattern.search(text):
                hits.append(f"{label} in `{path.relative_to(ROOT)}`")
    if hits:
        for hit in hits:
            result.fail(f"Possible plaintext secret: {hit}")
    else:
        result.ok("No common live-secret token patterns found.")


def check_source_registry(parsed: dict[Path, object], result: Result) -> None:
    path = ROOT / "research" / "SOURCES.json"
    data = parsed.get(path)
    if not isinstance(data, dict) or not isinstance(data.get("sources"), list):
        result.fail("`research/SOURCES.json` does not contain a `sources` list.")
        return
    ids: set[str] = set()
    required = {"id", "category", "title", "url", "type", "why"}
    for index, source in enumerate(data["sources"]):
        if not isinstance(source, dict):
            result.fail(f"Source entry {index} is not an object.")
            continue
        missing = required - source.keys()
        if missing:
            result.fail(f"Source `{source.get('id', index)}` missing fields: {sorted(missing)}")
        source_id = source.get("id")
        if not isinstance(source_id, str) or not source_id:
            result.fail(f"Source entry {index} has invalid ID.")
        elif source_id in ids:
            result.fail(f"Duplicate research source ID: `{source_id}`")
        else:
            ids.add(source_id)
        url = source.get("url")
        if not isinstance(url, str) or not url.startswith("https://"):
            result.fail(f"Source `{source_id}` has non-HTTPS or invalid URL.")
    if not any("Source " in error or "research/SOURCES" in error for error in result.errors):
        result.ok(f"Research source registry check passed ({len(data['sources'])} sources).")


def make_tree() -> str:
    lines: list[str] = [f"{ROOT.name}/"]

    def walk(directory: Path, prefix: str = "") -> None:
        entries = sorted(
            [p for p in directory.iterdir() if p.name != ".git"],
            key=lambda p: (not p.is_dir(), p.name.lower()),
        )
        for index, entry in enumerate(entries):
            connector = "└── " if index == len(entries) - 1 else "├── "
            lines.append(prefix + connector + entry.name + ("/" if entry.is_dir() else ""))
            if entry.is_dir():
                walk(entry, prefix + ("    " if index == len(entries) - 1 else "│   "))

    walk(ROOT)
    return "\n".join(lines) + "\n"


def write_manifest(files: list[Path]) -> None:
    lines: list[str] = []
    for path in files:
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        lines.append(f"{digest}  {path.relative_to(ROOT).as_posix()}")
    MANIFEST_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_report(result: Result, file_count: int, byte_count: int, word_count: int) -> None:
    status = "PASS" if not result.errors else "FAIL"
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    lines = [
        "# Handover validation",
        "",
        f"**Status:** {status}",
        f"**Validated at:** {now}",
        f"**Files checked:** {file_count}",
        f"**Bytes (excluding generated report/tree/manifest):** {byte_count}",
        f"**Approximate words in text files:** {word_count}",
        "",
        "This validates document structure, JSON syntax/schemas, examples, links, diagrams, source-registry shape, placeholder markers and common plaintext-secret patterns. It does **not** certify product implementation, legal clearance, privacy compliance, third-party deletion, Windows compatibility, model quality or media-codec licensing.",
        "",
        "## Passed checks",
        "",
    ]
    lines.extend(f"- {item}" for item in result.checks)
    lines.extend(["", "## Warnings", ""])
    lines.extend(f"- {item}" for item in result.warnings) if result.warnings else lines.append("- None.")
    lines.extend(["", "## Errors", ""])
    lines.extend(f"- {item}" for item in result.errors) if result.errors else lines.append("- None.")
    lines.append("")
    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    result = Result()
    check_required(result)
    parsed = parse_json(result)
    registry = schema_registry(parsed, result)
    validate_examples(parsed, registry, result)
    check_source_registry(parsed, result)
    check_markdown_links(result)
    check_mermaid(result)
    check_placeholders(result)
    check_secret_canaries(result)

    files = iter_files()
    byte_count = sum(path.stat().st_size for path in files)
    word_count = 0
    for path in files:
        if path.suffix.lower() in {".md", ".json", ".mmd", ".py", ".sh", ".txt"}:
            word_count += len(path.read_text(encoding="utf-8", errors="ignore").split())

    TREE_PATH.write_text(make_tree(), encoding="utf-8")
    write_manifest(files)
    write_report(result, len(files), byte_count, word_count)

    if result.errors:
        print(f"FAIL: {len(result.errors)} error(s); see {REPORT_PATH}")
        for error in result.errors:
            print(f"- {error}")
        return 1

    print(
        f"PASS: {len(result.checks)} checks, {len(result.warnings)} warning(s), "
        f"{len(files)} files, {word_count} approximate words"
    )
    print(f"Report: {REPORT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
