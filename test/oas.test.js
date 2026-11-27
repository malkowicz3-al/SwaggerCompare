import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { OBJECTS, TEMPLATES, verOf } from '../src/oas/model.js';
import { contextAt } from '../src/oas/context.js';
import { complete, fieldDoc, render } from '../src/oas/complete.js';
import { validate } from '../src/oas/validate.js';
import { outline } from '../src/oas/outline.js';
import { starter, SNIPPETS } from '../src/oas/templates.js';
import { formatJson } from '../src/oas/ast.js';
import { definitionAt, refHover } from '../src/oas/refs.js';
import { parseDocument } from 'yaml';

// `mark` (default '|') is the cursor -> {text, line, col}
function at(src, mark = '|') {
  const i = src.indexOf(mark);
  const before = src.slice(0, i).split('\n');
  return { text: src.slice(0, i) + src.slice(i + mark.length), line: before.length, col: before.at(-1).length + 1 };
}
const ctx = (src, mark) => {
  const { text, line, col } = at(src, mark);
  return contextAt(text, line, col);
};
const comp = (src) => {
  const { text, line, col } = at(src);
  return complete(text, line, col);
};
const labels = (src) => comp(src).map((c) => c.label);
const pick = (c) => c && { path: c.path, objectType: c.objectType, position: c.position, key: c.key, prefix: c.prefix };

const OP = `openapi: 3.0.3
paths:
  /a:
    get:
`;

test('contextAt: valid YAML', () => {
  const rows = [
    [OP + '      summary: x\n      |\n      parameters: []\n', { path: ['paths', '/a', 'get'], objectType: 'Operation', position: 'key', key: null, prefix: '' }],
    [OP + '      parameters:\n        - name: a\n          in: |query\n', { path: ['paths', '/a', 'get', 'parameters', 0], objectType: 'Parameter', position: 'value', key: 'in', prefix: '' }],
    [OP + '      parameters:\n        - na|me: a\n', { path: ['paths', '/a', 'get', 'parameters', 0], objectType: 'Parameter', position: 'key', key: 'name', prefix: 'na' }],
    [OP + '      parameters:\n        - name: a\n          in: query\n        - name: b\n          |\n', { path: ['paths', '/a', 'get', 'parameters', 1], objectType: 'Parameter', position: 'key', key: null, prefix: '' }],
    [OP + "      responses:\n        '200':\n          content:\n            |\n", { path: ['paths', '/a', 'get', 'responses', '200', 'content'], objectType: null, position: 'key', key: null, prefix: '' }],
  ];
  for (const [src, want] of rows) assert.deepEqual(pick(ctx(src)), want, src);
  const c = ctx(OP + '      summary: x\n      |\n      parameters: []\n');
  assert.deepEqual([...c.keysPresent].sort(), ['parameters', 'summary']);
  assert.equal(c.version, 30);
  assert.equal(ctx(OP + "      responses:\n        '200':\n          content:\n            |\n").container.kind, 'map');
});

test('contextAt: broken YAML', () => {
  const rows = [
    [OP + '      res|', { path: ['paths', '/a', 'get'], objectType: 'Operation', position: 'key', key: null, prefix: 'res' }],
    [OP + '      parameters:\n        - name: a\n          in: |', { path: ['paths', '/a', 'get', 'parameters', 0], objectType: 'Parameter', position: 'value', key: 'in', prefix: '' }],
    [OP + '      parameters:\n        - name: a\n        - |', { path: ['paths', '/a', 'get', 'parameters', 1], objectType: 'Parameter', position: 'key', key: null, prefix: '' }],
    [OP + '      summary\n      |', { path: ['paths', '/a', 'get'], objectType: 'Operation', position: 'key', key: null, prefix: '' }],
    [OP + '          |', { path: ['paths', '/a', 'get'], objectType: 'Operation', position: 'key', key: null, prefix: '' }],
    // same-column list form
    [OP + '      parameters:\n      - name: a\n      - name: b\n        |', { path: ['paths', '/a', 'get', 'parameters', 1], objectType: 'Parameter', position: 'key', key: null, prefix: '' }],
  ];
  for (const [src, want] of rows) assert.deepEqual(pick(ctx(src)), want, src);
});

test('contextAt: block scalar bodies are skipped', () => {
  const src = OP + '      description: |\n        get:\n          x\n      ^\n';
  assert.deepEqual(pick(ctx(src, '^')), { path: ['paths', '/a', 'get'], objectType: 'Operation', position: 'key', key: null, prefix: '' });
  assert.equal(ctx(OP + '      description: |\n        ge^t:\n', '^'), null);
});

test('contextAt: JSON', () => {
  const inKey = ctx('{"openapi": "3.1.0", "paths": {"/a": {"get": {"summary": "x", "par|": 1, "responses": {}}}}}');
  assert.deepEqual(pick(inKey), { path: ['paths', '/a', 'get'], objectType: 'Operation', position: 'key', key: 'par', prefix: '"par' });
  assert.deepEqual([...inKey.keysPresent].sort(), ['responses', 'summary']);
  const after = ctx('{"openapi": "3.1.0", "paths": {"/a": {"get": {"parameters": [{"name": "a"}, {"name": "b"}], |}}}}');
  assert.deepEqual(pick(after), { path: ['paths', '/a', 'get'], objectType: 'Operation', position: 'key', key: null, prefix: '' });
  assert.deepEqual([...after.keysPresent], ['parameters']);
  const val = ctx('{"openapi": "3.1.0", "paths": {"/a": {"get": {"parameters": [{"name": "a", "in": "|"}]}}}}');
  assert.deepEqual(pick(val), { path: ['paths', '/a', 'get', 'parameters', 0], objectType: 'Parameter', position: 'value', key: 'in', prefix: '"' });
});

test('complete: keys', () => {
  const ks = labels(OP + '      summary: x\n      |\n');
  assert.ok(ks.includes('responses'));
  assert.ok(!ks.includes('summary'));
  assert.equal(new Set(ks).size, ks.length);
  const items = comp(OP + '      parameters:\n        - |\n');
  assert.deepEqual(items.filter((c) => c.required).map((c) => c.label), ['name', 'in']);
  assert.deepEqual(items.sort((a, b) => a.sortText.localeCompare(b.sortText)).slice(0, 2).map((c) => c.label), ['in', 'name']);
  assert.deepEqual(labels(OP + '      re|'), ['requestBody', 'responses']);
});

test('complete: values and version gates', () => {
  const v = (ver, rest) => `openapi: ${ver}\n${rest}`;
  const param = 'paths:\n  /a:\n    get:\n      parameters:\n        - in: |\n';
  assert.deepEqual(labels(v('3.1.0', param)), ['query', 'header', 'path', 'cookie']);
  assert.deepEqual(labels(v('3.2.0', param)), ['query', 'header', 'path', 'cookie', 'querystring']);
  const type = 'components:\n  schemas:\n    A:\n      type: |\n';
  assert.ok(!labels(v('3.0.3', type)).includes('null'));
  assert.equal(comp(v('3.1.0', type)).find((c) => c.label === 'null').insertText, "'null'");
  const path = 'paths:\n  /a:\n    |\n';
  assert.ok(!labels(v('3.1.0', path)).includes('query'));
  assert.ok(labels(v('3.2.0', path)).includes('query') && labels(v('3.2.0', path)).includes('get'));
  assert.ok(labels(v('3.0.3', 'paths:\n  /a:\n    get:\n      responses:\n        |\n')).includes('404'));
  assert.ok(labels(v('3.0.3', 'paths:\n  /a:\n    get:\n      requestBody:\n        content:\n          |\n')).includes('application/json'));
  assert.deepEqual(labels('openapi: |\n'), TEMPLATES);
  const schema = 'components:\n  schemas:\n    A:\n      |\n';
  assert.ok(labels(v('3.0.3', schema)).includes('nullable'));
  assert.ok(!labels(v('3.1.0', schema)).includes('nullable'));
  assert.ok(!labels(v('3.0.3', '|\n')).includes('webhooks'));
  assert.ok(labels(v('3.1.0', '|\n')).includes('webhooks'));
  assert.ok(!labels(v('3.1.0', '|\n')).includes('$self'));
  assert.ok(labels(v('3.2.0', '|\n')).includes('$self'));
  assert.deepEqual(labels(v('3.0.3', 'paths:\n  /a:\n    get:\n      deprecated: |\n')), ['true', 'false']);
});

test('complete: insert text', () => {
  const ins = (src, label) => comp(src).find((c) => c.label === label).insertText;
  assert.equal(ins(OP + '      |\n', 'summary'), 'summary: ');
  assert.equal(ins(OP + '      |\n', 'requestBody'), 'requestBody:\n  ');
  assert.equal(ins(OP + '      |\n', 'parameters'), 'parameters:\n  - ');
  assert.equal(ins(OP + '      sum|: x\n', 'summary'), 'summary');
  assert.equal(ins(OP + '      responses:\n        |\n', '200'), "'200':\n  ");
  assert.equal(ins('{"openapi": "3.0.3", "info": {"ti|"}}', 'title'), '"title": ');
});

test('fieldDoc', () => {
  const doc = (src) => {
    const { text, line, col } = at(src);
    return fieldDoc(text, line, col);
  };
  assert.deepEqual(doc('openapi: 3.1.0\ninfo:\n  ti|tle: x\n'), { title: 'title', doc: 'The name of the API.', type: 'string', required: true });
  assert.equal(doc('openapi: 3.1.0\ninfo:\n  x-l|ogo: x\n').title, 'x-logo');
  assert.match(doc('openapi: 3.1.0\ninfo:\n  x-l|ogo: x\n').doc, /^Specification extension/);
  assert.equal(doc('openapi: 3.1.0\ninfo:\n  fo|o: x\n'), null);
  assert.match(doc('openapi: 3.2.0\npaths:\n  /a:\n    qu|ery:\n').doc, /Since OpenAPI 3\.2\.$/);
  assert.equal(doc('openapi: 3.0.3\npaths:\n  /a:\n    get:\n      param|eters: []\n').type, 'list of Parameter');
  assert.equal(doc('openapi: 3.0.3\ncomponents:\n  schemas:\n    Pe|t: {}\n').type, 'Schema');
});

const pos = (m) => [m.severity, m.message, m.startLine, m.startCol, m.endLine, m.endCol];
const marks = (text) => validate(text).map(pos);
const INFO = 'info: {title: a, version: "1"}\n';

test('validate: one row per rule', () => {
  const rows = [
    ['openapi: 3.0.3\ninfo: [\n', [['error', 'Flow sequence in block collection must be sufficiently indented and end with a ] at line 3, column 1:', 3, 1, 3, 2]]],
    ["swagger: '2.0'\n", [['error', 'Swagger 2.0 is not supported by the editor (OpenAPI 3.x only)', 1, 1, 1, 8]]],
    ['info:\n  title: x\n', [['error', "Missing required 'openapi' field", 1, 1, 1, 2]]],
    ['openapi: 3.9.0\n' + INFO + 'paths: {}\n', [['error', 'OpenAPI 3.9.0 is newer than this editor supports (up to 3.2)', 1, 10, 1, 15]]],
    ['openapi: 3.0.3\ninfo:\n  title: a\n  version: "1"\n  foo: 1\n  x-logo: a\npaths: {}\n', [['warning', "Unknown key 'foo' in Info", 5, 3, 5, 6]]],
    ['openapi: 3.0.3\ninfo: hello\npaths: {}\n', [['error', 'Expected mapping (Info), found string', 2, 7, 2, 12]]],
    ['openapi: 3.0.3\ninfo:\n  title: a\n  version: 1.0\npaths: {}\n', [['warning', 'Expected string; quote the value', 4, 12, 4, 15]]],
    ['openapi: 3.0.3\ninfo:\n  version: "1"\npaths: {}\n', [['error', "Missing required 'title' in Info", 2, 1, 2, 5]]],
    [
      'openapi: 3.0.3\n' + INFO + 'paths:\n  /a:\n    get:\n      parameters:\n        - name: a\n        - name: b\n          in: body\n      responses: {}\n',
      [
        ['error', "Missing required 'in' in Parameter", 7, 11, 7, 18],
        ['error', "Invalid value 'body'. Allowed: query, header, path, cookie", 9, 15, 9, 19],
      ],
    ],
    ['openapi: 3.1.0\n' + INFO + 'components:\n  schemas:\n    A:\n      type: string\n      nullable: true\n', [['warning', "'nullable' was removed in OpenAPI 3.1", 7, 7, 7, 15]]],
    ['openapi: 3.0.3\n' + INFO + 'paths: {}\nwebhooks: {}\n', [['warning', "'webhooks' needs OpenAPI 3.1+", 4, 1, 4, 9]]],
    ['openapi: 3.1.0\n' + INFO + 'paths:\n  /a:\n    query:\n      responses: {}\n', [['warning', "'query' needs OpenAPI 3.2+", 5, 5, 5, 10]]],
  ];
  for (const [text, want] of rows) assert.deepEqual(marks(text).filter((m) => m[0] !== 'info'), want, text);
});

const read = (url) => readFileSync(url, 'utf8');
const errors = (text) => validate(text).filter((m) => m.severity === 'error');

test('validate: no false positives', () => {
  const ex = new URL('../examples/', import.meta.url);
  const fx = new URL('./fixtures/', import.meta.url);
  const files = [
    ...readdirSync(ex).filter((f) => f.endsWith('.yaml')).map((f) => new URL(f, ex)),
    ...readdirSync(fx).filter((f) => f.startsWith('openapi3-')).map((f) => new URL(f, fx)),
  ];
  assert.ok(files.length >= 4);
  // a real fault in a compare fixture, kept as is because the compare tests use it
  const known = {
    'openapi3-old.yaml': ["19:5 Path '{id}' has no 'in: path' parameter named 'id'"],
  };
  for (const f of files) {
    assert.deepEqual(errors(read(f)).map((m) => `${m.startLine}:${m.startCol} ${m.message}`), known[f.pathname.split('/').pop()] ?? [], f.pathname);
  }
  for (const v of TEMPLATES) assert.deepEqual(validate(starter(v)), [], v);
});

test('every version gate in the model has a template at or above it', () => {
  const top = Math.max(...TEMPLATES.map((v) => verOf(`openapi: ${v}`)));
  const gates = [];
  for (const o of Object.values(OBJECTS)) {
    for (const f of Object.values(o.fields)) {
      gates.push(f.since, f.until, f.reqUntil, f.tFrom?.[0]);
      for (const e of f.enum ?? []) if (Array.isArray(e)) gates.push(e[1], e[2]);
    }
  }
  for (const g of gates.filter(Boolean)) assert.ok(g <= top, `gate ${g}`);
});

test('outline', () => {
  const o = outline(read(new URL('../examples/orders-api-v1.yaml', import.meta.url)));
  assert.deepEqual(o.map((n) => [n.label, n.line]), [['Info', 2], ['Servers', 5], ['Paths', 7], ['Components', 68]]);
  assert.equal(o[0].detail, 'Orders API 1.4.0');
  assert.deepEqual(o[2].children.map((p) => [p.label, p.line, p.children.map((m) => `${m.method}@${m.line}:${m.detail}`)]), [
    ['/orders', 8, ['get@9:List orders', 'post@29:Create an order']],
    ['/orders/{id}', 39, ['get@40:Get one order', 'delete@51:Cancel an order']],
    ['/legacy/export', 62, ['get@63:CSV export']],
  ]);
  assert.deepEqual(o[3].children[0].children.map((c) => c.label), ['Order', 'NewOrder']);
  const o32 = outline('openapi: 3.2.0\npaths:\n  /a:\n    query:\n      summary: Q\n    additionalOperations:\n      COPY:\n        summary: C\n');
  assert.deepEqual(o32[0].children[0].children.map((m) => [m.label, m.method, m.line, m.detail]), [['QUERY', 'query', 4, 'Q'], ['COPY', 'copy', 7, 'C']]);
  assert.deepEqual(outline('openapi: 3.0.3\npaths:\n  /a:\n    get: [\n').map((n) => n.label), ['Paths']);
});

test('perf on a ~3000-line spec', () => {
  const parts = ['openapi: 3.1.0', 'info:', '  title: Big', '  version: 1.0.0', 'paths:'];
  for (let i = 0; i < 130; i++) {
    parts.push(`  /r${i}/{id}:`, '    get:', `      summary: Get ${i}`, '      parameters:', '        - name: id', '          in: path', '          required: true', '          schema:', '            type: string');
    parts.push('      responses:', "        '200':", '          description: ok', '          content:', '            application/json:', '              schema:', `                $ref: '#/components/schemas/S${i}'`);
  }
  parts.push('components:', '  schemas:');
  for (let i = 0; i < 130; i++) parts.push(`    S${i}:`, '      type: object', '      properties:', '        id:', '          type: string', '        n:', '          type: integer');
  const text = parts.join('\n') + '\n';
  const lines = parts.length;
  assert.ok(lines > 2800, String(lines));
  const time = (fn) => {
    const t = performance.now();
    fn();
    return performance.now() - t;
  };
  validate(text); // warm up
  const tv = time(() => assert.deepEqual(validate(text), []));
  const tc = time(() => contextAt(text, lines - 2, 11));
  const tk = time(() => complete(text, lines - 2, 11));
  const refLine = parts.findIndex((l) => l.includes('$ref'));
  let refs;
  const tr = time(() => (refs = complete(text, refLine + 1, parts[refLine].indexOf("'") + 1)));
  assert.equal(refs.length, 130);
  console.log(`perf: ${lines} lines, validate ${tv.toFixed(1)} ms, contextAt ${tc.toFixed(1)} ms, complete ${tk.toFixed(1)} ms, complete $ref ${tr.toFixed(1)} ms`);
  assert.ok(tv < 300, `validate ${tv}`);
  assert.ok(tc < 50, `contextAt ${tc}`);
  assert.ok(tk < 50, `complete ${tk}`);
  assert.ok(tr < 50, `complete $ref ${tr}`);
});

test('review fixes: no-space value, dash pad, bare JSON token, JSON format guard', () => {
  const ins = (src, label) => comp(src).find((c) => c.label === label).insertText;
  assert.equal(ins(OP + '      parameters:\n        - in:|\n', 'query'), ' query');
  assert.equal(ins(OP + '      parameters:\n        - in: |\n', 'query'), 'query');
  assert.equal(ins(OP + '      parameters:\n        - sch|\n', 'schema'), 'schema:\n    ');
  assert.equal(ins(OP + '      parameters:\n        - name: a\n          sch|\n', 'schema'), 'schema:\n  ');
  const bare = '{"openapi": "3.0.3", "paths": {"/a": {"get": {"deprecated": tr|}}}}';
  assert.deepEqual(pick(ctx(bare)), { path: ['paths', '/a', 'get'], objectType: 'Operation', position: 'value', key: 'deprecated', prefix: 'tr' });
  assert.deepEqual(labels(bare), ['true']);
  assert.equal(formatJson('{"a":[1,-2.5e3,"9007199254740993"]}'), '{\n  "a": [\n    1,\n    -2500,\n    "9007199254740993"\n  ]\n}\n');
  assert.throws(() => formatJson('{"max": 9223372036854775807}'), /9223372036854775807/);
  assert.throws(() => formatJson('{"a": }'), SyntaxError);
});

const COMPS = `components:
  schemas:
    Pet: {}
    a/b: {}
  parameters:
    Id: {name: id, in: query}
  responses:
    Ok: {description: ok}
  pathItems:
    PI: {}
  mediaTypes:
    MT: {}
`;

test('complete: $ref values', () => {
  const doc = (ver, body) => `openapi: ${ver}\npaths:\n${body}${COMPS}`;
  const get = '  /a:\n    get:\n';
  const schemaSlot = get + '      requestBody:\n        content:\n          application/json:\n            schema:\n              $ref: |\n';
  assert.deepEqual(labels(doc('3.0.3', schemaSlot)), ['#/components/schemas/Pet', '#/components/schemas/a~1b']);
  assert.deepEqual(labels(doc('3.0.3', get + '      parameters:\n        - $ref: |\n')), ['#/components/parameters/Id']);
  assert.deepEqual(labels(doc('3.0.3', get + "      responses:\n        '200':\n          $ref: |\n")), ['#/components/responses/Ok']);
  const pathSlot = '  /a:\n    $ref: |\n';
  assert.deepEqual(labels(doc('3.0.3', pathSlot)), []);
  assert.deepEqual(labels(doc('3.1.0', pathSlot)), ['#/components/pathItems/PI']);
  const mediaSlot = get + '      requestBody:\n        content:\n          application/json:\n            $ref: |\n';
  assert.deepEqual(labels(doc('3.1.0', mediaSlot)), []);
  assert.deepEqual(labels(doc('3.2.0', mediaSlot)), ['#/components/mediaTypes/MT']);
  // quoting, the space after a bare colon, prefixes
  const param = (rest) => comp(doc('3.0.3', get + `      parameters:\n        - ${rest}\n`));
  assert.deepEqual(param('$ref: |').map((c) => c.insertText), ["'#/components/parameters/Id'"]);
  assert.deepEqual(param('$ref:|').map((c) => c.insertText), [" '#/components/parameters/Id'"]);
  assert.deepEqual(labels(doc('3.0.3', schemaSlot.replace('$ref: |', "$ref: '#/components/schemas/P|"))), ['#/components/schemas/Pet']);
  assert.deepEqual(labels(doc('3.0.3', schemaSlot.replace('$ref: |', '$ref: Pe|'))), ['#/components/schemas/Pet']);
  assert.deepEqual(labels(doc('3.0.3', schemaSlot.replace('$ref: |', '$ref: a/|'))), []);
  assert.deepEqual(labels(doc('3.0.3', schemaSlot.replace('$ref: |', '$ref: a~1|'))), ['#/components/schemas/a~1b']);
  const json = '{"openapi": "3.0.3", "paths": {"/a": {"get": {"parameters": [{"$ref": "|"}]}}}, "components": {"parameters": {"Id": {}, "Id2": {}}}}';
  assert.deepEqual(comp(json).map((c) => c.insertText), ['"#/components/parameters/Id"', '"#/components/parameters/Id2"']);
});

test('complete: $ref key', () => {
  const schema = OP + '      requestBody:\n        content:\n          application/json:\n            schema:\n              |\n';
  const refs = comp(schema).filter((c) => c.label === '$ref');
  assert.deepEqual(refs.map((c) => [c.insertText, c.retrigger]), [['$ref: ', true]]);
  assert.ok(!labels(OP + '      |\n').includes('$ref'));
  assert.ok(!labels(schema.replace('|\n', "$ref: '#/x'\n              |\n")).includes('$ref'));
  assert.ok(labels(OP + '      parameters:\n        - |\n').includes('$ref'));
});

const DEF = `openapi: 3.1.0
paths:
  /a:
    get:
      tags: [x]
      parameters:
        - name: q
          in: query
components:
  schemas:
    Pet:
      type: object
      title: A pet
      description: ${'x'.repeat(200)}
      properties:
        id: {type: integer}
        tags: {type: array}
        owner: {$ref: '#/components/schemas/Owner'}
    Owner: {$ref: '#/components/schemas/Person'}
    Person:
      type: object
  parameters:
    Id: {name: id, in: path, required: true}
x-refs:
  - $ref: '#/components/schemas/Pet'
  - $ref: '#/paths/~1a/get'
  - $ref: '#/paths/~1a/get/parameters/0'
  - $ref: 'other.yaml#/Pet'
  - $ref: '#'
  - $ref: '#/components/schemas/Nope'
  - $ref: '#/components/parameters/Id'
  - $ref: '#/components/schemas/Owner'
`;

test('definitionAt', () => {
  const def = (line, col) => definitionAt(DEF, line, col);
  assert.deepEqual(def(25, 12), { line: 11, col: 5 });
  assert.deepEqual(def(25, 36), { line: 11, col: 5 });
  assert.equal(def(25, 11), null);
  assert.equal(def(25, 5), null);
  assert.deepEqual(def(26, 20), { line: 4, col: 5 });
  assert.deepEqual(def(27, 20), { line: 7, col: 11 });
  for (const line of [28, 29, 30]) assert.equal(def(line, 13), null, String(line));
  const json = '{"openapi": "3.1.0", "components": {"schemas": {"A": {"$ref": "#/components/schemas/B"}, "B": {}}}}';
  assert.deepEqual(definitionAt(json, 1, json.indexOf('#') + 2), { line: 1, col: json.indexOf('"B": {}') + 1 });
});

test('refHover', () => {
  const pet = refHover(DEF, 25, 20);
  assert.deepEqual(pet, { title: 'Pet', kind: 'schemas', rows: ['A pet', 'x'.repeat(119) + '…', 'type: object', 'id: integer', 'tags: array', 'owner: Owner'], from: 12, to: 36 });
  assert.deepEqual(refHover(DEF, 31, 20).rows, ['in: path', 'required: true']);
  assert.deepEqual(refHover(DEF, 32, 20), { title: 'Owner', kind: 'schemas', rows: ['type: object'], from: 12, to: 38 });
  assert.equal(refHover(DEF, 30, 20), null);
  assert.equal(refHover(DEF, 28, 20), null);
  const multi = "openapi: 3.1.0\nx: {$ref: '#/components/responses/R'}\ncomponents:\n  responses:\n    R:\n      description: |\n        one\n        two\n";
  assert.deepEqual(refHover(multi, 2, 15).rows, ['one two']);
});

test('validate: semantic rules', () => {
  const doc = (body) => 'openapi: 3.1.0\n' + INFO + body;
  const rows = [
    // ref: unresolved, wrong kind; external and data refs are ignored
    [
      "paths:\n  /a:\n    get:\n      parameters:\n        - $ref: '#/components/schemas/P'\n        - $ref: 'x.yaml#/P'\n      responses:\n        '200':\n          $ref: '#/components/responses/Nope'\ncomponents:\n  schemas:\n    P:\n      example: {$ref: '#/nowhere'}\n",
      [
        ['warning', 'Expected a reference to components/parameters, but this points to components/schemas', 7, 17, 7, 41],
        ['error', "Unresolved reference '#/components/responses/Nope'", 11, 17, 11, 46],
      ],
    ],
    // pathParam: via $ref, an operation list overriding the path list, per-list checks, a missing one
    [
      "paths:\n  /a/{id}:\n    parameters:\n      - $ref: '#/components/parameters/Id'\n    get:\n      parameters:\n        - {name: id, in: path, required: true}\n      responses: {}\n    put:\n      parameters:\n        - name: id\n          in: path\n        - name: q\n          in: query\n        - name: q\n          in: query\n        - name: x\n          in: path\n          required: true\n      responses: {}\n  /b/{n}:\n    post:\n      responses: {}\ncomponents:\n  parameters:\n    Id: {name: id, in: path, required: true}\n",
      [
        ['error', "Path parameter 'id' must have required: true", 13, 17, 13, 19],
        ['error', "Duplicate parameter 'q' (in query)", 15, 17, 15, 18],
        ['error', "Duplicate parameter 'q' (in query)", 17, 17, 17, 18],
        ['error', "Path parameter 'x' is not in the path '/a/{id}'", 19, 17, 19, 18],
        ['error', "Path '{n}' has no 'in: path' parameter named 'n'", 24, 5, 24, 9],
      ],
    ],
    ["paths:\n  /a/{id}:\n    get:\n      parameters:\n        - $ref: '#/components/parameters/Id'\n      responses: {}\ncomponents:\n  parameters:\n    Id: {name: id, in: path, required: true}\n", []],
    // operationId across paths, callbacks and webhooks
    [
      "paths:\n  /a:\n    get:\n      operationId: dup\n      responses: {}\n      callbacks:\n        cb:\n          '{$request.body#/u}':\n            post:\n              operationId: dup\n              responses: {}\nwebhooks:\n  w:\n    post:\n      operationId: dup\n      responses: {}\n",
      [
        ['error', "Duplicate operationId 'dup'", 6, 20, 6, 23],
        ['error', "Duplicate operationId 'dup'", 12, 28, 12, 31],
        ['error', "Duplicate operationId 'dup'", 17, 20, 17, 23],
      ],
    ],
    ['paths:\n  /a:\n    get:\n      operationId: a\n    put:\n      operationId: b\n', []],
    // security; a scheme used only in security is not unused
    [
      'security:\n  - api: []\n    nope: []\npaths: {}\ncomponents:\n  securitySchemes:\n    api: {type: apiKey, name: k, in: header}\n',
      [['error', "Security scheme 'nope' is not defined in components.securitySchemes", 5, 5, 5, 9]],
    ],
    // tag: only with root tags
    ['tags:\n  - name: a\npaths:\n  /a:\n    get:\n      tags: [a, b]\n', [['info', "Tag 'b' is used but not declared in tags", 8, 17, 8, 18]]],
    ['paths:\n  /a:\n    get:\n      tags: [b]\n', []],
    // serverVar
    [
      'servers:\n  - url: https://{env}.x.com/{v}\n    variables:\n      env: {default: prod}\npaths: {}\n',
      [['error', "Server variable '{v}' is not defined in 'variables'", 4, 10, 4, 33]],
    ],
    ['servers:\n  - url: https://{env}.x.com\n    variables:\n      env: {default: prod}\npaths: {}\n', []],
    // unused: transitive use, discriminator mapping (bare and #/), a cycle, a ref in example data
    [
      "paths:\n  /a:\n    get:\n      responses:\n        '200':\n          $ref: '#/components/responses/R'\ncomponents:\n  responses:\n    R:\n      description: ok\n      content:\n        application/json:\n          schema: {$ref: '#/components/schemas/A'}\n  schemas:\n    A:\n      oneOf: [{$ref: '#/components/schemas/B'}]\n      discriminator:\n        propertyName: k\n        mapping: {c: C, d: '#/components/schemas/D'}\n    B: {}\n    C: {}\n    D: {}\n    E: {$ref: '#/components/schemas/F'}\n    F: {$ref: '#/components/schemas/E'}\n    G: {}\n    H:\n      example: {$ref: '#/components/schemas/G'}\n",
      [
        ['info', "Component 'schemas/E' is never referenced", 25, 5, 25, 6],
        ['info', "Component 'schemas/F' is never referenced", 26, 5, 26, 6],
        ['info', "Component 'schemas/G' is never referenced", 27, 5, 27, 6],
        ['info', "Component 'schemas/H' is never referenced", 28, 5, 28, 6],
      ],
    ],
  ];
  for (const [body, want] of rows) assert.deepEqual(marks(doc(body)), want, body);
});

test('validate: review fixes for semantic rules', () => {
  const doc = (ver, body) => `openapi: ${ver}\n` + INFO + body;
  // an external parameter $ref may define the path parameter
  assert.deepEqual(marks(doc('3.1.0', "paths:\n  /a/{id}:\n    get:\n      parameters:\n        - $ref: 'x.yaml#/P'\n      responses: {}\n")), []);
  // aliases are not expanded, so the rules reading through them stay quiet
  const alias = "x-p: &p\n  - {name: id, in: path, required: true}\npaths:\n  /a/{id}:\n    get:\n      parameters: *p\n      responses: {}\n";
  assert.deepEqual(errors(doc('3.1.0', alias)), []);
  // 3.2: a security requirement key may be a URI reference
  const sec = (ver) => errors(doc(ver, "security:\n  - 'other.yaml#/components/securitySchemes/k': []\npaths: {}\n")).length;
  assert.equal(sec('3.2.0'), 0);
  assert.equal(sec('3.1.0'), 1);
  // unused: implicit discriminator children and 3.2 defaultMapping are reachable
  const comps = "paths:\n  /a:\n    get:\n      responses:\n        '200':\n          description: ok\n          content:\n            application/json:\n              schema: {$ref: '#/components/schemas/Pet'}\ncomponents:\n  schemas:\n    Pet:\n      type: object\n      discriminator:\n        propertyName: k\n        defaultMapping: Other\n    Cat:\n      allOf: [{$ref: '#/components/schemas/Pet'}]\n    Other: {}\n    Lone:\n      allOf: [{$ref: '#/components/schemas/Other'}]\n";
  assert.deepEqual(validate(doc('3.2.0', comps)).map((m) => m.message), ["Component 'schemas/Lone' is never referenced"]);
  // the same server variable twice is reported once
  assert.equal(errors(doc('3.1.0', 'servers:\n  - url: https://{v}.x/{v}\npaths: {}\n')).length, 1);
});

// Monaco snippet text -> the plain text it inserts, and Monaco's indenting of continuation lines
const expand = (s) => s.replace(/\$\{\d+\|([^,|]*)[^}]*\}/g, '$1').replace(/\$\{\d+:([^}]*)\}/g, '$1').replace(/\\\$/g, '$');
const applyMonaco = (line, insert) => insert.replace(/\n/g, '\n' + line.match(/^ */)[0]);

test('snippets: bodies parse at any indent', () => {
  assert.equal(expand("'${1:200}': ${2|a,b|} \\$x"), "'200': a $x");
  assert.equal(applyMonaco('    - ', 'a\n  b'), 'a\n      b');
  for (const s of SNIPPETS) {
    for (const n of [0, 2, 4, 8]) {
      const ind = ' '.repeat(n);
      const ok = (text) => assert.deepEqual(parseDocument(text).errors, [], `${s.label} @${n}:\n${text}`);
      ok(ind + applyMonaco(ind, expand(render(s.lines, ''))));
      ok(ind + '- ' + applyMonaco(ind + '- ', expand(render(s.lines, '  '))));
      const dashed = ind + applyMonaco(ind, expand(render(s.lines, '', true)));
      ok(dashed);
      assert.equal(parseDocument(dashed).contents.items.length, 1, dashed);
    }
  }
});

test('snippets: offered only in their context', () => {
  const snips = (src) => comp(src).filter((c) => c.snippet).map((c) => c.label);
  const ins = (src, label) => comp(src).find((c) => c.label === label).insertText;
  assert.deepEqual(snips('openapi: 3.1.0\npaths:\n  |\n'), ['path']);
  const item = 'paths:\n  /a:\n    get: {}\n    |\n';
  assert.deepEqual(snips('openapi: 3.1.0\n' + item), ['operation']);
  assert.match(ins('openapi: 3.1.0\n' + item, 'operation'), /^\$\{1\|post,put,patch,delete\|\}:\n {2}summary/);
  assert.match(ins('openapi: 3.2.0\n' + item, 'operation'), /^\$\{1\|post,put,patch,delete,query\|\}:/);
  assert.deepEqual(snips('openapi: 3.1.0\npaths:\n  /a:\n    get: {}\n    post: {}\n    put: {}\n    patch: {}\n    delete: {}\n    |\n'), []);
  assert.deepEqual(snips(OP + '      responses:\n        |\n'), ['response']);
  assert.deepEqual(snips('openapi: 3.1.0\ncomponents:\n  schemas:\n    |\n'), ['schema']);
  assert.deepEqual(snips('openapi: 3.1.0\ncomponents:\n  schemas:\n    A:\n      properties:\n        |\n'), []);
  assert.deepEqual(snips(OP + '      |\n'), []);
  const params = ['parameter: query', 'parameter: path', 'parameter: header'];
  assert.deepEqual(snips(OP + '      parameters:\n        - |\n'), params);
  assert.equal(ins(OP + '      parameters:\n        - |\n', 'parameter: path'), 'name: ${1:id}\n  in: path\n  required: true\n  schema:\n    type: ${2:string}');
  assert.deepEqual(snips(OP + '      parameters:\n        - name: a\n          |\n'), []);
  assert.deepEqual(snips(OP + '      parameters:\n        |\n'), params);
  assert.match(ins(OP + '      parameters:\n        |\n', 'parameter: query'), /^- name: \$\{1:limit\}\n {2}in: query\n/);
  assert.deepEqual(snips('{"openapi": "3.1.0", "paths": {|}}'), []);
});
