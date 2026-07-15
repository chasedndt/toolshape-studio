import type { StudioProject } from "./model";

export const CURRENT_STUDIO_SCHEMA_VERSION = 1 as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Studio owns only this domain migration boundary. Shared operation/job
 * envelopes will be integrated from platform-v0.1.0 when it exists.
 */
export function migrateStudioProject(input: unknown): StudioProject {
  if (!isRecord(input)) {
    throw new TypeError("Studio project must be an object.");
  }

  if (input.schemaVersion === CURRENT_STUDIO_SCHEMA_VERSION) {
    return structuredClone(input) as unknown as StudioProject;
  }

  if (input.schemaVersion === 0 || input.schemaVersion === undefined) {
    const migrated = {
      ...input,
      schemaVersion: CURRENT_STUDIO_SCHEMA_VERSION,
      revision: typeof input.revision === "number" ? input.revision : 0,
      effects: Array.isArray(input.effects) ? input.effects : [],
      renderPresets: Array.isArray(input.renderPresets) ? input.renderPresets : [],
      styleProfileRef: input.styleProfileRef ?? null,
      provenance: Array.isArray(input.provenance) ? input.provenance : [],
    };

    return structuredClone(migrated) as unknown as StudioProject;
  }

  throw new RangeError(`Unsupported Studio schema version: ${String(input.schemaVersion)}`);
}

