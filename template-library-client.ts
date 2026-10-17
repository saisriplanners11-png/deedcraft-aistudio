import { loadTemplate } from './template';
import { TEMPLATE_VERSIONS } from './legal-registry';
import type { LibraryListing, LibraryRevision, TemplatePin } from './template-library-types';
import { canonicalContract } from './template-fields';

export async function templateRequest<T>(path = '', init?: RequestInit): Promise<T> {
  const response = await fetch('/api/templates' + path, { ...init, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(20000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Template request failed.');
  return data;
}
export const listTemplates = () => templateRequest<LibraryListing>();
export function bundledTemplatePin(versionId = 'sale-deed-v6'): TemplatePin {
  const version = TEMPLATE_VERSIONS.find(item => item.id === versionId) || TEMPLATE_VERSIONS.find(item => item.id === 'sale-deed-v6')!;
  return { versionId: version.id, hash: version.sha256!, name: `Built-in Sale v${version.version.split('.')[0]}`, saleOpenings: ['sale-deed-v7', 'sale-deed-v9', 'sale-deed-v10'].includes(version.id) };
}
export const pinFor = (version: LibraryRevision): TemplatePin => ({ saleOpenings: version.saleOpenings ?? version.validation?.saleOpenings, versionId: version.id, hash: version.hash, name: version.filename, fieldContract: version.fieldContract, schemaHash: version.schemaHash, packageHash: version.packageHash, contractVersion: version.contractVersion });

const cache = new Map<string, Promise<Uint8Array>>();
export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function verifyTemplateBytes(bytes: Uint8Array, expectedHash: string): Promise<Uint8Array> {
  const actual = await sha256(bytes);
  if (actual !== expectedHash) throw new Error('Template integrity check failed. Retry downloading this version.');
  return bytes;
}
export async function loadLibraryBytes(pin: TemplatePin): Promise<Uint8Array> {
  if (pin.schemaHash) await verifyTemplateBytes(new TextEncoder().encode(canonicalContract(pin.fieldContract)), pin.schemaHash);
  if (pin.packageHash && pin.schemaHash && pin.contractVersion) await verifyTemplateBytes(new TextEncoder().encode(pin.hash + ':' + pin.schemaHash + ':' + pin.contractVersion), pin.packageHash);
  if (pin.bytes) return verifyTemplateBytes(pin.bytes, pin.hash);
  if (TEMPLATE_VERSIONS.some(version => version.id === pin.versionId && version.sha256 === pin.hash)) return verifyTemplateBytes(await loadTemplate(pin.versionId), pin.hash);
  const key = pin.versionId + ':' + pin.hash + ':' + (pin.packageHash || 'legacy');
  let pending = cache.get(key);
  if (!pending) {
    pending = (async () => {
      const response = await fetch(`/api/templates/versions/${encodeURIComponent(pin.versionId)}/download`, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error('The selected template version could not be downloaded. Retry when the library is available.');
      return verifyTemplateBytes(new Uint8Array(await response.arrayBuffer()), pin.hash);
    })().catch(error => { cache.delete(key); throw error; });
    cache.set(key, pending);
  }
  return pending;
}
export async function currentSaleTemplate(): Promise<TemplatePin> {
  const listing = await listTemplates();
  const version = listing.versions.find(item => item.id === listing.active.sale);
  if (!version) throw new Error('No published Sale template is available.');
  const pin = pinFor(version);
  return { ...pin, bytes: await loadLibraryBytes(pin) };
}
