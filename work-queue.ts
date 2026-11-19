/** FIFO capacity shared by extraction and independent payment verification. */
export class WorkQueue {
  private active = 0;
  private waiting: (() => void)[] = [];
  constructor(private limit = 3) {}
  async run<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    signal?.throwIfAborted();
    if (this.active >= this.limit) await new Promise<void>((resolve, reject) => {
      const resume = () => {
        signal?.removeEventListener('abort', cancel);
        resolve();
      };
      const cancel = () => {
        this.waiting = this.waiting.filter(waiter => waiter !== resume);
        reject(signal?.reason);
      };
      this.waiting.push(resume);
      signal?.addEventListener('abort', cancel, { once: true });
    });
    else this.active++;
    try {
      signal?.throwIfAborted();
      return await work();
    }
    finally { const next = this.waiting.shift(); if (next) next(); else this.active--; }
  }
}

// Match the server's capacity across document and payment reads together.
export const aiRequestQueue = new WorkQueue(4);
