import { useCallback, useEffect, useRef, useState } from "react";
import type { SemanticDiff, StudioProject } from "@toolshape/studio-domain";
import {
  MemoryStudioJobGateway,
  MemoryStudioRepository,
  StudioKernel,
  type DurableJob,
  type OperationHistoryEntry,
} from "@toolshape/studio-kernel";
import {
  StudioClient,
  StudioDisconnectedError,
  StudioStaleRevisionError,
  createMemoryTransport,
  type ApplyOptions,
  type OperationDraft,
  type StudioTransport,
} from "./studio-client";
import { createHttpTransport } from "./studio-transport-http";

export type { ApplyOptions, OperationDraft };

/**
 * How the editor is currently reaching the kernel.
 *
 * `local` is an honest label, not a failure: with no host configured the editor
 * runs its own in-process kernel so the app is usable standalone. Edits are
 * real and validated, but they live only in this tab and no agent can see them.
 * The shell says so rather than implying persistence it does not have.
 */
export type ConnectionState = "local" | "connecting" | "connected" | "disconnected";

/**
 * Agent edits arrive out-of-band, so the editor re-reads on an interval.
 *
 * Two seconds is a deliberate trade: an agent's change should feel like it
 * lands rather than eventually appearing, and the cost is one small local
 * request against a host that is usually on the same machine. An event stream
 * would remove the polling entirely and is the right answer once the Tauri
 * shell provides a persistent channel (ADR 0013).
 */
const POLL_INTERVAL_MS = 2000;

function readEnv(key: string): string | undefined {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const value = env?.[key];
  return value && value.length > 0 ? value : undefined;
}

/**
 * Chooses the transport.
 *
 * Configured endpoint wins; otherwise the editor falls back to an in-process
 * kernel. At Milestone 11 a Tauri IPC transport slots in here and nothing above
 * this function changes (ADR 0013).
 */
function resolveTransport(initialProject: StudioProject): { transport: StudioTransport; remote: boolean } {
  const endpoint = readEnv("VITE_STUDIO_ENDPOINT");
  const token = readEnv("VITE_STUDIO_TOKEN");
  if (endpoint && token) {
    return { transport: createHttpTransport({ endpoint, token }), remote: true };
  }
  const repository = new MemoryStudioRepository();
  repository.createProject(initialProject);
  return {
    transport: createMemoryTransport(new StudioKernel(repository, new MemoryStudioJobGateway())),
    remote: false,
  };
}

export function useStudioState(initialProject: StudioProject, injectedTransport?: StudioTransport) {
  const [project, setProject] = useState(initialProject);
  const [history, setHistory] = useState<OperationHistoryEntry[]>([]);
  const [undoToken, setUndoToken] = useState<string | null>(null);
  const [redoToken, setRedoToken] = useState<string | null>(null);
  const [lastDiff, setLastDiff] = useState<SemanticDiff | null>(null);
  const [renderJob, setRenderJob] = useState<DurableJob | null>(null);
  const [pending, setPending] = useState(false);
  const [stale, setStale] = useState(false);

  const setup = useRef<{ client: StudioClient; remote: boolean } | null>(null);
  if (!setup.current) {
    const resolved = injectedTransport
      ? { transport: injectedTransport, remote: false }
      : resolveTransport(initialProject);
    setup.current = {
      client: new StudioClient({ transport: resolved.transport, projectId: initialProject.id }),
      remote: resolved.remote,
    };
  }
  const { client, remote } = setup.current;

  const [connection, setConnection] = useState<ConnectionState>(remote ? "connecting" : "local");

  const adoptState = useCallback((next: StudioProject) => {
    setProject(next);
    setConnection((current) => (current === "local" ? current : "connected"));
  }, []);

  const readHistory = useCallback(async () => {
    // Revertibility depends on everything that came after an entry, so the
    // whole list is re-read rather than appended to.
    try {
      setHistory(await client.history());
    } catch {
      // History is supporting detail; failing to read it must not take down
      // the editor. The connection state already reports a real outage.
    }
  }, [client]);

  const refresh = useCallback(async () => {
    try {
      const state = await client.inspect();
      adoptState(state.project);
      setStale(false);
      await readHistory();
    } catch (error) {
      if (error instanceof StudioDisconnectedError) setConnection("disconnected");
      throw error;
    }
  }, [adoptState, client, readHistory]);

  useEffect(() => {
    void refresh().catch(() => {
      // Reported through connection state; a rejected initial load is not fatal.
    });
  }, [refresh]);

  // Poll only when talking to a host. In local mode nothing else can edit the
  // project, so polling would be pure waste.
  useEffect(() => {
    if (!remote) return;
    const timer = setInterval(() => {
      if (pending) return;
      void refresh().catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pending, refresh, remote]);

  /**
   * Runs a mutation and translates its failure modes.
   *
   * A stale rejection is surfaced and followed by a re-read, never retried at
   * the newer revision — doing that would silently discard whatever the other
   * editor just did, which is precisely what the revision check exists to stop.
   */
  const run = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T> => {
      setPending(true);
      try {
        const result = await action();
        setConnection((current) => (current === "local" ? current : "connected"));
        return result;
      } catch (error) {
        if (error instanceof StudioStaleRevisionError) {
          setStale(true);
          await refresh().catch(() => {});
        } else if (error instanceof StudioDisconnectedError) {
          setConnection("disconnected");
        }
        throw error;
      } finally {
        setPending(false);
      }
    },
    [refresh],
  );

  const apply = useCallback(
    (draft: OperationDraft, options: ApplyOptions = {}) =>
      run(async () => {
        const outcome = await client.apply(draft, options);
        adoptState(outcome.project);
        setLastDiff(outcome.diff);
        setUndoToken(outcome.undoToken);
        setRedoToken(null);
        await readHistory();
        return outcome.diff;
      }),
    [adoptState, client, readHistory, run],
  );

  const revert = useCallback(
    (operationId: string) =>
      run(async () => {
        const outcome = await client.revert(operationId);
        adoptState(outcome.project);
        setLastDiff(outcome.diff);
        setUndoToken(outcome.undoToken);
        setRedoToken(null);
        await readHistory();
        return outcome.diff;
      }),
    [adoptState, client, readHistory, run],
  );

  const undo = useCallback(() => {
    if (!undoToken) return Promise.resolve(null);
    return run(async () => {
      const outcome = await client.undo(undoToken);
      adoptState(outcome.project);
      setUndoToken(null);
      setRedoToken(outcome.undoToken);
      await readHistory();
      return outcome.diff;
    });
  }, [adoptState, client, readHistory, run, undoToken]);

  const redo = useCallback(() => {
    if (!redoToken) return Promise.resolve(null);
    return run(async () => {
      const outcome = await client.undo(redoToken);
      adoptState(outcome.project);
      setRedoToken(null);
      setUndoToken(outcome.undoToken);
      await readHistory();
      return outcome.diff;
    });
  }, [adoptState, client, readHistory, redoToken, run]);

  const queueRender = useCallback(
    () =>
      run(async () => {
        const job = await client.queueRender({
          coverAssetId: "asset-product-image",
          presetId: "render-social-portrait",
          outputName: "toolshape-studio-proof.mp4",
        });
        setRenderJob(job);
        await readHistory();
        return job;
      }),
    [client, readHistory, run],
  );

  return {
    project,
    history,
    apply,
    revert,
    undo,
    redo,
    canUndo: undoToken !== null,
    canRedo: redoToken !== null,
    lastDiff,
    renderJob,
    queueRender,
    refresh,
    pending,
    stale,
    connection,
  };
}
