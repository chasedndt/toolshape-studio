import { spawn } from "node:child_process";
import { mkdir, mkdtemp, stat } from "node:fs/promises";
import path from "node:path";
import type { Asset } from "@toolshape/studio-domain";
import { SqliteStudioRepository } from "@toolshape/studio-persistence";

interface ProcessOutput { code?: number; stdout: string; stderr: string }

function run(binary: string, args: string[]): Promise<ProcessOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk: Buffer) => { stderr = `${stderr}${chunk.toString("utf8")}`.slice(-24_000); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${binary} exited with code ${String(code)}.\n${stderr}`));
    });
  });
}

function runCli(cliPath: string, databasePath: string, document: unknown): Promise<ProcessOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", cliPath, "--db", databasePath], {
      cwd: repoRoot,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
    child.stdin.end(JSON.stringify(document));
  });
}

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const runtimeRoot = path.join(repoRoot, "runtime");
await mkdir(runtimeRoot, { recursive: true });
const runRoot = await mkdtemp(path.join(runtimeRoot, "media-ingest-"));
const sourcePath = path.join(runRoot, "generated-source.mp4");
const objectRoot = path.join(runRoot, "objects");
const databasePath = path.join(runRoot, "studio.sqlite");
const cliPath = path.join(repoRoot, "packages", "studio-cli", "src", "bin.ts");

await run("ffmpeg", [
  "-hide_banner",
  "-nostdin",
  "-y",
  "-f", "lavfi",
  "-i", "testsrc2=size=1280x720:rate=30",
  "-f", "lavfi",
  "-i", "sine=frequency=880:sample_rate=48000",
  "-t", "4",
  "-c:v", "libx264",
  "-pix_fmt", "yuv420p",
  "-c:a", "aac",
  "-b:a", "128k",
  "-shortest",
  sourcePath,
]);

const cli = await runCli(cliPath, databasePath, {
  command: "ingest-media",
  source_path: sourcePath,
  original_name: "generated-source.mp4",
  declared_media_type: "video/mp4",
});
if (cli.code !== 0) throw new Error(`CLI media ingestion failed: ${cli.stderr}`);
const cliResult = JSON.parse(cli.stdout) as { status?: string; asset?: Asset };
if (cliResult.status !== "completed" || !cliResult.asset) {
  throw new Error(`CLI media ingestion failed: ${cli.stderr || cli.stdout}`);
}
const asset = cliResult.asset;

const reopened = new SqliteStudioRepository(databasePath);
const recovered = reopened.getMediaAsset(asset.id);
reopened.close();
if (JSON.stringify(recovered) !== JSON.stringify(asset)) {
  throw new Error("Normalized media asset did not survive SQLite reopen.");
}
const proxy = asset.derivatives.find((derivative) => derivative.kind === "proxy");
const thumbnail = asset.derivatives.find((derivative) => derivative.kind === "thumbnail");
const waveform = asset.derivatives.find((derivative) => derivative.kind === "waveform");
if (!proxy || !thumbnail || !waveform) {
  throw new Error("Verified proxy, thumbnail, and waveform derivatives are required for this fixture.");
}
if (proxy.width !== 960 || proxy.height !== 540) {
  throw new Error(`Unexpected proxy dimensions: ${String(proxy.width)}x${String(proxy.height)}`);
}
if (proxy.probe?.video?.codec !== "h264" || proxy.probe.audio?.codec !== "aac") {
  throw new Error("Proxy codecs were not verified as H.264/AAC.");
}
if (thumbnail.width !== 480 || thumbnail.height !== 270 || thumbnail.probe !== null) {
  throw new Error(`Unexpected thumbnail evidence: ${String(thumbnail.width)}x${String(thumbnail.height)}.`);
}
if (waveform.width !== 1280 || waveform.height !== 160 || waveform.probe !== null) {
  throw new Error(`Unexpected waveform evidence: ${String(waveform.width)}x${String(waveform.height)}.`);
}
function contentPath(digest: string): string {
  const hex = digest.slice("sha256:".length);
  return path.join(objectRoot, hex.slice(0, 2), hex);
}
const originalDetails = await stat(contentPath(asset.contentHash));
const proxyDetails = await stat(contentPath(proxy.contentHash));
const thumbnailDetails = await stat(contentPath(thumbnail.contentHash));
const waveformDetails = await stat(contentPath(waveform.contentHash));

process.stdout.write(`${JSON.stringify({
  runRoot,
  source: {
    generated: true,
    mediaType: asset.mediaType,
    bytes: originalDetails.size,
    digest: asset.contentHash,
    probe: asset.probe,
  },
  proxy: {
    bytes: proxyDetails.size,
    digest: proxy.contentHash,
    mediaType: proxy.mediaType,
    width: proxy.width,
    height: proxy.height,
    duration: proxy.duration,
    probe: proxy.probe,
    toolchain: proxy.provenance.toolchain,
  },
  thumbnail: {
    bytes: thumbnailDetails.size,
    digest: thumbnail.contentHash,
    mediaType: thumbnail.mediaType,
    width: thumbnail.width,
    height: thumbnail.height,
    probe: thumbnail.probe,
  },
  waveform: {
    bytes: waveformDetails.size,
    digest: waveform.contentHash,
    mediaType: waveform.mediaType,
    width: waveform.width,
    height: waveform.height,
    duration: waveform.duration,
    probe: waveform.probe,
  },
  persistence: { databasePath, reopened: true },
  adapter: { command: "ingest-media", stderrDiagnostics: cli.stderr ? [cli.stderr] : [] },
  publicMetadataContainsLocalPath: JSON.stringify(asset).includes(runRoot),
}, null, 2)}\n`);
