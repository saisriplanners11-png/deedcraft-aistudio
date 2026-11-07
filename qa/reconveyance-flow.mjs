import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const rt = await loadTemplateRuntime();
await mkdir('tmp/reconveyance/qa', { recursive: true });
for (const [name, variant, mode, count, property] of [
  ['title', 'title-deed', 'bank-to-person', 1, 'ordinary-plot'],
  ['bank-mortgage', 'mortgage-deed-person-to-person-and-bank-to-person', 'bank-to-person', 2, 'ordinary-house-finished'],
  ['person-mortgage', 'mortgage-deed-person-to-person-and-bank-to-person', 'person-to-person', 3, 'ordinary-flat-finished'],
]) {
  const state = rt.sampleState(property);
  state.deedType = 'Deed Of Reconvayance'; state.draft = variant === 'title-deed' ? 'TITLE DEED' : 'MORTGAGE DEED (PERSON TO PERSON and bank to person)';
  Object.assign(state.form, { bankName: 'SAMPLE BANK', bankBranch: 'Central', officialDesignation: 'Manager', mortgagePartyMode: mode, interestAmount: '25.05', nearAdjacent: 'near', claimantDob: '1991-01-01', executantPan: 'ABCDE1234F', claimantPan: 'PQRST5678L' });
  state.linkRecordsBySchedule = { primary: Array.from({length:count}, (_,i)=>({ id:`mortgage-${i}`,docNames:[],values:{linkOption:'linkDoc',linkDocNo:`100${i}/2025`,linkDocDate:`2025-01-0${i+1}`,linkSro:`Sample SRO ${i+1}`,linkSroCode:`101${i}`,mortgageAmount:'100000.10'}})) };
  const compiled = rt.compileDeed({ instrumentId:'reconveyance',variantId:variant,snapshotHash:'qa',values:rt.mergeValues(state),schedules:rt.scheduleMergesFor(state),rewrites:rt.rewritesFor(state),unresolvedWarnings:[] });
  const {result}=await rt.renderArtifact(compiled,'docx');
  const bytes=new Uint8Array(await result.blob.arrayBuffer());
  const text=await rt.docxToText(bytes);
  assert.ok(text.includes('RECONVEYANCE'));
  assert.equal((text.match(/additional mortgage/g)||[]).length,count-1);
  assert.ok(!text.includes('<IF '));
  await writeFile(`tmp/reconveyance/qa/${name}.docx`,bytes);
}
console.log('Reconveyance default compiler and three representative documents passed.');
