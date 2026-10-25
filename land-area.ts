/** Convert the common Acre-Gunta notation used on NALA orders.
 *  For example, 0.0144 means 0 acres and 1.44 guntas (not a decimal-acre
 *  value), so the displayed equivalent is 1.44 × 121 = 174.24 Sq. Yards.
 */
export function acreGuntasToSqYards(value: string): number | null {
  const normalized = value.trim().replace(/\s+/g, ' ');
  const labeled = normalized.match(/(\d+(?:\.\d+)?)\s*acres?[^\d]+(\d+(?:\.\d+)?)\s*guntas?/i);
  const compact = normalized.match(/^(\d+)\.(\d{4})(?:\s*acre[-\s]*guntas?)?$/i);
  const dashed = normalized.match(/^(\d+)\s*-\s*(\d+(?:\.\d+)?)$/);
  let acres: number;
  let guntas: number;
  if (labeled) {
    acres = Number(labeled[1]); guntas = Number(labeled[2]);
  } else if (dashed) {
    acres = Number(dashed[1]); guntas = Number(dashed[2]);
  } else if (compact) {
    acres = Number(compact[1]);
    guntas = Number(compact[2].slice(1, 2)) + Number(compact[2].slice(2)) / 100;
  } else return null;
  if (!Number.isFinite(acres) || !Number.isFinite(guntas) || guntas >= 40) return null;
  return Math.round((acres * 4840 + guntas * 121) * 100) / 100;
}

