import React from 'react';

export function RecordMove({ scope, id, ids, onChange }: { scope: string; id: string; ids: string[]; onChange: (ids: string[]) => void }) {
  if (ids.length < 2) return null;
  const index = ids.indexOf(id);
  const move = (from: string, to: number) => {
    if (!ids.includes(from) || to < 0 || to >= ids.length || ids[to] === from) return;
    const next = ids.filter(key => key !== from);
    next.splice(to, 0, from);
    onChange(next);
  };
  const mime = 'application/x-deed-order';
  return <button type="button" className="quiet" style={{ cursor: 'grab' }} draggable title="Drag to reorder or use Alt and the arrow keys"
    aria-label={'Reorder item ' + (index + 1)} onDragStart={event => {
      event.dataTransfer.setData(mime, scope + '|' + id);
      event.dataTransfer.effectAllowed = 'move';
    }} onDragOver={event => { if (event.dataTransfer.types.includes(mime)) event.preventDefault(); }}
    onDrop={event => {
      const data = event.dataTransfer.getData(mime);
      if (!data.startsWith(scope + '|')) return;
      event.preventDefault();
      move(data.slice(scope.length + 1), index);
    }}
    onKeyDown={event => {
      if (!event.altKey || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      move(id, index + (['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1));
    }}>↕</button>;
}
