import React, { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

let activeZones = 0;
const preventFileNavigation = (event: DragEvent) => {
  if (Array.from(event.dataTransfer?.types || []).includes('Files')) event.preventDefault();
};

/** Respect the same file types and cardinality advertised by the native picker. */
export function droppedFileError(files: Pick<File, 'name' | 'type'>[], accept: string, multiple: boolean): string {
  if (!multiple && files.length > 1) return 'Choose one file for this upload.';
  const allowed = accept.toLowerCase().split(',').map(type => type.trim()).filter(Boolean);
  const imageTypes: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', bmp: 'image/bmp', heic: 'image/heic', heif: 'image/heif', avif: 'image/avif', tif: 'image/tiff', tiff: 'image/tiff' };
  if (allowed.length && files.some(file => {
    const name = file.name.toLowerCase();
    const type = file.type.toLowerCase() || imageTypes[name.split('.').pop() || ''] || '';
    return !allowed.some(rule => rule.startsWith('.') ? name.endsWith(rule) : rule.endsWith('/*') ? type.startsWith(rule.slice(0, -1)) : type === rule);
  })) return `Choose a supported file (${accept}).`;
  return '';
}

/** Send drops through the existing input's onChange so upload behavior stays identical. */
export function FileDropZone({ children, as: Tag = 'div', className, style, inputRef, disabled = false, hint = true }: {
  children: ReactNode; as?: 'div' | 'label' | 'span'; className?: string; style?: React.CSSProperties;
  inputRef?: RefObject<HTMLInputElement | null>; disabled?: boolean; hint?: boolean;
}) {
  const root = useRef<HTMLElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (activeZones++ === 0) {
      document.addEventListener('dragover', preventFileNavigation);
      document.addEventListener('drop', preventFileNavigation);
    }
    return () => {
      if (--activeZones === 0) {
        document.removeEventListener('dragover', preventFileNavigation);
        document.removeEventListener('drop', preventFileNavigation);
      }
    };
  }, []);
  const input = () => inputRef?.current || root.current?.querySelector<HTMLInputElement>('input[type="file"]:not([capture])');
  const unavailable = () => disabled || !input() || input()!.disabled;
  return <Tag ref={root as any} className={className} data-file-drop-zone="" aria-busy={disabled}
    style={{ ...style, ...(dragging ? { outline: '2px dashed currentColor', outlineOffset: 4 } : {}) }}
    onDragOver={event => {
      if (!Array.from(event.dataTransfer.types).includes('Files')) return;
      event.preventDefault(); event.stopPropagation();
      event.dataTransfer.dropEffect = unavailable() ? 'none' : 'copy';
      if (!unavailable()) setDragging(true);
    }}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
    onChangeCapture={() => setError('')}
    onDrop={(event: React.DragEvent<HTMLElement>) => {
      event.preventDefault(); event.stopPropagation(); setDragging(false);
      const target = input();
      if (unavailable() || !target) return;
      const files = Array.from(event.dataTransfer.files);
      if (!files.length) return;
      const problem = droppedFileError(files, target.accept, target.multiple);
      setError(problem);
      if (problem) return;
      const transfer = new DataTransfer();
      files.forEach(file => transfer.items.add(file));
      target.files = transfer.files;
      target.dispatchEvent(new Event('change', { bubbles: true }));
    }}>
    {children}
    {hint && <small style={{ display: 'block', width: '100%', minWidth: 0, maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>Drop files here or use the upload control.</small>}
    {error && <span role="alert" style={{ display: 'block', width: '100%', minWidth: 0, maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{error}</span>}
  </Tag>;
}
