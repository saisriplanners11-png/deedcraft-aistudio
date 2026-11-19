import { aiRequestQueue } from './work-queue';

type ReadTask = 'text' | 'scan' | 'identity' | 'authority' | 'payment' | 'visual';

function retryDelay(error: unknown): number | undefined {
  const failure = error as { status?: number; headers?: Headers } | undefined;
  if (![429, 500, 502, 503, 504].includes(failure?.status ?? 0)) return;
  if (/no_api_key|key is not set|perday|per[\s_-]+day/i.test(String(error))) return;
  const header = failure?.headers?.get('retry-after');
  if (!header) return 600 + Math.random() * 400;
  const seconds = Number(header);
  const duration = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now();
  if (Number.isFinite(duration) && duration <= 5000) return Math.max(duration, 250);
}

function wait(ms: number, signal?: AbortSignal) {
  signal?.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', cancel);
      resolve();
    }, ms);
    signal?.addEventListener('abort', cancel, { once: true });
  });
}

/** A retry waits outside the four shared document/payment request slots. */
export async function readWithRetry<T>(
  task: ReadTask,
  signal: AbortSignal | undefined,
  read: (options: { signal?: AbortSignal; maxRetries: number; timeout: number; headers: Record<string, string> }) => Promise<T>,
): Promise<T> {
  const request = () => aiRequestQueue.run(() => read({
    signal, maxRetries: 0, timeout: 90000, headers: { 'x-deedcraft-extraction': task },
  }), signal);
  try {
    return await request();
  } catch (error) {
    signal?.throwIfAborted();
    const waitMs = retryDelay(error);
    if (waitMs === undefined) throw error;
    await wait(waitMs, signal);
    return await request();
  }
}
