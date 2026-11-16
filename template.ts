import releaseTemplateUrl from './release-deed-template-v2.docx?url';
import releaseTemplateV1Url from './release-deed-template-v1.docx?url';
import reconveyanceTemplateUrl from './reconveyance-deed-template-v2.docx?url';
import reconveyanceTemplateV1Url from './reconveyance-deed-template-v1.docx?url';
import generalPoaTemplateUrl from './general-poa-template-v4.docx?url';
import generalPoaTemplateV3Url from './general-poa-template-v3.docx?url';
import generalPoaTemplateV2Url from './general-poa-template-v2.docx?url';
import generalPoaTemplateV1Url from './general-poa-template-v1.docx?url';
import agreementSaleGpaTemplateUrl from './agreement-sale-gpa-template-v5.docx?url';
import agreementSaleGpaTemplateV4Url from './agreement-sale-gpa-template-v4.docx?url';
import agreementSaleGpaTemplateV3Url from './agreement-sale-gpa-template-v3.docx?url';
import agreementSaleGpaTemplateV2Url from './agreement-sale-gpa-template-v2.docx?url';
import agreementSaleGpaTemplateV1Url from './agreement-sale-gpa-template-v1.docx?url';
import municipalGiftTemplateUrl from './gift-municipal-template-v4.docx?url';
import municipalGiftTemplateV3Url from './gift-municipal-template-v3.docx?url';
import municipalGiftTemplateV2Url from './gift-municipal-template-v2.docx?url';
import municipalGiftTemplateV1Url from './gift-municipal-template-v1.docx?url';
import giftDeedTemplateUrl from './gift-deed-template-v7.docx?url';
import giftDeedTemplateV6Url from './gift-deed-template-v6.docx?url';
import giftDeedTemplateV5Url from './gift-deed-template-v5.docx?url';
import giftDeedTemplateV4Url from './gift-deed-template-v4.docx?url';
import giftDeedTemplateV3Url from './gift-deed-template-v3.docx?url';
import giftDeedTemplateV2Url from './gift-deed-template-v2.docx?url';
import giftDeedTemplateV1Url from './gift-deed-template-v1.docx?url';
// The Word file is the source of truth for the generated deed. Keeping it as
// a bundled asset prevents template revisions from drifting from a base64 copy.
import saleDeedTemplateUrl from './sale-deed-template-v12.docx?url';
import saleDeedTemplateV11Url from './sale-deed-template-v11.docx?url';
import saleDeedTemplateV10Url from './sale-deed-template-v10.docx?url';
import saleDeedTemplateV9Url from './sale-deed-template-v9.docx?url';
import saleDeedTemplateV7Url from './sale-deed-template-v7.docx?url';
import saleDeedTemplateV6Url from './sale-deed-template-v6.docx?url';
import saleDeedTemplateV5Url from './sale-deed-template-v5.docx?url';
import saleDeedTemplateV4Url from './sale-deed-template-v4.docx?url';
import saleDeedTemplateV3Url from './sale-deed-template.docx?url';
import saleDeedTemplateV2Url from './sale-deed-template-v2.docx?url';
import type { InstrumentId } from './instruments';
import { TEMPLATE_VERSIONS } from './legal-registry';

export const DEED_TEMPLATES = { Sale: { id: 'sale-deed-v12', url: saleDeedTemplateUrl } } as const;

let cachedTemplate: Promise<Uint8Array> | undefined;

export function loadSaleDeedTemplate(): Promise<Uint8Array> {
  cachedTemplate ??= fetch(saleDeedTemplateUrl)
    .then(response => {
      if (!response.ok) throw new Error('Could not load the sale deed template.');
      return response.arrayBuffer();
    })
    .then(buffer => new Uint8Array(buffer))
    .catch(error => { cachedTemplate = undefined; throw error; });
  return cachedTemplate;
}

/** Instrument-neutral loader. Unknown or unapproved assets fail closed. */
export async function loadTemplate(templateVersionId: string): Promise<Uint8Array> {
  if (['general-poa-v1', 'general-poa-v2', 'general-poa-v3', 'general-poa-v4'].includes(templateVersionId)) { const response = await fetch(templateVersionId === 'general-poa-v1' ? generalPoaTemplateV1Url : templateVersionId === 'general-poa-v2' ? generalPoaTemplateV2Url : templateVersionId === 'general-poa-v3' ? generalPoaTemplateV3Url : generalPoaTemplateUrl); if (!response.ok) throw new Error('Could not load the General Power of Attorney reference.'); return new Uint8Array(await response.arrayBuffer()); }
  if (['agreement-sale-gpa-v1', 'agreement-sale-gpa-v2', 'agreement-sale-gpa-v3', 'agreement-sale-gpa-v4', 'agreement-sale-gpa-v5'].includes(templateVersionId)) { const response = await fetch(templateVersionId === 'agreement-sale-gpa-v1' ? agreementSaleGpaTemplateV1Url : templateVersionId === 'agreement-sale-gpa-v2' ? agreementSaleGpaTemplateV2Url : templateVersionId === 'agreement-sale-gpa-v3' ? agreementSaleGpaTemplateV3Url : templateVersionId === 'agreement-sale-gpa-v4' ? agreementSaleGpaTemplateV4Url : agreementSaleGpaTemplateUrl); if (!response.ok) throw new Error('Could not load the Agreement of Sale Cum GPA reference.'); return new Uint8Array(await response.arrayBuffer()); }
  if (['gift-municipal-v1', 'gift-municipal-v2', 'gift-municipal-v3', 'gift-municipal-v4'].includes(templateVersionId)) { const response = await fetch(templateVersionId === 'gift-municipal-v1' ? municipalGiftTemplateV1Url : templateVersionId === 'gift-municipal-v2' ? municipalGiftTemplateV2Url : templateVersionId === 'gift-municipal-v3' ? municipalGiftTemplateV3Url : municipalGiftTemplateUrl); if (!response.ok) throw new Error('Could not load the Municipal Gift reference.'); return new Uint8Array(await response.arrayBuffer()); }
  if (['gift-deed-v1', 'gift-deed-v2', 'gift-deed-v3', 'gift-deed-v4', 'gift-deed-v5', 'gift-deed-v6', 'gift-deed-v7'].includes(templateVersionId)) { const response = await fetch(templateVersionId === 'gift-deed-v1' ? giftDeedTemplateV1Url : templateVersionId === 'gift-deed-v2' ? giftDeedTemplateV2Url : templateVersionId === 'gift-deed-v3' ? giftDeedTemplateV3Url : templateVersionId === 'gift-deed-v4' ? giftDeedTemplateV4Url : templateVersionId === 'gift-deed-v5' ? giftDeedTemplateV5Url : templateVersionId === 'gift-deed-v6' ? giftDeedTemplateV6Url : giftDeedTemplateUrl); if (!response.ok) throw new Error('Could not load the Gift reference.'); return new Uint8Array(await response.arrayBuffer()); }
  if (['release-deed-v1', 'release-deed-v2'].includes(templateVersionId)) { const response = await fetch(templateVersionId === 'release-deed-v1' ? releaseTemplateV1Url : releaseTemplateUrl); if (!response.ok) throw new Error('Could not load Release template.'); return new Uint8Array(await response.arrayBuffer()); }
  if (['reconveyance-deed-v1', 'reconveyance-deed-v2'].includes(templateVersionId)) { const response = await fetch(templateVersionId === 'reconveyance-deed-v1' ? reconveyanceTemplateV1Url : reconveyanceTemplateUrl); if (!response.ok) throw new Error('Could not load Reconveyance template.'); return new Uint8Array(await response.arrayBuffer()); }
  const version = TEMPLATE_VERSIONS.find(item => item.id === templateVersionId);
  if (!version) throw new Error(`Template version ${templateVersionId} is not registered.`);
  if (templateVersionId === 'sale-deed-v12') return loadSaleDeedTemplate();
  if (templateVersionId === 'sale-deed-v11') { const response = await fetch(saleDeedTemplateV11Url); if (!response.ok) throw new Error('Could not load the immutable v11 template.'); return new Uint8Array(await response.arrayBuffer()); }
  if (version.instrumentId === 'sale' && version.asset === 'sale-deed-template-v10.docx') { const response = await fetch(saleDeedTemplateV10Url); if (!response.ok) throw new Error('Could not load the immutable v10 template.'); return new Uint8Array(await response.arrayBuffer()); }
  if (version.asset === 'sale-deed-template-v9.docx') { const response = await fetch(saleDeedTemplateV9Url); if (!response.ok) throw new Error('Could not load v9 template.'); return new Uint8Array(await response.arrayBuffer()); }
  if (version.asset === 'sale-deed-template-v7.docx') { const response = await fetch(saleDeedTemplateV7Url); if (!response.ok) throw new Error('Could not load v7 template.'); return new Uint8Array(await response.arrayBuffer()); }
  if (version.asset === 'sale-deed-template-v6.docx') { const response = await fetch(saleDeedTemplateV6Url); if (!response.ok) throw new Error('Could not load v6 template.'); return new Uint8Array(await response.arrayBuffer()); }
  if (version.instrumentId === 'sale' && version.asset === 'sale-deed-template-v5.docx') {
    const response = await fetch(saleDeedTemplateV5Url);
    if (!response.ok) throw new Error('Could not load the earlier sale deed template.');
    return new Uint8Array(await response.arrayBuffer());
  }
  if (version.instrumentId === 'sale' && version.asset === 'sale-deed-template-v4.docx') {
    const response = await fetch(saleDeedTemplateV4Url);
    if (!response.ok) throw new Error('Could not load the earlier sale deed template.');
    return new Uint8Array(await response.arrayBuffer());
  }
  if (version.instrumentId === 'sale' && version.asset === 'sale-deed-template.docx') {
    const response = await fetch(saleDeedTemplateV3Url);
    if (!response.ok) throw new Error('Could not load the earlier sale deed template.');
    return new Uint8Array(await response.arrayBuffer());
  }
  if (version.instrumentId === 'sale' && version.asset === 'sale-deed-template-v2.docx') {
    const response = await fetch(saleDeedTemplateV2Url);
    if (!response.ok) throw new Error('Could not load the earlier sale deed template.');
    return new Uint8Array(await response.arrayBuffer());
  }
  throw new Error(`Template asset for ${version.instrumentId} has not been onboarded.`);
}

export function templateVersionFor(instrumentId: InstrumentId): string | undefined {
  return TEMPLATE_VERSIONS.find(item => item.instrumentId === instrumentId)?.id;
}
