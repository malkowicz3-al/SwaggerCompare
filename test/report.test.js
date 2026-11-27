import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compare } from '../src/compare.js';
import { heading, summary, byEndpoint, markdown } from '../src/report.js';

const read = (name) => readFileSync(new URL('../examples/' + name, import.meta.url), 'utf8');
const res = compare(read('orders-api-v1.yaml'), read('orders-api-v2.yaml'));

test('heading', () => {
  assert.equal(heading(res.meta), 'Orders API  1.4.0 → 2.0.0');
  assert.equal(heading({ left: { title: 'A', version: '1' }, right: { title: 'B', version: '1' } }), 'A → B  1');
  assert.equal(heading({ left: {}, right: {} }), '');
  assert.equal(heading({ left: null, right: { title: 'B', version: '2' } }), 'B  2');
});

test('summary', () => {
  assert.equal(summary([]), 'No changes');
  const s = summary(res.changes);
  assert.match(s, /^Endpoints: 1 added · 2 removed · \d+ changed · Schemas: \d+ changed · ⚠ \d+ breaking$/);
  assert.ok(s.endsWith(`⚠ ${res.changes.filter((c) => c.breaking).length} breaking`));
});

test('byEndpoint: via prefix, a change under every endpoint it hits, Other last', () => {
  const c = (text, affects) => ({ text, affects });
  const a = c('Added endpoint', [{ endpoint: 'GET /a', dir: 'endpoint' }]);
  const s = c('x: now required', [
    { endpoint: 'GET /a', via: 'parameter p', dir: 'request' },
    { endpoint: 'GET /a', via: 'response 200, 404', dir: 'response' },
    { endpoint: 'POST /b', via: 'request body', dir: 'request' },
  ]);
  const o = c('version: 1 → 2', []);
  assert.deepEqual(byEndpoint([o, a, s]), [
    { key: 'GET /a', rows: [{ c: a, text: 'Added endpoint' }, { c: s, text: 'parameter p, response 200, 404 › x: now required' }] },
    { key: 'POST /b', rows: [{ c: s, text: 'request body › x: now required' }] },
    { key: 'Other', rows: [{ c: o, text: 'version: 1 → 2' }] },
  ]);
});

test('markdown: title, breaking, endpoints with details, other', () => {
  const md = markdown(res);
  const at = (s) => md.indexOf(s);
  assert.ok(md.startsWith('# Orders API  1.4.0 → 2.0.0\n'));
  assert.ok(at('## Breaking') > 0 && at('## Breaking') < at('## GET /orders') && at('## GET /orders') < at('## Other'));
  assert.ok(md.includes('- ⚠ request body › currency: now required'));
  assert.ok(md.includes('- info: version: "1.4.0" → "2.0.0"'));
  assert.ok(/requestId: extracted to schema RequestId\n {2}- /.test(md));
  assert.match(markdown(compare('a:\n\tb: 1', 'a: 1')), /^# API changes\n\nThe left spec can't be parsed: line 2: /);
});
