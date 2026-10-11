export const FLAT_OPTIONS = [
  { key: 'Flat:Finished', label: 'Finished Flat', stage: 'Finished' },
  { key: 'Flat:Semi-Finished', label: 'Semi-finished Flat', stage: 'Semi-Finished' },
] as const;

/** Legacy free-text stages remain stored; only recognised stages select a deed. */
export function flatStage(value = ''): '' | 'Finished' | 'Semi-Finished' {
  const text = value.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
  if (['finished', 'finished flat', 'fully finished', 'completed'].includes(text)) return 'Finished';
  if (['semi finished', 'semi finished flat', 'semifinished'].includes(text)) return 'Semi-Finished';
  return '';
}

export function propertyChoice(category: string, stage = ''): string {
  return category === 'Flat' ? (flatStage(stage) ? `Flat:${flatStage(stage)}` : '') : category;
}

export function flatVariant(stage = ''): string {
  return flatStage(stage) === 'Semi-Finished' ? 'IF FLAT SEMI FINISHED'
    : flatStage(stage) === 'Finished' ? 'IF FLAT FINISHED' : 'IF FLAT';
}

export function flatLabel(stage = ''): string {
  return flatStage(stage) === 'Finished' ? 'Finished Flat' : flatStage(stage) === 'Semi-Finished' ? 'Semi-finished Flat' : 'Flat — choose completion option';
}
