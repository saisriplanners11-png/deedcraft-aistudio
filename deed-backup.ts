import type { SavedDeed } from './saved-deeds';

const FORMAT = 'deedcraft-saved-deeds';
const BINARY = '__deedcraftPortableType';
const BYTE_CHUNK = 12 * 1024; // divisible by three, so base64 chunks can be joined

function base64(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += BYTE_CHUNK) {
    parts.push(btoa(String.fromCharCode(...bytes.subarray(offset, offset + BYTE_CHUNK))));
  }
  return parts.join('');
}

function fromBase64(value: unknown): Uint8Array {
  if (typeof value !== 'string' || value.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('Backup contains invalid file data.');
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const output = new Uint8Array(value.length / 4 * 3 - padding);
  let at = 0;
  try {
    for (let offset = 0; offset < value.length; offset += 16 * 1024) {
      const chunk = atob(value.slice(offset, offset + 16 * 1024));
      for (let i = 0; i < chunk.length; i++) output[at++] = chunk.charCodeAt(i);
    }
  } catch { throw new Error('Backup contains invalid file data.'); }
  return output;
}

async function portable(value: unknown): Promise<unknown> {
  if (typeof File !== 'undefined' && value instanceof File) return {
    [BINARY]: 'File', name: value.name, type: value.type, lastModified: value.lastModified,
    data: base64(new Uint8Array(await value.arrayBuffer())),
  };
  if (value instanceof Blob) return { [BINARY]: 'Blob', type: value.type, data: base64(new Uint8Array(await value.arrayBuffer())) };
  if (value instanceof Uint8Array) return { [BINARY]: 'Uint8Array', data: base64(value) };
  if (Array.isArray(value)) return Promise.all(value.map(portable));
  if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await portable(item)])));
  return value;
}

function restore(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(restore);
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  if (record[BINARY]) {
    const bytes = fromBase64(record.data);
    if (record[BINARY] === 'Uint8Array') return bytes;
    if (record[BINARY] === 'Blob') return new Blob([bytes as BlobPart], { type: typeof record.type === 'string' ? record.type : '' });
    if (record[BINARY] === 'File' && typeof record.name === 'string') return new File([bytes as BlobPart], record.name, {
      type: typeof record.type === 'string' ? record.type : '',
      lastModified: typeof record.lastModified === 'number' ? record.lastModified : Date.now(),
    });
    throw new Error('Backup contains an unsupported file type.');
  }
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, restore(item)]));
}

function isSavedDeed(value: unknown): value is SavedDeed {
  if (!value || typeof value !== 'object') return false;
  const deed = value as Partial<SavedDeed>;
  return typeof deed.id === 'string' && !!deed.id
    && typeof deed.updatedAt === 'string'
    && !!deed.draft && deed.draft.id === deed.id && Array.isArray(deed.draft.sources)
    && typeof deed.draft.manual === 'object' && !!deed.draft.manual
    && typeof deed.sourceFiles === 'object' && !!deed.sourceFiles
    && Object.values(deed.sourceFiles).every(files => Array.isArray(files) && files.every(file => file instanceof File))
    && (!deed.customTemplate || (deed.customTemplate.kind === 'custom' && deed.customTemplate.bytes instanceof Uint8Array));
}

export async function createDeedBackup(deeds: SavedDeed[]): Promise<Blob> {
  const data = { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), deeds: await portable(deeds) };
  return new Blob([JSON.stringify(data)], { type: 'application/json' });
}

export async function readDeedBackup(file: Blob, existing: SavedDeed[]): Promise<{ deeds: SavedDeed[]; skipped: number; copies: number }> {
  let data: any;
  try { data = JSON.parse(await file.text()); } catch { throw new Error('Choose a readable DeedCraft saved-deeds backup.'); }
  if (data?.format !== FORMAT || data.version !== 1 || !Array.isArray(data.deeds)) throw new Error('This is not a supported DeedCraft saved-deeds backup.');
  const restored = restore(data.deeds);
  if (!Array.isArray(restored) || !restored.every(isSavedDeed)) throw new Error('The backup has incomplete deed records or attachments. Nothing was imported.');
  const prior = new Map(existing.map(deed => [deed.id, deed]));
  const incoming = new Set<string>();
  const deeds: SavedDeed[] = [];
  let skipped = 0, copies = 0;
  for (const deed of restored) {
    if (incoming.has(deed.id)) throw new Error('The backup contains duplicate deed IDs. Nothing was imported.');
    incoming.add(deed.id);
    const old = prior.get(deed.id);
    if (old?.updatedAt === deed.updatedAt && JSON.stringify(await portable(old)) === JSON.stringify(await portable(deed))) { skipped++; continue; }
    if (old) {
      const id = crypto.randomUUID();
      deeds.push({ ...deed, id, draft: { ...deed.draft, id }, name: `Imported copy of ${deed.name || deed.claimantNames?.join(', ') || 'deed'}`, generationManifest: null });
      copies++;
    } else deeds.push(deed);
  }
  return { deeds, skipped, copies };
}
