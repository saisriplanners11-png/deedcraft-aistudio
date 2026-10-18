import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {loadTemplateRuntime} from '../template-runtime-loader.mjs';
const rt=await loadTemplateRuntime();
await mkdir('tmp/gift/qa',{recursive:true});
for(const id of ['ordinary-plot','ordinary-open','ordinary-dismantled','ordinary-part','ordinary-house-finished','ordinary-house-semi','ordinary-flat-finished','ordinary-flat-semi']) for(const donors of [1,2]) for(const donees of [1,2]){
 const state=rt.sampleState(id);state.deedType='Gift';state.form={...state.form,giftRelationship:'daughter',govtRate:'5000',structValue:'100000'};
 if(donors>1)state.additionalExecutants=[{id:'second-donor',values:{...state.form,executantName:'SECOND DONOR'},docNames:[]}];
 if(donees>1)state.additionalClaimants=[{id:'second-donee',values:{...state.form,claimantName:'SECOND DONEE'},docNames:[]}];
 const schedules=rt.scheduleMergesFor(state);const output=await rt.fillGiftDeed(rt.mergeValues(state),rt.rewritesFor(state),schedules);
 const bytes=new Uint8Array(await output.blob.arrayBuffer());const text=await rt.docxToText(bytes);
 assert.deepEqual(output.unmapped,[],id);
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
assert.equal(artifact.manifest.templateVersionId,'gift-deed-v1');
assert.match(await rt.docxToText(new Uint8Array(await artifact.result.blob.arrayBuffer())),/WHEREAS the Donees are the son and daughter of the Donors/);
const sourceBytes=new Uint8Array(await readFile(new URL('../gift-deed-template-v1.docx',import.meta.url)));
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
