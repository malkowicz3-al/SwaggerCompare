import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compare } from '../src/compare.js';

const read = (name) => readFileSync(new URL('./fixtures/' + name, import.meta.url), 'utf8');
const texts = (res) => res.changes.map((c) => `${c.where} | ${c.text}`).sort();
const ln = (text, re) => text.slice(0, text.search(re)).split('\n').length;

const s2old = read('swagger2-old.yaml');
const s2new = read('swagger2-new.yaml');
const o3old = read('openapi3-old.yaml');
const o3new = read('openapi3-new.json');
const s2 = compare(s2old, s2new);
const o3 = compare(o3old, o3new);

test('swagger 2.0 fixture', () => {
  assert.deepEqual(texts(s2), [
    'info | version: "1.0" → "1.1"',
    'schemes | 0: "http" → "https"',
    'schemes | 1 removed',
    '/users | tenant: now required',
    "GET /users | Added parameter query 'page'",
    "GET /users | Removed parameter query 'legacy'",
    'GET /users | limit: type integer → string',
    'GET /users | Removed response 500',
    'GET /users | Added response 404',
    'DELETE /users | Removed endpoint',
    'POST /users | Added endpoint',
    'PUT /users/{id} | body: now required',
    'PUT /users/{id} | body: type #/definitions/User → #/definitions/Order',
    'GET /legacy | Removed endpoint',
    'POST /legacy | Removed endpoint',
    'GET /orders | Added endpoint',
    'POST /orders | Added endpoint',
    'User | email: now required',
    'User | Removed property age (integer)',
    'User | Added property phone (string)',
    'User | name: type string → integer',
    'User | nick.format added',
    'schemas | Removed schema Legacy',
    'schemas | Added schema Order',
  ].sort());
});

test('openapi 3 fixture (yaml vs json)', () => {
  assert.deepEqual(texts(o3), [
    'GET /pets | limit: now required',
    'GET /pets | limit: type integer → string',
    "GET /pets | Removed parameter query 'q'",
    "GET /pets | Added parameter header 'X-Req'",
    'GET /pets | Added response 400',
    'POST /pets | request body (application/json) removed',
    'POST /pets | request body (application/xml) added',
    'DELETE /pets/{id} | Removed endpoint',
    'GET /owners | Added endpoint',
    'Pet | tag: now required',
    'Pet | tag: type string → integer',
    'Pet | Added property age (integer)',
    'schemas | Removed schema Owner',
    'schemas | Added schema Toy',
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
    assert.ok(typeof c.text === 'string' && typeof c.where === 'string' && c.where !== '');
    assert.ok(c.details === undefined || (Array.isArray(c.details) && c.details.every((d) => typeof d === 'string')));
  }
});

test('sides and lines', () => {
  const find = (where, text) => {
    const c = s2.changes.find((x) => x.where === where && x.text === text);
    return [c.side, c.line];
  };
  assert.deepEqual(find('POST /users', 'Added endpoint'), ['right', ln(s2new, /^ {4}post:/m)]);
  assert.deepEqual(find('DELETE /users', 'Removed endpoint'), ['left', ln(s2old, /^ {4}delete:/m)]);
  assert.deepEqual(find('User', 'Removed property age (integer)'), ['left', ln(s2old, /^ {6}age:/m)]);
  assert.deepEqual(find('User', 'email: now required'), ['right', ln(s2new, /required: \[name, email\]/)]);
});

test('no duplicate entries', () => {
  assert.ok(!texts(s2).includes('User | age: no longer required'));
  assert.equal(texts(s2).filter((t) => t.includes('limit:')).length, 1);
  const limit = texts(o3).filter((t) => t.includes('limit:'));
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
    'User.allOf.1 | name: no longer required',
  ]);
});

test('type arrays and $ref next to type', () => {
  const t = { type: ['string', 'null'] };
  assert.deepEqual(diff({ properties: { a: t } }, { properties: { a: { ...t } } }), []);
  assert.deepEqual(diff({ properties: { a: t } }, { properties: { a: { type: 'string' } } }), [
    'User | a: type ["string","null"] → string',
  ]);
  assert.deepEqual(
    diff({ properties: { a: { type: 'object', $ref: '#/A' } } }, { properties: { a: { type: 'object', $ref: '#/B' } } }),
    ['User | a.$ref: "#/A" → "#/B"'],
  );
  const op = (schema) => JSON.stringify({ paths: { '/x': { get: { parameters: [{ in: 'query', name: 'q', schema }] } } } });
  assert.deepEqual(texts(compare(op({ type: 'object', $ref: '#/A' }), op({ type: 'object', $ref: '#/B' }))), [
    'GET /x | q.$ref: "#/A" → "#/B"',
  ]);
});

test('duplicate and unlabeled parameters', () => {
  const op = (parameters) => JSON.stringify({ paths: { '/x': { get: { parameters } } } });
  const q = (description) => ({ in: 'query', name: 'a', description });
  assert.deepEqual(texts(compare(op([q('1'), q('2'), 'junk']), op([q('1'), q('3'), 'other']))), [
    'GET /x | a#2.description: "2" → "3"',
    'GET /x | parameters.2: "junk" → "other"',
  ]);
  assert.deepEqual(texts(compare(op([q('1')]), op([q('1'), q('1')]))), ["GET /x | Added parameter query 'a'#2"]);
});

test('owner name follows non-properties keys', () => {
  const x = { properties: { x: { type: 'string' } } };
  assert.deepEqual(diff({}, { items: x }), ['User | items added']);
  assert.deepEqual(diff({ items: {} }, { items: x }), ['User.items | Added property x (string)']);
  assert.deepEqual(diff({}, x), ['User | Added property x (string)']);
  assert.deepEqual(diff({ properties: { tags: { items: {} } } }, { properties: { tags: { items: x } } }), [
    'User.tags.items | Added property x (string)',
  ]);
});

test('param schema emptied on one side gives a single type entry', () => {
  const doc = (s) => `paths:\n  /x:\n    get:\n      parameters:\n        - {in: query, name: q, schema: ${s}}\n`;
  assert.deepEqual(texts(compare(doc('{type: integer}'), doc('{}'))), [
    'GET /x | q: type integer → undefined',
  ]);
});

// $ref extraction / inlining
const json = (o) => JSON.stringify(o, null, 2);
const rid = { type: 'string', description: 'id', format: 'uuid' };
const s2doc = (props, defs = {}) => ({ swagger: '2.0', definitions: { User: { properties: props }, ...defs } });
const o3doc = (props, schemas = {}) => ({ openapi: '3.0.3', components: { schemas: { User: { properties: props }, ...schemas } } });
const run = (l, r) => {
  const [lt, rt] = [json(l), json(r)];
  return { res: compare(lt, rt), lt, rt };
};
const only = (res) => {
  const ext = res.changes.filter((c) => c.details);
  assert.equal(ext.length, 1);
  return ext[0];
};

test('extract property to a new schema (2.0 and 3.x)', () => {
  for (const [doc, ref] of [
    [s2doc, '#/definitions/RequestId'],
    [o3doc, '#/components/schemas/RequestId'],
  ]) {
    const { res, rt } = run(doc({ requestId: rid }), doc({ requestId: { $ref: ref } }, { RequestId: { ...rid }, Other: { type: 'object' } }));
    assert.deepEqual(texts(res), ['User | requestId: extracted to schema RequestId', 'schemas | Added schema Other']);
    const c = only(res);
    assert.deepEqual([c.kind, c.side, c.line, c.details], ['changed', 'right', ln(rt, /"\$ref"/), ['definition unchanged']]);
  }
});

test('extracted definition differences become details', () => {
  const ref = { $ref: '#/definitions/RequestId' };
  let { res } = run(s2doc({ requestId: rid }), s2doc({ requestId: ref }, { RequestId: { type: 'string', format: 'uuid-v7' } }));
  assert.deepEqual(only(res).details.sort(), ['description removed', 'format: "uuid" → "uuid-v7"']);
  ({ res } = run(s2doc({ requestId: rid }), s2doc({ requestId: ref }, { RequestId: { ...rid, type: 'integer' } })));
  assert.equal(res.changes.length, 1);
  assert.deepEqual(only(res).details, ['type: "string" → "integer"']);
});

test('extract parameter schema', () => {
  const op = (schema, schemas) => ({ openapi: '3.0.3', paths: { '/x': { get: { parameters: [{ in: 'query', name: 'id', schema }] } } }, components: { schemas } });
  const inline = { type: 'string', format: 'uuid' };
  for (const [Id, details] of [
    [inline, ['definition unchanged']],
    [{ ...inline, type: 'integer' }, ['type: "string" → "integer"']],
  ]) {
    const { res } = run(op(inline, {}), op({ $ref: '#/components/schemas/Id' }, { Id }));
    assert.deepEqual(texts(res), ['GET /x | id: extracted to schema Id']);
    assert.deepEqual(only(res).details, details);
  }
});

test('extract a whole parameter (3.x and 2.0)', () => {
  const p = { in: 'query', name: 'limit', required: false, schema: { type: 'integer' } };
  const o3 = (param, parameters) => ({ openapi: '3.0.3', paths: { '/x': { get: { parameters: [param] } } }, components: { parameters } });
  const s2 = (param, parameters) => ({ swagger: '2.0', paths: { '/x': { get: { parameters: [param] } } }, parameters });
  for (const [doc, ref] of [
    [o3, '#/components/parameters/Limit'],
    [s2, '#/parameters/Limit'],
  ]) {
    const { res } = run(doc(p, {}), doc({ $ref: ref }, { Limit: { ...p } }));
    assert.deepEqual(texts(res), ['GET /x | limit: extracted to parameter Limit']);
    assert.deepEqual(only(res).details, ['definition unchanged']);
  }
});

test('extract to an external $ref', () => {
  const { res } = run(s2doc({ requestId: rid }), s2doc({ requestId: { $ref: 'other.yaml#/X' } }));
  assert.deepEqual(texts(res), ['User | requestId: extracted to other.yaml#/X']);
  assert.deepEqual(only(res).details, ['definition not compared (external $ref)']);
});

test('inline a schema from $ref', () => {
  const { res, rt } = run(s2doc({ requestId: { $ref: '#/definitions/RequestId' } }, { RequestId: rid }), s2doc({ requestId: rid }));
  assert.deepEqual(texts(res), ['User | requestId: inlined from schema RequestId']);
  const c = only(res);
  assert.deepEqual([c.side, c.line, c.details], ['right', ln(rt, /"requestId"/), ['definition unchanged']]);
});

test('extract to a schema that exists on both sides', () => {
  const ref = { $ref: '#/definitions/RequestId' };
  const { res } = run(s2doc({ requestId: rid }, { RequestId: { type: 'string' } }), s2doc({ requestId: ref }, { RequestId: { ...rid } }));
  assert.deepEqual(texts(res), ['RequestId | description added', 'RequestId | format added', 'User | requestId: extracted to schema RequestId']);
  assert.deepEqual(only(res).details, ['definition unchanged']);
});

test('extract array items', () => {
  const arr = (items) => ({ type: 'array', items });
  const { res } = run(s2doc({ ids: arr(rid) }), s2doc({ ids: arr({ $ref: '#/definitions/Id' }) }, { Id: rid }));
  assert.deepEqual(texts(res), ['User | ids.items: extracted to schema Id']);
});

test('two properties extracted to the same new schema', () => {
  const ref = { $ref: '#/definitions/Id' };
  const { res } = run(s2doc({ a: rid, b: rid }), s2doc({ a: ref, b: ref }, { Id: rid }));
  assert.deepEqual(texts(res), ['User | a: extracted to schema Id', 'User | b: extracted to schema Id']);
});

test('pointer with an escaped slash', () => {
  const { res } = run(s2doc({ x: rid }), s2doc({ x: { $ref: '#/definitions/a~1b' } }, { 'a/b': rid }));
  assert.deepEqual(texts(res), ['User | x: extracted to schema a/b']);
  assert.deepEqual(only(res).details, ['definition unchanged']);
});

test('$ref changed to another $ref is not an extraction', () => {
  const { res } = run(s2doc({ a: { $ref: '#/A' } }), s2doc({ a: { $ref: '#/B' } }));
  assert.deepEqual(texts(res), ['User | a: type #/A → #/B']);
  assert.ok(res.changes.every((c) => !c.details));
});

test('ref into a sub-path of another schema suppresses nothing', () => {
  const s = { type: 'string' };
  const { res } = run(
    s2doc({ id: s }, { W: { properties: { x: s } } }),
    s2doc({ id: { $ref: '#/definitions/W/properties/id' } }, { W: { properties: { x: s, id: s } } }),
  );
  assert.deepEqual(texts(res), ['User | id: extracted to #/definitions/W/properties/id', 'W | Added property id (string)']);
});

test('unresolved ref target is not suppressed', () => {
  const { res } = run(s2doc({ a: rid }), s2doc({ a: { $ref: '#/definitions/A' } }, { A: 'oops' }));
  assert.ok(texts(res).includes('schemas | Added schema A'));
});

test('tags', () => {
  const tag = (l, r, text) => compare(json(l), json(r)).changes.find((c) => c.text.includes(text))?.tag;
  const user = (props, required) => ({ swagger: '2.0', definitions: { User: { required, properties: props } } });
  assert.equal(tag({ paths: {} }, { paths: { '/x': { get: {} } } }, 'Added endpoint'), 'endpoint');
  assert.equal(tag(user({}), user({ a: { type: 'string' } }), 'Added property'), 'property');
  assert.equal(tag(user({ a: {} }, []), user({ a: {} }, ['a']), 'now required'), 'required');
  assert.equal(tag(user({ a: { type: 'string' } }), user({ a: { type: 'integer' } }), 'type'), 'type');
  assert.equal(tag(s2doc({ a: rid }), s2doc({ a: { $ref: '#/definitions/Id' } }, { Id: rid }), 'extracted'), 'refactor');
  assert.equal(tag(user({ a: { pattern: 'x' } }), user({ a: { pattern: 'y' } }), 'pattern'), 'pattern');
  assert.equal(tag(user({ a: { enum: ['a', 'b'] } }), user({ a: { enum: ['a', 'b', 'c'] } }), 'added'), 'enum');
  assert.equal(tag({ info: { version: '1' } }, { info: { version: '2' } }, 'version'), 'version');
  for (const c of [...s2.changes, ...o3.changes]) assert.ok(typeof c.tag === 'string' && c.tag !== '');
});

// allOf / oneOf / anyOf refactors
const str = { type: 'string' };
const orderFlat = { type: 'object', required: ['id', 'total'], properties: { id: str, createdAt: { type: 'string', format: 'date-time' }, total: { type: 'number' } } };
const entity = { type: 'object', required: ['id'], properties: { id: str, createdAt: { type: 'string', format: 'date-time' } } };
const orderAll = { allOf: [{ $ref: '#/definitions/Entity' }, { type: 'object', required: ['total'], properties: { total: { type: 'number' }, currency: str } }] };
const sdefs = (definitions) => ({ swagger: '2.0', definitions });

test('schema becomes allOf of a new schema + inline', () => {
  const { res, rt } = run(sdefs({ Order: orderFlat }), sdefs({ Order: orderAll, Entity: entity }));
  assert.deepEqual(texts(res), ['Order | Order: now allOf [schema Entity + inline]']);
  const c = only(res);
  assert.deepEqual([c.tag, c.side, c.line, c.details], ['refactor', 'right', ln(rt, /"allOf"/), ['Added property currency (string)']]);
});

test('allOf flattened back', () => {
  const { res, lt } = run(sdefs({ Order: orderAll, Entity: entity }), sdefs({ Order: orderFlat }));
  assert.deepEqual(texts(res), ['Order | Order: allOf flattened']);
  const c = only(res);
  assert.deepEqual([c.side, c.line, c.details], ['left', ln(lt, /"allOf"/), ['Removed property currency (string)']]);
});

test('single-member oneOf is the member itself', () => {
  const { res } = run(sdefs({ Order: orderFlat }), sdefs({ Order: { oneOf: [{ $ref: '#/definitions/O' }] }, O: orderFlat }));
  assert.deepEqual(texts(res), ['Order | Order: now oneOf [schema O]']);
  assert.deepEqual(only(res).details, ['definition unchanged']);
});

test('inline schema becomes a 2-member oneOf', () => {
  const dc = (n) => ({ $ref: `#/definitions/${n}` });
  const { res } = run(sdefs({ Pet: entity }), sdefs({ Pet: { oneOf: [dc('Dog'), dc('Cat')] }, Dog: entity, Cat: entity }));
  // a union's raw details don't show the members, so the new schemas keep their own entries
  assert.deepEqual(texts(res), ['Pet | Pet: now oneOf [schema Dog, schema Cat]', 'schemas | Added schema Cat', 'schemas | Added schema Dog']);
  assert.ok(only(res).details.length > 0);
});

test('allOf → oneOf and anyOf switches are one refactor entry', () => {
  for (const kw of ['oneOf', 'anyOf']) {
    const { res } = run(sdefs({ Order: orderAll, Entity: entity }), sdefs({ Order: { [kw]: orderAll.allOf }, Entity: entity }));
    assert.deepEqual(texts(res), [`Order | Order: now ${kw} [schema Entity, inline]`]);
    assert.equal(only(res).tag, 'refactor');
  }
});

test('narrowing inline allOf member keeps its change when the refs change', () => {
  const status = (e) => ({ properties: { status: { type: 'string', ...(e && { enum: e }) } } });
  const base = { A: status(), B: status() };
  const ord = (ref, e) => ({ allOf: [{ $ref: `#/definitions/${ref}` }, status(e)] });
  const { res } = run(sdefs({ Order: ord('A', ['a', 'b']), ...base }), sdefs({ Order: ord('B', ['a', 'b', 'c']), ...base }));
  assert.deepEqual(texts(res), ['Order | Order: allOf members changed: + schema B, − schema A']);
  assert.deepEqual(only(res).details, ['status.enum.2 added']);
});

test('deep allOf chain flattens fully', () => {
  const chain = { L0: { properties: { root: str } } };
  for (let i = 1; i <= 6; i++) chain[`L${i}`] = { allOf: [{ $ref: `#/definitions/L${i - 1}` }, { properties: { [`p${i}`]: str } }] };
  const props = Object.fromEntries(['root', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((n) => [n, str]));
  const { res } = run(sdefs({ Order: { properties: props }, ...chain }), sdefs({ Order: { allOf: [{ $ref: '#/definitions/L6' }] }, ...chain }));
  assert.deepEqual(texts(res), ['Order | Order: now allOf [schema L6]']);
  assert.deepEqual(only(res).details, ['definition unchanged']);
});

test('a member schema present on both sides keeps its own changes', () => {
  const { res } = run(sdefs({ Order: orderFlat, Entity: entity }), sdefs({ Order: orderAll, Entity: { ...entity, description: 'base' } }));
  assert.deepEqual(texts(res), ['Entity | description added', 'Order | Order: now allOf [schema Entity + inline]']);
});

test('property schema becomes allOf', () => {
  const { res } = run(s2doc({ a: rid }), s2doc({ a: { allOf: [{ $ref: '#/definitions/Id' }] } }, { Id: rid }));
  assert.deepEqual(texts(res), ['User | a: now allOf [schema Id]']);
  assert.deepEqual(only(res).details, ['definition unchanged']);
});

test('parameter schema becomes allOf', () => {
  const op = (schema, schemas) => ({ openapi: '3.0.3', paths: { '/x': { get: { parameters: [{ in: 'query', name: 'id', schema }] } } }, components: { schemas } });
  const { res } = run(op(rid, {}), op({ allOf: [{ $ref: '#/components/schemas/Id' }] }, { Id: rid }));
  assert.deepEqual(texts(res), ['GET /x | id: now allOf [schema Id]']);
});

test('allOf members changed', () => {
  const all = (n) => ({ allOf: [{ $ref: `#/definitions/${n}` }, { properties: { x: str } }] });
  const { res } = run(sdefs({ Order: all('A'), A: entity, B: entity }), sdefs({ Order: all('B'), A: entity, B: entity }));
  assert.deepEqual(texts(res), ['Order | Order: allOf members changed: + schema B, − schema A']);
  assert.deepEqual(only(res).details, ['definition unchanged']);
});

test('allOf with the same refs walks members as before', () => {
  const all = (p) => ({ allOf: [{ $ref: '#/definitions/A' }, { properties: p }] });
  const { res } = run(sdefs({ Order: all({ x: str }), A: entity }), sdefs({ Order: all({ x: str, y: str }), A: entity }));
  assert.deepEqual(texts(res), ['Order.allOf.1 | Added property y (string)']);
  assert.ok(res.changes.every((c) => c.tag !== 'refactor'));
});

test('$ref cycle in allOf terminates', () => {
  const cyc = { allOf: [{ $ref: '#/definitions/Order' }, { properties: { x: str } }] };
  const { res } = run(sdefs({ Order: orderFlat }), sdefs({ Order: cyc }));
  assert.equal(only(res).text, 'Order: now allOf [schema Order + inline]');
});
