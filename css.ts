// The design canvas expressed every style as an inline CSS string. React wants
// objects, so parse once and memoize — the same ~700 strings recur every render.
const cache = new Map<string, React.CSSProperties>();

const toCamel = (prop: string) =>
  prop.startsWith('--') ? prop : prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

export function css(text: string): React.CSSProperties {
  if (!text) return {};
  const hit = cache.get(text);
  if (hit) return hit;

  const out: Record<string, string> = {};
  // Split on semicolons that aren't inside url(...) or a quoted font stack.
  for (const decl of text.split(/;(?![^(]*\))/)) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    const value = decl.slice(i + 1).trim();
    if (!prop || !value) continue;
    out[toCamel(prop)] = value.replace(/\s*!important$/, '');
  }
  const style = out as React.CSSProperties;
  cache.set(text, style);
  return style;
}
