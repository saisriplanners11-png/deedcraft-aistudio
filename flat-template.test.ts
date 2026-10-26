import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { docxToText, fillSaleDeed, readZip, validateSaleDeedTemplate, type DeedTemplateSource } from './docx';
import { initialState, generationBlockers, type AppState } from './logic';
import { mergeValues, rewritesFor, scheduleMergesFor, variantFor } from './merge';
import { flatStage, propertyChoice } from './flat-options';
import { newDraft, appStateFor, draftReducer, resolveDraft } from './source-draft';
import { newPayment } from './payments';

const fixture = (stage = 'Finished', category = 'Flat') => ({ ...initialState, category,
  form: { ...initialState.form, executionDate: '2026-10-11', flatStage: stage, flatNo: '103', flatFloorNo: 'First', apartmentName: 'QA COMPLEX', superBuiltUpAreaSqFt: '1020', udsSqYards: '30', parkingAreaSqFt: '75', stiltFloors: '2', upperFloors: '4', developmentDocNo: 'DEV-55', developmentDocDate: '2025-01-02', supplementalDocNo: 'SUP-66', extentSqYards: '139.25', plotNo: 'A', surveyNo: '688', bearingHNo: '12-6-43', nearHNo: '12-6-40', locality: 'Shivanagar', village: 'Sircilla', mandal: 'Sircilla', district: 'Rajanna Sircilla', state: 'Telangana', pinCode: '505301', sro: 'Sircilla', districtRegistrar: 'Karimnagar', consid: '1494000', stampValue: '50', roofMaterial: 'R.C.C. Building', constructionDescription: 'Framed with pillars & beams', taxesPerAnnum: '1000', annualRentalValue: '6000', boundaryNorth: 'North apartment', boundarySouth: 'South apartment', boundaryEast: 'East apartment', boundaryWest: 'West apartment', flatBoundaryNorth: 'open to sky', flatBoundarySouth: 'South flat', flatBoundaryEast: 'East flat', flatBoundaryWest: 'West flat', executantName: 'QA SELLER', executantRelation: 'S/O', executantRelativeName: 'QA FATHER', executantAge: '40', executantDob: '1986-01-01', executantOccupation: 'Business', executantHNo: '1-1', executantVillage: 'Sircilla', executantMandal: 'Sircilla', executantDistrict: 'Rajanna Sircilla', executantState: 'Telangana', executantPinCode: '505301', claimantName: 'QA BUYER', claimantRelation: 'S/O', claimantRelativeName: 'QA PARENT', claimantAge: '36', claimantDob: '1990-01-01', claimantOccupation: 'Business', claimantHNo: '2-2', claimantVillage: 'Sircilla', claimantMandal: 'Sircilla', claimantDistrict: 'Rajanna Sircilla', claimantState: 'Telangana', claimantPinCode: '505301' },
  payments: [{ ...newPayment(), mode: 'cash' as const, amount: '1494000', payer: 'QA BUYER', payee: 'QA SELLER', date: '2026-10-11' }],
  structureDetailsBySchedule: { primary: { totalFloors: '1', rows: [{ id: 'floor', floorNo: 'Ground Floor', structureType: 'R.C.C. Building', customStructureType: '', stage: 'Finished', buildingAge: '29', builtUpAreaSqFt: '532' }] } },
});

describe('v6 full-deed compatibility', () => {
  const previous = globalThis.fetch;
  let bytes: Uint8Array;
  beforeAll(async () => {
    bytes = new Uint8Array(await readFile(new URL('./sale-deed-template-v6.docx', import.meta.url)));
    // Pin this legacy compatibility suite to its v6 fixture, independently of the current default URL.
    globalThis.fetch = async () => new Response(Uint8Array.from(bytes).buffer);
  });
  afterAll(() => { globalThis.fetch = previous; });
  const generate = async (state: AppState, source?: DeedTemplateSource) => {
    const result = await fillSaleDeed(mergeValues(state), variantFor(state.category, state.form.flatStage), rewritesFor(state), scheduleMergesFor(state), source);
    return { result, text: await docxToText(new Uint8Array(await result.blob.arrayBuffer())) };
  };
  it.each(['Municipal Council', 'Municipal Corporation', 'Gram Panchayat'])('uses %s in each schedule and preserves its saved selection', async authority => {
    const state: AppState = fixture('', 'Residential'); state.form.localAuthorityType = authority;
    state.additionalSchedules = [{ id: 'other', category: 'Vacant Plot', unit: 'Sq. Yards', docNames: [], values: { ...state.form, localAuthorityType: 'Gram Panchayat', village: 'Other Village' } }];
    const { text } = await generate(state);
    expect(text).toContain(`Within the jurisdictional limits of the ${authority}, Sircilla`);
    expect(text).toContain('Within the jurisdictional limits of the Gram Panchayat, Other Village');
    expect(text).not.toContain('Competent Local Authority');
    const draft = newDraft(); draft.manual['property|primary|localAuthorityType'] = authority;
    expect(appStateFor(draftReducer(newDraft(), { type: 'load', draft: JSON.parse(JSON.stringify(draft)) })).form.localAuthorityType).toBe(authority);
  });
  it.each([['Corporation', 'Municipal Corporation'], ['Municipality', 'Municipal Council'], ['Gram Panchayati', 'Gram Panchayat']])('maps saved %s selections without changing their original values', async (oldName, newName) => {
    const draft = newDraft();
    draft.manual['property|primary|localAuthorityType'] = oldName;
    draft.manual['property|second|localAuthorityType'] = oldName;
    const loaded = draftReducer(newDraft(), { type: 'load', draft: JSON.parse(JSON.stringify(draft)) });
    expect(appStateFor(loaded).form.localAuthorityType).toBe(newName);
    expect(resolveDraft(loaded).values['property|second|localAuthorityType']).toBe(newName);
    expect(loaded.manual['property|primary|localAuthorityType']).toBe(oldName);
    const state: AppState = fixture('', 'Residential'); state.form.localAuthorityType = oldName;
    state.additionalSchedules = [{ id: 'second', category: 'Vacant Plot', unit: 'Sq. Yards', docNames: [], values: { ...state.form, village: 'Other Village' } }];
    const { text } = await generate(state);
    expect(text).toContain(`limits of the ${newName}, Sircilla`);
    expect(text).toContain(`limits of the ${newName}, Other Village`);
  });
  it('writes revised house floor prose once with independent Annexure floor areas', async () => {
    const state: AppState = fixture('', 'Residential');
    state.structureDetailsBySchedule.primary!.rows.push({ ...state.structureDetailsBySchedule.primary!.rows[0], id: 'upper', floorNo: 'First Floor', builtUpAreaSqFt: '320' });
    const { text } = await generate(state);
    expect(text).toContain('consisting of Ground Floor: 532 square feet; First Floor: 320 square feet, in plot');
    expect(text).toContain('532 sq.fts'); expect(text).toContain('320 sq.fts'); expect(text).not.toContain('852 sq.fts');
    expect(text).not.toContain('HOUSE / BUILDING / FLOOR DETAILS');
    expect(text).not.toMatch(/<[^>]+>/);
  });
  it.each(['built-in', 'legacy-custom'])('emits the requested Through Bank recital for each payment in %s', async kind => {
    const state: AppState = fixture();
    state.payments = [{ ...newPayment('through-bank'), amount: '100000', payer: 'BANK BUYER', payee: 'BANK SELLER' }, { ...newPayment('through-bank'), amount: '200000' }];
    const legacy = new Uint8Array(await readFile(new URL('./sale-deed-template.docx', import.meta.url)));
    const source: DeedTemplateSource | undefined = kind === 'legacy-custom' ? { kind: 'custom', name: 'legacy.docx', hash: 'qa', bytes: legacy, validation: await validateSaleDeedTemplate(legacy, 'legacy.docx') } : undefined;
    const { result, text } = await generate(state, source);
    expect(text).toContain('Through Bank: Amount of Rs.1,00,000/- paid through bank by the Vendee, namely BANK BUYER, to the Vendor, namely BANK SELLER.');
    expect(text).toContain('Through Bank: Amount of Rs.2,00,000/- paid through bank by the Vendee, namely QA BUYER, to the Vendor, namely QA SELLER.');
    expect(text.match(/Through Bank:/g)).toHaveLength(2);
    expect(text).not.toContain('Housing Loan:');
    expect(text).not.toContain('UPI/Online:');
    expect(generationBlockers(state).filter(item => item.id.startsWith('payment-') && /refNo|bank|branch|date/.test(item.id))).toEqual([]);
    if (process.env.FLAT_QA_DIR && kind === 'built-in') { await mkdir(process.env.FLAT_QA_DIR, { recursive: true }); await writeFile(`${process.env.FLAT_QA_DIR}/Through-Bank.docx`, new Uint8Array(await result.blob.arrayBuffer())); }
  });
  it.each(['built-in', 'legacy-custom'])('keeps multiple-party numbering in recitals and leaves signature lines unnumbered in %s', async kind => {
    const state: AppState = fixture('', 'Vacant Plot');
    state.additionalExecutants = [{ id: 'seller-2', docNames: [], values: { ...state.form, executantName: 'SECOND SELLER' } }];
    state.additionalClaimants = [{ id: 'buyer-2', docNames: [], values: { ...state.form, claimantName: 'SECOND BUYER' } }, { id: 'buyer-3', docNames: [], values: { ...state.form, claimantName: 'THIRD BUYER' } }];
    state.vendorSharesBySchedule = { primary: { primary: '60', 'seller-2': '40' } };
    state.vendeeSharesBySchedule = { primary: { primary: '50', 'buyer-2': '30', 'buyer-3': '20' } };
    const legacy = new Uint8Array(await readFile(new URL('./sale-deed-template.docx', import.meta.url)));
    const source: DeedTemplateSource | undefined = kind === 'legacy-custom' ? { kind: 'custom', name: 'legacy.docx', hash: 'qa', bytes: legacy, validation: await validateSaleDeedTemplate(legacy, 'legacy.docx') } : undefined;
    const { result, text } = await generate(state, source);
    const opening = text.slice(0, text.indexOf('FLOW OF TITLE'));
    for (const name of ['1. QA SELLER', '2. SECOND SELLER', '1. QA BUYER', '2. SECOND BUYER', '3. THIRD BUYER']) expect(opening).toContain(name);
    expect(opening).toContain('Holding Undivided Share of 60%');
    expect(text).toContain('SIGNATURES OF VENDORS');
    const signatures = text.slice(text.indexOf('SIGNATURES OF VENDORS'), text.indexOf('WITNESSES:'));
    expect(signatures.match(/________________/g)).toHaveLength(5);
    expect(signatures).not.toMatch(/\d+\./);
    const entries = await readZip(new Uint8Array(await result.blob.arrayBuffer()));
    const xml = new TextDecoder().decode(entries.find(part => part.name === 'word/document.xml')!.data);
    const cells = xml.slice(xml.indexOf('SIGNATURES OF VENDORS'), xml.indexOf('WITNESSES:'));
    expect(cells).not.toContain('<w:numPr');
    if (process.env.FLAT_QA_DIR && kind === 'built-in') { await mkdir(process.env.FLAT_QA_DIR, { recursive: true }); await writeFile(`${process.env.FLAT_QA_DIR}/Multiple-Parties.docx`, new Uint8Array(await result.blob.arrayBuffer())); }
  });
  it('accepts the final full-deed structure as a custom template too', async () => {
    const validation = await validateSaleDeedTemplate(bytes, 'final.docx', bytes);
    expect(validation.errors).toEqual([]);
    const { text } = await generate(fixture(), { kind: 'custom', name: 'final.docx', hash: 'qa', bytes, validation });
    expect(text).toContain('Finished Residential Flat No. 103');
  });
  it.each(['Finished', 'Semi-Finished'])('selects the full %s deed, with separate title references and no examples', async stage => {
    const { result, text } = await generate(fixture(stage));
    expect(text.match(/FLOW OF TITLE & LINK DEED DETAILS/g)).toHaveLength(1);
    expect(text.match(/SCHEDULE OF PROPERTY/g)).toHaveLength(1);
    expect(text).toContain(stage);
    expect(text).toContain('75 sq.fts');
    expect(text).not.toMatch(/<[^>]+>|700 Sq|2100 Sq|100 sq\.fts/);
    expect(text).toContain('North apartment'); expect(text).toContain('South flat');
    // Supplied development/allotment references apply to both completion stages.
    expect(text).toContain('DEV-55');
    expect(text).toContain('SUP-66');
    expect(text.includes('Municipal No.Not Allotted')).toBe(stage === 'Semi-Finished');
    if (process.env.FLAT_QA_DIR) { await mkdir(process.env.FLAT_QA_DIR, { recursive: true }); await writeFile(`${process.env.FLAT_QA_DIR}/${stage}.docx`, new Uint8Array(await result.blob.arrayBuffer())); }
  });
  it.each(['Vacant Plot', 'Open Place', 'Residential', 'Commercial', 'Agricultural land', 'Demolished', 'Part open place'])('keeps exactly the %s schedule and entered house rows', async category => {
    const { result, text } = await generate(fixture('Finished', category));
    expect(text.match(/SCHEDULE OF PROPERTY/g)).toHaveLength(1);
    expect(text).not.toMatch(/<[^>]+>|DEV-55|SUP-66|700 Sq|2100 Sq/);
    if (['Residential', 'Commercial'].includes(category)) { expect(text).toContain('Ground Floor: 532 square feet'); expect(text).not.toContain('Second Floor'); }
    if (process.env.FLAT_QA_DIR && category === 'Residential') await writeFile(`${process.env.FLAT_QA_DIR}/House.docx`, new Uint8Array(await result.blob.arrayBuffer()));
  });
  it('preserves legacy stage values and does not guess unknown completion', async () => {
    let draft = newDraft();
    for (const [key, value] of Object.entries({ category: 'Flat', flatStage: 'semi finished', flatNo: '103' })) draft = draftReducer(draft, { type: 'manual', key: `property|primary|${key}`, value });
    const reopened = appStateFor(draftReducer(newDraft(), { type: 'load', draft }));
    expect(flatStage(reopened.form.flatStage)).toBe('Semi-Finished');
    expect(propertyChoice('Flat', 'unverified stage')).toBe('');
    expect(generationBlockers(fixture('unverified stage')).some(item => item.id === 'flat-stage-choice')).toBe(true);
    await expect(generate(fixture('unverified stage'))).rejects.toThrow('Choose Finished Flat');
    expect(draft.manual['property|primary|flatStage']).toBe('semi finished');
  });
  it('keeps older custom templates with a single flat block working', async () => {
    const legacy = new Uint8Array(await readFile(new URL('./sale-deed-template.docx', import.meta.url)));
    const validation = await validateSaleDeedTemplate(legacy, 'legacy.docx');
    expect(validation.errors).toEqual([]);
    const { text } = await generate(fixture('Semi-Finished'), { kind: 'custom', name: 'legacy.docx', hash: 'legacy', bytes: legacy, validation });
    expect(text).toContain('Semi-Finished'); expect(text).toContain('103');
  });
  it('retains untouched package parts from the final reference', async () => {
    const { result } = await generate(fixture());
    const original = await readZip(bytes), output = await readZip(new Uint8Array(await result.blob.arrayBuffer()));
    for (const name of ['word/styles.xml', 'word/theme/theme1.xml']) expect(output.find(part => part.name === name)?.data).toEqual(original.find(part => part.name === name)?.data);
    const decode = (parts: Awaited<ReturnType<typeof readZip>>) => new TextDecoder().decode(parts.find(part => part.name === 'word/numbering.xml')!.data);
    expect(decode(output).startsWith(decode(original).split('</w:numbering>')[0])).toBe(true);
  });
  it('selects separate finished and semi-finished sections for repeated schedules', async () => {
    const state: AppState = fixture();
    state.additionalSchedules = [{ id: 'second', category: 'Flat', unit: 'Sq. Yards', docNames: [], values: { ...state.form, flatStage: 'Semi-Finished', flatNo: '204', supplementalDocNo: 'SUP-SECOND' } }];
    const { result, text } = await generate(state);
    expect(text.match(/FLOW OF TITLE & LINK DEED DETAILS/g)).toHaveLength(2);
    expect(text.match(/SCHEDULE OF PROPERTY -/g)).toHaveLength(2);
    expect(text).toContain('Finished Residential Flat No. 103');
    expect(text).toContain('Semi-Finished Residential Flat No.204');
    expect(text).toContain('SUP-SECOND');
    expect(text.match(/DECLARATION/g)).toHaveLength(1);
    if (process.env.FLAT_QA_DIR) await writeFile(`${process.env.FLAT_QA_DIR}/Mixed-Flats.docx`, new Uint8Array(await result.blob.arrayBuffer()));
  });
  it.each(['rtgs', 'housing-loan'] as const)('prints the supplied %s reference only once and drops unused methods', async mode => {
    const state: AppState = fixture(); state.payments = [{ ...newPayment(), mode, amount: '1494000', refNo: 'REF-ABC', bank: 'QA BANK', branch: 'QA BRANCH', date: '2026-10-11', payer: 'QA BUYER', payee: 'QA SELLER' }];
    const { text } = await generate(state);
    expect(text).toContain('REF-ABC');
    expect(text).not.toContain('Through Bank:'); expect(text).not.toContain('Cash:');
    expect(text.match(/REF-ABC/g)).toHaveLength(1);
  });
  it('keeps the entity recital with both flat completion options', async () => {
    for (const stage of ['Finished', 'Semi-Finished']) {
      const state: AppState = fixture(stage); state.form.executantPartyType = 'Company'; state.form.executantEntityName = 'QA COMPANY LIMITED';
      state.partyPeopleByParty = { 'executant|primary': { representatives: [{ id: 'person', name: 'QA SIGNER', relation: 'S/O', relationName: 'QA PARENT', designation: 'Manager', dob: '1980-01-01', age: '46', mobile: '', aadhaar: '', pan: '', hNo: '', locality: '', village: 'Sircilla', mandal: '', district: '', state: '', pinCode: '' }], members: [] } };
      const { text } = await generate(state);
      expect(text).toContain('QA COMPANY LIMITED'); expect(text).toContain('represented by'); expect(text).toContain('QA SIGNER');
    }
  });
  it('numbers each semi-finished covenant list continuously from one', async () => {
    const { result } = await generate(fixture('Semi-Finished'));
    const parts = await readZip(new Uint8Array(await result.blob.arrayBuffer()));
    const xml = new TextDecoder().decode(parts.find(part => part.name === 'word/document.xml')!.data);
    const operativeStart = xml.indexOf('OPERATIVE CLAUSES');
    const scheduleStart = xml.indexOf('SCHEDULE OF PROPERTY');
    expect(operativeStart).toBeGreaterThan(-1);
    expect(scheduleStart).toBeGreaterThan(operativeStart);
    const operativeXml = xml.slice(operativeStart, scheduleStart);
    const clauses = (operativeXml.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) || []).filter(paragraph => /<w:numPr\b/.test(paragraph) && /The (?:Vendor|Vendee)\b/i.test(paragraph.replace(/<[^>]+>/g, '')));
    expect(clauses).toHaveLength(15);
    const ids = [...new Set(clauses.map(paragraph => paragraph.match(/<w:numId w:val="(\d+)"/)?.[1]))];
    expect(ids).toHaveLength(1);
    const numbering = new TextDecoder().decode(parts.find(part => part.name === 'word/numbering.xml')!.data);
    expect(numbering).toMatch(new RegExp(`<w:num w:numId="${ids[0]}">[\\s\\S]*?<w:startOverride w:val="1"/>`));
  });
});
