import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

// src/gen/renderer.js is committed so the repo runs from SwaggerCompare.bat; it must match src/
test('committed bundle is up to date (run `npm run build` if this fails)', async () => {
  const out = await build({ entryPoints: ['src/renderer.js'], bundle: true, format: 'iife', target: 'chrome120', write: false, logLevel: 'silent' });
  assert.equal(out.outputFiles[0].text, readFileSync('src/gen/renderer.js', 'utf8').replace(/\r\n/g, '\n'));
});
