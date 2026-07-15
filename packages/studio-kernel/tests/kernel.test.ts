import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { StudioOperation } from "@toolshape/studio-domain";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import {
  IdempotencyConflictError,
  MemoryStudioRepository,
  MissingCapabilityGrantError,
  STUDIO_SCHEMA_VERSION,
  StudioKernel,
  stableDigest,
  type OperationEnvelope,
} from "../src";

function envelope(
  projectRevision: number,
  operations: StudioOperation[],
  overrides: Partial<OperationEnvelope> = {},
): OperationEnvelope {
  return {
    schema_version: STUDIO_SCHEMA_VERSION,
    operation_id: randomUUID(),
    idempotency_key: `test-${randomUUID()}`,
    trace_id: `trace-${randomUUID()}`,
    actor: { id: "operator-1", type: "human" },
    intent: "Apply a tested Studio edit",
    capability: { id: "studio.project.apply_operations", version: STUDIO_SCHEMA_VERSION },
    target: {
      resource: "toolshape-studio://projects/project-launch-film",
      expected_revision: projectRevision,
    },
    input: { operations },
    risk: { level: "low" },
    authorization: { grant_ids: ["studio.project.apply_operations"] },
    execution: { dry_run: false, atomicity: "atomic" },
    retention: { class: "project", content_storage: "local" },
    created_at: new Date(0).toISOString(),
    ...overrides,
  };
}

function textEdit(
  expectedRevision = 0,
  content = "Revised by the semantic kernel",
): StudioOperation {
  return {
    operationId: randomUUID(),
    type: "scene.node.update-text",
    actor: "operator",
    expectedRevision,
    payload: { sceneId: "scene-hero", nodeId: "node-title", content },
  };
}

describe("Studio semantic kernel", () => {
  it("previews without state or idempotency side effects", () => {
    const repository = new MemoryStudioRepository();
    repository.createProject(createGoldenStudioProject());
    const kernel = new StudioKernel(repository);
    const request = envelope(0, [textEdit()], {
      capability: { id: "studio.project.plan", version: STUDIO_SCHEMA_VERSION },
      authorization: { grant_ids: ["studio.project.plan"] },
      execution: { dry_run: true, atomicity: "atomic" },
    });
    const result = kernel.invoke(request);
    expect(result.status).toBe("previewed");
    expect(result.state.revision_after).toBe(1);
    expect(repository.getProject("project-launch-film")?.revision).toBe(0);
    expect(repository.getIdempotency(request.idempotency_key)).toBeNull();
  });

  it("commits an atomic batch and replays the same idempotent result", () => {
    const repository = new MemoryStudioRepository();
    repository.createProject(createGoldenStudioProject());
    const kernel = new StudioKernel(repository);
    const request = envelope(0, [
      textEdit(0),
      { ...textEdit(1, "Second edit"), operationId: randomUUID() },
    ]);
    const first = kernel.invoke(request);
    const replay = kernel.invoke(request);
    expect(first).toEqual(replay);
    expect(first.state.revision_after).toBe(2);
    expect(repository.getProject("project-launch-film")?.revision).toBe(2);
  });

  it("rolls back the whole batch when a later operation fails", () => {
    const repository = new MemoryStudioRepository();
    const original = createGoldenStudioProject();
    repository.createProject(original);
    const kernel = new StudioKernel(repository);
    const invalid = {
      ...textEdit(1),
      payload: { sceneId: "missing", nodeId: "node-title", content: "no" },
    } as StudioOperation;
    expect(() => kernel.invoke(envelope(0, [textEdit(0), invalid]))).toThrow(/Unknown scene/);
    expect(stableDigest(repository.getProject(original.id))).toBe(stableDigest(original));
  });

  it("rejects key reuse with a different digest, missing grants, and malformed envelopes", () => {
    const repository = new MemoryStudioRepository();
    repository.createProject(createGoldenStudioProject());
    const kernel = new StudioKernel(repository);
    const first = envelope(0, [textEdit()]);
    kernel.invoke(first);
    expect(() =>
      kernel.invoke({ ...first, input: { operations: [textEdit(0, "different")] } }),
    ).toThrow(IdempotencyConflictError);
    expect(() =>
      kernel.invoke(envelope(1, [textEdit(1)], { authorization: { grant_ids: [] } })),
    ).toThrow(MissingCapabilityGrantError);
    expect(() => kernel.invoke({ nope: true })).toThrow(/schema_version/i);
  });

  it("restores a prior snapshot through a revision-bound undo token", () => {
    const repository = new MemoryStudioRepository();
    repository.createProject(createGoldenStudioProject());
    const kernel = new StudioKernel(repository);
    const edit = kernel.invoke(envelope(0, [textEdit()]));
    const undo = envelope(1, [], {
      capability: { id: "studio.operation.undo", version: STUDIO_SCHEMA_VERSION },
      authorization: { grant_ids: ["studio.operation.undo"] },
      input: { undo_token: edit.undo?.token ?? "" },
    });
    const undone = kernel.invoke(undo);
    expect(undone.state.revision_after).toBe(2);
    const title = undone.state.project?.scenes[0].nodes.find(
      (node) => node.id === "node-title",
    );
    expect(title?.type === "text" ? title.content : "").toBe(
      "Shape the work. Keep the source.",
    );
  });
});
