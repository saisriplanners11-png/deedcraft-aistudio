import assert from 'node:assert/strict';
import { build } from 'esbuild';

const data = {
  amount: ['1000', 'Amount: 1000'], refNo: ['123456', 'Cheque No. 123456'],
  bank: ['TEST BANK', 'Bank: TEST BANK'], branch: ['Sircilla', 'Branch: Sircilla'],
  date: ['2026-10-17', 'DATE: 17/10/2026'], payer: ['TEST DRAWER', 'Drawer: TEST DRAWER'],
  payee: ['TEST BENEFICIARY', 'PAY: TEST BENEFICIARY'],
};
const state = { active: 0, peak: 0, calls: 0, leaf: true };
globalThis.__qaRead = async (request, options, payment = false) => {
  options.signal.throwIfAborted();
  state.active++;
  state.peak = Math.max(state.peak, state.active);
  state.calls++;
  try {
    await new Promise((resolve, reject) => {
      const finish = () => { options.signal.removeEventListener('abort', abort); resolve(); };
      const timer = setTimeout(finish, 15);
      const abort = () => { clearTimeout(timer); reject(options.signal.reason); };
      options.signal.addEventListener('abort', abort, { once: true });
    });
    if (!payment) return { content: [{ type: 'tool_use', name: 'record_transcription', input: { candidates: [] } }] };
    return { parsed_output: {
      ...Object.fromEntries(Object.entries(data).map(([key, [value]]) => [key, value])),
      evidence: Object.fromEntries(Object.entries(data).map(([key, [, quote]]) => [key, { page: 1, quote }])),
      chequeLeaf: state.leaf,
    }, stop_reason: 'end_turn' };
  } finally { state.active--; }
};

const bundle = await build({
  stdin: { contents: [
    "export { extractPayment } from './payments';",
    "export { extractUpload } from './upload-extraction';",
    "export { aiRequestQueue } from './work-queue';",
    "export { readWithRetry } from './extraction-request';",
  ].join('\n'), resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'fixture-ai', setup(build) {
    build.onLoad({ filter: /[/\\]claude\.ts$/ }, () => ({
      loader: 'js', contents: 'export const EXTRACT_MODEL="test", VISION_MODEL="test", VERIFY_MODEL="test"; export const readableError=e=>e; export const getClient=()=>({messages:{parse:(r,o)=>globalThis.__qaRead(r,o,true),create:(r,o)=>globalThis.__qaRead(r,o)}});',
    }));
    build.onResolve({ filter: /\?url$/ }, args => ({ path: args.path, namespace: 'fixture-url' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture-url' }, () => ({ loader: 'js', contents: 'export default "unused-url";' }));
  } }],
});
const app = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const file = new File([Object.values(data).map(([, quote]) => quote).join('\n')], 'synthetic-proof.txt', { type: 'text/plain' });
const [cheque] = await Promise.all([
  app.extractPayment('cheque', [file]),
  app.extractUpload(file, new AbortController().signal, () => {}, undefined, 'party:executant'),
]);
assert.equal(cheque.values.amount, '1000');
assert.equal(cheque.values.refNo, '123456');
assert.equal(cheque.values.date, '2026-10-17');
assert.equal(cheque.values.branch, 'Sircilla');
assert.equal(cheque.values.payer, 'TEST DRAWER');
assert.equal(cheque.values.payee, 'TEST BENEFICIARY');
assert.equal(state.calls, 7, 'five cheque reads and two identity reads');
assert.equal(state.peak, 4);
assert.equal(state.active, 0);

const beforeUpi = state.calls;
state.leaf = false;
assert.equal((await app.extractPayment('upi', [file])).values.amount, '1000');
assert.equal(state.calls - beforeUpi, 3);
const beforeAdvice = state.calls;
assert.equal((await app.extractPayment('housing-loan', [file])).values.amount, '1000');
assert.equal(state.calls - beforeAdvice, 3);
state.leaf = true;
const beforeLoanCheque = state.calls;
assert.equal((await app.extractPayment('housing-loan', [file])).values.date, '2026-10-17');
assert.equal(state.calls - beforeLoanCheque, 5);

const cancelled = new AbortController();
const pending = app.extractPayment('cheque', [file], cancelled.signal);
setTimeout(() => cancelled.abort(), 5);
await assert.rejects(pending, { name: 'AbortError' });
assert.equal(state.active, 0);
const backoff = new AbortController();
let attempts = 0;
const rateLimited = app.readWithRetry('text', backoff.signal, async () => {
  attempts++;
  throw Object.assign(new Error('Rate limited'), { status: 429, headers: new Headers({ 'Retry-After': '2' }) });
});
const rejected = assert.rejects(rateLimited, { name: 'AbortError' });
let share = 0;
const readers = Array.from({ length: 4 }, () => app.aiRequestQueue.run(async () => {
  share++;
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(share, 4, 'all four slots remain usable during rate-limit backoff');
}));
await Promise.all(readers);
backoff.abort();
await rejected;
assert.equal(attempts, 1);
assert.equal(await app.aiRequestQueue.run(async () => 42), 42);
console.log('PASS: five cheque reads, three non-cheque reads, two identity reads, shared capacity and cancellation.');
