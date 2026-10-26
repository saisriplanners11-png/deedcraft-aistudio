import { expect, it } from 'vitest';
import { mkdtemp, mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

it('loads the rebuilt validator after a loader reload in the same Node process', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'deedcraft-runtime-cache-'));
  try {
    await copyFile(new URL('./template-runtime-loader.mjs', import.meta.url), join(directory, 'loader.mjs'));
    await mkdir(join(directory, '.runtime'));
    await writeFile(join(directory, '.runtime', 'template-runtime.mjs'), 'export const version = 1;');
    const result = execFileSync(process.execPath, ['--input-type=module', '-e', `
      import { writeFile } from 'node:fs/promises';
      const first = await (await import('./loader.mjs?reload=1')).loadTemplateRuntime();
      await writeFile('./.runtime/template-runtime.mjs', 'export const version = 2;');
      const second = await (await import('./loader.mjs?reload=2')).loadTemplateRuntime();
      console.log(JSON.stringify([first.version, second.version]));
    `], { cwd: directory, env: { ...process.env, NODE_ENV: 'production' }, encoding: 'utf8' });
    expect(JSON.parse(result.trim())).toEqual([1, 2]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
