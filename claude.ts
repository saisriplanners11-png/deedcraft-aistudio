import Anthropic from '@anthropic-ai/sdk';

// The client is pointed at this app's own proxy, not at api.anthropic.com.
// `apiKey` here is a placeholder the proxy discards — the real key lives in
// .env.local and is attached server-side (see proxy.mjs), so it never reaches
// the browser bundle. `dangerouslyAllowBrowser` only satisfies the SDK's guard
// against shipping a real key to the client; there is no real key to leak.
const PROXY_BASE_URL = '/api/anthropic';

/**
 * Every stage runs on Haiku to keep billing down. Opus and Sonnet are
 * intentionally never used here. Override any of these in .env.local.
 */
function readModel(which: 'EXTRACT_MODEL' | 'DRAFT_MODEL', fallback: string): string {
  try {
    const v = which === 'EXTRACT_MODEL' ? process.env.EXTRACT_MODEL : process.env.DRAFT_MODEL;
    return v || fallback;
  } catch {
    return fallback;
  }
}

export const EXTRACT_MODEL = readModel('EXTRACT_MODEL', 'claude-haiku-4-5');
export const DRAFT_MODEL = readModel('DRAFT_MODEL', 'claude-sonnet-4-6');
export const VISION_MODEL = (() => {
  try { return process.env.VISION_MODEL || 'claude-sonnet-4-6'; } catch { return 'claude-sonnet-4-6'; }
})();
export const VERIFY_MODEL = (() => {
  try { return process.env.VERIFY_MODEL || 'claude-sonnet-4-6'; } catch { return 'claude-sonnet-4-6'; }
})();
let client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: 'proxied-server-side',
      baseURL: new URL(PROXY_BASE_URL, window.location.origin).toString(),
      dangerouslyAllowBrowser: true,
      maxRetries: 2,
    });
  }
  return client;
}

/** Turn an SDK or proxy failure into something a drafter can act on. */
export function readableError(e: any): Error {
  if (e instanceof Anthropic.AuthenticationError) {
    return new Error('The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in .env.local, then restart the server.');
  }
  if (e instanceof Anthropic.RateLimitError) {
    return new Error('Rate limited by the Anthropic API. Wait a moment and try again.');
  }
  if (e instanceof Anthropic.BadRequestError) {
    return new Error(`The request was rejected: ${e.message}`);
  }
  if (e instanceof Anthropic.APIConnectionError) {
    return new Error('Could not reach the API. Is the dev server still running (`npm run dev`)?');
  }

  const raw = String(e?.message ?? e);
  // The proxy's own "no key set" reply, surfaced verbatim.
  if (/no_api_key|ANTHROPIC_API_KEY is not set/.test(raw)) {
    return new Error(
      'ANTHROPIC_API_KEY is not set. Add it to .env.local and restart `npm run dev`. Everything else in the app still works.'
    );
  }
  if (e instanceof Anthropic.APIError) {
    return new Error(`API error ${e.status}: ${e.message}`);
  }
  return new Error(raw);
}

// ---------------------------------------------------------------- deed drafting

export type DraftKind = 'schedule' | 'reverify';

const SYSTEM = `You are a senior document writer at a sub-registrar's office in Telangana / Andhra Pradesh, India.
You draft in the settled register of Indian conveyancing: formal, precise, no marketing tone, no markdown headings or bullets unless asked.
Amounts are written in Indian numbering (lakh/crore) with the figure repeated in words. Never invent survey numbers, document numbers, names or amounts that are absent from the supplied facts — if a fact is missing, write a clearly bracketed blank such as [SURVEY NO.].`;

const PROMPTS: Record<DraftKind, (facts: string) => string> = {
  schedule: facts => `Write the SCHEDULE OF PROPERTY description for this deed, as one flowing paragraph
in the settled Indian conveyancing form ("All that the open plot no. ... admeasuring ... bounded as follows").
Use only the facts given. Do not add a boundaries list — the deed sets those out separately.
Facts:\n${facts}`,

  reverify: facts => `Review this deed data for anything that would block a clean registration: value or
consideration mismatches, extent or boundary inconsistencies, duty computation errors, missing party or
title-flow particulars, and payment that does not total the consideration.
Reply as a short numbered list of concrete findings, each one line, most serious first.
If a point is sound, do not list it. If nothing is wrong, reply exactly: No issues found.
Facts:\n${facts}`,
};

/** The substantive state, with blanks omitted rather than asserted as empty. */
export function facts(state: any, vm: any): string {
  const f = state.form;
  return JSON.stringify(
    {
      state: state.statePreset,
      deedType: state.deedType,
      category: state.category,
      draft: state.draft,
      property: {
        plotNo: f.plotNo, bearingHNo: f.bearingHNo, nearHNo: f.nearHNo,
        surveyNo: f.surveyNo, locality: f.locality, village: f.village,
        mandal: f.mandal, district: f.district, state: f.propState,
        extent: f.extentValue, unit: state.unit,
        extentSqYards: vm.sqYards, extentSqMeters: vm.sqMeters,
      },
      boundaries: {
        north: f.boundaryNorth, south: f.boundarySouth,
        east: f.boundaryEast, west: f.boundaryWest,
      },
      structure: {
        natureOfRoof: f.natureOfHouse, floors: f.floors, ageYears: f.ageOfHouse,
        plinthAreaSqFt: f.plinthArea, propertyTaxId: f.bltNo,
      },
      valuation: {
        ratePerSqYard: vm.rateINR, structureValue: vm.structINR,
        marketValue: vm.persayINR, consideration: vm.considINR,
        dutyBasis: vm.basis, totalDuty: vm.dutyINR,
      },
      payment: {
        total: vm.paidINR,
        netOfTds: vm.netPaidINR,
        tds: vm.tdsINR,
        instruments: state.payments
          .filter((p: any) => p.amount !== '')
          .map((p: any) => ({
            mode: p.mode, amount: p.amount, ref: p.refNo,
            bank: p.bank, branch: p.branch, date: p.date, advance: p.advance || undefined,
          })),
      },
      linkDocument: { type: f.linkDocType, no: f.linkDocNo, date: f.linkDocDate, sro: f.linkSro },
      executant: { name: f.executantName, relation: [f.executantRelation, f.executantRelativeName].filter(Boolean).join(' '), age: f.executantAge, aadhaar: f.executantAadhaar },
      claimant: { name: f.claimantName, relation: [f.claimantRelation, f.claimantRelativeName].filter(Boolean).join(' '), age: f.claimantAge, aadhaar: f.claimantAadhaar },
    },
    null,
    2
  ).replace(/^\s*"[^"]+": (""|null),?$\n?/gm, '');
}

/** Streams the draft, calling `onChunk` with the text so far. */
export async function draft(
  kind: DraftKind,
  state: any,
  vm: any,
  onChunk: (textSoFar: string) => void
): Promise<string> {
  const ai = getClient();
  try {
    const stream = ai.messages.stream({
      model: DRAFT_MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      messages: [{ role: 'user', content: PROMPTS[kind](facts(state, vm)) }],
    });

    let text = '';
    stream.on('text', delta => {
      text += delta;
      onChunk(text);
    });

    const message = await stream.finalMessage();
    if (message.stop_reason === 'refusal') {
      throw new Error('The model declined to answer this request.');
    }
    return text;
  } catch (e) {
    throw readableError(e);
  }
}
