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
  Object.assign(state.form, { stampPaperMargin: '100', stampPaperCount: '3' });
  Object.assign(state.form, { bankName: 'SAMPLE BANK', bankBranch: 'Central', officialDesignation: 'Manager', mortgagePartyMode: mode, interestAmount: '25.05', nearAdjacent: 'near', claimantDob: '1991-01-01', executantPan: 'ABCDE1234F', claimantPan: 'PQRST5678L' });
  state.linkRecordsBySchedule = { primary: Array.from({length:count}, (_,i)=>({ id:`mortgage-${i}`,docNames:[],values:{linkOption:'linkDoc',linkDocNo:`100${i}/2025`,linkDocDate:`2025-01-0${i+1}`,linkSro:`Sample SRO ${i+1}`,linkSroCode:`101${i}`,mortgageAmount:'100000.10'}})) };
  const compiled = rt.compileDeed({ instrumentId:'reconveyance',variantId:variant,snapshotHash:'qa',values:rt.mergeValues(state),schedules:rt.scheduleMergesFor(state),rewrites:rt.rewritesFor(state),unresolvedWarnings:[] });
  const {result}=await rt.renderArtifact(compiled,'docx');
  const bytes=new Uint8Array(await result.blob.arrayBuffer());
  const text=await rt.docxToText(bytes);
  const document = (await rt.readZip(bytes)).find(entry => entry.name === 'word/document.xml');
  const xml = new TextDecoder().decode(document.data);
  assert.deepEqual([...xml.matchAll(/<w:pgMar\b[^>]*w:top="(\d+)"/g)].slice(0, 4).map(match => match[1]), ['8352', '8352', '8352', '1418']);
  assert.ok(xml.slice(0, xml.indexOf('</w:p>', xml.indexOf('<w:sectPr'))).includes('SAMPLE PURCHASER'), name + ': keep the opening parties together');
  for (const label of ['1000/2025', 'Sample SRO 1', '1,00,000.10', '25.05']) {
    assert.ok([...xml.matchAll(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g)].some(([run]) => /<w:b\/>/.test(run) && run.includes('>' + label + '</w:t>')), label + ' is bold');
  }
  assert.ok(text.includes('Reconveyance'));
  assert.equal((text.match(/additional mortgage/g)||[]).length,count-1);
  assert.ok(!text.includes('<IF '));
  await writeFile(`tmp/reconveyance/qa/${name}.docx`,bytes);
}
console.log('Reconveyance default compiler and three representative documents passed.');
