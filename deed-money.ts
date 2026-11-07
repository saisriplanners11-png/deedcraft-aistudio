/** Currency values use integer paise; blank and malformed amounts stay unresolved. */
export function moneyPaise(value: string): bigint | null {
  const input = value.trim();
  if (input.includes(',') && !/^(?:\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d{1,2})?$/.test(input)) return null;
  const clean = input.replace(/,/g, '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(clean)) return null;
  const [whole, fraction = ''] = clean.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

