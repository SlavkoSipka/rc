// A small "must eventually happen" queue for work done from the buyer's browser right after
// PayPal captured a payment (order email, saving the order). There is no server in between,
// so each job is first saved to localStorage and only removed once it succeeded. Anything
// still pending (tab closed, network drop, service outage) is retried on the next page load.

const RETRY_DELAYS_MS = [0, 2000, 5000];

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function createPendingQueue<T>(
  storageKey: string,
  label: string,
  run: (payload: T, attempt: number) => Promise<void>
) {
  // Jobs running in this tab right now, so a flush never runs the same one twice
  const inFlight = new Set<string>();

  function readPending(): Record<string, T> {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch {
      return {};
    }
  }

  function writePending(pending: Record<string, T>) {
    try {
      if (Object.keys(pending).length === 0) {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, JSON.stringify(pending));
      }
    } catch {
      // Storage unavailable (private mode, quota) - the job still runs below
    }
  }

  async function runWithRetry(id: string, payload: T): Promise<boolean> {
    if (inFlight.has(id)) return false;
    inFlight.add(id);
    try {
      for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
        await wait(RETRY_DELAYS_MS[attempt]);
        try {
          await run(payload, attempt);
          const pending = readPending();
          delete pending[id];
          writePending(pending);
          return true;
        } catch (error) {
          console.error(`${label} for ${id} failed (attempt ${attempt + 1}):`, error);
        }
      }
      return false;
    } finally {
      inFlight.delete(id);
    }
  }

  return {
    enqueue(id: string, payload: T): Promise<boolean> {
      writePending({ ...readPending(), [id]: payload });
      return runWithRetry(id, payload);
    },
    flush() {
      for (const [id, payload] of Object.entries(readPending())) {
        void runWithRetry(id, payload);
      }
    }
  };
}
