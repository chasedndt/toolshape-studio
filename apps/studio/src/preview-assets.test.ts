import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import { resolveAssetPreview, resolveFixturePreview } from "./preview-assets";

describe("preview asset resolution", () => {
  it("resolves known immutable fixture derivatives without changing canonical refs", () => {
    const asset = createGoldenStudioProject().assets[0];
    const thumbnail = resolveAssetPreview(asset, "thumbnail", resolveFixturePreview);
    const waveform = resolveAssetPreview(asset, "waveform", resolveFixturePreview);
    expect(thumbnail?.url).toMatch(/source-product-film\.thumbnail\.png$/);
    expect(waveform?.url).toMatch(/source-product-film\.waveform\.png$/);
    expect(thumbnail?.derivative.sourceRef).toMatch(/^content:\/\/sha256\/[a-f0-9]{64}$/);
  });

  it("fails closed for an unresolved or absent derivative", () => {
    const asset = createGoldenStudioProject().assets[0];
    expect(resolveAssetPreview(asset, "thumbnail", () => null)).toBeNull();
    expect(resolveAssetPreview(undefined, "waveform", resolveFixturePreview)).toBeNull();
  });

  it("keeps committed fixture bytes aligned with canonical derivative digests and dimensions", async () => {
    const asset = createGoldenStudioProject().assets[0];
    for (const derivative of asset.derivatives) {
      const filePath = path.resolve(
        import.meta.dirname,
        "../../../fixtures/studio/previews",
        `source-product-film.${derivative.kind}.png`,
      );
      const bytes = await readFile(filePath);
      expect(`sha256:${createHash("sha256").update(bytes).digest("hex")}`).toBe(derivative.contentHash);
      expect(bytes.readUInt32BE(16)).toBe(derivative.width);
      expect(bytes.readUInt32BE(20)).toBe(derivative.height);
    }
  });
});
