import { useCallback, useRef, useState } from "react";
import type {
  SemanticDiff,
  StudioOperation,
  StudioProject,
} from "@toolshape/studio-domain";
import {
  MemoryStudioRepository,
  MemoryStudioJobGateway,
  STUDIO_SCHEMA_VERSION,
  StudioKernel,
  type OperationEnvelope,
  type DurableJob,
} from "@toolshape/studio-kernel";

type DistributiveOmit<T, TKey extends PropertyKey> = T extends unknown ? Omit<T, TKey> : never;
export type OperationDraft = DistributiveOmit<
  StudioOperation,
  "operationId" | "expectedRevision" | "actor"
>;

export function useStudioState(initialProject: StudioProject) {
  const [project, setProject] = useState(initialProject);
  const kernelRef = useRef<StudioKernel | null>(null);
  if (!kernelRef.current) {
    const repository = new MemoryStudioRepository();
    repository.createProject(initialProject);
    kernelRef.current = new StudioKernel(repository, new MemoryStudioJobGateway());
  }
  const [undoToken, setUndoToken] = useState<string | null>(null);
  const [redoToken, setRedoToken] = useState<string | null>(null);
  const [lastDiff, setLastDiff] = useState<SemanticDiff | null>(null);
  const [renderJob, setRenderJob] = useState<DurableJob | null>(null);

  const invoke = useCallback((envelope: OperationEnvelope) => {
    const result = kernelRef.current!.invoke(envelope);
    const nextProject = result.state.project;
    if (!nextProject) throw new Error("Studio kernel returned no project state.");
    setProject(nextProject);
    setLastDiff(result.state.semantic_diff.at(-1) ?? null);
    return result;
  }, []);

  const makeEnvelope = useCallback((
    capabilityId: OperationEnvelope["capability"]["id"],
    expectedRevision: number,
    input: OperationEnvelope["input"],
  ): OperationEnvelope => ({
    schema_version: STUDIO_SCHEMA_VERSION,
    operation_id: crypto.randomUUID(),
    idempotency_key: `ui-${crypto.randomUUID()}`,
    trace_id: `ui-trace-${crypto.randomUUID()}`,
    actor: { id: "studio-operator", type: "human" },
    intent: `Apply ${capabilityId}`,
    capability: { id: capabilityId, version: STUDIO_SCHEMA_VERSION },
    target: { resource: `toolshape-studio://projects/${encodeURIComponent(initialProject.id)}`, expected_revision: expectedRevision },
    input,
    risk: { level: "low" },
    authorization: { grant_ids: [capabilityId] },
    execution: { dry_run: false, atomicity: "atomic" },
    retention: { class: "project", content_storage: "local" },
    created_at: new Date().toISOString(),
  }), [initialProject.id]);

  const apply = useCallback(
    (draft: OperationDraft, actor: "operator" | "agent" = "operator") => {
      const operation = {
        ...draft,
        operationId: crypto.randomUUID(),
        expectedRevision: project.revision,
        actor,
      } as StudioOperation;
      const result = invoke(
        makeEnvelope("studio.project.apply_operations", project.revision, { operations: [operation] }),
      );
      setUndoToken(result.undo?.token ?? null);
      setRedoToken(null);
      return result.state.semantic_diff[0];
    },
    [invoke, makeEnvelope, project.revision],
  );

  const undo = useCallback(() => {
    if (!undoToken) return;
    const result = invoke(
      makeEnvelope("studio.operation.undo", project.revision, { undo_token: undoToken }),
    );
    setUndoToken(null);
    setRedoToken(result.undo?.token ?? null);
  }, [invoke, makeEnvelope, project.revision, undoToken]);

  const redo = useCallback(() => {
    if (!redoToken) return;
    const result = invoke(
      makeEnvelope("studio.operation.undo", project.revision, { undo_token: redoToken }),
    );
    setRedoToken(null);
    setUndoToken(result.undo?.token ?? null);
  }, [invoke, makeEnvelope, project.revision, redoToken]);

  const queueRender = useCallback(() => {
    const result = invoke(
      makeEnvelope("studio.project.render", project.revision, {
        render: {
          cover_asset_id: "asset-product-image",
          preset_id: "render-social-portrait",
          output_name: "toolshape-studio-proof.mp4",
        },
      }),
    );
    if (!result.job) throw new Error("Render capability returned no durable job.");
    setRenderJob(result.job);
    return result.job;
  }, [invoke, makeEnvelope, project.revision]);

  return {
    project,
    apply,
    undo,
    redo,
    canUndo: undoToken !== null,
    canRedo: redoToken !== null,
    lastDiff,
    renderJob,
    queueRender,
  };
}
