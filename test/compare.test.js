import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compare, usage } from '../src/compare.js';

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

// highlight ranges: left/right = {start, end, exact} lines of the affected fragment
const pick = (l, r, text) => compare(l, r).changes.find((c) => c.text.includes(text));

test('ranges cover the whole fragment', () => {
  const user = (t, more = '') => `definitions:\n  User:\n    properties:\n      a:\n        type: ${t}\n        format: x\n${more}`;
  // a is last in the file (trailing newline) and followed by another key
  for (const more of ['', '      b:\n        type: string\n']) {
    const c = pick(user('string', more), user('integer', more), 'type string');
    assert.deepEqual(c.left, { start: 4, end: 6, exact: true });
    assert.deepEqual(c.right, { start: 4, end: 6, exact: true });
  }
  const v = pick('info:\n  version: "1"\n  title: X\n', 'info:\n  version: "2"\n  title: X\n', 'version');
  assert.deepEqual([v.left, v.right], [{ start: 2, end: 2, exact: true }, { start: 2, end: 2, exact: true }]);
  const d = pick('info:\n  description: |\n    a\n    b\n\n  title: X\n', 'info:\n  description: |\n    a\n    c\n\n  title: X\n', 'description');
  assert.deepEqual(d.right, { start: 2, end: 4, exact: true });
});

test('ranges of an added endpoint', () => {
  const l = 'paths:\n  /x:\n    get:\n      summary: s\n';
  const r = 'paths:\n  /x:\n    get:\n      summary: s\n    post:\n      responses:\n        200:\n          description: ok\n';
  const c = pick(l, r, 'Added endpoint');
  assert.deepEqual(c.right, { start: 5, end: 8, exact: true });
  assert.deepEqual(c.left, { start: 2, end: 2, exact: false });
});

test('ranges of refactors and required', () => {
  const props = (a) => `definitions:\n  User:\n    properties:\n      a:\n${a}`;
  const ext = pick(props('        type: string\n        format: uuid\n'), props("        $ref: '#/definitions/Id'\n  Id:\n    type: string\n    format: uuid\n"), 'extracted');
  assert.deepEqual(ext.right, { start: 5, end: 5, exact: true });
  assert.deepEqual(ext.left, { start: 4, end: 6, exact: true });

  const flatL = "definitions:\n  E:\n    properties: {id: {type: string}}\n  O:\n    allOf:\n      - $ref: '#/definitions/E'\n";
  const fl = pick(flatL, 'definitions:\n  O:\n    properties: {id: {type: string}}\n', 'flattened');
  assert.equal(fl.left.start, 5);

  const req = (r) => `definitions:\n  User:\n    required:\n${r}    properties:\n      a: {}\n      b: {}\n`;
  const nr = pick(req('      - a\n      - b\n'), req('      - a\n'), 'no longer required');
  assert.deepEqual(nr.left, { start: 5, end: 5, exact: true });
});

test('ranges in JSON, CRLF, parameters and a missing required', () => {
  const { res, lt } = run(s2doc({ a: { type: 'string', format: 'x' } }), s2doc({ a: { type: 'integer', format: 'x' } }));
  const a = res.changes.find((c) => c.text.includes('type string'));
  const start = ln(lt, /"a": \{/);
  assert.deepEqual(a.left, { start, end: start + 3, exact: true }); // through the closing }

  const user = (t) => `definitions:\n  User:\n    properties:\n      a:\n        type: ${t}\n        format: x\n      b:\n        type: string\n`;
  const crlf = (s) => s.replace(/\n/g, '\r\n');
  const lf = pick(user('string'), user('integer'), 'type string');
  const cr = pick(crlf(user('string')), crlf(user('integer')), 'type string');
  assert.deepEqual([cr.left, cr.right], [lf.left, lf.right]);

  const op = (ps) => `paths:\n  /x:\n    get:\n      parameters:\n${ps.map((p) => `        - {${p}}\n`).join('')}`;
  const b = pick(op(['in: query, name: a', 'in: query, name: b, description: x']), op(['in: query, name: b, description: y']), 'description');
  assert.deepEqual([b.left.start, b.right.start], [6, 5]);

  const req = (r) => `definitions:\n  User:\n${r}    properties:\n      a: {}\n`;
  const now = pick(req(''), req('    required: [a]\n'), 'now required');
  assert.equal(now.left.exact, false);
  assert.equal(now.right.exact, true);
});

// meta, usage, affects, breaking, name flash
test('meta from info and the spec version, also on errors', () => {
  assert.deepEqual(s2.meta, { left: { title: 'Shop', version: '1.0', spec: '2.0' }, right: { title: 'Shop', version: '1.1', spec: '2.0' } });
  const bad = compare('a:\n\tb: 1', 'openapi: 3.1.0\ninfo: {title: X, version: 2}\n');
  assert.equal(bad.error.side, 'left');
  assert.deepEqual(bad.meta.right, { title: 'X', version: '2', spec: '3.1.0' });
  assert.equal(bad.meta.left, null);
  assert.deepEqual(compare('a: 1', 'a: 1').meta.left, { title: undefined, version: undefined, spec: undefined });
});

const ref = (n) => ({ $ref: `#/components/schemas/${n}` });
const body = (n) => ({ content: { 'application/json': { schema: ref(n) } } });
// POST /o with an optional request body / 200 response schema, plus extra components
const api = (schemas, { req, res, parameters, components = {} } = {}) => ({
  openapi: '3.0.3',
  info: { title: 'T', version: '1' },
  paths: { '/o': { post: { ...(parameters && { parameters }), ...(req && { requestBody: body(req) }), responses: { 200: { description: 'ok', ...(res && body(res)) } } } } },
  components: { schemas, ...components },
});
const key = (n) => JSON.stringify(['components', 'schemas', n]);

test('usage follows refs transitively, through cycles and response refs', () => {
  const schemas = { A: { properties: { b: ref('B') } }, B: { items: ref('C') }, C: { properties: { a: ref('A') } }, S: {} };
  const use = usage(api(schemas, { res: 'A', components: { responses: { R: body('S') } } }));
  for (const n of ['A', 'B', 'C']) assert.deepEqual(use.get(key(n)), [{ endpoint: 'POST /o', via: 'response 200', dir: 'response' }]);
  assert.equal(use.get(key('S')), undefined);
  const withRef = api(schemas, { components: { responses: { R: body('S') } } });
  withRef.paths['/o'].post.responses[404] = { $ref: '#/components/responses/R' };
  const u2 = usage(withRef);
  assert.deepEqual(u2.get(key('S')), [{ endpoint: 'POST /o', via: 'response 404', dir: 'response' }]);
  assert.deepEqual(u2.get(JSON.stringify(['components', 'responses', 'R'])), u2.get(key('S')));
  const p = usage(api({ Id: {} }, { req: 'Id', parameters: [{ $ref: '#/components/parameters/P' }], components: { parameters: { P: { in: 'query', name: 'p', schema: ref('Id') } } } }));
  assert.deepEqual(p.get(key('Id')), [
    { endpoint: 'POST /o', via: 'parameter p', dir: 'request' },
    { endpoint: 'POST /o', via: 'request body', dir: 'request' },
  ]);
});

const pickJ = (l, r, text) => compare(json(l), json(r)).changes.find((c) => c.text.includes(text));

test('affects: endpoint, path-level, component and other', () => {
  const op = (q) => ({ paths: { '/x': { get: { parameters: [{ in: 'query', name: 'q', required: q }] }, post: {} } } });
  assert.deepEqual(pickJ(op(false), op(true), 'q:').affects, [{ endpoint: 'GET /x', dir: 'request' }]);
  const pl = (q) => ({ paths: { '/x': { parameters: [{ in: 'query', name: 'q', required: q }], get: {}, post: {} } } });
  assert.deepEqual(pickJ(pl(false), pl(true), 'q:').affects.map((a) => a.endpoint), ['GET /x', 'POST /x']);
  const s = (t) => api({ S: { properties: { a: { type: t } } } }, { res: 'S' });
  assert.deepEqual(pickJ(s('string'), s('integer'), 'type').affects, [{ endpoint: 'POST /o', via: 'response 200', dir: 'response' }]);
  assert.deepEqual(pickJ({ info: { version: '1' } }, { info: { version: '2' } }, 'version').affects, []);
});

// schema S with property a (string), used where `use` says
const brk = (a, b, text, use) => {
  const doc = (p) => api({ S: { ...(p.required && { required: p.required }), properties: { a: { type: 'string', ...p.a }, ...p.more } } }, use);
  const c = compare(json(doc(a)), json(doc(b))).changes.find((x) => x.text.includes(text));
  assert.ok(c, text);
  return c.breaking;
};
const REQ = { req: 'S' };
const RES = { res: 'S' };

test('breaking: endpoint removed, response code removed, type change', () => {
  const ops = (m) => ({ paths: { '/x': Object.fromEntries(m.map((k) => [k, { responses: { 200: {}, 404: {} } }])) } });
  assert.equal(pickJ(ops(['get', 'post']), ops(['get']), 'Removed endpoint').breaking, true);
  assert.equal(pickJ(ops(['get']), ops(['get', 'post']), 'Added endpoint').breaking, false);
  const resp = (codes) => ({ paths: { '/x': { get: { responses: Object.fromEntries(codes.map((c) => [c, {}])) } } } });
  assert.equal(pickJ(resp([200, 404]), resp([200]), 'Removed response').breaking, true);
  assert.equal(pickJ(resp([200]), resp([200, 404]), 'Added response').breaking, false);
  assert.equal(brk({}, { a: { type: 'integer' } }, 'type', RES), true);
  // an unused schema breaks nothing
  assert.equal(brk({}, { a: { type: 'integer' } }, 'type', {}), false);
});

test('breaking: new required parameter', () => {
  const op = (parameters) => ({ paths: { '/x/{id}': { get: { parameters } } } });
  assert.equal(pickJ(op([]), op([{ in: 'query', name: 'q', required: true }]), 'Added parameter').breaking, true);
  assert.equal(pickJ(op([]), op([{ in: 'path', name: 'id' }]), 'Added parameter').breaking, true);
  assert.equal(pickJ(op([]), op([{ in: 'query', name: 'q' }]), 'Added parameter').breaking, false);
});

test('breaking: now required in a request, no longer required in a response', () => {
  assert.equal(brk({}, { required: ['a'] }, 'now required', REQ), true);
  assert.equal(brk({}, { required: ['a'] }, 'now required', RES), false);
  assert.equal(brk({ required: ['a'] }, {}, 'no longer required', RES), true);
  assert.equal(brk({ required: ['a'] }, {}, 'no longer required', REQ), false);
});

test('breaking: property removed in a response', () => {
  const b = { type: 'string' };
  assert.equal(brk({ more: { b } }, {}, 'Removed property', RES), true);
  assert.equal(brk({ more: { b } }, {}, 'Removed property', REQ), false);
  assert.equal(brk({}, { more: { b } }, 'Added property', RES), false);
});

test('breaking: enum narrowed in a request, widened in a response', () => {
  const e = (...v) => ({ a: { enum: v } });
  assert.equal(brk(e('x', 'y'), e('x'), 'enum', REQ), true);
  assert.equal(brk(e('x', 'y'), e('x'), 'enum', RES), false);
  assert.equal(brk(e('x'), e('x', 'y'), 'enum', RES), true);
  assert.equal(brk(e('x'), e('x', 'y'), 'enum', REQ), false);
  assert.equal(brk({}, e('x'), 'enum', REQ), true);
});

test('breaking: tighter min/max/pattern in a request', () => {
  assert.equal(brk({ a: { maxLength: 10 } }, { a: { maxLength: 5 } }, 'maxLength', REQ), true);
  assert.equal(brk({ a: { maxLength: 5 } }, { a: { maxLength: 10 } }, 'maxLength', REQ), false);
  assert.equal(brk({}, { a: { minimum: 1 } }, 'minimum', REQ), true);
  assert.equal(brk({ a: { pattern: 'a' } }, { a: { pattern: 'b' } }, 'pattern', REQ), true);
  assert.equal(brk({ a: { maxLength: 10 } }, { a: { maxLength: 5 } }, 'maxLength', RES), false);
});

test('breaking: refactor when any detail breaks', () => {
  const doc = (a, Id) => api({ S: { properties: { a } }, ...(Id && { Id }) }, REQ);
  const ext = (Id) => compare(json(doc({ type: 'string' })), json(doc(ref('Id'), Id))).changes.find((c) => c.tag === 'refactor');
  assert.equal(ext({ type: 'string' }).breaking, false);
  assert.equal(ext({ type: 'integer' }).breaking, true);
});

test('breaking: a schema in request and response breaks by either rule; additions and info never', () => {
  const both = { req: 'S', res: 'S' };
  assert.equal(brk({ more: { b: {} } }, {}, 'Removed property', both), true);
  assert.equal(brk({}, { required: ['a'] }, 'now required', both), true);
  assert.equal(brk({}, { a: { description: 'd' } }, 'description', both), false);
  assert.equal(pickJ({ info: { version: '1' } }, { info: { version: '2' } }, 'version').breaking, false);
  for (const c of [...s2.changes, ...o3.changes]) assert.equal(typeof c.breaking, 'boolean');
});

test('flash: key columns in YAML, JSON and a flow-style parameter', () => {
  const y = pick('info:\n  version: "1"\n', 'info:\n  version: "2"\n', 'version');
  assert.deepEqual(y.flash, { left: { line: 2, from: 3, to: 10 }, right: { line: 2, from: 3, to: 10 } });
  const j = pick('{\n  "info": {\n    "version": "1"\n  }\n}', '{\n  "info": {\n    "version": "2"\n  }\n}', 'version');
  assert.deepEqual(j.flash.left, { line: 3, from: 5, to: 14 });
  const line = '        - {in: query, name: limit}';
  const op = (ps) => `paths:\n  /x:\n    get:\n      parameters:\n${ps}`;
  const a = pick(op('        - {in: query, name: other}\n'), op(`${line}\n`), 'Added parameter');
  const from = line.indexOf('limit') + 1;
  assert.deepEqual(a.flash, { right: { line: 5, from, to: from + 5 } });
});

test('flash: a trailing $ref is stripped so the property name flashes', () => {
  const props = (a) => `definitions:\n  User:\n    properties:\n      a:\n${a}`;
  const ext = pick(props('        type: string\n'), props("        $ref: '#/definitions/Id'\n  Id:\n    type: string\n"), 'extracted');
  assert.deepEqual(ext.flash, { left: { line: 4, from: 7, to: 8 }, right: { line: 4, from: 7, to: 8 } });
});

test('breaking: keys inside examples, defaults and x-* are data, not keywords', () => {
  const op = (v) => ({ paths: { '/x': { get: { responses: { 200: { content: { 'application/json': { example: v, examples: { a: { value: v } } } } } } } } } });
  const res = compare(json(op({ type: 'card', required: true })), json(op({ type: 'bank', required: false })));
  assert.ok(res.changes.length >= 4);
  assert.ok(res.changes.every((c) => !c.breaking));
  assert.equal(brk({ a: { default: { type: 'x' } } }, { a: { default: { type: 'y' } } }, 'type', RES), false);
  assert.equal(brk({ a: { 'x-meta': { minimum: 1 } } }, { a: { 'x-meta': { minimum: 2 } } }, 'minimum', REQ), false);
  // a property that happens to be called "example" is still judged
  assert.equal(brk({ more: { example: { type: 'string' } } }, {}, 'Removed property', RES), true);
  for (const n of ['example', 'default', 'x-id']) {
    assert.equal(brk({ more: { [n]: {} } }, { more: { [n]: {} }, required: [n] }, `${n}: now required`, REQ), true, n);
  }
});

test('breaking: a retargeted $ref, a required request body, a removed content type', () => {
  const retarget = pickJ(api({ S: {}, T: {} }, REQ), api({ S: {}, T: {} }, { req: 'T' }), '$ref');
  assert.deepEqual([retarget.tag, retarget.breaking], ['$ref', true]);
  const body = (requestBody) => ({ paths: { '/x': { post: { ...(requestBody && { requestBody }), responses: { 200: {} } } } } });
  const content = { 'application/json': {} };
  assert.equal(pickJ(body(), body({ required: true, content }), 'request body').breaking, true);
  assert.equal(pickJ(body(), body({ content }), 'request body').breaking, false);
  const two = { ...content, 'application/xml': {} };
  assert.equal(pickJ(body({ content: two }), body({ content }), 'removed').breaking, true);
  assert.equal(pickJ(body({ content }), body({ content: two }), 'added').breaking, false);
  const resp = (c) => ({ paths: { '/x': { get: { responses: { 200: { content: c } } } } } });
  assert.equal(pickJ(resp(two), resp(content), 'removed').breaking, true);
});

test('breaking: enum judged as sets, not by position', () => {
  const enumBreaks = (l, r, use) => {
    const doc = (v) => api({ S: { properties: { a: { type: 'string', enum: v } } } }, use);
    const cs = compare(json(doc(l)), json(doc(r))).changes.filter((c) => c.tag === 'enum');
    assert.ok(cs.length);
    return cs.map((c) => c.breaking);
  };
  // inserted in the middle: widened only
  assert.deepEqual(enumBreaks(['a', 'c'], ['a', 'b', 'c'], REQ), [false, false]);
  assert.deepEqual(enumBreaks(['a', 'c'], ['a', 'b', 'c'], RES), [true, true]);
  // removed from the middle: narrowed only
  assert.deepEqual(enumBreaks(['a', 'b', 'c'], ['a', 'c'], REQ), [true, true]);
  assert.deepEqual(enumBreaks(['a', 'b', 'c'], ['a', 'c'], RES), [false, false]);
});

test('affects: one entry per endpoint and direction, vias joined', () => {
  const doc = (t) => {
    const d = api({ S: { properties: { a: { type: t } } } }, { req: 'S', res: 'S' });
    d.paths['/o'].post.responses[404] = { description: 'x', ...body('S') };
    return d;
  };
  assert.deepEqual(pickJ(doc('string'), doc('integer'), 'type').affects, [
    { endpoint: 'POST /o', via: 'request body', dir: 'request' },
    { endpoint: 'POST /o', via: 'response 200, 404', dir: 'response' },
  ]);
});

test('usage and affects stay fast on a large spec (500 paths sharing a schema chain)', () => {
  const doc = (t) => {
    const paths = {};
    for (let i = 0; i < 500; i++) paths[`/r${i}`] = { get: { responses: { 200: body('A'), 404: body('A') } }, post: { requestBody: body('A'), responses: { 200: {} } } };
    const schemas = { A: { properties: { b: ref('B') } }, B: { properties: { c: ref('C') } }, C: { properties: { x: { type: t }, y: { type: t } } } };
    return json({ openapi: '3.0.3', paths, components: { schemas } });
  };
  const [l, r] = [doc('string'), doc('integer')];
  const t0 = performance.now();
  const res = compare(l, r);
  const ms = performance.now() - t0;
  assert.equal(res.changes.length, 2);
  assert.equal(res.changes[0].affects.length, 1000);
  assert.ok(ms < 3000, `${ms} ms`); // ~0.5 s today; catches a superlinear regression, not machine noise
});
