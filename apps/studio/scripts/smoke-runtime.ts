import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import path from "node:path";
import {
  STUDIO_SCHEMA_VERSION,
  StudioKernel,
} from "@toolshape/studio-kernel";
import {
  ContentAddressedAssetStore,
  SqliteStudioRepository,
} from "@toolshape/studio-persistence";
import {
  stateDigestFromResult,
  StudioSdk,
  type ContractOperationEnvelope,
} from "@toolshape/studio-sdk";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";

const appRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(appRoot, "../..");
const runtimeRoot = path.join(repoRoot, "runtime");
await mkdir(runtimeRoot, { recursive: true });
const runRoot = await mkdtemp(path.join(runtimeRoot, "smoke-"));
const coverPath = path.join(appRoot, "artifacts", "golden-cover.png");
const coverBytes = await readFile(coverPath);
const store = new ContentAddressedAssetStore(path.join(runRoot, "objects"));
const stored = await store.import({
  bytes: coverBytes,
  originalName: "golden-cover.png",
  mediaType: "image/png",
});

const project = createGoldenStudioProject();
const image = project.assets.find((asset) => asset.id === "asset-product-image");
if (!image) throw new Error("Golden project image asset is missing.");
image.contentHash = stored.digest;
image.sourceRef = `content://sha256/${stored.digest.slice("sha256:".length)}`;
image.width = 540;
image.height = 960;

const databasePath = path.join(runRoot, "studio.sqlite");
const repository = new SqliteStudioRepository(databasePath);
repository.createProject(project);
const sdk = new StudioSdk(new StudioKernel(repository));

function envelope(
  capability: ContractOperationEnvelope["capability"]["id"],
  revision: number,
  input: ContractOperationEnvelope["input"],
  dryRun: boolean,
): ContractOperationEnvelope {
  return {
    schema_version: STUDIO_SCHEMA_VERSION,
    operation_id: randomUUID(),
    idempotency_key: `smoke-${randomUUID()}`,
    trace_id: `smoke-trace-${randomUUID()}`,
    actor: { principal_id: "runtime-smoke", agent_id: "runtime-smoke", harness_id: "smoke" },
    intent: `Exercise ${capability}`,
    capability: { id: capability, version: STUDIO_SCHEMA_VERSION },
    target: {
      resource: { type: "studio_project", id: project.id, revision },
      expected_revision: revision,
    },
    input,
    risk: "reversible_local_write",
    authorization: { grant_ids: [capability] },
    execution: { dry_run: dryRun, atomicity: "atomic" },
    retention: { class: "R2_user_history", content_storage: "local" },
    created_at: new Date().toISOString(),
  };
}

const edit = {
  operationId: randomUUID(),
  type: "scene.node.update-text" as const,
  actor: "operator" as const,
  expectedRevision: 0,
  payload: {
    sceneId: "scene-hero",
    nodeId: "node-title",
    content: "Imported, persisted, editable.",
  },
};
const plan = sdk.invoke(envelope("studio.project.plan", 0, { operations: [edit] }, true));
if (repository.getProject(project.id)?.revision !== 0) throw new Error("Plan mutated durable state.");
const applied = sdk.invoke(
  envelope("studio.project.apply_operations", 0, { operations: [edit] }, false),
);
repository.close();

const reopened = new SqliteStudioRepository(databasePath);
const inspectSdk = new StudioSdk(new StudioKernel(reopened));
const inspected = inspectSdk.invoke(envelope("studio.project.inspect", 1, {}, false));
reopened.close();

process.stdout.write(
  `${JSON.stringify(
    {
      runRoot,
      databasePath,
      importedAsset: stored,
      plan: {
        status: plan.status,
        revisionBefore: plan.state.revision_before,
        revisionAfter: plan.state.revision_after,
      },
      apply: {
        status: applied.status,
        revisionAfter: applied.state.revision_after,
        digest: stateDigestFromResult(applied),
      },
      reopenInspect: {
        status: inspected.status,
        revision: inspected.state.revision_after,
        digest: stateDigestFromResult(inspected),
      },
      recovered: stateDigestFromResult(inspected) === stateDigestFromResult(applied),
    },
    null,
    2,
  )}\n`,
);
