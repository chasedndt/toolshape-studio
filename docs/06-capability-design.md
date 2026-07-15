# Capability design and tool granularity

## The target surface

Each product should expose approximately 12–20 stable, high-leverage agent capabilities, plus shared job, artifact, approval, and project operations.

This number is a design target, not a protocol limit. The goal is a legible semantic surface that covers 80% of real work without reproducing every control.

## Two levels

### Semantic primitives

Deterministic operations such as:

```text
text.replace_span
scene.apply_operations
timeline.apply_operations
caption.update_segment
asset.import
artifact.export
```

### Goal-level workflows

Compositions such as:

```text
voice.dictate_to_target
studio.create_campaign_variants
studio.edit_video_from_transcript
studio.prepare_platform_exports
```

A harness uses a workflow when it fits and drops to primitives for precise control.

## Selection criteria

A capability is well-shaped when it is:

- understandable without seeing the UI;
- independently testable;
- composable;
- narrow enough to preview and verify;
- broad enough to avoid dozens of dependent calls;
- stable across UI redesigns;
- explicit about side effects, cost, risk, and recovery.

## Bad surfaces

```text
click_left_toolbar
move_mouse
press_export_button
set_property_17
make_everything_professional
edit_video
```

## Recommended tool response pattern

Every mutating call returns one of:

- completed operation result;
- accepted job reference;
- approval request;
- structured rejection/error.

The response should include semantic diffs, artifact references, verification status, warnings, usage, cost, and recovery information.

## Tool documentation as Agent Experience

Treat tool documentation as **AX: Agent Experience**.

For every capability include:

- a precise name using domain language;
- one-sentence purpose;
- when to use and when not to use;
- required context;
- parameter descriptions and bounded enums;
- one successful example;
- one ambiguous example;
- common errors and recovery;
- risk and approval behaviour;
- output interpretation.

A tool description is executable attack surface when it comes from an untrusted server. Pin trusted manifests, validate versions, and never grant authority solely because an MCP server described a tool as safe.
