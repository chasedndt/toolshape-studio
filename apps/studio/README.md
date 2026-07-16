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

With the dev server running, set `STUDIO_URL` to its printed URL and run `npm run qa:browser`. The script switches Create/Edit/Review shell arrangements without changing project revision, exercises the View menu, hides/restores the timeline, selects source/context tabs, drives canonical split, ripple-trim, direct-transform, agent-style, undo, redo, and render operations, checks the final state, and captures the closed editor, open View menu, and render cover.

## Editor shell

The browser seed now has a typed ephemeral editor shell over the canonical project:

- Create, Edit, Review, and Automate workspace arrangements;
- Media, Layers, Text, Audio, and Captions source panels backed by current project data;
- separate Inspector, Agent, and Quality context tabs;
- File, Edit, and View menus with honest disabled native-only actions;
- independent source/context/timeline visibility;
- keyboard undo/redo, Escape-to-close menus, and Alt+1 through Alt+4 workspace selection;
- Lucide interface icons, visible focus states, reduced-motion handling, and larger core control targets.

Workspace and panel choices are view state only. They do not enter `StudioProject`, revisions, semantic diffs, persistence, public contracts, project hashes, or render plans.

After capturing the cover to `artifacts/golden-cover.png`, create and verify the MP4 with:

```powershell
npm run render:golden
```

The render worker uses `spawn(binary, args, { shell: false })`, renders to a partial path, verifies the output with FFprobe, and promotes it to the final artifact path only after all checks pass.

Exercise the durable SQLite queue, a separate CLI worker process, artifact registration, and queued cancellation with:

```powershell
npm run smoke:render-job
```

Generate a license-safe MP4 with audio, invoke the separate-process JSON CLI media importer, probe the immutable original, create and verify an editing proxy, and reopen its SQLite record with:

```powershell
npm run smoke:media-ingest
```

The `ingest-media` JSON CLI command accepts a source path through stdin plus an original name and declared media type. The response contains only normalized canonical asset/proxy metadata; local content paths remain inside the host.

The public render envelope accepts only a project asset ID, a project render-preset ID, and a safe logical `.mp4` name. The worker resolves the immutable `content://sha256/...` source beneath its configured content root and compiles FFmpeg arguments inside the trusted render boundary.

## Current boundary

The Studio repository now owns its domain, deterministic engine, semantic operation envelopes, grant/revision/idempotency kernel, SQLite repository, byte-sniffed content-addressed imports, probed media/proxy generation, SDK, JSON CLI, durable render jobs, verified artifacts, rendering, and a scalable human/agent editor shell. The UI invokes the same in-process kernel, while SDK/CLI public documents are projected and validated against the shared Draft 2020-12 schemas.

`studio.project.render`, `studio.job.get`, and `studio.job.cancel` are verified through the shared kernel and JSON adapter mapping. Real process smokes prove media import/proxy/reopen and render queue/claim/progress/verification/artifact/read/cancel behavior. Authenticated local IPC, MCP, Tauri packaging, waveform generation, hostile-codec sandboxing, signed distribution, and crash-proof multi-worker leases remain deferred. They must reuse the existing services rather than duplicate domain logic.
