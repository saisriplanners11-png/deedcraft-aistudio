/** Completed years between two ISO dates. Blank if the birth date is unusable. */
export function ageFrom(dobISO: string, onISO: string = todayISO()): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dobISO)) return '';
  const dob = new Date(dobISO);
  if (!onISO || !/^\d{4}-\d{2}-\d{2}$/.test(onISO)) return '';
  const on = new Date(onISO);
  if (Number.isNaN(dob.getTime()) || dob.toISOString().slice(0, 10) !== dobISO || !Number.isFinite(on.getTime()) || on.toISOString().slice(0, 10) !== onISO || dob > on) return '';
  let years = on.getFullYear() - dob.getFullYear();
  const before =
    on.getMonth() < dob.getMonth() || (on.getMonth() === dob.getMonth() && on.getDate() < dob.getDate());
  if (before) years -= 1;
  return years >= 0 && years < 130 ? String(years) : '';
}

/** Local calendar date, kept separate from ageFrom so date maths remains testable. */
export function todayISO(now = new Date()): string {
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

