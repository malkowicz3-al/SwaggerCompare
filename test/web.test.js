import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

// served from a web server, / must lead to the app and the web package must ship that entry page
test('root index.html redirects to the app and is packaged', () => {
  const target = readFileSync('index.html', 'utf8').match(/url=([^"]+)"/)[1];
  assert.equal(target, 'src/index.html');
  assert.ok(existsSync(target));
  assert.match(readFileSync('scripts/build-web.mjs', 'utf8'), /cpSync\('index\.html'/);
});
