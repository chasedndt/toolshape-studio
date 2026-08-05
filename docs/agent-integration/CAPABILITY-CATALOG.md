# Capability catalog

**Date:** 2026-08-05
**Status:** ACTIVE

The complete semantic surface: what exists today, what is planned, and what is deliberately excluded. The runtime source of truth is `tools/list` over MCP — this document explains the surface, it does not define it.

Design constraint from `docs/06-capability-design.md`: the target is roughly 12–20 well-scoped capabilities, never one broad "make it good" tool. A powerful catch-all is easier to prompt and impossible to preview, verify, authorize, or recover — so it is an explicit anti-pattern here.

---

## Shipped — 8 capabilities

| Capability | MCP tool | Risk | Mutating | Idempotent | Undoable |
|---|---|---|---|---|---|
| `studio.project.inspect` | `studio_project_inspect` | read_only | no | n/a | n/a |
| `studio.project.validate` | `studio_project_validate` | read_only | no | n/a | n/a |
| `studio.project.plan` | `studio_project_plan` | simulation | no | n/a | n/a |
| `studio.project.apply_operations` | `studio_project_apply_operations` | reversible_local_write | yes | yes | yes |
| `studio.project.render` | `studio_project_render` | reversible_local_write | yes | yes | job cancel |
| `studio.job.get` | `studio_job_get` | read_only | no | n/a | n/a |
| `studio.job.cancel` | `studio_job_cancel` | reversible_local_write | yes | yes | no |
| `studio.operation.undo` | `studio_operation_undo` | reversible_local_write | yes | token-bound | no |

### studio.project.inspect
Returns canonical project state and current revision. The first call in any workflow, because `state.revision_after` is what you pass as `expected_revision`.

### studio.project.validate
Deterministic domain validation. Detects missing source assets, clips extending past the timeline duration, clips reading past the immutable source duration, invalid audio gain, and duplicate identifiers. Returns structured issues with severity and a path. **This is the verification mechanism** — an agent confirms its work here rather than by re-reading and judging its own output.

### studio.project.plan
Simulates operations and returns the semantic diff without mutating. `dry_run` is forced true regardless of what the caller passes. Cheap, and it catches malformed edits before they cost a revision.

### studio.project.apply_operations
Applies a batch of typed operations atomically and advances the revision. Rejects on stale `expected_revision`. Returns a single-use undo token. Supply a stable `idempotency_key` to make retries safe.

Operation types today (18):

| Operation | Domain |
|---|---|
| `scene.node.add` | design |
| `scene.node.update-transform` | design |
| `scene.node.update-text` | design |
| `timeline.clip.split` | edit |
| `timeline.clip.trim` | edit |
| `timeline.clip.set-audio` | edit |
| `timeline.caption.upsert` | edit |
| `animation.keyframe.set` | motion |
| `effect.blur.set` | effects |
| `style.profile.apply` | style |
| `timeline.clip.move` | assembly |
| `timeline.clip.reorder` | assembly |
| `timeline.clip.delete` | assembly |
| `timeline.clip.duplicate` | assembly |
| `timeline.clip.merge` | assembly |
| `timeline.clip.set-speed` | assembly |
| `timeline.clip.insert` | assembly |
| `scene.node.remove` | design |

Speed is a **rational ratio**, not a float: `2/1` is double speed, and a clip taken to `1/3` and back returns to its exact original duration (ADR 0003).

Merge is deliberately narrow — it joins two clips only when they are adjacent on the timeline and contiguous in the same source, which is exactly the shape a split produces. That correspondence is what makes it a true inverse rather than an approximation.

**Every timeline and scene operation is individually revertible.** The inverse planner receives the project as it was immediately before an operation ran, so anything the snapshot holds is recoverable — a merge's split point, a reorder's previous ordering, a removed node, and a deleted clip all come back exactly.

What remains non-revertible is a genuine vocabulary gap rather than lost information: creating a caption, a keyframe, or the first effect or style profile, because no removal operation exists for those yet. Those entries say so.

### studio.project.render
Queues a durable render job and returns immediately with `accepted_job`. The public input names an asset, a preset and a safe output filename — it **never** carries FFmpeg arguments. Command construction and path resolution happen inside the trusted worker (ADR 0007).

### studio.job.get / studio.job.cancel
Poll status, fractional progress, stage, attempt count and outputs. Cancellation is cooperative; request state and actual state are tracked separately so an agent can distinguish "asked to stop" from "stopped".

### studio.operation.undo
Reverses a previously applied operation using its token. Tokens are capability- and revision-bound and single-use — this is not a general "undo the last thing" command.

---

## Planned — capture (Milestone 9)

Specified in [`docs/product/CAPTURE-PILLAR.md`](../product/CAPTURE-PILLAR.md). These join the MCP surface with no protocol change.

| Capability | Purpose | Risk |
|---|---|---|
| `studio.capture.list_sources` | Enumerate displays, windows, cameras, audio devices | read_only |
| `studio.capture.start` | Begin a recording against a declared source | reversible_local_write |
| `studio.capture.stop` | Finalize media, register the capture document | reversible_local_write |
| `studio.capture.get_session` | Poll an in-flight recording | read_only |
| `studio.capture.plan_zoom` | Derive or author zoom keyframes from the event track | reversible_local_write |
| `studio.capture.set_overlay` | Camera bubble, backdrop, cursor styling | reversible_local_write |
| `studio.capture.redact` | Mask regions, drop keystroke spans, blur windows | reversible_local_write |
| `studio.capture.to_scene` | Project a capture into an editable timeline scene | reversible_local_write |

**`studio.capture.start` carries a hard invariant no grant can override:** recording requires explicit OS-level consent and shows a non-suppressible indicator. An agent can request a recording; it cannot start one silently.

---

## Planned — design and variants (Milestone 10)

| Capability | Purpose | Risk |
|---|---|---|
| `studio.design.create_variants` | Resize one design into N platform formats, preserving hierarchy and safe areas | reversible_local_write |
| `studio.design.bind_data` | Bind CSV/JSON rows to a template for bulk generation | reversible_local_write |
| `studio.design.apply_brand` | Apply a brand kit with hard/soft rule enforcement | reversible_local_write |
| `studio.transcript.generate` | Speech-to-text as a durable job | reversible_local_write |
| `studio.transcript.edit` | Cut media by editing transcript spans | reversible_local_write |
| `studio.asset.import` | Import media through the quarantine boundary | reversible_local_write |
| `studio.project.export` | Export to a declared format and preset | reversible_local_write |

Variants and bulk data are the flagship agent workflows: pure repetitive precision work, and fully verifiable in code (did every variant preserve hierarchy, safe areas, contrast and text fit?) with no model judgement required.

---

## Deliberately excluded

Not oversights. Each is excluded for a stated reason.

| Not a capability | Why |
|---|---|
| "Make this look better" | The catch-all anti-pattern. Hides side effects, makes preview meaningless, prevents verification and recovery. |
| Direct FFmpeg argument passthrough | Public inputs carry typed intent only. Command construction is the trusted worker's job (ADR 0007). |
| Arbitrary file read/write | Studio addresses content by digest, never by path. Paths never cross the public contract (ADR 0008, ADR 0010). |
| Set the project revision | Revisions advance only by applying operations. A settable revision would defeat concurrency control entirely. |
| Suppress the recording indicator | Hard invariant. No configuration, policy profile or grant may disable it. |
| Execute arbitrary code or plugins | Explicit non-goal (`docs/19-non-goals.md`). |
| Publish to an external service | No egress path exists. When one is built it needs approval binding, a secret broker, and fresh threat analysis. |
| Agent-authored executable UI | Agents send typed view models; Studio renders approved components (ADR 0009). |

---

## Every capability declares

Per `docs/04-semantic-kernel.md`, a registry entry carries:

```text
id · version · input schema · output schema
risk class · required grants · approval mode
preconditions · postconditions
idempotency behaviour
verifier (or an explicit verification limitation)
recovery method
cost estimator
```

The **verifier** field is the one most often skipped in agent systems and the one that matters most: no capability may report success on a model's assertion. Where deterministic verification is impossible, the capability must declare that limitation explicitly rather than imply a guarantee it cannot make.

---

## Risk classes

| Class | Meaning | Default handling |
|---|---|---|
| `read_only` | No state change | Auto |
| `simulation` | Computes a diff, changes nothing | Auto |
| `reversible_local_write` | Local state change, undoable | Auto, recorded, undoable |
| `external_reversible` | Reaches outside the machine, reversible | Approval required |
| `high_impact` | Irreversible, public, or costly | Exact-parameter approval required |

Nothing in Studio is `external_reversible` or `high_impact` today, because no egress path exists. Those classes are defined now so the boundary is unambiguous when the first one is built.
