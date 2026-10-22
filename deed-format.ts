/** Stored dates remain ISO; every date printed in a deed is DD-MM-YYYY. */
export function deedDate(value: string): string {
  if (!value) return '';
  const input = value.trim();
  let year: string, month: string, day: string;
  const iso = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const local = input.match(/^(\d{2})[-/.]?(\d{2})[-/.]?(\d{4})$/);
  if (iso) [, year, month, day] = iso;
  else if (local) [, day, month, year] = local;
  else return '';
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return '';
  return `${day}-${month}-${year}`;
}
