import { describe, expect, it, vi } from "vitest";
import { startJobWorker, type JobRunner } from "../src";

/**
 * Every host had a job service and none had anything driving it, so work was
 * accepted and then sat in the database. A queue with no consumer is a more
 * convincing failure than an outright error, because everything up to the
 * waiting looks right.
 */

function job(id: string) {
  return { job_id: id, type: "studio.render", status: "completed" };
}

/** Resolves once the predicate holds, so tests never race a timer. */
async function until(predicate: () => boolean, label: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

describe("startJobWorker", () => {
  it("drains the queue", async () => {
    const queue = [job("a"), job("b"), job("c")];
    const seen: string[] = [];
    const runner: JobRunner = { runNext: async () => queue.shift() ?? null };

    const worker = startJobWorker(runner, { idleMs: 5, onJob: (done) => seen.push(done.job_id) });
    await until(() => seen.length === 3, "three jobs");
    await worker.stop();

    expect(seen).toEqual(["a", "b", "c"]);
  });

  it("keeps polling once the queue empties", async () => {
    // Otherwise the worker drains whatever was there at startup and then never
    // notices anything queued afterwards.
    let queued: ReturnType<typeof job> | null = null;
    const seen: string[] = [];
    const worker = startJobWorker(
      {
        runNext: async () => {
          const next = queued;
          queued = null;
          return next;
        },
      },
      { idleMs: 5, onJob: (done) => seen.push(done.job_id) },
    );

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(seen).toEqual([]);
    queued = job("late");
    await until(() => seen.length === 1, "the late job");
    await worker.stop();
    expect(seen).toEqual(["late"]);
  });

  it("survives a job that throws", async () => {
    // One malformed job must not take the worker down and stall everything
    // behind it.
    const queue: Array<() => Promise<ReturnType<typeof job> | null>> = [
      async () => {
        throw new Error("bad job");
      },
      async () => job("after"),
    ];
    const seen: string[] = [];
    const errors: unknown[] = [];
    const worker = startJobWorker(
      { runNext: async () => (queue.shift() ?? (async () => null))() },
      { idleMs: 5, onJob: (done) => seen.push(done.job_id), onError: (error) => errors.push(error) },
    );

    await until(() => seen.length === 1, "the job after the failure");
    await worker.stop();
    expect(errors).toHaveLength(1);
    expect(seen).toEqual(["after"]);
  });

  it("returns interrupted jobs to the queue before taking new ones", async () => {
    // A host that died mid-render would otherwise leave the job "running" with
    // nobody running it.
    const recover = vi.fn(() => 2);
    const worker = startJobWorker(
      { runNext: async () => null, recoverInterruptedJobs: recover },
      { idleMs: 5 },
    );
    await worker.stop();
    expect(recover).toHaveBeenCalledOnce();
  });

  it("waits for the job in flight before stopping", async () => {
    // Abandoning it would leave a half-written artifact behind.
    let finished = false;
    const worker = startJobWorker(
      {
        runNext: async () => {
          await new Promise((resolve) => setTimeout(resolve, 30));
          finished = true;
          return null;
        },
      },
      { idleMs: 5 },
    );
    // Let the tick actually begin. Stopping before one has started is a
    // different case: there is nothing in flight, so there is nothing to wait
    // for.
    await new Promise((resolve) => setTimeout(resolve, 10));
    await worker.stop();
    expect(finished).toBe(true);
  });

  it("stops taking work once stopped", async () => {
    let calls = 0;
    const worker = startJobWorker(
      { runNext: async () => { calls += 1; return null; } },
      { idleMs: 5 },
    );
    await worker.stop();
    const after = calls;
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(calls).toBe(after);
  });
});
