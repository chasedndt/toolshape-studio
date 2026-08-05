import { describe, expect, it } from "vitest";
import type { StudioOperation, StudioProject } from "@toolshape/studio-domain";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import { applyStudioOperation, planOperationInverse, verifyVariant } from "../src";

/**
 * The flagship workflow end to end, driven the way an agent would drive it:
 * one source design, several platform formats, a row of copy bound into each,
 * and every result checked in code.
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
    actor: "agent",
    expectedRevision,
    payload,
  } as StudioOperation;
}

function apply(project: StudioProject, op: StudioOperation): StudioProject {
  return applyStudioOperation(project, op).project;
}

const FORMATS = [
  { formatId: "story", formatName: "Story", width: 1080, height: 1920 },
  { formatId: "square", formatName: "Square", width: 1080, height: 1080 },
  { formatId: "wide", formatName: "Wide", width: 1920, height: 1080 },
];

describe("design.variant.create", () => {
  it("adds a variant alongside the original rather than replacing it", () => {
    const before = createGoldenStudioProject();
    const sceneId = before.scenes[0].id;
    const after = apply(before, operation("design.variant.create", { sceneId, ...FORMATS[1] }, 0));

    expect(after.scenes).toHaveLength(before.scenes.length + 1);
    expect(after.scenes.find((scene) => scene.id === sceneId)).toBeDefined();
  });

  it("produces every platform format from one source, each verifying clean", () => {
    // The workflow the product exists for: an agent fans out a design and each
    // result is checked rather than eyeballed.
    let project = createGoldenStudioProject();
    const sceneId = project.scenes[0].id;
    const source = project.scenes[0];

    for (const format of FORMATS) {
      project = apply(project, operation("design.variant.create", { sceneId, ...format }, project.revision));
    }

    expect(project.scenes).toHaveLength(1 + FORMATS.length);
    for (const format of FORMATS) {
      const variant = project.scenes.find((scene) => scene.id === `${sceneId}--${format.formatId}`)!;
      expect(variant.size).toEqual({ width: format.width, height: format.height });
      expect(verifyVariant({ source, variant })).toEqual([]);
    }
  });

  it("refuses to create the same variant twice", () => {
    const before = createGoldenStudioProject();
    const sceneId = before.scenes[0].id;
    const once = apply(before, operation("design.variant.create", { sceneId, ...FORMATS[0] }, 0));
    expect(() =>
      apply(once, operation("design.variant.create", { sceneId, ...FORMATS[0] }, once.revision)),
    ).toThrow(/already/i);
  });

  it("refuses non-positive dimensions", () => {
    const before = createGoldenStudioProject();
    expect(() =>
      apply(
        before,
        operation(
          "design.variant.create",
          { sceneId: before.scenes[0].id, formatId: "bad", formatName: "Bad", width: 0, height: 100 },
          0,
        ),
      ),
    ).toThrow(/positive/i);
  });
});

describe("design.data.bind", () => {
  it("fills text layers from a row of data", () => {
    const before = createGoldenStudioProject();
    const sceneId = before.scenes[0].id;
    const after = apply(
      before,
      operation("design.data.bind", { sceneId, values: { "node-title": "Row one headline." } }, 0),
    );
    const node = after.scenes[0].nodes.find((candidate) => candidate.id === "node-title");
    expect(node).toMatchObject({ content: "Row one headline." });
  });

  it("refuses a key that does not name a text layer", () => {
    // Skipping silently would produce a hundred designs missing the same field,
    // and nobody would notice until they were published.
    const before = createGoldenStudioProject();
    const shape = before.scenes[0].nodes.find((node) => node.type === "shape");
    if (!shape) return;
    expect(() =>
      apply(before, operation("design.data.bind", { sceneId: before.scenes[0].id, values: { [shape.id]: "x" } }, 0)),
    ).toThrow(/cannot bind/i);
  });

  it("refuses a key that names no layer at all", () => {
    const before = createGoldenStudioProject();
    expect(() =>
      apply(
        before,
        operation("design.data.bind", { sceneId: before.scenes[0].id, values: { "node-absent": "x" } }, 0),
      ),
    ).toThrow(/unknown scene node/i);
  });

  it("refuses an empty binding", () => {
    const before = createGoldenStudioProject();
    expect(() =>
      apply(before, operation("design.data.bind", { sceneId: before.scenes[0].id, values: {} }, 0)),
    ).toThrow(/at least one/i);
  });

  it("reverts only the fields it bound", () => {
    const before = createGoldenStudioProject();
    const sceneId = before.scenes[0].id;
    const original = (before.scenes[0].nodes.find((node) => node.id === "node-title") as { content: string }).content;

    const bind = operation("design.data.bind", { sceneId, values: { "node-title": "Replaced." } }, 0);
    const after = apply(before, bind);

    const plan = planOperationInverse(bind, before);
    expect(plan.revertible).toBe(true);
    if (!plan.revertible) return;

    sequence += 1;
    const back = apply(after, {
      ...plan.operations[0],
      operationId: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
      actor: "agent",
      expectedRevision: after.revision,
    } as StudioOperation);
    expect(back.scenes[0].nodes.find((node) => node.id === "node-title")).toMatchObject({ content: original });
  });
});

describe("bulk generation", () => {
  it("produces one variant per format per row, all verifying clean", () => {
    // Three rows across three formats: the shape of a real bulk run.
    const rows = [
      { "node-title": "Launch week." },
      { "node-title": "Now shipping." },
      { "node-title": "Try it today." },
    ];

    let project = createGoldenStudioProject();
    const sceneId = project.scenes[0].id;
    let produced = 0;

    for (const [index, row] of rows.entries()) {
      project = apply(project, operation("design.data.bind", { sceneId, values: row }, project.revision));
      const source = project.scenes.find((scene) => scene.id === sceneId)!;

      for (const format of FORMATS) {
        project = apply(
          project,
          operation(
            "design.variant.create",
            { sceneId, ...format, formatId: `${format.formatId}-r${index}` },
            project.revision,
          ),
        );
        const variant = project.scenes.find((scene) => scene.id === `${sceneId}--${format.formatId}-r${index}`)!;
        // Every variant carries this row's copy and passes the checker.
        expect(variant.nodes.find((node) => node.id.startsWith("node-title"))).toMatchObject({
          content: row["node-title"],
        });
        expect(verifyVariant({ source, variant })).toEqual([]);
        produced += 1;
      }
    }

    expect(produced).toBe(rows.length * FORMATS.length);
  });
});
