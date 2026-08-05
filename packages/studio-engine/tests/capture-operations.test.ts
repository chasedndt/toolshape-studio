import { describe, expect, it } from "vitest";
import type { CaptureDocument, StudioOperation, StudioProject } from "@toolshape/studio-domain";
import { migrateStudioProject } from "@toolshape/studio-domain";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import { applyStudioOperation, planOperationInverse, rational, validateStudioProject } from "../src";

/**
 * Capture edits are ordinary operations.
 *
 * That is the point of putting captures on the project: adjusting a zoom plan
 * or adding a redaction is revision-checked, idempotent, reversible and
 * agent-callable for free, because it travels the same path every other edit
 * does. No new transport, and no second concurrency story.
 */

let sequence = 0;
function operation<T extends StudioOperation["type"]>(
  type: T,
  payload: Extract<StudioOperation, { type: T }>["payload"],
  expectedRevision: number,
): StudioOperation {
  sequence += 1;
  return {
    operationId: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    type,
    actor: "operator",
    expectedRevision,
    payload,
  } as StudioOperation;
}

function apply(project: StudioProject, op: StudioOperation): StudioProject {
  return applyStudioOperation(project, op).project;
}

/** Applies an inverse plan's first operation against the current revision. */
function revertOnto(project: StudioProject, plan: ReturnType<typeof planOperationInverse>): StudioProject {
  if (!plan.revertible) throw new Error(`Not revertible: ${plan.reason}`);
  sequence += 1;
  return apply(project, {
    ...plan.operations[0],
    operationId: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    actor: "operator",
    expectedRevision: project.revision,
  } as StudioOperation);
}

function capture(): CaptureDocument {
  return {
    id: "capture-1",
    revision: 0,
    source: { id: "display-1", kind: "display", label: "Primary display", width: 2560, height: 1440 },
    mediaAssetId: "asset-product-film",
    audioAssetIds: [],
    duration: rational(8),
    frameRate: rational(30),
    cursorTrack: [],
    eventTrack: [],
    windowTrack: [],
    zoomPlan: {
      id: "zoom-1",
      revision: 0,
      derived: true,
      keyframes: [{ id: "k0", time: rational(0), scale: 1, centerX: 0.5, centerY: 0.5, easing: "linear" }],
    },
    backdrop: { fill: { kind: "solid", colour: "#000000" }, paddingPx: 32, cornerRadiusPx: 12, shadowOpacity: 0.3 },
    cursorStyle: { smoothing: 0.6, sizeScale: 1, clickEmphasis: true, motionBlur: false },
    cameraOverlay: null,
    redactions: [],
    transcriptRef: null,
  };
}

function withCapture(): StudioProject {
  const project = createGoldenStudioProject();
  project.captures = [capture()];
  return project;
}

const AUTHORED_PLAN = {
  id: "zoom-authored",
  revision: 0,
  derived: true,
  keyframes: [{ id: "a0", time: rational(1), scale: 2, centerX: 0.3, centerY: 0.4, easing: "linear" as const }],
};

describe("schema migration to v4", () => {
  it("gives a project written before captures existed an empty list", () => {
    const legacy = { ...createGoldenStudioProject(), schemaVersion: 3 } as unknown as Record<string, unknown>;
    delete legacy.captures;
    const migrated = migrateStudioProject(legacy);
    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.captures).toEqual([]);
  });

  it("leaves an existing project's content untouched", () => {
    const golden = createGoldenStudioProject();
    const legacy = { ...golden, schemaVersion: 3 } as unknown as Record<string, unknown>;
    const migrated = migrateStudioProject(legacy);
    expect(migrated.timeline.tracks).toHaveLength(golden.timeline.tracks.length);
    expect(migrated.assets).toHaveLength(golden.assets.length);
  });
});

describe("capture.zoom.set-plan", () => {
  it("marks an authored plan so a later derivation cannot silently overwrite it", () => {
    const before = withCapture();
    expect(before.captures[0].zoomPlan.derived).toBe(true);

    const after = apply(
      before,
      operation("capture.zoom.set-plan", { captureId: "capture-1", plan: AUTHORED_PLAN }, 0),
    );
    // Authored regardless of what the payload claimed (CAP-5).
    expect(after.captures[0].zoomPlan.derived).toBe(false);
    expect(after.captures[0].zoomPlan.keyframes[0].scale).toBe(2);
  });

  it("reverts to the previous plan, including whether it was derived", () => {
    const before = withCapture();
    const set = operation("capture.zoom.set-plan", { captureId: "capture-1", plan: AUTHORED_PLAN }, 0);
    const after = apply(before, set);
    const restored = revertOnto(after, planOperationInverse(set, before));
    expect(restored.captures[0].zoomPlan.keyframes[0].scale).toBe(1);
  });

  it("rejects an unknown capture", () => {
    const before = withCapture();
    expect(() =>
      apply(before, operation("capture.zoom.set-plan", { captureId: "capture-missing", plan: AUTHORED_PLAN }, 0)),
    ).toThrow(/unknown capture/i);
  });
});

describe("capture redactions", () => {
  const redaction = {
    id: "redaction-1",
    kind: "region" as const,
    from: rational(1),
    to: rational(3),
    bounds: { x: 0, y: 0, width: 100, height: 100 },
  };

  it("adds and removes a redaction", () => {
    const before = withCapture();
    const added = apply(before, operation("capture.redaction.add", { captureId: "capture-1", redaction }, 0));
    expect(added.captures[0].redactions).toHaveLength(1);

    const removed = apply(
      added,
      operation("capture.redaction.remove", { captureId: "capture-1", redactionId: "redaction-1" }, 1),
    );
    expect(removed.captures[0].redactions).toHaveLength(0);
  });

  it("reverts an added redaction by removing it", () => {
    const before = withCapture();
    const add = operation("capture.redaction.add", { captureId: "capture-1", redaction }, 0);
    const added = apply(before, add);
    const back = revertOnto(added, planOperationInverse(add, before));
    expect(back.captures[0].redactions).toHaveLength(0);
  });

  it("reverts a removed redaction by adding it back", () => {
    const before = withCapture();
    const added = apply(before, operation("capture.redaction.add", { captureId: "capture-1", redaction }, 0));
    const remove = operation("capture.redaction.remove", { captureId: "capture-1", redactionId: "redaction-1" }, 1);
    const removed = apply(added, remove);
    const back = revertOnto(removed, planOperationInverse(remove, added));
    expect(back.captures[0].redactions).toHaveLength(1);
    expect(back.captures[0].redactions[0].id).toBe("redaction-1");
  });

  it("refuses a duplicate redaction id", () => {
    const before = withCapture();
    const added = apply(before, operation("capture.redaction.add", { captureId: "capture-1", redaction }, 0));
    expect(() =>
      apply(added, operation("capture.redaction.add", { captureId: "capture-1", redaction }, 1)),
    ).toThrow(/already/i);
  });
});

describe("capture validation", () => {
  it("rejects a zoom scale below the source", () => {
    const project = withCapture();
    project.captures[0].zoomPlan.keyframes[0].scale = 0.5;
    expect(validateStudioProject(project).some((issue) => issue.code === "capture.zoom-below-source")).toBe(true);
  });

  it("rejects a zoom centre outside the frame", () => {
    const project = withCapture();
    project.captures[0].zoomPlan.keyframes[0].centerX = 1.4;
    expect(
      validateStudioProject(project).some((issue) => issue.code === "capture.zoom-centre-outside-frame"),
    ).toBe(true);
  });

  it("rejects a redaction covering no time", () => {
    const project = withCapture();
    project.captures[0].redactions.push({
      id: "redaction-bad",
      kind: "region",
      from: rational(3),
      to: rational(3),
    });
    expect(
      validateStudioProject(project).some((issue) => issue.code === "capture.redaction-empty-range"),
    ).toBe(true);
  });

  it("accepts a well-formed capture", () => {
    expect(validateStudioProject(withCapture()).filter((issue) => issue.severity === "error")).toHaveLength(0);
  });
});
