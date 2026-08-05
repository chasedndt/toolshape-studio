# Toolshape Studio assembly-operations milestone

**Date:** 2026-08-05
**Runtime:** Codex
**Status:** IN PROGRESS / MILESTONE 8b

## Outcome

Make the timeline an editor rather than a trimmer, and close the gap that stops
most past operations from being individually revertible.

You can currently split a clip and trim it. You cannot move one, reorder them,
delete one, duplicate one, or change its speed — so a sequence cannot actually
be assembled. Every pillar downstream produces material that lands on this
timeline, so the missing vocabulary caps the value of everything after it.

The same gap shows in the activity history. Four of the ten operation types
declare themselves non-revertible with the reason *"needs a merge or delete
operation, which does not exist yet"*. Adding deletion and merging turns those
four into reversible operations without touching the revert engine's design.

## Repo-truth baseline

- Milestone 8 is committed and verified. The worktree began clean at `b77dfab`.
- `StudioOperation` in `packages/studio-domain/src/model.ts` has ten members.
  Assembly is absent: no move, reorder, delete, duplicate, merge or speed.
- `packages/studio-engine/src/operations.ts` applies operations against a cloned
  project and returns `{ project, diff }`; every case pushes `changedPaths` and
  a summary, bumps `clip.revision` and `timeline.revision`, and the whole result
  is validated by `assertStudioProjectValid`.
- `packages/studio-engine/src/inverse.ts` returns `revert.no-inverse-capability`
  for `timeline.clip.split` and `scene.node.add`, naming the missing operation.
- Rational time is exact (ADR 0003). Speed changes must not introduce floats.

## Operations

| Operation | Payload | Notes |
|---|---|---|
| `timeline.clip.move` | `trackId`, `clipId`, `newStart`, `ripple` | Repositions on the same track. Source range unchanged — this is not a trim. |
| `timeline.clip.reorder` | `trackId`, `clipId`, `toIndex` | Reorders and re-packs sequentially, for transcript-driven and agent-driven assembly. |
| `timeline.clip.delete` | `trackId`, `clipId`, `ripple` | Ripple closes the gap; otherwise the gap remains. |
| `timeline.clip.duplicate` | `trackId`, `clipId`, `newClipId`, `at` | Copies the source range, not the media. |
| `timeline.clip.merge` | `trackId`, `leftClipId`, `rightClipId` | Only when adjacent and contiguous in the same source. This is the inverse of split. |
| `timeline.clip.set-speed` | `trackId`, `clipId`, `speed` (rational), `ripple` | Duration scales by the reciprocal; `sourceIn` is unchanged. |
| `scene.node.remove` | `sceneId`, `nodeId` | Inverse of `scene.node.add`. |

## Design decisions

**Speed is rational, not a float.** A 2× clip of 5s must be exactly 2.5s and a
⅓× clip must not accumulate error across repeated edits. `speed` is a
`RationalTime` used as a ratio, and the new duration is `duration × 1/speed`
computed in exact arithmetic (ADR 0003).

**Merge is deliberately narrow.** It joins two clips only when they are
adjacent on the timeline, contiguous in the source, and reference the same
asset. That is exactly the shape a split produces, which is what makes it a
true inverse. A general "combine any two clips" would be a different feature
and could not be an inverse of anything.

**Delete does not remove the asset.** Assets are immutable and
content-addressed (ADR 0002); removing a clip removes a reference.

**Reorder re-packs.** Reordering clips that sat at arbitrary positions and
leaving them there would be a no-op visually. Reorder places clips end to end in
the new order, which is what the operation is for.

## Revert consequences

With deletion and merging present, `planOperationInverse` can express:

- `timeline.clip.split` → merge the two halves back
- `scene.node.add` → remove the node
- `timeline.clip.duplicate` → delete the copy
- `timeline.clip.delete` → **not** revertible, and stays declared so. Restoring
  a deleted clip means reconstructing it from the before-snapshot, which needs
  an insert operation carrying a full clip. Deferred rather than faked.

Conflict detection needs new target keys: delete, reorder and ripple-move all
affect the whole track, so they must report `track:<id>` rather than a single
clip, or a later reorder would let an earlier revert quietly corrupt positions.

## TDD and implementation order

1. Engine tests for each operation, including the exact-arithmetic speed cases
   and every rejection: move beyond the timeline, merge non-adjacent clips,
   merge across different assets, delete the last clip, reorder out of range.
   Run red.
2. Extend `StudioOperation` and implement the cases in `operations.ts`.
3. Extend validation where new invariants apply.
4. Extend `operationTargets` for the new track-wide operations.
5. Extend `planOperationInverse` for split, node add and duplicate; add tests
   asserting each round-trips.
6. UI: delete, duplicate and speed on the selected clip; agent parity is
   automatic since the MCP tool surface is derived.
7. Full gates plus regenerated screenshots and demo.

## Acceptance criteria

- All seven operations apply, validate, and appear in the MCP tool schema
  without a transport change.
- Splitting then reverting the split restores the original clip exactly.
- Adding then reverting a node removes it.
- A speed change of 2× then ½× returns the clip to its exact original duration.
- Reverting an operation after a later reorder on the same track is refused.
- Deleting a clip is reported non-revertible with the reason, not silently
  offered and then failing.
- Existing 137 tests stay green.

## Non-goals

- Insert-with-payload, and therefore undeleting. Deferred deliberately.
- Cross-track moves. Same-track only for now; moving between tracks needs
  compatibility rules that belong with the transitions work.
- Speed with pitch correction, or any audio resampling. Duration only.
- Multi-clip selection. One clip per operation; a batch is several operations
  in one atomic envelope, which the kernel already supports.
