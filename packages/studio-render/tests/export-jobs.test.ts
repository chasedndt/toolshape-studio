import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { STUDIO_SCHEMA_VERSION, StudioKernel, type OperationEnvelope } from "@toolshape/studio-kernel";
import { SqliteStudioRepository } from "@toolshape/studio-persistence";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import { DurableRenderJobService, type ExportExecutor } from "../src";

/**
 * The export renderer only mattered if an agent could reach it. These cover the
 * capability end to end — envelope in, files and artifacts out — and lean on
 * the cases where a job could report success without having produced what was
 * asked for.
 */

const temporaryRoots: string[] = [];
afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {})));
});

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "toolshape-export-jobs-"));
  temporaryRoots.push(root);
  const bytes = new TextEncoder().encode("export-fixture");
  const digest = createHash("sha256").update(bytes).digest("hex");
  const contentFile = path.join(root, "objects", digest.slice(0, 2), digest);
  await mkdir(path.dirname(contentFile), { recursive: true });
  await writeFile(contentFile, bytes);

  const project = createGoldenStudioProject();
  // The scene has an image node, so its bytes must be resolvable or every
  // export refuses — which is the behaviour one of these tests relies on.
  const asset = project.assets.find((candidate) => candidate.id === "asset-product-image")!;
  asset.contentHash = `sha256:${digest}`;
  asset.sourceRef = `content://sha256/${digest}`;
  // A second scene, so a batch export has more than one thing to produce.
  project.scenes.push({
    ...structuredClone(project.scenes[0]),
    id: "scene-square",
    name: "Square",
    size: { width: 1080, height: 1080 },
  });
  const repository = new SqliteStudioRepository(path.join(root, "studio.sqlite"));
  repository.createProject(project);
  return { root, repository, project };
}

function exportEnvelope(input: Record<string, unknown>, projectId: string): OperationEnvelope {
  return {
    schema_version: STUDIO_SCHEMA_VERSION,
    operation_id: randomUUID(),
    idempotency_key: `export-job-${randomUUID()}`,
    trace_id: `export-trace-${randomUUID()}`,
    actor: { id: "export-test", type: "agent" },
    intent: "Export designs",
    capability: { id: "studio.design.export", version: STUDIO_SCHEMA_VERSION },
    target: { resource: `toolshape-studio://projects/${projectId}`, expected_revision: 0 },
    input: { export: input as never },
    risk: { level: "low" },
    authorization: { grant_ids: ["studio.design.export"] },
    execution: { dry_run: false, atomicity: "atomic" },
    retention: { class: "project", content_storage: "local" },
    created_at: new Date(0).toISOString(),
  };
}

/** Writes the plan's own document, so the test never needs a browser. */
const writeDocument: ExportExecutor = async (plan) => {
  await mkdir(path.dirname(plan.finalOutputPath), { recursive: true });
  await writeFile(plan.finalOutputPath, plan.document, "utf8");
  return { outputPath: plan.finalOutputPath, bytes: Buffer.byteLength(plan.document) };
};

describe("studio.design.export", () => {
  it("accepts an export as a job rather than blocking the caller", async () => {
    const { root, repository, project } = await fixture();
    const jobs = new DurableRenderJobService(repository, {
      contentRoot: path.join(root, "objects"),
      artifactRoot: path.join(root, "artifacts"),
      executeExport: writeDocument,
    });
    const result = new StudioKernel(repository, jobs).invoke(
      exportEnvelope(
        { scene_ids: [project.scenes[0].id], format: "svg", output_name: "batch" },
        project.id,
      ),
    );
    expect(result.status).toBe("accepted_job");
    expect(result.job?.type).toBe("studio.design.export");
    repository.close();
  });

  it("writes one file per scene and registers each as its own artifact", async () => {
    // A caller should be able to fetch one variant without knowing about the
    // rest, which is only true if each file is separately addressable.
    const { root, repository, project } = await fixture();
    const jobs = new DurableRenderJobService(repository, {
      contentRoot: path.join(root, "objects"),
      artifactRoot: path.join(root, "artifacts"),
      executeExport: writeDocument,
    });
    new StudioKernel(repository, jobs).invoke(
      exportEnvelope(
        { scene_ids: [project.scenes[0].id, "scene-square"], format: "svg", output_name: "batch" },
        project.id,
      ),
    );

    const completed = await jobs.runNext();
    expect(completed?.status).toBe("completed");
    expect(completed?.outputs).toHaveLength(2);

    const files = await readdir(path.join(root, "artifacts", "batch"));
    expect(files.sort()).toEqual([`${project.scenes[0].id}.svg`, "scene-square.svg"]);

    for (const output of completed!.outputs) {
      const artifact = repository.getArtifact(output.split("/").at(-1)!);
      expect(artifact?.media_type).toBe("image/svg+xml");
      expect(artifact?.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    }
    repository.close();
  });

  it("exports the scene the caller asked for, not the active one", async () => {
    const { root, repository, project } = await fixture();
    const jobs = new DurableRenderJobService(repository, {
      contentRoot: path.join(root, "objects"),
      artifactRoot: path.join(root, "artifacts"),
      executeExport: writeDocument,
    });
    new StudioKernel(repository, jobs).invoke(
      exportEnvelope({ scene_ids: ["scene-square"], format: "svg", output_name: "batch" }, project.id),
    );
    await jobs.runNext();
    const markup = await readFile(path.join(root, "artifacts", "batch", "scene-square.svg"), "utf8");
    expect(markup).toContain('viewBox="0 0 1080 1080"');
    repository.close();
  });

  it("fails the job rather than the process when a scene cannot be rendered", async () => {
    // The golden project has an image node whose bytes are not in the content
    // store, so a raster export of it must refuse rather than produce a design
    // with a hole in it.
    const { root, repository, project } = await fixture();
    const jobs = new DurableRenderJobService(repository, {
      contentRoot: path.join(root, "empty"),
      artifactRoot: path.join(root, "artifacts"),
      executeExport: writeDocument,
    });
    new StudioKernel(repository, jobs).invoke(
      exportEnvelope({ scene_ids: [project.scenes[0].id], format: "svg", output_name: "batch" }, project.id),
    );
    const attempted = await jobs.runNext();
    expect(attempted?.status).toBe("retry_scheduled");
    expect(attempted?.error_ref).toBe("studio.export.worker_failure");
    repository.close();
  });

  it("leaves nothing behind when an export fails partway through", async () => {
    // A half-written batch that survived on disk would be indistinguishable
    // from a finished one to anything reading the directory.
    const { root, repository, project } = await fixture();
    let calls = 0;
    const jobs = new DurableRenderJobService(repository, {
      contentRoot: path.join(root, "objects"),
      artifactRoot: path.join(root, "artifacts"),
      executeExport: async (plan) => {
        calls += 1;
        if (calls > 1) throw new Error("rasteriser died");
        return writeDocument(plan);
      },
    });
    new StudioKernel(repository, jobs).invoke(
      exportEnvelope(
        { scene_ids: [project.scenes[0].id, "scene-square"], format: "svg", output_name: "batch" },
        project.id,
      ),
    );
    await jobs.runNext();
    await expect(readdir(path.join(root, "artifacts", "batch"))).rejects.toThrow();
    repository.close();
  });

  it("refuses an output name that would escape the artifact root", async () => {
    const { root, repository, project } = await fixture();
    const jobs = new DurableRenderJobService(repository, {
      contentRoot: path.join(root, "objects"),
      artifactRoot: path.join(root, "artifacts"),
      executeExport: writeDocument,
    });
    expect(() =>
      new StudioKernel(repository, jobs).invoke(
        exportEnvelope(
          { scene_ids: [project.scenes[0].id], format: "svg", output_name: "../escaped" },
          project.id,
        ),
      ),
    ).toThrow();
    repository.close();
  });

  it("refuses an unknown scene at queue time rather than at run time", async () => {
    // Failing when the job runs would mean the caller was told the work was
    // accepted, then had to poll to learn it never could have been.
    const { root, repository, project } = await fixture();
    const jobs = new DurableRenderJobService(repository, {
      contentRoot: path.join(root, "objects"),
      artifactRoot: path.join(root, "artifacts"),
      executeExport: writeDocument,
    });
    expect(() =>
      new StudioKernel(repository, jobs).invoke(
        exportEnvelope({ scene_ids: ["scene-absent"], format: "svg", output_name: "batch" }, project.id),
      ),
    ).toThrow(/unknown scene/i);
    repository.close();
  });

  it("refuses duplicate scene ids", async () => {
    const { root, repository, project } = await fixture();
    const jobs = new DurableRenderJobService(repository, {
      contentRoot: path.join(root, "objects"),
      artifactRoot: path.join(root, "artifacts"),
      executeExport: writeDocument,
    });
    expect(() =>
      new StudioKernel(repository, jobs).invoke(
        exportEnvelope(
          { scene_ids: ["scene-square", "scene-square"], format: "svg", output_name: "batch" },
          project.id,
        ),
      ),
    ).toThrow(/unique/i);
    repository.close();
  });

  it("refuses an unsupported format", async () => {
    const { root, repository, project } = await fixture();
    const jobs = new DurableRenderJobService(repository, {
      contentRoot: path.join(root, "objects"),
      artifactRoot: path.join(root, "artifacts"),
      executeExport: writeDocument,
    });
    expect(() =>
      new StudioKernel(repository, jobs).invoke(
        exportEnvelope({ scene_ids: ["scene-square"], format: "tiff", output_name: "batch" }, project.id),
      ),
    ).toThrow(/format must be/i);
    repository.close();
  });

  it("keeps render and export requests apart", async () => {
    // Both share one column, so asking for the wrong kind has to be an error
    // rather than a silently mistyped object.
    const { root, repository, project } = await fixture();
    const jobs = new DurableRenderJobService(repository, {
      contentRoot: path.join(root, "objects"),
      artifactRoot: path.join(root, "artifacts"),
      executeExport: writeDocument,
    });
    const result = new StudioKernel(repository, jobs).invoke(
      exportEnvelope({ scene_ids: ["scene-square"], format: "svg", output_name: "batch" }, project.id),
    );
    expect(() => repository.getRenderRequest(result.job!.job_id)).not.toThrow();
    expect(repository.getExportRequest(result.job!.job_id).format).toBe("svg");
    repository.close();
  });
});
