/** Indian grouping without converting the entered digits to floating point. */
export function formatMoneyInput(value: string): string {
  const match = /^(-?)(\d*)(\.\d*)?$/.exec(value.replace(/,/g, ''));
  if (!match) return value;
  const [, sign, whole, fraction = ''] = match;
  return sign + (whole ? BigInt(whole).toLocaleString('en-IN') : '') + fraction;
}

/** Keep fractional amounts, but omit a zero fractional part in finished output. */
export function formatDeedAmount(value: string): string {
  const clean = value.trim().replace(/,/g, '');
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(clean)) return '';
  const withWhole = clean.replace(/^(-?)\./, (_, sign) => sign + '0.');
  return formatMoneyInput(withWhole.replace(/\.0*$/, ''));
}

export function stampSheetCount(count = ''): number {
  return /^\d{1,3}$/.test(count) ? Math.max(1, Number(count)) : 1;
}

export function stampPaperValue(form: Record<string, string>): string {
  const { stampPaperMargin, stampPaperCount, stampValue } = form;
  return ['100', '50', '20'].includes(stampPaperMargin)
    ? String(Number(stampPaperMargin) * stampSheetCount(stampPaperCount))
    : stampValue || '';
}

/** Currency values use integer paise; blank and malformed amounts stay unresolved. */
export function moneyPaise(value: string): bigint | null {
  const input = value.trim();
  if (input.includes(',') && !/^(?:\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d{1,2})?$/.test(input)) return null;
  const clean = input.replace(/,/g, '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(clean)) return null;
  const [whole, fraction = ''] = clean.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

