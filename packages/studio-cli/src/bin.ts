import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import type { StudioProject } from "@toolshape/studio-domain";
import { StudioKernel } from "@toolshape/studio-kernel";
import { MediaIngestionService } from "@toolshape/studio-media";
import { ContentAddressedAssetStore, SqliteStudioRepository } from "@toolshape/studio-persistence";
import { DurableRenderJobService } from "@toolshape/studio-render";
import { dispatchJsonCli, StudioSdk, type ContractOperationEnvelope } from "@toolshape/studio-sdk";

interface CliDocument {
  command: "init" | "invoke" | "work" | "recover" | "ingest-media";
  project?: StudioProject;
  envelope?: ContractOperationEnvelope;
  source_path?: string;
  original_name?: string;
  declared_media_type?: string;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dbIndex = args.indexOf("--db");
  const inputIndex = args.indexOf("--input");
  const databasePath = dbIndex >= 0 ? args[dbIndex + 1] : "runtime/studio.sqlite";
  const inputText = inputIndex >= 0 ? await readFile(args[inputIndex + 1], "utf8") : await readStdin();
  if (!databasePath || !inputText.trim()) throw new TypeError("Usage: toolshape-studio --db <path> [--input <json-file>]");
  const document = JSON.parse(inputText) as CliDocument;
  const repository = new SqliteStudioRepository(databasePath);
  const runtimeRoot = path.dirname(path.resolve(databasePath));
  const renderJobs = new DurableRenderJobService(repository, {
    contentRoot: path.join(runtimeRoot, "objects"),
    artifactRoot: path.join(runtimeRoot, "artifacts"),
  });
  const mediaIngestion = new MediaIngestionService({
    contentStore: new ContentAddressedAssetStore(path.join(runtimeRoot, "objects")),
    repository,
    workRoot: path.join(runtimeRoot, "media-work"),
  });
  try {
    if (document.command === "init") {
      if (!document.project) throw new TypeError("init requires a project document.");
      repository.createProject(document.project);
      process.stdout.write(`${JSON.stringify({ status: "completed", project_id: document.project.id, revision: document.project.revision })}\n`);
      return;
    }
    if (document.command === "invoke") {
      if (!document.envelope) throw new TypeError("invoke requires an operation envelope.");
      const sdk = new StudioSdk(new StudioKernel(repository, renderJobs));
      process.stdout.write(dispatchJsonCli(sdk, { command: "invoke", envelope: document.envelope }));
      return;
    }
    if (document.command === "work") {
      const job = await renderJobs.runNext();
      process.stdout.write(`${JSON.stringify({ status: job ? "worked" : "idle", job })}\n`);
      return;
    }
    if (document.command === "recover") {
      const recovered = renderJobs.recoverInterruptedJobs();
      process.stdout.write(`${JSON.stringify({ status: "completed", recovered })}\n`);
      return;
    }
    if (document.command === "ingest-media") {
      if (!document.source_path || !document.original_name || !document.declared_media_type) {
        throw new TypeError("ingest-media requires source_path, original_name, and declared_media_type.");
      }
      const result = await mediaIngestion.ingest({
        sourcePath: document.source_path,
        originalName: document.original_name,
        declaredMediaType: document.declared_media_type,
      });
      process.stdout.write(`${JSON.stringify({ status: "completed", asset: result.asset })}\n`);
      return;
    }
    throw new TypeError("Unknown CLI command.");
  } finally {
    repository.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${JSON.stringify({ status: "failed", error: { code: "studio.cli.failure", message } })}\n`);
  process.exitCode = 1;
});
