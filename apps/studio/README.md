# Toolshape Studio operator seed

This app is the first Studio-owned operator surface. It renders the same `StudioProject` reduced by `@toolshape/studio-engine`; the canvas, layers, inspector and timeline do not maintain a second flattened document model.

## Run locally

```powershell
cd apps/studio
npm install
npm run typecheck
npm test
npm run dev
```

Open `http://127.0.0.1:5173/`. The export-only cover surface is `http://127.0.0.1:5173/?export=cover`.

With the dev server running, set `STUDIO_URL` to its printed URL and run `npm run qa:browser`. The script drives canonical split, ripple-trim, direct-transform, agent-style, undo, and redo operations in installed Chromium; checks the final state; records timing; and captures both a post-edit screenshot and render cover.

After capturing the cover to `artifacts/golden-cover.png`, create and verify the MP4 with:

```powershell
npm run render:golden
```

The render worker uses `spawn(binary, args, { shell: false })`, renders to a partial path, verifies the output with FFprobe, and promotes it to the final artifact path only after all checks pass.

## Current boundary

The Studio repository now owns its domain, deterministic engine, semantic operation envelopes, grant/revision/idempotency kernel, SQLite repository, content-addressed imports, SDK, JSON CLI, rendering, and UI. The UI invokes the same in-process kernel as the SDK/CLI adapters.

Render execution and cancellation are verified directly, but durable render-job orchestration is not yet connected to the public envelope. Authenticated local IPC, MCP, Tauri packaging, real media probe/proxy generation, and signed distribution remain deferred. They must reuse the existing service rather than duplicate domain logic.
