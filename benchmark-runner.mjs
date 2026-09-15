// Run against the local dev server. Expected values must be checked by a human.
// No identity data is logged: only aggregate scores are printed.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { chromium } from 'playwright';

const manifestPath = process.argv[2];
if (!manifestPath) throw new Error('Usage: node benchmark-runner.mjs <manifest.json> [report.json]');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const browser = await chromium.launch({headless:true});
try {
  const page = await browser.newPage();
  await page.goto(process.env.BENCHMARK_URL || 'http://localhost:5173');
  const cases = [];
  for (const item of manifest.cases) {
    if (item.manuallyChecked !== true) continue;
    const bytes = await readFile(resolve(dirname(resolve(manifestPath)), item.file));
    const result = await page.evaluate(async ({item, bytes}) => {
      const {extractUpload} = await import('/upload-extraction.ts');
      const file=new File([new Uint8Array(bytes)], item.file.split('/').pop(),{type:item.mime});
      const start=performance.now();
      const result=await extractUpload(file,new AbortController().signal,()=>{});
      return {actual:result.candidates,latencyMs:performance.now()-start};
    },{item,bytes:[...bytes]});
    cases.push({...item,...result,manualEdits:0});
  }
  const report=await page.evaluate(async cases => (await import('/benchmark.ts')).scoreBenchmark(cases),cases);
  console.log(JSON.stringify(report,null,2));
  if(process.argv[3]) await writeFile(process.argv[3],JSON.stringify(report,null,2)+'\n');
  process.exitCode=report.status==='passed'?0:2;
} finally {await browser.close();}
