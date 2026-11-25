import { attachFiles, clearAttachmentKeys, detachFiles, localFiles } from './local-attachments';
import { createClient, type Session } from '@supabase/supabase-js';

const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
const url = env?.VITE_SUPABASE_URL;
const key = env?.VITE_SUPABASE_PUBLISHABLE_KEY;
export const auth = url && key ? createClient(url, key, { auth: { flowType: 'pkce' } }) : null;
const versions = new Map<string, number>();
const cloudBodies = new Map<string, unknown>();
export let session: Session | null = null;
auth?.auth.onAuthStateChange((_event, next) => {
  if (session?.user.id !== next?.user.id) { versions.clear(); cloudBodies.clear(); clearAttachmentKeys(); }
  session = next;
});

export async function accountFetch(input: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (session) headers.set('Authorization', 'Bearer ' + session.access_token);
  return fetch(input, { ...init, headers });
}

function preserveDeviceReferences(next: unknown, previous: unknown): unknown {
  if (!previous || typeof previous !== 'object') return next;
  if ('deviceFile' in previous && next === undefined) return previous;
  if (Array.isArray(next) && Array.isArray(previous)) {
    if (next.length < previous.length && previous.every(item => item && typeof item === 'object' && 'deviceFile' in item)) {
      if (next.length === 0) return previous;
    }
    return next.map((item, index) => preserveDeviceReferences(item, previous[index]));
  }
  if (!next || typeof next !== 'object' || Array.isArray(next)) return next;
  return Object.fromEntries(Object.entries(next).map(([key, value]) =>
    [key, preserveDeviceReferences(value, (previous as Record<string, unknown>)[key])]));
}

export function accountStore<T>(kind: string) {
  function scope(expectedOwner?: string) {
    const active = session;
    if (!active || (expectedOwner && expectedOwner !== active.user.id) || !auth) throw new Error('Your session has ended. Sign in again.');
    return { owner: active.user.id, db: createClient(url!, key!, {
      accessToken: async () => active.access_token,
    }) };
  }
  return {
    async list() {
      const { owner, db } = scope();
      const result: T[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await db.from('account_drafts').select('id,body,revision')
          .eq('owner', owner).eq('kind', kind).order('id').range(offset, offset + 499);
        if (error) throw error;
        for (const row of data) {
          const cacheKey = JSON.stringify([owner, kind, row.id]);
          if (!versions.has(cacheKey)) versions.set(cacheKey, row.revision);
          cloudBodies.set(cacheKey, row.body);
          result.push(row.body as T);
        }
        if (data.length < 500) return result;
      }
    },
    async open(id: string, body: T) {
      const { owner } = scope();
      const files = await localFiles('readonly', store => store.get(JSON.stringify([owner, kind, id])));
      return attachFiles(body, files ?? new Map());
    },
    async save(id: string, body: T, expectedOwner?: string) {
      const { owner, db } = scope(expectedOwner);
      const cacheKey = JSON.stringify([owner, kind, id]);
      const files = new Map();
      const cloudBody = preserveDeviceReferences(detachFiles(body, files), cloudBodies.get(cacheKey));
      if (files.size) {
        const previous = await localFiles('readonly', store => store.get(cacheKey));
        await localFiles('readwrite', store => store.put(new Map([...(previous ?? []), ...files]), cacheKey));
      }
      const { data, error } = await db.rpc('save_account_draft', {
        draft_kind: kind, draft_id: id, draft_body: cloudBody, expected_revision: versions.get(cacheKey) ?? 0,
      });
      if (error) throw error;
      versions.set(cacheKey, data);
      cloudBodies.set(cacheKey, cloudBody);
    },
    async remove(id: string) {
      const { owner, db } = scope();
      const { error } = await db.from('account_drafts').delete().eq('owner', owner).eq('kind', kind).eq('id', id);
      if (error) throw error;
      const cacheKey = JSON.stringify([owner, kind, id]);
      versions.delete(cacheKey);
      cloudBodies.delete(cacheKey);
      await localFiles('readwrite', store => store.delete(cacheKey));
    },
  };
}

