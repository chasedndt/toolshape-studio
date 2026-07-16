import { describe, expect, it } from "vitest";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import { migrateStudioProject } from "../src";

describe("Studio project migrations", () => {
  it("returns an isolated v2 document", () => {
    const source = createGoldenStudioProject();
    const migrated = migrateStudioProject(source);
    expect(migrated).toEqual(source);
    expect(migrated).not.toBe(source);
    expect(migrated.schemaVersion).toBe(2);
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
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.assets.every((asset) => asset.probe === null)).toBe(true);
    expect(migrated.assets.every((asset) => asset.derivatives.length === 0)).toBe(true);
  });

  it("adds the v2 revision, provenance, and media boundaries to seed-era documents", () => {
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
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.revision).toBe(0);
    expect(migrated.provenance).toEqual([]);
    expect(migrated.assets.every((asset) => asset.derivatives.length === 0)).toBe(true);
  });

  it("rejects unknown future schemas", () => {
    expect(() => migrateStudioProject({ schemaVersion: 99 })).toThrow(/unsupported/i);
  });
});
