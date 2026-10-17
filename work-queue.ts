/** FIFO capacity shared by extraction and independent payment verification. */
export class WorkQueue {
  private active = 0;
  private waiting: (() => void)[] = [];
  constructor(private limit = 3) {}
  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) await new Promise<void>(resolve => this.waiting.push(resolve));
    else this.active++;
    try { return await work(); }
    finally { const next = this.waiting.shift(); if (next) next(); else this.active--; }
  }
}

// Match the server's capacity across document and payment reads together.
export const aiRequestQueue = new WorkQueue(4);
