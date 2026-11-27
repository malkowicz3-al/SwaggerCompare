import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { OBJECTS, TEMPLATES, verOf } from '../src/oas/model.js';
import { contextAt } from '../src/oas/context.js';
import { complete, fieldDoc } from '../src/oas/complete.js';
import { validate } from '../src/oas/validate.js';
import { outline } from '../src/oas/outline.js';
import { starter } from '../src/oas/templates.js';
import { formatJson } from '../src/oas/ast.js';

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
  for (const [text, want] of rows) assert.deepEqual(marks(text), want, text);
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
  for (const f of files) assert.deepEqual(errors(read(f)), [], f.pathname);
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
  assert.deepEqual(o.map((n) => [n.label, n.line]), [['Info', 2], ['Servers', 5], ['Paths', 7], ['Components', 62]]);
  assert.equal(o[0].detail, 'Orders API 1.4.0');
  assert.deepEqual(o[2].children.map((p) => [p.label, p.line, p.children.map((m) => `${m.method}@${m.line}:${m.detail}`)]), [
    ['/orders', 8, ['get@9:List orders', 'post@29:Create an order']],
    ['/orders/{id}', 39, ['get@40:Get one order', 'delete@51:Cancel an order']],
    ['/legacy/export', 56, ['get@57:CSV export']],
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
  console.log(`perf: ${lines} lines, validate ${tv.toFixed(1)} ms, contextAt ${tc.toFixed(1)} ms, complete ${tk.toFixed(1)} ms`);
  assert.ok(tv < 300, `validate ${tv}`);
  assert.ok(tc < 50, `contextAt ${tc}`);
  assert.ok(tk < 50, `complete ${tk}`);
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
