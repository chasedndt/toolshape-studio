import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  MemoryStudioJobGateway,
  MemoryStudioRepository,
  STUDIO_SCHEMA_VERSION,
  StudioKernel,
  type OperationEnvelope,
  type StudioCapabilityId,
} from "@toolshape/studio-kernel";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import { dispatchJsonCli, StudioSdk } from "../src";

function createRequest(): OperationEnvelope {
  return {
    schema_version: STUDIO_SCHEMA_VERSION,
    operation_id: randomUUID(),
    idempotency_key: `parity-${randomUUID()}`,
    trace_id: `trace-${randomUUID()}`,
    actor: { id: "parity-test", type: "agent" },
    intent: "Compare adapters",
    capability: { id: "studio.project.apply_operations", version: STUDIO_SCHEMA_VERSION },
    target: { resource: "toolshape-studio://projects/project-launch-film", expected_revision: 0 },
    input: {
      operations: [{
        operationId: randomUUID(),
        type: "scene.node.update-transform",
        actor: "agent",
        expectedRevision: 0,
        payload: { sceneId: "scene-hero", nodeId: "node-product", patch: { x: 300 } },
      }],
    },
    risk: { level: "low" },
    authorization: { grant_ids: ["studio.project.apply_operations"] },
    execution: { dry_run: false, atomicity: "atomic" },
    retention: { class: "project", content_storage: "local" },
    created_at: new Date(0).toISOString(),
  };
}

function createSdk(): StudioSdk {
  const repository = new MemoryStudioRepository();
  repository.createProject(createGoldenStudioProject());
  return new StudioSdk(new StudioKernel(repository));
}

function createJobSdk(): StudioSdk {
  const repository = new MemoryStudioRepository();
  repository.createProject(createGoldenStudioProject());
  return new StudioSdk(new StudioKernel(repository, new MemoryStudioJobGateway()));
}

function jobRequest(
  capability: StudioCapabilityId,
  input: OperationEnvelope["input"],
): OperationEnvelope {
  return {
    ...createRequest(),
    operation_id: randomUUID(),
    idempotency_key: `job-parity-${randomUUID()}`,
    capability: { id: capability, version: STUDIO_SCHEMA_VERSION },
    input,
    authorization: { grant_ids: [capability] },
  };
}

describe("SDK and JSON CLI transport parity", () => {
  it("returns the same normalized result and final state digest", () => {
    const request = createRequest();
    const sdkResult = createSdk().invoke(request);
    const cliResult = JSON.parse(dispatchJsonCli(createSdk(), { command: "invoke", envelope: request }));
    expect(cliResult.status).toBe(sdkResult.status);
    expect(cliResult.state.semantic_diff).toEqual(sdkResult.state.semantic_diff);
    expect(cliResult.state.digest).toBe(sdkResult.state.digest);
    expect(cliResult.state.project).toEqual(sdkResult.state.project);
  });

  it("preserves render, job-read, and cancellation semantics through JSON CLI mapping", () => {
    const sdk = createJobSdk();
    const accepted = JSON.parse(
      dispatchJsonCli(sdk, {
        command: "invoke",
        envelope: jobRequest("studio.project.render", {
          render: {
            cover_asset_id: "asset-product-image",
            preset_id: "render-social-portrait",
            output_name: "adapter-parity.mp4",
          },
        }),
      }),
    );
    expect(accepted.status).toBe("accepted_job");
    expect(accepted.job.status).toBe("queued");

    const read = sdk.invoke(jobRequest("studio.job.get", { job_id: accepted.job.job_id }));
    expect(read.job?.status).toBe("queued");
    const cancelled = JSON.parse(
      dispatchJsonCli(sdk, {
        command: "invoke",
        envelope: jobRequest("studio.job.cancel", { job_id: accepted.job.job_id }),
      }),
    );
    expect(cancelled.job.status).toBe("cancelled");
    expect(cancelled.state.digest).toBe(read.state.digest);
  });
});
