/**
 * Drains queued jobs.
 *
 * Every host had a job service and none had anything driving it, so a render
 * or an export was accepted, written to the database, and then sat there. The
 * caller was told the work had been queued, which was true, and would have
 * waited for it forever. A queue with no consumer is a more convincing failure
 * than an outright error, because everything up to the waiting looks right.
 */

export interface JobRunner {
  runNext(): Promise<{ job_id: string; type: string; status: string } | null>;
  recoverInterruptedJobs?(): number;
}

export interface JobWorkerOptions {
  /** How long to wait before looking again once the queue is empty. */
  idleMs?: number;
  onJob?: (job: { job_id: string; type: string; status: string }) => void;
  onError?: (error: unknown) => void;
  /** Reports how many interrupted jobs were returned to the queue at startup. */
  onRecovered?: (count: number) => void;
}

export interface JobWorker {
  stop(): Promise<void>;
}

export function startJobWorker(runner: JobRunner, options: JobWorkerOptions = {}): JobWorker {
  const idleMs = options.idleMs ?? 250;
  let running = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  /**
   * The tick currently executing, if any.
   *
   * Tracked so `stop` can wait for real work without waiting on an idle timer.
   * Signalling completion from inside the tick instead would deadlock a worker
   * stopped while idle: there is no tick left to do the signalling.
   */
  let inFlight: Promise<void> | null = null;

  // Jobs interrupted by a crash or a restart are returned to the queue before
  // anything new is taken, so a host that died mid-render picks up where it
  // left off rather than leaving the job "running" with nobody running it.
  const recovered = runner.recoverInterruptedJobs?.() ?? 0;
  if (recovered > 0) options.onRecovered?.(recovered);

  const schedule = (delayMs: number): void => {
    if (!running) return;
    timer = setTimeout(() => {
      timer = null;
      inFlight = tick().finally(() => {
        inFlight = null;
      });
    }, delayMs);
  };

  const tick = async (): Promise<void> => {
    if (!running) return;
    let found = false;
    try {
      const job = await runner.runNext();
      if (job) {
        found = true;
        options.onJob?.(job);
      }
    } catch (error) {
      // Swallowed on purpose. One malformed job must not take the worker down
      // with it and stall every job behind it.
      options.onError?.(error);
    }
    // Straight back round when something was found, so a batch of nine exports
    // does not collect an idle wait between each one.
    schedule(found ? 0 : idleMs);
  };

  schedule(0);

  return {
    async stop(): Promise<void> {
      running = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      // Looped rather than awaited once: a tick that was already scheduled can
      // start between the flag being set and this await, and abandoning it
      // would leave a half-written artifact behind.
      while (inFlight) await inFlight;
    },
  };
}
