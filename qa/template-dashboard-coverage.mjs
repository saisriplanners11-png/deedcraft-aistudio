import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const rt = await loadTemplateRuntime();
const norm = value => value.replace(/\s+/g, ' ').trim().toLowerCase();
const fields = [...rt.GROUPS.flatMap(group => group.fields.map(field => ({ ...field, screen: group.title }))), ...rt.LINK_OPTIONS.flatMap(option => option.fields.map(field => ({ ...field, screen: 'Link Deed & Enclosures / ' + option.label })))].filter(field => !field.hidden);
const aliases = new Map();
const add = (tags, screen, inputs) => tags.forEach(tag => aliases.set(norm(tag), { screen, inputs }));
add(['1'], 'Property Schedules / stilt floors', ['stiltFloors']);
add(['5'], 'Property Schedules / upper floors', ['upperFloors']);
add(['EXECUTANT RELATION NAME'], 'Executant Details', ['executantRelation', 'executantRelativeName']);
add(['CLAIMANT RELATION NAME'], 'Claimant Details', ['claimantRelation', 'claimantRelativeName']);
add(['Municipal House Nos.'], 'Property Schedules', ['bearingHNo']);
add(['Municipality/Municipal Corporation/Gram Panchayat Name'], 'Link Deed & Enclosures / Permissions', ['permissionAuthorityName']);
add(['V.L.T.No.'], 'Link Deed & Enclosures / Land tax', ['vltNo', 'assessmentPtinNo']);
add(['Nala Order No.'], 'Link Deed & Enclosures / NALA', ['nalaOrderNo']);
add(['Pass Book Khata No.'], 'Link Deed & Enclosures / Title deed', ['khataNo']);
add(['Pattadar Pass Book No.'], 'Link Deed & Enclosures / Title deed', ['titleDeedNo']);
add(['Total Land Extent'], 'Property Schedules', ['extentSqYards']);
add(['Nature of House'], 'Property Schedules / Structure details', ['roofMaterial', 'structureDetails.rows.structureType']);
add(['Type of structure'], 'Property Schedules / Structure & Annexure I-A', ['constructionDescription']);
add(['Age of House'], 'Property Schedules / Structure details', ['structureDetails.rows.buildingAge']);
add(['Plinth Area', 'Ground Floor Area', 'First Floor Area'], 'Property Schedules / Structure details', ['structureDetails.rows.floorNo', 'structureDetails.rows.builtUpAreaSqFt']);
add(['Friend/Relationship'], 'Attorney details / Relationship to principal(s)', ['variantId', 'claimant.poaRelationship', 'claimant.poaRelationshipCustom']);
add(['FAMILY MEMBER/OTHER THAN FAMILY MEMBER'], 'Deed setup / Gift category', ['variantId']);
add(['Relationship'], 'Gift relationship', ['giftRelationship', 'giftRelationshipCustom']);
add(['ULB'], 'Property Schedules / Municipal Gift recipient', ['localAuthorityType', 'village']);
add(['Consideration in words'], 'Market Value / calculated from entered amount', ['consid']);
add(['Executant Share'], 'Executant Details / optional share per property', ['vendorSharesBySchedule']);
add(['Claimant Share'], 'Claimant Details / optional share per property', ['vendeeSharesBySchedule']);
add(['G.P.A.Doct.No.', 'A.G.P.A.Doct.No.'], 'Executant Details / Sale authority', ['saleAuthority.documentNo']);
add(['G.P.A.Doct.Date', 'A.G.P.A.Doct.Date'], 'Executant Details / Sale authority', ['saleAuthority.documentDate']);
add(['Authority SRO'], 'Executant Details / Sale authority', ['saleAuthority.sro']);
add(['Authority SRO Code'], 'Executant Details / Sale authority', ['saleAuthority.sroCode']);
add(['Authority Book Number'], 'Executant Details / Sale authority', ['saleAuthority.bookNumber']);
add(['Adjusted Amount'], 'Executant Details / AGPA authority', ['saleAuthority.adjustedAmount']);
add(['Authority Holder Label'], 'Deed setup / selected Sale form', ['variantId']);
add(['Authority Principal Names'], 'Executant Details / principal names', ['executantName']);
add(['Represented Principals'], 'Executant Details / attorney principal selection', ['saleAuthority.attorneys.principalIds']);
for (const [tag, suffix] of Object.entries({NAME:'Name','RELATION NAME':'RelationName',Age:'Age',Dob:'Dob',Occupation:'Occupation','H.No.':'HNo',Locality:'Locality',Village:'Village',Mandal:'Mandal',District:'District',State:'State','Pin Code':'PinCode','Adhar Number':'Aadhaar','Cell.No.':'Mobile',PAN:'Pan'})) {
 add(['Principal ' + tag], 'Executant Details / principal identity', ['executant' + (suffix === 'RelationName' ? 'RelativeName' : suffix)]);
 add(['Attorney ' + tag], 'Executant Details / attorney identity', ['saleAuthority.attorneys.values.' + suffix]);
}
add(['Attorney Share'], 'Executant Details / optional attorney share', ['saleAuthority.attorneys.values.SharePercentage']);
add(['Executant Address', 'Claimant Address'], 'Party details / composed address', ['party.HNo', 'party.Locality', 'party.Village', 'party.Mandal', 'party.District', 'party.State', 'party.PinCode']);
add(['Amount'], 'Payment Details / payment amount', ['payments.amount']);
add(['Bank Name', 'Housing Loan Bank'], 'Payment Details / bank', ['payments.bank']);
add(['Housing Loan Branch'], 'Payment Details / bank branch', ['payments.branch']);
add(['Cheque No.', 'DD No.', 'Transaction ID', 'Utr/Reference No.'], 'Payment Details / method-specific reference', ['payments.refNo']);
const report = [];
for (const file of ['gift-municipal-template-v3.docx', 'gift-deed-template-v6.docx', 'agreement-sale-gpa-template-v4.docx', 'general-poa-template-v3.docx', 'sale-deed-template-v11.docx', 'sale-deed-template-v10.docx', 'gift-deed-template-v5.docx', 'gift-municipal-template-v2.docx', 'agreement-sale-gpa-template-v1.docx', 'agreement-sale-gpa-template-v2.docx', 'general-poa-template-v1.docx', 'general-poa-template-v2.docx', 'agreement-sale-gpa-template-v3.docx']) {
 const text = await rt.docxToText(new Uint8Array(await readFile(new URL('../' + file, import.meta.url))));
 const tags = [...new Set([...text.matchAll(/<([^<>]+)>/g)].map(match => norm(match[1])))].filter(tag => !/^(?:if|end|for)\b/.test(tag) && tag !== 'without possession');
 const rows = tags.sort().map(placeholder => {
  const field = fields.find(field => (Array.isArray(field.ph) ? field.ph : field.ph ? [field.ph] : []).some(tag => norm(tag) === placeholder));
  const binding = aliases.get(placeholder) || (field && { screen: field.screen, inputs: [field.id] });
  assert(binding, `${file}: <${placeholder}> has no documented dashboard input or calculation`);
  return { placeholder, ...binding };
 });
 report.push({ file, count: rows.length, fields: rows });
}
for (const field of rt.ALL_FIELDS.filter(field => /^(?:development|supplemental)/.test(field.id) && !/^supplementalDeed/.test(field.id))) {
 assert(rt.groupsForStep(3, 'Flat').some(group => group.title === 'Landowner–developer agreements' && group.fields.some(item => item.id === field.id)), `${field.id}: dedicated dashboard section`);
}
await mkdir('tmp/template-field-coverage', { recursive: true });
await writeFile('tmp/template-field-coverage/report.json', JSON.stringify(report, null, 2));
await writeFile('tmp/template-field-coverage/report.md', '# Template-to-dashboard field coverage\n\n' + report.map(item => `## ${item.file}\n\n${item.count} template fields mapped.\n\n| Template placeholder | Dashboard location | Inputs / calculation sources |\n| --- | --- | --- |\n` + item.fields.map(row => `| ${row.placeholder} | ${row.screen} | ${row.inputs.join(', ')} |`).join('\n')).join('\n\n'));
console.log(`PASS: all ${report.reduce((sum, item) => sum + item.count, 0)} template-field occurrences across Sale/Gift/Municipal Gift have dashboard inputs or documented calculations; flat agreement inputs have a dedicated section.`);
