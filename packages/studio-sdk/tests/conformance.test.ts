import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  MemoryStudioJobGateway,
  MemoryStudioRepository,
  STUDIO_SCHEMA_VERSION,
  StudioKernel,
  type ArtifactRecord,
} from "@toolshape/studio-kernel";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import {
  StudioSdk,
  dispatchJsonCli,
  jobDocumentFromResult,
  projectArtifactDocument,
  validateArtifactDocument,
  validateJobDocument,
  validateOperationEnvelopeDocument,
  validateOperationResultDocument,
  type ContractOperationEnvelope,
} from "../src";

function publicEnvelope(capability = "studio.project.render"): ContractOperationEnvelope {
  return {
    schema_version: STUDIO_SCHEMA_VERSION,
    operation_id: randomUUID(),
    idempotency_key: `contract-${randomUUID()}`,
    trace_id: `contract-trace-${randomUUID()}`,
    actor: {
      principal_id: "operator-1",
      agent_id: "studio-sdk",
      harness_id: "vitest",
      chaseos_session_id: null,
      delegation_chain: ["operator-1", "studio-sdk"],
    },
    intent: `Exercise ${capability}`,
    capability: { id: capability, version: STUDIO_SCHEMA_VERSION },
    target: {
      resource: { type: "studio_project", id: "project-launch-film", revision: 0 },
      expected_revision: 0,
      selection_refs: [],
    },
    input: {
      render: {
        cover_asset_id: "asset-product-image",
        preset_id: "render-social-portrait",
        output_name: "contract-proof.mp4",
      },
    },
    context_refs: [],
    secret_refs: [],
    risk: "reversible_local_write",
    authorization: { grant_ids: [capability], approval_id: null, max_cost: null },
    execution: { dry_run: false, atomicity: "atomic", timeout_ms: 30_000, priority: "normal" },
    retention: { class: "R2_user_history", content_storage: "local", expires_at: null },
    created_at: new Date(0).toISOString(),
  };
}

function sdk(): StudioSdk {
  const repository = new MemoryStudioRepository();
  repository.createProject(createGoldenStudioProject());
  return new StudioSdk(new StudioKernel(repository, new MemoryStudioJobGateway()));
}

describe("shared Draft 2020-12 adapter conformance", () => {
  it("validates real SDK input/output and JSON CLI parity", () => {
    const request = publicEnvelope();
    expect(validateOperationEnvelopeDocument(request)).toBe(request);
    const client = sdk();
    const direct = client.invoke(request);
    expect(validateOperationResultDocument(direct)).toBe(direct);
    const cli = JSON.parse(dispatchJsonCli(client, { command: "invoke", envelope: request }));
    expect(validateOperationResultDocument(cli)).toBe(cli);
    expect(cli).toEqual(direct);
    expect(cli.state).not.toHaveProperty("project");
    expect(cli.state).not.toHaveProperty("digest");
    expect(JSON.stringify(cli)).not.toMatch(/[A-Z]:\\|contentPath/i);
  });

  it("emits a separately schema-valid job document without internal ownership fields", () => {
    const result = sdk().invoke(publicEnvelope());
    const job = jobDocumentFromResult(result);
    expect(validateJobDocument(job)).toBe(job);
    expect(job.status).toBe("queued");
    expect(job).not.toHaveProperty("project_id");
    expect(job).not.toHaveProperty("trace_id");
  });

  it("projects verified internal artifacts into the shared artifact contract", () => {
    const artifact: ArtifactRecord = {
      schema_version: STUDIO_SCHEMA_VERSION,
      artifact_id: randomUUID(),
      logical_name: "proxy.mp4",
      media_type: "video/mp4",
      size_bytes: 128,
      digest: `sha256:${"a".repeat(64)}`,
      source: ["toolshape-studio://projects/project-launch-film/revisions/2"],
      producer: { operation_id: randomUUID(), job_id: randomUUID(), toolchain: [] },
      sensitivity: "private",
      retention_class: "project",
      licence: null,
      created_at: new Date(0).toISOString(),
      expires_at: null,
    };
    const document = projectArtifactDocument(artifact);
    expect(validateArtifactDocument(document)).toBe(document);
    expect(document.source[0]).toEqual({ type: "studio_project", id: "project-launch-film", revision: 2 });
  });

  it("fails closed on extra public fields", () => {
    expect(() => validateOperationEnvelopeDocument({
      ...publicEnvelope(),
      injected_policy_override: true,
    })).toThrow(/schema/i);
  });

  it("rejects a schema-valid but capability-incompatible target type", () => {
    const request = publicEnvelope();
    request.target.resource.type = "voice_project";
    expect(() => sdk().invoke(request)).toThrow(/studio_project/i);
  });
});
