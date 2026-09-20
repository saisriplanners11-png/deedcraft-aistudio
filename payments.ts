// The payments recited in the receipt clause.
//
// A sale is rarely discharged by one instrument: an advance token by UPI, a
// cheque on execution, an RTGS transfer on registration. Each payment is its
// own record with its own mode, and each can be read off a photograph of the
// instrument (a cheque leaf, a DD counterfoil, an RTGS advice, a UPI receipt).

import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import { getClient, EXTRACT_MODEL, readableError } from './claude';
import { fileToVisualParts } from './extract';

export type PayMode = 'rtgs' | 'cheque' | 'dd' | 'upi' | 'cash';

export type Payment = {
  id: string;
  mode: PayMode;
  /** Paid before execution, under an agreement of sale. */
  advance: boolean;
  /** 1% deducted under s.194-IA and remitted by the purchaser. */
  tds: boolean;
  amount: string;
  /** Cheque no., DD no., UTR or UPI reference — whatever the mode names. */
  refNo: string;
  bank: string;
  branch: string;
  date: string;
  payer: string;
  payee: string;
  /** The instrument image this payment was read from, if any. */
  docName?: string;
  /** Fields that were populated from an uploaded instrument. */
  filled?: string[];
};

/**
 * Payment instruments are legal components of the final consideration, not a
 * free-form running total. Keep this pure so typed and AI-extracted updates
 * use exactly the same guard before they reach state.
 */
export function paymentPatchError(payments: Payment[], paymentId: string, patch: Partial<Payment>, consideration: string): string | null {
  if (!consideration.trim()) return null;
  const finalConsideration = Number(consideration);
  if (!Number.isFinite(finalConsideration) || finalConsideration < 0) return null;
  const total = payments.reduce((sum, payment) => {
    const candidate = payment.id === paymentId ? { ...payment, ...patch } : payment;
    const amount = Number(candidate.amount);
    return sum + (Number.isFinite(amount) && amount > 0 ? amount : 0);
  }, 0);
  return total > finalConsideration
    ? `Payment total (₹${total.toLocaleString('en-IN')}) cannot exceed final sale consideration (₹${finalConsideration.toLocaleString('en-IN')}).`
    : null;
}

export type ModeSpec = {
  key: PayMode;
  label: string;
  telugu: string;
  /** Label for the reference-number field. */
  refLabel: string;
  refHint?: string;
  bankLabel?: string;
  branchLabel?: string;
  /** Which optional fields this mode shows. */
  shows: { ref: boolean; bank: boolean; branch: boolean; parties: boolean };
  /** What a drafter would upload for this mode. */
  docLabel: string;
  accept: string;
  /** How the payment reads in the receipt clause. */
  recital: (p: Payment) => string;
};

const money0 = (v: string) => (v === '' ? '____' : Number(v).toLocaleString('en-IN'));

export const MODES: ModeSpec[] = [
  {
    key: 'rtgs',
    label: 'RTGS / NEFT',
    telugu: 'బ్యాంకు బదిలీ',
    refLabel: 'UTR / reference no.',
    refHint: 'The 16-22 character UTR on the advice',
    bankLabel: 'Remitting bank',
    branchLabel: 'Branch',
    shows: { ref: true, bank: true, branch: true, parties: true },
    docLabel: 'RTGS / NEFT advice or bank statement line',
    accept: '.pdf,image/*',
    recital: p =>
      `₹${money0(p.amount)} by RTGS/NEFT bearing UTR ${p.refNo || '____'} dated ${p.date || '____'} through ${p.bank || '____'}`,
  },
  {
    key: 'cheque',
    label: 'Cheque',
    telugu: 'చెక్కు',
    refLabel: 'Cheque no.',
    refHint: '6–10 digits, in the labelled Cheque No. box',
    bankLabel: 'Bank name',
    branchLabel: 'Branch',
    shows: { ref: true, bank: true, branch: true, parties: true },
    docLabel: 'Photograph or scan of the cheque leaf',
    accept: '.pdf,image/*',
    recital: p =>
      `₹${money0(p.amount)} by cheque no. ${p.refNo || '____'} dated ${p.date || '____'} drawn on ${p.bank || '____'}${p.branch ? ', ' + p.branch : ''}`,
  },
  {
    key: 'dd',
    label: 'Demand Draft (DD)',
    telugu: 'డిమాండ్ డ్రాఫ్ట్',
    refLabel: 'DD no.',
    bankLabel: 'Issuing bank',
    branchLabel: 'Issuing branch',
    shows: { ref: true, bank: true, branch: true, parties: true },
    docLabel: 'The demand draft or its counterfoil',
    accept: '.pdf,image/*',
    recital: p =>
      `₹${money0(p.amount)} by demand draft no. ${p.refNo || '____'} dated ${p.date || '____'} issued by ${p.bank || '____'}`,
  },
  {
    key: 'upi',
    label: 'UPI / Online',
    telugu: 'యూపీఐ',
    refLabel: 'UPI / transaction ref.',
    refHint: '12-digit UTR shown on the receipt',
    bankLabel: 'App / bank',
    shows: { ref: true, bank: true, branch: false, parties: true },
    docLabel: 'Screenshot of the payment receipt',
    accept: 'image/*,.pdf',
    recital: p =>
      `₹${money0(p.amount)} by UPI transfer ref. ${p.refNo || '____'} dated ${p.date || '____'}`,
  },
  {
    key: 'cash',
    label: 'Cash',
    telugu: 'నగదు',
    refLabel: 'Receipt no.',
    shows: { ref: false, bank: false, branch: false, parties: true },
    docLabel: 'Cash receipt or acknowledgement, if one was written',
    accept: '.pdf,image/*',
    recital: p => `₹${money0(p.amount)} in cash on ${p.date || '____'}`,
  },
];

export const modeSpec = (mode: PayMode): ModeSpec =>
  MODES.find(m => m.key === mode) ?? MODES[1];

let seq = 0;
export const newPayment = (mode: PayMode = 'cheque', payer = '', payee = ''): Payment => ({
  id: `pay-${Date.now()}-${seq++}`,
  mode,
  advance: false,
  tds: false,
  amount: '',
  refNo: '',
  bank: '',
  branch: '',
  date: '',
  payer,
  payee,
  filled: [],
});

const n = (v: string) => (v === '' ? 0 : Number(v) || 0);

/** 1% under s.194-IA, deducted by the purchaser and not handed to the vendor. */
export const tdsOn = (p: Payment) => (p.tds ? Math.round(n(p.amount) * 0.01) : 0);

/** What the vendor actually receives for this payment. */
export const netOf = (p: Payment) => n(p.amount) - tdsOn(p);

export const totalOf = (ps: Payment[]) => ps.reduce((s, p) => s + n(p.amount), 0);
export const netTotalOf = (ps: Payment[]) => ps.reduce((s, p) => s + netOf(p), 0);
export const tdsTotalOf = (ps: Payment[]) => ps.reduce((s, p) => s + tdsOn(p), 0);

/** The receipt clause, one sentence per payment. */
export const recitalFor = (ps: Payment[]) =>
  ps
    .filter(p => p.amount !== '')
    .map(p => modeSpec(p.mode).recital(p) + (p.advance ? ' (paid in advance)' : ''))
    .join('; ');

const deedDate = (iso: string) => {
  const [year, month, day] = iso.split('-');
  return year && month && day ? `${day}-${month}-${year}` : iso || '____';
};

/** Template-style recital that preserves every individual payment amount. */
export const deedPaymentRecital = (ps: Payment[]) =>
  ps
    .filter(p => p.amount !== '')
    .map((p, index) => {
      // The template paragraph already carries the automatic "a)" number.
      const prefix = `${index ? `${String.fromCharCode(97 + index)}) ` : ''}Rs. ${money0(p.amount)}/-`;
      const advance = p.advance ? ' (paid in advance)' : '';
      if (p.mode === 'cash') return `${prefix} in cash on ${deedDate(p.date)}${advance}`;
      if (p.mode === 'cheque') {
        return `${prefix} through Cheque bearing No. ${p.refNo || '____'} drawn on ${[p.bank, p.branch].filter(Boolean).join(', ') || '____'} dated ${deedDate(p.date)}${advance}`;
      }
      if (p.mode === 'dd') return `${prefix} through Demand Draft bearing No. ${p.refNo || '____'} issued by ${[p.bank, p.branch].filter(Boolean).join(', ') || '____'} dated ${deedDate(p.date)}${advance}`;
      if (p.mode === 'rtgs') return `${prefix} through RTGS/NEFT bearing UTR ${p.refNo || '____'} through ${p.bank || '____'} dated ${deedDate(p.date)}${advance}`;
      return `${prefix} through UPI/online transfer bearing reference ${p.refNo || '____'} through ${p.bank || '____'} dated ${deedDate(p.date)}${advance}`;
    })
    .join('; ');

// ------------------------------------------------------------------ extraction

const SYSTEM = `You read Indian payment instruments and transcribe their particulars into a form.

Rules you must follow:
- Transcribe only what the instrument actually shows. Never infer, complete or invent a value.
- Omit any field the instrument does not show. An omitted field is correct; a guessed one is a serious error.
- Amounts: digits only, no rupee sign, commas or words. If the figure and the words disagree, take the words.
- Dates: return YYYY-MM-DD. Indian instruments write DD-MM-YYYY, so read the order carefully.
- Cheque numbers are the digits printed in the labelled Cheque No. box. They are commonly 6 to 10 digits; never use the account, IFSC, MICR or CTS number instead.
- Copy names exactly as written, including honorifics such as Sri or Smt.`;

const PROMPT: Record<PayMode, string> = {
  rtgs: 'This is an RTGS / NEFT advice, a bank statement line or a transfer receipt. Transcribe the amount, the UTR / reference number, the remitting bank and branch, the value date, and the remitter and beneficiary names.',
  cheque:
    'This is a cheque. Transcribe the amount, the 6-to-10 digit cheque number from the labelled Cheque No. box (not an account, IFSC, MICR or CTS number), the bank and branch printed on the leaf, the handwritten date in the DATE boxes (not the pre-printed issue/CTS date), the drawer (account holder, who is paying) and the payee (the name written after "Pay").',
  dd: 'This is a demand draft or its counterfoil. Transcribe the amount, the DD number, the issuing bank and branch, the date of issue, the applicant (purchaser) and the payee.',
  upi: 'This is a UPI or online payment receipt. Transcribe the amount, the transaction / UTR reference, the app or bank used, the date, and the payer and payee names.',
  cash: 'This is a cash receipt or acknowledgement. Transcribe the amount, the receipt number if any, the date, and who paid whom.',
};

const SCHEMA = {
  type: 'object' as const,
  properties: {
    amount: { type: 'string' as const, description: 'The amount paid, digits only.' },
    refNo: {
      type: 'string' as const,
      description: 'The instrument number: cheque no., DD no., UTR, or UPI transaction reference.',
    },
    bank: { type: 'string' as const, description: 'The bank the instrument is drawn on or remitted through.' },
    branch: { type: 'string' as const, description: 'The branch, as printed.' },
    date: { type: 'string' as const, description: 'The date on the instrument, as YYYY-MM-DD.' },
    payer: { type: 'string' as const, description: 'Who is paying — the drawer, remitter or applicant.' },
    payee: { type: 'string' as const, description: 'Who is being paid — the payee or beneficiary.' },
    detectedMode: {
      type: 'string' as const,
      description:
        'What this instrument actually is. One of: rtgs, cheque, dd, upi, cash. Say what you see, even if it is not what was asked for.',
    },
    _unreadable: {
      type: 'string' as const,
      description:
        'If this is not a payment instrument, or is too unclear to read, say so in one short sentence. Otherwise omit this field.',
    },
  },
  additionalProperties: false,
};

/**
 * A mode-specific schema built from that mode's `shows` spec, rather than the
 * one-size-fits-all `SCHEMA` above. A cash receipt has no bank/branch/ref, and
 * a UPI receipt has no branch — asking for fields that mode's instrument never
 * carries invites the model to fill something plausible-looking rather than
 * correctly omitting, since there's nothing telling it those fields don't
 * apply here at all.
 */
export function paymentSchemaFor(mode: PayMode) {
  const s = modeSpec(mode).shows;
  const properties: Record<string, (typeof SCHEMA)['properties'][keyof (typeof SCHEMA)['properties']]> = {
    amount: SCHEMA.properties.amount,
    date: SCHEMA.properties.date,
    ...(s.ref ? { refNo: SCHEMA.properties.refNo } : {}),
    ...(s.bank ? { bank: SCHEMA.properties.bank } : {}),
    ...(s.branch ? { branch: SCHEMA.properties.branch } : {}),
    ...(s.parties ? { payer: SCHEMA.properties.payer, payee: SCHEMA.properties.payee } : {}),
    detectedMode: SCHEMA.properties.detectedMode,
    _unreadable: SCHEMA.properties._unreadable,
  };
  return { type: 'object' as const, properties, additionalProperties: false };
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

const validDate = (iso: string) => {
  if (!ISO.test(iso)) return false;
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

/**
 * Coerce one model-supplied value into what the input expects, or drop it.
 * `refNo` is validated per mode, mirroring the Aadhaar/PAN format checks in
 * extract.ts's normalize(): a value that doesn't look like the real thing is
 * dropped rather than shown, even though the SYSTEM prompt already asks the
 * model to get it right (e.g. a 6-to-10 digit cheque number) — never trust that
 * alone.
 */
export function cleanPaymentValue(key: string, raw: unknown, mode: PayMode): string {
  if (raw === null || raw === undefined) return '';
  let v = String(raw).replace(/\s+/g, ' ').trim();
  if (!v || /^(n\/?a|nil|none|null|unknown|not (available|mentioned|stated|found))$/i.test(v)) return '';

  if (key === 'amount') {
    const a = v.replace(/[₹,\s]/g, '').replace(/\/-$/, '');
    return /^\d+(\.\d+)?$/.test(a) ? String(Math.round(Number(a))) : '';
  }
  if (key === 'date') {
    if (validDate(v)) return v;
    const dmy = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
    if (dmy) {
      const [, d, m, y] = dmy;
      const year = y.length === 2 ? '20' + y : y;
      const iso = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      return validDate(iso) ? iso : '';
    }
    const parsed = new Date(v);
    const iso = Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
    return validDate(iso) ? iso : '';
  }
  if (key === 'refNo') {
    const digits = v.replace(/\s+/g, '');
    if (mode === 'cash') return digits; // receipt no. is genuinely free-form
    if (mode === 'cheque') return /^\d{6,10}$/.test(digits) ? digits : '';
    return /^\d{6,22}$/.test(digits) ? digits : '';
  }
  if (key === 'payer' || key === 'payee') {
    const labelOnly = /^(?:pay|rupees?|for bearer|bearer|account holder|drawer|payee|payer|self|or bearer)$/i;
    if (labelOnly.test(v.replace(/[.:_-]+$/g, '').trim())) return '';
    if (!/[A-Za-z\p{L}]/u.test(v)) return '';
  }
  return v;
}

export type PaymentExtraction = {
  values: Partial<Payment>;
  /** What the instrument turned out to be, when it is not the selected mode. */
  detectedMode: PayMode | null;
  unreadable: string;
};

const MODE_KEYS: PayMode[] = ['rtgs', 'cheque', 'dd', 'upi', 'cash'];

export type PaymentPass = {
  values: Partial<Payment>;
  detectedMode: PayMode | null;
  unreadable: string;
};

const PAYMENT_KEYS = ['amount', 'refNo', 'bank', 'branch', 'date', 'payer', 'payee'] as const;

async function readPaymentPass(
  mode: PayMode,
  parts: Anthropic.ContentBlockParam[],
  instruction: string
): Promise<PaymentPass> {
  const ai = getClient();
  const message = await ai.messages.parse({
    model: EXTRACT_MODEL,
    max_tokens: 2000,
    system: SYSTEM,
    messages: [{ role: 'user', content: [...parts, { type: 'text', text: `${PROMPT[mode]}\n\n${instruction}` }] }],
    output_config: { format: jsonSchemaOutputFormat(paymentSchemaFor(mode)) },
  });

  if (message.stop_reason === 'refusal') {
    throw new Error('The model declined to read this instrument.');
  }

  const parsed = (message.parsed_output ?? {}) as Record<string, unknown>;
  const values: Partial<Payment> = {};
  for (const key of PAYMENT_KEYS) {
    const v = cleanPaymentValue(key, parsed[key], mode);
    if (v) values[key] = v;
  }
  const detected = String(parsed.detectedMode ?? '').toLowerCase() as PayMode;
  return {
    values,
    detectedMode: MODE_KEYS.includes(detected) && detected !== mode ? detected : null,
    unreadable: String(parsed._unreadable ?? '').trim(),
  };
}

export function agreePaymentPasses(first: PaymentPass, second: PaymentPass) {
  const values: Partial<Payment> = {};
  const disputed: string[] = [];
  const same = (a: string | undefined, b: string | undefined) =>
    !!a && !!b && a.replace(/\s+/g, ' ').trim().toLowerCase() === b.replace(/\s+/g, ' ').trim().toLowerCase();

  for (const key of PAYMENT_KEYS) {
    const a = first.values[key];
    const b = second.values[key];
    if (a && b && same(a, b)) values[key] = a;
    else if (a || b) disputed.push(key);
  }

  const notes = [first.unreadable, second.unreadable].filter(Boolean);
  if (disputed.length) notes.push(`Could not verify ${disputed.join(', ')} from the instrument; those fields were left blank.`);
  if (!Object.keys(values).length && !notes.length) notes.push('No payment details were clear enough to verify from the uploaded instrument.');
  return {
    values,
    detectedMode: first.detectedMode === second.detectedMode ? first.detectedMode : null,
    unreadable: Array.from(new Set(notes)).join(' '),
  };
}

/** A targeted visual pass rejects unreliable critical instrument values. */
export function applyPaymentVerification(
  agreed: PaymentExtraction,
  verification: PaymentPass,
): PaymentExtraction {
  const values = { ...agreed.values };
  const rejected: string[] = [];
  const same = (a: string | undefined, b: string | undefined) =>
    !!a && !!b && a.replace(/\s+/g, ' ').trim().toLowerCase() === b.replace(/\s+/g, ' ').trim().toLowerCase();
  for (const key of ['amount', 'refNo', 'bank', 'branch', 'date', 'payer', 'payee'] as const) {
    if (values[key] && !same(values[key], verification.values[key])) {
      delete values[key];
      rejected.push(key);
    }
  }
  const notes = [agreed.unreadable, verification.unreadable].filter(Boolean);
  if (rejected.length) notes.push(`Could not independently verify ${rejected.join(', ')} from the instrument; those fields were left blank.`);
  return { values, detectedMode: agreed.detectedMode, unreadable: Array.from(new Set(notes)).join(' ') };
}

/** Add a cheque date only when two date-only reads agree on the handwritten DATE boxes. */
export function applyChequeDateVerification(
  extraction: PaymentExtraction,
  first: PaymentPass,
  second: PaymentPass,
): PaymentExtraction {
  const a = first.values.date;
  const b = second.values.date;
  const same = !!a && !!b && a === b;
  if (same) return { ...extraction, values: { ...extraction.values, date: a } };
  const notes = [extraction.unreadable, 'Could not verify the handwritten cheque date from two focused reads; it was left blank.'].filter(Boolean);
  return { ...extraction, unreadable: Array.from(new Set(notes)).join(' ') };
}

/** Add a printed branch only when two branch-only reads agree. */
export function applyChequeBranchVerification(
  extraction: PaymentExtraction,
  first: PaymentPass,
  second: PaymentPass,
): PaymentExtraction {
  const a = first.values.branch;
  const b = second.values.branch;
  const same = !!a && !!b && a.replace(/\s+/g, ' ').trim().toLowerCase() === b.replace(/\s+/g, ' ').trim().toLowerCase();
  if (same) {
    const unreadable = extraction.unreadable
      .replace(/Could not (?:independently )?verify branch from the instrument; those fields were left blank\.\s*/gi, '')
      .replace(/Could not verify the printed cheque branch from two focused reads; it was left blank\.\s*/gi, '')
      .trim();
    return { ...extraction, values: { ...extraction.values, branch: a }, unreadable };
  }
  const notes = [extraction.unreadable, 'Could not verify the printed cheque branch from two focused reads; it was left blank.'].filter(Boolean);
  return { ...extraction, unreadable: Array.from(new Set(notes)).join(' ') };
}

/**
 * Cheque party labels are easy to reverse in a broad read. A drawer/payee-only
 * pair of reads is authoritative: payer is the account holder/drawer and
 * payee is the handwritten name after PAY. Neither survives a disagreement.
 */
export function applyChequePartyVerification(
  extraction: PaymentExtraction,
  first: PaymentPass,
  second: PaymentPass,
): PaymentExtraction {
  const values = { ...extraction.values };
  const same = (a: string | undefined, b: string | undefined) =>
    !!a && !!b && a.replace(/\s+/g, ' ').trim().toLowerCase() === b.replace(/\s+/g, ' ').trim().toLowerCase();
  const unresolved: string[] = [];
  for (const key of ['payer', 'payee'] as const) {
    delete values[key];
    if (same(first.values[key], second.values[key])) values[key] = first.values[key]!;
    else unresolved.push(key);
  }
  const notes = [extraction.unreadable, first.unreadable, second.unreadable].filter(Boolean);
  if (unresolved.length) notes.push(`Could not independently verify cheque ${unresolved.join(', ')}; those fields were left blank.`);
  return { ...extraction, values, unreadable: Array.from(new Set(notes)).join(' ') };
}

/**
 * Read a photographed instrument and return the fields it supplies.
 *
 * The schema is small enough to be sent whole — unlike the deed extraction in
 * extract.ts, this needs no staging.
 */
export async function extractPayment(mode: PayMode, files: File[]): Promise<PaymentExtraction> {
  // Preparing photos/PDFs is independent work.  Do it together so a front and
  // back image (or multiple payment proofs) reaches the already-parallel read
  // passes without an avoidable serial wait.
  const parts = (await Promise.all(files.map(fileToVisualParts))).flat() as Anthropic.ContentBlockParam[];

  try {
    const [first, second, verification, dateFirst, dateSecond, branchFirst, branchSecond, partyFirst, partySecond] = await Promise.all([
      readPaymentPass(mode, parts, 'The same image may be included at more than one rotation: use the upright copy. Transcribe only text that is clearly visible. If any field is blurred, cropped, or ambiguous, omit it.'),
      readPaymentPass(mode, parts, 'The same image may be included at more than one rotation: use the upright copy. Perform an independent read. Do not infer from the requested instrument type or common bank names. Omit every field that is not clearly legible.'),
      readPaymentPass(mode, parts, 'The same image may be included at more than one rotation: use the upright copy. Verification pass: inspect the printed bank and branch, labelled instrument number, amount, handwritten transaction date, printed drawer/account-holder name, and the name actually written after PAY. For a cheque, use the labelled Cheque No. box and DATE boxes only; do not use pre-printed CTS, issue, MICR, account, IFSC, validity or serial values. PAY, RUPEES and FOR BEARER are labels, never party names. If the payee line is blank, omit payee. Omit a value unless you can visibly read it.'),
      readPaymentPass(mode, parts, 'Date-only check. For a cheque, return a date only when it is visibly handwritten or written in the DATE boxes. Ignore every printed CTS, issue, validity, MICR, account and IFSC date or number. Do not reject the handwritten date because it looks unusual or conflicts with printed validity dates.'),
      readPaymentPass(mode, parts, 'Independent date-only check. Read the upright image. For a cheque, return only the handwritten DATE-box value in YYYY-MM-DD if every digit is visible. Ignore all printed CTS, issue and validity dates; do not infer a date.'),
      readPaymentPass(mode, parts, 'Branch-only check. Read the upright image and return only the exact branch name printed below the bank name. Do not invent a city or use any account, IFSC, CTS, issue, validity or MICR text.'),
      readPaymentPass(mode, parts, 'Independent branch-only check. Read the upright image and return the exact printed bank branch name only when legible. Omit it if uncertain.'),
      mode === 'cheque'
        ? readPaymentPass(mode, parts, 'Cheque party check: return payer only as the printed drawer/account-holder name and payee only as the handwritten name after PAY. Never reverse them. PAY, RUPEES, FOR BEARER and account numbers are labels, not party names. Omit either party unless it is clearly visible.')
        : Promise.resolve({ values: {}, detectedMode: null, unreadable: '' }),
      mode === 'cheque'
        ? readPaymentPass(mode, parts, 'Independent cheque party check: inspect only the drawer/account-holder and PAY line. Payer means drawer/account holder; payee means the name after PAY. Do not infer either name from the transaction or sale parties.')
        : Promise.resolve({ values: {}, detectedMode: null, unreadable: '' }),
    ]);

    const verified = applyPaymentVerification(agreePaymentPasses(first, second), verification);
    if (mode !== 'cheque') return verified;
    return applyChequePartyVerification(
      applyChequeBranchVerification(applyChequeDateVerification(verified, dateFirst, dateSecond), branchFirst, branchSecond),
      partyFirst,
      partySecond,
    );
  } catch (e) {
    throw readableError(e);
  }
}
