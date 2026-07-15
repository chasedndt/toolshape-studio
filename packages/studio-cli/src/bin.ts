import { readFile } from "node:fs/promises";
import process from "node:process";
import type { StudioProject } from "@toolshape/studio-domain";
import { StudioKernel, type OperationEnvelope } from "@toolshape/studio-kernel";
import { SqliteStudioRepository } from "@toolshape/studio-persistence";
import { dispatchJsonCli, StudioSdk } from "@toolshape/studio-sdk";

interface CliDocument {
  command: "init" | "invoke";
  project?: StudioProject;
  envelope?: OperationEnvelope;
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
  try {
    if (document.command === "init") {
      if (!document.project) throw new TypeError("init requires a project document.");
      repository.createProject(document.project);
      process.stdout.write(`${JSON.stringify({ status: "completed", project_id: document.project.id, revision: document.project.revision })}\n`);
      return;
    }
    if (document.command === "invoke") {
      if (!document.envelope) throw new TypeError("invoke requires an operation envelope.");
      const sdk = new StudioSdk(new StudioKernel(repository));
      process.stdout.write(dispatchJsonCli(sdk, { command: "invoke", envelope: document.envelope }));
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
