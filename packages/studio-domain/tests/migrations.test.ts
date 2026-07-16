import { describe, expect, it } from "vitest";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import { migrateStudioProject } from "../src";

describe("Studio project migrations", () => {
  it("returns an isolated v3 document", () => {
    const source = createGoldenStudioProject();
    const migrated = migrateStudioProject(source);
    expect(migrated).toEqual(source);
    expect(migrated).not.toBe(source);
    expect(migrated.schemaVersion).toBe(3);
  });

  it("migrates v2 image derivatives to an explicit nullable probe", () => {
    const source = createGoldenStudioProject() as unknown as Record<string, unknown>;
    source.schemaVersion = 2;
    const assets = source.assets as Array<Record<string, unknown>>;
    assets[0].derivatives = [{
      id: "thumbnail-v2",
      kind: "thumbnail",
      mediaType: "image/png",
      contentHash: `sha256:${"d".repeat(64)}`,
      sourceRef: `content://sha256/${"d".repeat(64)}`,
      immutable: true,
      width: 320,
      height: 180,
      createdAt: new Date(0).toISOString(),
      provenance: { sourceDigest: assets[0].contentHash, toolchain: [] },
    }];
    const migrated = migrateStudioProject(source);
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.assets[0].derivatives[0].probe).toBeNull();
  });

  it("migrates v1 assets to explicit probe and derivative state", () => {
    const source = createGoldenStudioProject() as unknown as Record<string, unknown>;
    source.schemaVersion = 1;
    source.assets = (source.assets as Array<Record<string, unknown>>).map((asset) => {
      const legacy = { ...asset };
      delete legacy.probe;
      delete legacy.derivatives;
      return legacy;
    });
    const migrated = migrateStudioProject(source);
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.assets.every((asset) => asset.probe === null)).toBe(true);
    expect(migrated.assets.every((asset) => asset.derivatives.length === 0)).toBe(true);
  });

  it("adds current revision, provenance, and media boundaries to seed-era documents", () => {
    const source = createGoldenStudioProject() as unknown as Record<string, unknown>;
    delete source.schemaVersion;
    delete source.provenance;
    source.assets = (source.assets as Array<Record<string, unknown>>).map((asset) => {
      const legacy = { ...asset };
      delete legacy.probe;
      delete legacy.derivatives;
      return legacy;
    });
    const migrated = migrateStudioProject(source);
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.revision).toBe(0);
    expect(migrated.provenance).toEqual([]);
    expect(migrated.assets.every((asset) => asset.derivatives.length === 0)).toBe(true);
  });

  it("rejects unknown future schemas", () => {
    expect(() => migrateStudioProject({ schemaVersion: 99 })).toThrow(/unsupported/i);
  });
});
