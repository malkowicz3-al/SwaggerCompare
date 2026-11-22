import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compare } from '../src/compare.js';

const read = (name) => readFileSync(new URL('./fixtures/' + name, import.meta.url), 'utf8');
const texts = (res) => res.changes.map((c) => c.text).sort();
const ln = (text, re) => text.slice(0, text.search(re)).split('\n').length;

const s2old = read('swagger2-old.yaml');
const s2new = read('swagger2-new.yaml');
const o3old = read('openapi3-old.yaml');
const o3new = read('openapi3-new.json');
const s2 = compare(s2old, s2new);
const o3 = compare(o3old, o3new);

test('swagger 2.0 fixture', () => {
  assert.deepEqual(texts(s2), [
    'Changed info.version: "1.0" → "1.1"',
    'Changed schemes.0: "http" → "https"',
    'Removed schemes.1',
    "Parameter header 'tenant' on /users: now required",
    "Added parameter query 'page' on GET /users",
    "Removed parameter query 'legacy' on GET /users",
    "Parameter query 'limit' on GET /users: type integer → string",
    'Removed response 500 on GET /users',
    'Added response 404 on GET /users',
    'Removed endpoint DELETE /users',
    'Added endpoint POST /users',
    "Parameter body 'body' on PUT /users/{id}: now required",
    "Parameter body 'body' on PUT /users/{id}: type #/definitions/User → #/definitions/Order",
    'Removed endpoint GET /legacy',
    'Removed endpoint POST /legacy',
    'Added endpoint GET /orders',
    'Added endpoint POST /orders',
    'User.email: now required',
    'Removed property User.age (integer)',
    'Added property User.phone (string)',
    'User.name: type string → integer',
    'Added definitions.User.properties.nick.format',
    'Removed schema Legacy',
    'Added schema Order',
  ].sort());
});

test('openapi 3 fixture (yaml vs json)', () => {
  assert.deepEqual(texts(o3), [
    "Parameter query 'limit' on GET /pets: now required",
    "Parameter query 'limit' on GET /pets: type integer → string",
    "Removed parameter query 'q' on GET /pets",
    "Added parameter header 'X-Req' on GET /pets",
    'Added response 400 on GET /pets',
    'Removed paths./pets.post.requestBody.content.application/json',
    'Added paths./pets.post.requestBody.content.application/xml',
    'Removed endpoint DELETE /pets/{id}',
    'Added endpoint GET /owners',
    'Pet.tag: now required',
    'Pet.tag: type string → integer',
    'Added property Pet.age (integer)',
    'Removed schema Owner',
    'Added schema Toy',
  ].sort());
});

test('no differences', () => {
  assert.deepEqual(compare(s2old, s2old).changes, []);
  assert.deepEqual(compare('a: 1\nb: {c: 2, d: 3}\n', 'b: {d: 3, c: 2}\na: 1\n').changes, []);
  assert.deepEqual(compare('a: [1, x]\nb: {c: true}\n', '{"b": {"c": true}, "a": [1, "x"]}').changes, []);
});

test('entry shape', () => {
  for (const c of [...s2.changes, ...o3.changes]) {
    assert.ok(['added', 'removed', 'changed'].includes(c.kind));
    assert.ok(['left', 'right'].includes(c.side));
    assert.ok(Array.isArray(c.path) && c.path.every((p) => typeof p === 'string'));
    assert.ok(Number.isInteger(c.line) && c.line >= 1);
  }
});

test('sides and lines', () => {
  const find = (t) => s2.changes.find((c) => c.text === t);
  assert.deepEqual(
    [find('Added endpoint POST /users').side, find('Added endpoint POST /users').line],
    ['right', ln(s2new, /^ {4}post:/m)],
  );
  assert.deepEqual(
    [find('Removed endpoint DELETE /users').side, find('Removed endpoint DELETE /users').line],
    ['left', ln(s2old, /^ {4}delete:/m)],
  );
  assert.deepEqual(
    [find('Removed property User.age (integer)').side, find('Removed property User.age (integer)').line],
    ['left', ln(s2old, /^ {6}age:/m)],
  );
  assert.deepEqual(
    [find('User.email: now required').side, find('User.email: now required').line],
    ['right', ln(s2new, /required: \[name, email\]/)],
  );
});

test('no duplicate entries', () => {
  assert.ok(!texts(s2).includes('User.age: no longer required'));
  assert.equal(texts(s2).filter((t) => t.includes("'limit'")).length, 1);
  const limit = texts(o3).filter((t) => t.includes("'limit'"));
  assert.equal(limit.length, 2);
  assert.ok(limit.some((t) => t.endsWith('now required')) && limit.some((t) => t.includes('type')));
  assert.ok(!texts(o3).some((t) => t.includes('schema.type')));
});

test('parse errors', () => {
  const tab = compare('a:\n\tb: 1', 'a: 1');
  assert.equal(tab.error.side, 'left');
  assert.equal(tab.error.line, 2);
  assert.equal(tab.changes, undefined);
  const dup = compare('a: 1', 'a: 1\na: 2');
  assert.equal(dup.error.side, 'right');
  assert.equal(dup.error.line, 2);
  assert.equal(compare('a:\n\tb: 1', 'a: 1\na: 2').error.side, 'left');
  assert.equal(compare('', 'a: 1').error.message, 'Empty document');
  assert.equal(compare('a: 1', '- 1').error.message, 'Document root must be a mapping');
});

const defs = (users) => users.map((u) => JSON.stringify({ swagger: '2.0', definitions: { User: u } }));
const diff = (l, r) => texts(compare(...defs([l, r])));

test('required dropped without a property on either side (allOf)', () => {
  const base = { $ref: '#/definitions/Base' };
  assert.deepEqual(diff({ allOf: [base, { required: ['name'] }] }, { allOf: [base, { required: [] }] }), [
    'User.allOf.1.name: no longer required',
  ]);
});

test('type arrays and $ref next to type', () => {
  const t = { type: ['string', 'null'] };
  assert.deepEqual(diff({ properties: { a: t } }, { properties: { a: { ...t } } }), []);
  assert.deepEqual(diff({ properties: { a: t } }, { properties: { a: { type: 'string' } } }), [
    'User.a: type ["string","null"] → string',
  ]);
  assert.deepEqual(
    diff({ properties: { a: { type: 'object', $ref: '#/A' } } }, { properties: { a: { type: 'object', $ref: '#/B' } } }),
    ['Changed definitions.User.properties.a.$ref: "#/A" → "#/B"'],
  );
  const op = (schema) => JSON.stringify({ paths: { '/x': { get: { parameters: [{ in: 'query', name: 'q', schema }] } } } });
  assert.deepEqual(texts(compare(op({ type: 'object', $ref: '#/A' }), op({ type: 'object', $ref: '#/B' }))), [
    'Changed paths./x.get.parameters.query:q.schema.$ref: "#/A" → "#/B"',
  ]);
});

test('duplicate and unlabeled parameters', () => {
  const op = (parameters) => JSON.stringify({ paths: { '/x': { get: { parameters } } } });
  const q = (description) => ({ in: 'query', name: 'a', description });
  assert.deepEqual(texts(compare(op([q('1'), q('2'), 'junk']), op([q('1'), q('3'), 'other']))), [
    'Changed paths./x.get.parameters.2: "junk" → "other"',
    'Changed paths./x.get.parameters.query:a#2.description: "2" → "3"',
  ]);
  assert.deepEqual(texts(compare(op([q('1')]), op([q('1'), q('1')]))), ["Added parameter query 'a'#2 on GET /x"]);
});

test('owner name follows non-properties keys', () => {
  const x = { properties: { x: { type: 'string' } } };
  assert.deepEqual(diff({}, { items: x }), ['Added definitions.User.items']);
  assert.deepEqual(diff({ items: {} }, { items: x }), ['Added property User.items.x (string)']);
  assert.deepEqual(diff({}, x), ['Added property User.x (string)']);
  assert.deepEqual(diff({ properties: { tags: { items: {} } } }, { properties: { tags: { items: x } } }), [
    'Added property User.tags.items.x (string)',
  ]);
});

test('param schema emptied on one side gives a single type entry', () => {
  const doc = (s) => `paths:\n  /x:\n    get:\n      parameters:\n        - {in: query, name: q, schema: ${s}}\n`;
  assert.deepEqual(texts(compare(doc('{type: integer}'), doc('{}'))), [
    "Parameter query 'q' on GET /x: type integer → undefined",
  ]);
});
