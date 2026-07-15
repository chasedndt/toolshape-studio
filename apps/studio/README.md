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

Exercise the durable SQLite queue, a separate CLI worker process, artifact registration, and queued cancellation with:

```powershell
npm run smoke:render-job
```

The public render envelope accepts only a project asset ID, a project render-preset ID, and a safe logical `.mp4` name. The worker resolves the immutable `content://sha256/...` source beneath its configured content root and compiles FFmpeg arguments inside the trusted render boundary.

## Current boundary

The Studio repository now owns its domain, deterministic engine, semantic operation envelopes, grant/revision/idempotency kernel, SQLite repository, content-addressed imports, SDK, JSON CLI, durable render jobs, verified artifacts, rendering, and UI. The UI invokes the same in-process kernel as the SDK/CLI adapters.

`studio.project.render`, `studio.job.get`, and `studio.job.cancel` are verified through the shared kernel and JSON adapter mapping. A real process smoke proves queue, worker claim, progress, FFprobe verification, immutable artifact registration, readback, and queued cancellation. Authenticated local IPC, MCP, Tauri packaging, real media probe/proxy generation, signed distribution, and crash-proof multi-worker leases remain deferred. They must reuse the existing service rather than duplicate domain logic.
