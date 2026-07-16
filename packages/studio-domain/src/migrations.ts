import type { StudioProject } from "./model";

export const CURRENT_STUDIO_SCHEMA_VERSION = 3 as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Studio owns project-document migration; public adapter contracts are validated separately. */
export function migrateStudioProject(input: unknown): StudioProject {
  if (!isRecord(input)) {
    throw new TypeError("Studio project must be an object.");
  }

  if (input.schemaVersion === CURRENT_STUDIO_SCHEMA_VERSION) {
    return structuredClone(input) as unknown as StudioProject;
  }

  if (
    input.schemaVersion === 0 ||
    input.schemaVersion === 1 ||
    input.schemaVersion === 2 ||
    input.schemaVersion === undefined
  ) {
    const assets = Array.isArray(input.assets)
      ? input.assets.map((asset) => isRecord(asset)
        ? {
            ...asset,
            probe: isRecord(asset.probe) ? asset.probe : null,
            derivatives: Array.isArray(asset.derivatives)
              ? asset.derivatives.map((derivative) => isRecord(derivative)
                ? { ...derivative, probe: isRecord(derivative.probe) ? derivative.probe : null }
                : derivative)
              : [],
          }
        : asset)
      : [];
    const migrated = {
      ...input,
      schemaVersion: CURRENT_STUDIO_SCHEMA_VERSION,
      revision: typeof input.revision === "number" ? input.revision : 0,
      effects: Array.isArray(input.effects) ? input.effects : [],
      renderPresets: Array.isArray(input.renderPresets) ? input.renderPresets : [],
      styleProfileRef: input.styleProfileRef ?? null,
      provenance: Array.isArray(input.provenance) ? input.provenance : [],
      assets,
    };

    return structuredClone(migrated) as unknown as StudioProject;
  }

  throw new RangeError(`Unsupported Studio schema version: ${String(input.schemaVersion)}`);
}
