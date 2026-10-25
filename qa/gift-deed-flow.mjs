import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {loadTemplateRuntime} from '../template-runtime-loader.mjs';
const rt=await loadTemplateRuntime();
const referenceBytes=new Uint8Array(await readFile(new URL('../gift-deed-template-v4.docx',import.meta.url)));
const referenceEntries=await rt.readZip(referenceBytes);
const referenceXml=new TextDecoder().decode(referenceEntries.find(entry=>entry.name==='word/document.xml').data);
await mkdir('tmp/gift/qa',{recursive:true});
for(const id of ['ordinary-plot','ordinary-open','ordinary-dismantled','ordinary-part','ordinary-house-finished','ordinary-house-semi','ordinary-flat-finished','ordinary-flat-semi']) for(const donors of [1,2]) for(const donees of [1,2]){
 const state=rt.sampleState(id);state.deedType='Gift';state.form={...state.form,giftRelationship:'daughter',govtRate:'5000',structValue:'100000',executantPan:'ABCDE1234F',claimantPan:'PQRST5678L'};
 if(donors>1)state.additionalExecutants=[{id:'second-donor',values:{...state.form,executantName:'SECOND DONOR'},docNames:[]}];
 if(donees>1)state.additionalClaimants=[{id:'second-donee',values:{...state.form,claimantName:'SECOND DONEE'},docNames:[]}];
 const schedules=rt.scheduleMergesFor(state);const output=await rt.fillGiftDeed(rt.mergeValues(state),rt.rewritesFor(state),schedules);
 const bytes=new Uint8Array(await output.blob.arrayBuffer());const text=await rt.docxToText(bytes);
 const packageEntries=await rt.readZip(bytes);
 for(const entry of referenceEntries.filter(entry=>entry.name!=='word/document.xml')) assert.deepEqual(packageEntries.find(output=>output.name===entry.name)?.data,entry.data,`${id}: preserve ${entry.name}`);
 const documentXml=new TextDecoder().decode(packageEntries.find(entry=>entry.name==='word/document.xml').data);
 const sections=documentXml.match(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g)||[];
 assert.equal(sections.length,2,`${id}: retain stamp-space and continuation sections`);
 for(const section of sections) {
  assert.match(section,/<w:pgSz w:w="11920" w:h="16840"\/>/);
  assert.match(section,/w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720"/);
 }
 assert.match(sections[0],/w:top="8208"/);
 assert.match(sections[1],/w:top="1080"/);
 assert.deepEqual(output.unmapped,[],id);
 assert.match(text,/State:Telangana/);
 assert.match(text,/ABCDE1234F/);assert.match(text,/PQRST5678L/);
 assert.doesNotMatch(documentXml,/__GIFT_SIGNATURE_TAB__/);
 assert.match(text,/SIGNATURES? OF THE DONORS?/);
 assert.match(text,/SIGNATURES? OF THE DONEES?/);
 assert.match(text,new RegExp(`WHEREAS the ${donees>1?'Donees are the daughters':'Donee is the daughter'} of the ${donors>1?'Donors':'Donor'}\\.`));
 if(id==='ordinary-house-semi') assert.match(text,/All that the semi-finished/);
 if(id.includes('flat')) assert.match(text,/30 Sq.yds equivalent to 25.08 square meters/);
 assert.doesNotMatch(text,/Consideration: Nil\s*: Nil/);
 assert.equal((text.match(/SCHEDULE OF PROPERTY/g)||[]).length,1);
 assert.doesNotMatch(text,/is\/are|has\/have|owner\/s|Donor\/s|Donee\/s|property hereby sold|50%|____%/i);
 assert.match(text,donors>1?/Donors further declare that they have/:/Donor further declares that the Donor has/);
 assert.match(text,donees>1?/Donees hereby accept/:/Donee hereby accepts/);
 if(donors>1)assert.match(text,/SECOND DONOR/);if(donees>1)assert.match(text,/SECOND DONEE/);
 if(id.includes('plot')||id.includes('house')||id.includes('flat'))await writeFile(`tmp/gift/qa/${id}-${donors}-${donees}.docx`,bytes);
}
console.log('PASS: Gift relationship, grammar and schedules in 32 property/party combinations.');

const state=rt.sampleState('multiple');state.deedType='Gift';state.form.giftRelationship='other';state.form.giftRelationshipCustom='son and daughter';
const schedules=rt.scheduleMergesFor(state);
const compiled=rt.compileDeed({instrumentId:'gift',variantId:'family-gift',snapshotHash:'synthetic',values:rt.mergeValues(state),schedules,rewrites:rt.rewritesFor(state),unresolvedWarnings:[]});
const artifact=await rt.renderArtifact(compiled,'docx');
assert.equal(artifact.manifest.templateVersionId,'gift-deed-v4');
assert.match(await rt.docxToText(new Uint8Array(await artifact.result.blob.arrayBuffer())),/WHEREAS the Donees are the son and daughter of the Donors/);
const sourceBytes=new Uint8Array(await readFile(new URL('../gift-deed-template-v4.docx',import.meta.url)));
const entries=await rt.readZip(sourceBytes);const document=entries.find(entry=>entry.name==='word/document.xml');
document.data=new TextEncoder().encode(new TextDecoder().decode(document.data).replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g,paragraph=>{
 const changed=rt.replaceRunText(paragraph,/WHEREAS the Donee\/s is\/are the <Relationship> of the Donor\/s\./gi,()=> '');
 return rt.replaceRunText(changed,/Donor\/s/g,()=> 'Donor');
}));
const replacement={kind:'custom',name:'replacement Gift.docx',hash:'synthetic',bytes:await rt.writeZip(entries),validation:await rt.validateGiftDeedTemplate(sourceBytes)};
const restored=JSON.parse(JSON.stringify(state));const result=await rt.fillGiftDeed(rt.mergeValues(restored),rt.rewritesFor(restored),rt.scheduleMergesFor(restored),replacement);
const text=await rt.docxToText(new Uint8Array(await result.blob.arrayBuffer()));
assert.equal((text.match(/WHEREAS the Donees are the son and daughter of the Donors\./g)||[]).length,1);
assert.match(text,/Donors have absolute right/);
assert.equal((text.match(/SCHEDULE OF PROPERTY/g)||[]).length,2);
state.form.giftRelationship='';await assert.rejects(()=>rt.fillGiftDeed(rt.mergeValues(state),[],schedules),/Select the relationship/);
console.log('PASS: Gift compiler/download path, multiple schedules, restored custom relationship, and replacement templates cannot remove the clause or reset donor grammar.');

const unknownEntries=await rt.readZip(sourceBytes);const unknownDoc=unknownEntries.find(entry=>entry.name==='word/document.xml');unknownDoc.data=new TextEncoder().encode(new TextDecoder().decode(unknownDoc.data).replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g,paragraph=>rt.replaceRunText(paragraph,/<EXECUTANT NAME>/g,()=>'<EXECUTANT NAME> <New required fact>')));
const unknownValidation=await rt.validateGiftDeedTemplate(await rt.writeZip(unknownEntries));assert.equal(unknownValidation.valid,false);assert(unknownValidation.errors.some(error=>/Unsupported Gift placeholder/.test(error)));
console.log('PASS: unknown Gift bindings block replacement rather than silently dropping newly added details.');

for(const version of ['v1','v2','v3','v4']) {
 const templateBytes=new Uint8Array(await readFile(new URL(`../gift-deed-template-${version}.docx`,import.meta.url)));
 const validation=await rt.validateGiftDeedTemplate(templateBytes);assert.equal(validation.valid,true,validation.errors.join(' '));
 const custom={kind:'custom',name:`Gift ${version}.docx`,hash:`synthetic-${version}`,bytes:templateBytes,validation};
 for(const variantId of ['family-gift','non-family-gift','gift-to-trust-or-charity']) {
  const restored=JSON.parse(JSON.stringify(state));restored.form.giftRelationship='friend';restored.form.executantPan='ABCDE1234F';restored.form.claimantPan='PQRST5678L';
  const compiled=rt.compileDeed({instrumentId:'gift',variantId,snapshotHash:'saved-reloaded',values:rt.mergeValues(restored),schedules:rt.scheduleMergesFor(restored),rewrites:rt.rewritesFor(restored),unresolvedWarnings:[]},custom);
  const generated=await rt.renderArtifact(compiled,'docx',custom);const text=await rt.docxToText(new Uint8Array(await generated.result.blob.arrayBuffer()));
  assert.match(text,/WHEREAS the Donees are the friends of the Donors/);
  assert.match(text,/ABCDE1234F/);assert.match(text,/PQRST5678L/);
  assert.match(text,/DECLARATION/);assert.match(text,/Donors further declare that they have/);
  assert.doesNotMatch(text,/has\/have|is\/are|property hereby sold|____%/i);
  if(variantId!=='family-gift')assert.doesNotMatch(text,/FAMILY MEMBERS?/);
  assert.equal(generated.manifest.templateVersionId,`custom:synthetic-${version}`);
 }
}
for(const [find,replacement,message] of [
 [/<Executant Adhar Number>/gi,'',/party details/],
 [/w:top="8208"/g,'w:top="1440"',/stamp space/],
 [/<IF FINISHED FLAT>/gi,'<IF SEMI FINISHED FLAT>',/duplicate|unsupported/],
]) {
 const entries=await rt.readZip(referenceBytes);const document=entries.find(entry=>entry.name==='word/document.xml');
 document.data=new TextEncoder().encode(new TextDecoder().decode(document.data).replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g,p=>rt.replaceRunText(p,find,()=>replacement)).replace(find,replacement));
 const checked=await rt.validateGiftDeedTemplate(await rt.writeZip(entries));assert.equal(checked.valid,false);assert(checked.errors.some(error=>message.test(error)),checked.errors.join(' '));
}
console.log('PASS: all four Gift revisions and all three Gift variants preserve saved relationship/grammar; party identity, stamp-space and schedule damage is rejected.');

// Voice-note corrections: retained data must not leak allocation prose into Gift.
for (const version of ['v1','v2','v3','v4']) {
 const state=rt.sampleState('ordinary-open');state.deedType='Gift';
 Object.assign(state.form,{giftRelationship:'friend',executionDate:'2026-10'});
 state.vendorSharesBySchedule={primary:{primary:'100'}};state.vendeeSharesBySchedule={primary:{primary:'100'}};
 state.linkRecordsBySchedule={primary:[{id:'nala',docNames:[],values:{linkOption:'nala',nalaOrderNo:'NALA-42',nalaExtent:'00-02'}}]};
 const bytes=new Uint8Array(await readFile(new URL(`../gift-deed-template-${version}.docx`,import.meta.url)));
 const source={kind:'custom',name:`Gift ${version}`,hash:version,bytes,validation:await rt.validateGiftDeedTemplate(bytes)};
 const values={...rt.mergeValues(state),'Gift Variant':'non-family-gift'};
 const result=await rt.fillGiftDeed(values,rt.rewritesFor(state),rt.scheduleMergesFor(state),source);
 const output=new Uint8Array(await result.blob.arrayBuffer()),text=await rt.docxToText(output);
 const entries=await rt.readZip(output),xml=new TextDecoder().decode(entries.find(entry=>entry.name==='word/document.xml').data);
 assert.deepEqual(result.unmapped,[]);
 assert.match(text,/made and executed on __-10-2026/);
 assert.doesNotMatch(text,/Holding\s+(?:an\s+)?Undivided Share|following undivided shares|NALA converted extent:/i);
 assert.match(text,/NALA-42/); // Keep the linked title record itself.
 const paragraphText=paragraph=>[...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(match=>match[1]).join('');
 const title=[...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].find(match=>paragraphText(match[0]).includes('GIFT SETTLEMENT DEED IN FAVOUR OF'))?.[0];
 assert(title);assert.match(paragraphText(title),/^GIFT SETTLEMENT DEED IN FAVOUR OF OTHERS\s*$/);
 assert.doesNotMatch(title,/<w:(?:br|cr)\b/);
 assert.equal(state.vendorSharesBySchedule.primary.primary,'100');
 await writeFile(`tmp/gift/qa/voice-note-${version}.docx`,output);
}
console.log('PASS: Gift single-line title, blank signing day, omitted party/schedule shares and NALA extent across all four source revisions.');
