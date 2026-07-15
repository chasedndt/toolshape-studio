import { access } from "node:fs/promises";
import path from "node:path";
import { createFfmpegRenderPlan, executeVerifiedRender } from "@toolshape/studio-render";

const appRoot = path.resolve(import.meta.dirname, "..");
const coverPath = path.join(appRoot, "artifacts/golden-cover.png");
const outputPath = path.join(appRoot, "artifacts/cancelled-render.mp4");
const plan = createFfmpegRenderPlan({
  coverPath,
  outputPath,
  width: 1080,
  height: 1920,
  durationSeconds: 60,
});
const controller = new AbortController();
setTimeout(() => controller.abort(), 500);

let cancellationObserved = false;
try {
  await executeVerifiedRender(plan, { signal: controller.signal });
} catch (error) {
  cancellationObserved = error instanceof DOMException && error.name === "AbortError";
}

async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

const finalExists = await exists(plan.finalOutputPath);
const partialExists = await exists(plan.partialOutputPath);
if (!cancellationObserved || finalExists || partialExists) {
  throw new Error(
    `Cancellation invariant failed: observed=${cancellationObserved} final=${finalExists} partial=${partialExists}`,
  );
}

console.log(
  JSON.stringify({ cancellationObserved, finalExists, partialExists, processCleanup: "passed" }),
);

