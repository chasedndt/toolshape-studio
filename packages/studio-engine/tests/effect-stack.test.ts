import { describe, expect, it } from "vitest";
import type { Effect, StudioOperation, StudioProject } from "@toolshape/studio-domain";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import { applyStudioOperation, planOperationInverse, validateStudioProject } from "../src";

/**
 * Blur used to be hardcoded end to end: its own interface, its own operation,
 * its own inverse, its own render branch. Adding a second effect would have
 * meant repeating all four. Effects now carry a typed parameter map, so a new
 * effect is data — an entry in EFFECT_PARAMETERS — rather than code in five
 * places.
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

function effect(type: Effect["type"], parameters: Record<string, number>, id = `effect-${type}`): Effect {
  return { id, type, enabled: true, parameters, revision: 0 };
}

function sceneAndNode(project: StudioProject) {
  return { sceneId: project.scenes[0].id, nodeId: project.scenes[0].nodes[0].id };
}

describe("effect.set", () => {
  it("adds any effect type without new code per effect", () => {
    let project = createGoldenStudioProject();
    const target = sceneAndNode(project);

    for (const [type, parameters] of [
      ["brightness", { amount: 0.2 }],
      ["contrast", { amount: 1.4 }],
      ["saturation", { amount: 0.8 }],
      ["colour-shift", { hueDegrees: 45 }],
    ] as const) {
      project = apply(
        project,
        operation("effect.set", { ...target, effect: effect(type, parameters) }, project.revision),
      );
    }

    for (const type of ["brightness", "contrast", "saturation", "colour-shift"]) {
      expect(project.effects.find((candidate) => candidate.type === type)).toBeDefined();
    }
  });

  it("attaches the effect to the node it was set on", () => {
    const project = createGoldenStudioProject();
    const target = sceneAndNode(project);
    const after = apply(
      project,
      operation("effect.set", { ...target, effect: effect("brightness", { amount: 0.3 }) }, 0),
    );
    const node = after.scenes[0].nodes.find((candidate) => candidate.id === target.nodeId)!;
    expect(node.effectIds).toContain("effect-brightness");
  });

  it("updates rather than duplicating an effect with the same id", () => {
    const project = createGoldenStudioProject();
    const target = sceneAndNode(project);
    const once = apply(
      project,
      operation("effect.set", { ...target, effect: effect("blur", { radius: 5 }, "effect-x") }, 0),
    );
    const twice = apply(
      once,
      operation("effect.set", { ...target, effect: effect("blur", { radius: 20 }, "effect-x") }, once.revision),
    );
    const matching = twice.effects.filter((candidate) => candidate.id === "effect-x");
    expect(matching).toHaveLength(1);
    expect(matching[0].parameters.radius).toBe(20);
  });

  it("refuses a parameter the effect type does not have", () => {
    const project = createGoldenStudioProject();
    const target = sceneAndNode(project);
    expect(() =>
      apply(project, operation("effect.set", { ...target, effect: effect("blur", { amount: 1 }) }, 0)),
    ).toThrow(/no parameter/i);
  });

  it("refuses a parameter outside its range", () => {
    const project = createGoldenStudioProject();
    const target = sceneAndNode(project);
    expect(() =>
      apply(project, operation("effect.set", { ...target, effect: effect("opacity", { amount: 4 }) }, 0)),
    ).toThrow(/between 0 and 1/i);
  });
});

describe("effect.remove", () => {
  it("removes the effect and detaches it from its node", () => {
    const project = createGoldenStudioProject();
    const target = sceneAndNode(project);
    const added = apply(
      project,
      operation("effect.set", { ...target, effect: effect("contrast", { amount: 2 }) }, 0),
    );
    const removed = apply(
      added,
      operation("effect.remove", { ...target, effectId: "effect-contrast" }, added.revision),
    );

    expect(removed.effects.find((candidate) => candidate.id === "effect-contrast")).toBeUndefined();
    const node = removed.scenes[0].nodes.find((candidate) => candidate.id === target.nodeId)!;
    expect(node.effectIds).not.toContain("effect-contrast");
  });

  it("refuses an unknown effect", () => {
    const project = createGoldenStudioProject();
    const target = sceneAndNode(project);
    expect(() =>
      apply(project, operation("effect.remove", { ...target, effectId: "effect-absent" }, 0)),
    ).toThrow(/unknown effect/i);
  });
});

describe("effect revert", () => {
  it("reverts a newly added effect by removing it", () => {
    // This is the case the blur-only shape could not express, so adding an
    // effect used to be permanently non-revertible.
    const before = createGoldenStudioProject();
    const target = sceneAndNode(before);
    const set = operation("effect.set", { ...target, effect: effect("saturation", { amount: 2 }) }, 0);
    const after = apply(before, set);

    const plan = planOperationInverse(set, before);
    expect(plan.revertible).toBe(true);
    if (!plan.revertible) return;

    sequence += 1;
    const back = apply(after, {
      ...plan.operations[0],
      operationId: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
      actor: "operator",
      expectedRevision: after.revision,
    } as StudioOperation);
    expect(back.effects.find((candidate) => candidate.id === "effect-saturation")).toBeUndefined();
  });

  it("reverts a changed effect to its previous parameters", () => {
    const before = createGoldenStudioProject();
    const target = sceneAndNode(before);
    const original = before.effects.find((candidate) => candidate.id === "effect-atmosphere")!;

    const change = operation(
      "effect.set",
      { ...target, effect: { ...original, parameters: { radius: 99 } } },
      0,
    );
    const after = apply(before, change);
    expect(after.effects.find((candidate) => candidate.id === "effect-atmosphere")!.parameters.radius).toBe(99);

    const plan = planOperationInverse(change, before);
    expect(plan.revertible).toBe(true);
    if (!plan.revertible) return;

    sequence += 1;
    const back = apply(after, {
      ...plan.operations[0],
      operationId: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
      actor: "operator",
      expectedRevision: after.revision,
    } as StudioOperation);
    expect(back.effects.find((candidate) => candidate.id === "effect-atmosphere")!.parameters.radius).toBe(
      original.parameters.radius,
    );
  });
});

describe("effect validation", () => {
  it("rejects a parameter outside its declared range", () => {
    const project = createGoldenStudioProject();
    project.effects[0].parameters.radius = 9999;
    expect(
      validateStudioProject(project).some((issue) => issue.code === "effect.parameter-out-of-range"),
    ).toBe(true);
  });

  it("rejects a parameter the effect type does not declare", () => {
    const project = createGoldenStudioProject();
    project.effects[0].parameters.nonsense = 1;
    expect(validateStudioProject(project).some((issue) => issue.code === "effect.unknown-parameter")).toBe(true);
  });

  it("accepts the golden project", () => {
    expect(validateStudioProject(createGoldenStudioProject()).filter((issue) => issue.severity === "error")).toEqual([]);
  });
});
