import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import {
  MemoryStudioJobGateway,
  MemoryStudioRepository,
  STUDIO_SCHEMA_VERSION,
  StudioKernel,
  type OperationEnvelope,
  type StudioCapabilityId,
} from "../src";

function envelope(
  capability: StudioCapabilityId,
  input: OperationEnvelope["input"],
  overrides: Partial<OperationEnvelope> = {},
): OperationEnvelope {
  return {
    schema_version: STUDIO_SCHEMA_VERSION,
    operation_id: randomUUID(),
    idempotency_key: `job-test-${randomUUID()}`,
    trace_id: `job-trace-${randomUUID()}`,
    actor: { id: "job-test", type: "service" },
    intent: `Exercise ${capability}`,
    capability: { id: capability, version: STUDIO_SCHEMA_VERSION },
    target: {
      resource: "toolshape-studio://projects/project-launch-film",
      expected_revision: 0,
    },
    input,
    risk: { level: "low" },
    authorization: { grant_ids: [capability] },
    execution: { dry_run: false, atomicity: "atomic" },
    retention: { class: "project", content_storage: "local" },
    created_at: new Date(0).toISOString(),
    ...overrides,
  };
}

function renderInput(): OperationEnvelope["input"] {
  return {
    render: {
      cover_asset_id: "asset-product-image",
      preset_id: "render-social-portrait",
      output_name: "job-proof.mp4",
    },
  };
}

describe("Studio durable job capabilities", () => {
  it("queues one idempotent render without advancing project revision", () => {
    const repository = new MemoryStudioRepository();
    repository.createProject(createGoldenStudioProject());
    const jobs = new MemoryStudioJobGateway();
    const kernel = new StudioKernel(repository, jobs);
    const request = envelope("studio.project.render", renderInput());

    const accepted = kernel.invoke(request);
    const replay = kernel.invoke(request);

    expect(accepted.status).toBe("accepted_job");
    expect(accepted.job_ref).toMatch(/^toolshape-studio:\/\/jobs\//);
    expect(replay).toEqual(accepted);
    expect(repository.getProject("project-launch-film")?.revision).toBe(0);
    expect(jobs.list()).toHaveLength(1);
  });

  it("reads and cancels a queued job through revision-bound capabilities", () => {
    const repository = new MemoryStudioRepository();
    repository.createProject(createGoldenStudioProject());
    const jobs = new MemoryStudioJobGateway();
    const kernel = new StudioKernel(repository, jobs);
    const accepted = kernel.invoke(envelope("studio.project.render", renderInput()));
    const jobId = accepted.job_ref!.split("/").at(-1)!;

    const read = kernel.invoke(envelope("studio.job.get", { job_id: jobId }));
    expect(read.job?.status).toBe("queued");

    const cancelled = kernel.invoke(envelope("studio.job.cancel", { job_id: jobId }));
    expect(cancelled.job?.status).toBe("cancelled");
    expect(cancelled.job?.completed_at).not.toBeNull();
  });

  it("does not expose jobs across project resources", () => {
    const repository = new MemoryStudioRepository();
    const project = createGoldenStudioProject();
    repository.createProject(project);
    const other = createGoldenStudioProject();
    other.id = "other-project";
    repository.createProject(other);
    const jobs = new MemoryStudioJobGateway();
    const kernel = new StudioKernel(repository, jobs);
    const accepted = kernel.invoke(envelope("studio.project.render", renderInput()));
    const jobId = accepted.job_ref!.split("/").at(-1)!;

    expect(() =>
      kernel.invoke(
        envelope("studio.job.get", { job_id: jobId }, {
          target: {
            resource: "toolshape-studio://projects/other-project",
            expected_revision: 0,
          },
        }),
      ),
    ).toThrow(/project/i);
  });
});
