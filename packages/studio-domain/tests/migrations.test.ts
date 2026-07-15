import { describe, expect, it } from "vitest";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import { migrateStudioProject } from "../src";

describe("Studio project migrations", () => {
  it("returns an isolated v1 document", () => {
    const source = createGoldenStudioProject();
    const migrated = migrateStudioProject(source);
    expect(migrated).toEqual(source);
    expect(migrated).not.toBe(source);
  });

  it("adds the v1 revision and provenance boundary to seed-era documents", () => {
    const source = createGoldenStudioProject() as unknown as Record<string, unknown>;
    delete source.schemaVersion;
    delete source.provenance;
    const migrated = migrateStudioProject(source);
    expect(migrated.schemaVersion).toBe(1);
    expect(migrated.revision).toBe(0);
    expect(migrated.provenance).toEqual([]);
  });

  it("rejects unknown future schemas", () => {
    expect(() => migrateStudioProject({ schemaVersion: 99 })).toThrow(/unsupported/i);
  });
});

