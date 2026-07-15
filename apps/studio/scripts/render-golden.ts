import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { createFfmpegRenderPlan, executeVerifiedRender } from "@toolshape/studio-render";

const appRoot = path.resolve(import.meta.dirname, "..");
const coverPath = path.resolve(process.argv[2] ?? path.join(appRoot, "artifacts/golden-cover.png"));
const outputPath = path.resolve(process.argv[3] ?? path.join(appRoot, "artifacts/golden-studio.mp4"));

await access(coverPath);
const plan = createFfmpegRenderPlan({
  coverPath,
  outputPath,
  width: 1080,
  height: 1920,
  durationSeconds: 8,
  frameRate: 30,
});

const report = await executeVerifiedRender(plan, {
  onProgress(seconds) {
    process.stdout.write(`render-progress ${seconds.toFixed(2)}s\r`);
  },
});
const bytes = await readFile(outputPath);
const sha256 = createHash("sha256").update(bytes).digest("hex");

process.stdout.write("\n");
process.stdout.write(
  `${JSON.stringify(
    {
      artifact: outputPath,
      sha256,
      bytes: bytes.byteLength,
      verification: report.checks,
    },
    null,
    2,
  )}\n`,
);

