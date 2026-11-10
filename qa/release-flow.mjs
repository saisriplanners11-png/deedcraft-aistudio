import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const rt=await loadTemplateRuntime();
const bytes=new Uint8Array(await readFile('release-deed-template-v1.docx'));
const validation=await rt.validateReleaseTemplate(bytes); assert.deepEqual(validation.errors,[]);
await mkdir('tmp/release/qa',{recursive:true});
for(const property of ['plot','open','part','dismantled','house-finished','house-semi','flat-finished','flat-semi']) {
  const state=rt.sampleState('ordinary-'+property); state.deedType='Release'; state.draft='Co-owner Release';
  Object.assign(state.form,{totalPropertyValue:'1200000',consid:'400000',nearAdjacent:'near',executantGender:'Male',claimantGender:'Female'});
  Object.assign(state.form, { dimensionNorth: '21 ft', dimensionSouth: '22 ft', dimensionEast: '41 ft', dimensionWest: '42 ft' });
  state.payments[0].amount='400000';
  state.releaseData={releasedBySchedule:{primary:{primary:'1/3'}}};
  const compiled=rt.compileDeed({instrumentId:'release',variantId:'co-owner-release',snapshotHash:'qa',values:rt.mergeValues(state),schedules:rt.scheduleMergesFor(state),rewrites:rt.rewritesFor(state),unresolvedWarnings:[]});
  const {result}=await rt.renderArtifact(compiled,'docx');
  const output=new Uint8Array(await result.blob.arrayBuffer()),text=await rt.docxToText(output);
  assert.ok(text.includes('RELEASE DEED BETWEEN CO-OWNERS'));
  assert.equal((text.match(/THE DETAILS OF TOTAL PROPERTY/g)||[]).length,1);
  assert.ok(!/<[^>]+>|DD-MM-YYYY|Vendee\/s|Vendor\/s|SIGN\/S|HAS\/HAVE|HIS\/HER/.test(text),text);
  assert.ok(text.includes('1/3'));
  assert.match(text, /Dimensions\s+North: 21 ft\s+South: 22 ft\s+East: 41 ft\s+West: 42 ft/, property);
  if (property.startsWith('house-')) assert.match(text, /Ground Floor: 800 Sq\. Ft\.; First Floor: 600 Sq\. Ft\.; Total Plinth Area: 1400 Sq\. Ft\./, property);
  await writeFile(`tmp/release/qa/${property}.docx`,output);
  if(property==='plot') await writeFile('tmp/release/qa/plot.txt',text);
}
console.log('Release source validation and all eight property downloads passed.');


// Stress the default route with isolated property records, repeated enclosures and seven parties.
const { enclosureFixture } = await import('./repeated-enclosures-fixtures.mjs');
const multiple=rt.sampleState('multiple');multiple.deedType='Release';multiple.draft='Co-owner Release';multiple.form.totalPropertyValue='3000000';multiple.form.nearAdjacent='near';multiple.form.executantGender='Female';multiple.form.claimantGender='Male';
multiple.additionalExecutants=Array.from({length:3},(_,i)=>({id:'s'+i,docNames:[],values:{...multiple.form,executantName:'RELEASOR PERSON '+(i+2),executantGender:i%2?'Female':'Male'}}));
multiple.additionalClaimants=Array.from({length:2},(_,i)=>({id:'b'+i,docNames:[],values:{...multiple.form,claimantName:'RELEASEE PERSON '+(i+2),claimantGender:'Female'}}));
multiple.releaseData={releasedBySchedule:{primary:{primary:'1/8',s0:'1/8',s1:'1/8',s2:'1/8'},'property-2':{primary:'1/4',s0:'1/4',s1:'',s2:''}},allocatedBySchedule:{primary:{primary:'1/4',b0:'1/8',b1:'1/8'}}};
multiple.linkRecordsBySchedule=Object.fromEntries(['primary','property-2'].map(scope=>[scope,[1,2].flatMap(i=>enclosureFixture(scope,i))]));
const before=JSON.stringify(multiple);
const render=async(state,variant='co-owner-release')=>{
  const {result}=await rt.renderArtifact(rt.compileDeed({instrumentId:'release',variantId:variant,snapshotHash:'release-qa',values:rt.mergeValues(state),schedules:rt.scheduleMergesFor(state),rewrites:rt.rewritesFor(state),unresolvedWarnings:[]}),'docx');
  const output=new Uint8Array(await result.blob.arrayBuffer());return {output,text:await rt.docxToText(output)};
};
const multi=await render(multiple);
assert.equal((multi.text.match(/SIGNATURE OF THE RELEASOR/g)||[]).length,4);
assert.equal((multi.text.match(/SIGNATURE OF THE RELEASEE/g)||[]).length,3);
for(const scope of ['primary','property-2']) for(const i of [1,2]) for(const prefix of ['TITLE','RECT','SUPP','VLT','LAYOUT','APP','PROC','PASSBOOK','KHATA','NALA','RECEIPT','PERMIT']) assert.ok(multi.text.includes(`${prefix}-${scope}-${i}`),prefix+' '+scope+' '+i);
assert.equal(JSON.stringify(multiple),before);
await writeFile('tmp/release/qa/multiple.docx',multi.output);
const minor=rt.sampleState('ordinary-plot');minor.deedType='Release';minor.draft='Co-owner Release';minor.form.totalPropertyValue='3000000';minor.releaseData={};
Object.assign(minor.form,{claimantPartyType:'Minor',claimantName:'MINOR RELEASEE',claimantGender:'Female',claimantDob:'2016-08-04',claimantRelation:'D/O',claimantGuardianName:'GUARDIAN PERSON',claimantGuardianRelationship:'Grandfather',claimantGuardianRelation:'S/O',claimantGuardianRelativeName:'ELDER',claimantGuardianDob:'1967-01-01',claimantGuardianOccupation:'Agriculture',claimantGuardianHNo:'GUARDIAN-HOUSE',claimantGuardianLocality:'Guardian Locality',claimantGuardianVillage:'Guardian Village',claimantGuardianMandal:'Guardian Mandal',claimantGuardianDistrict:'Guardian District',claimantGuardianState:'Telangana',claimantGuardianPinCode:'505303',claimantGuardianMobile:'9000000001',claimantGuardianAadhaar:'555566667777'});
const child=await render(minor);
assert.ok(child.text.includes('is under guardianship of her natural Grand Father'));
assert.ok(child.text.includes('GUARDIAN PERSON'));
assert.ok(child.text.includes('(MINOR)'));
assert.ok(child.text.includes('GUARDIAN-HOUSE'));
await writeFile('tmp/release/qa/minor.docx',child.output);
console.log('Release repeated enclosures, two properties, seven parties, partial shares and minor/guardian output passed.');
