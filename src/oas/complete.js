import { OBJECTS, active, kindsOf, member, enumOf, itemSpec, refKind, EXT } from './model.js';
import { contextAt } from './context.js';
import { parse } from './ast.js';
import { targets } from './refs.js';
import { SNIPPETS } from './templates.js';

const lower = (s) => s.toLowerCase();
const strip = (p) => p.replace(/^["']/, '');

// pad: Monaco indents continuation lines to the line's leading spaces, which excludes a `- ` before the key
function insertKey(key, spec, ctx, rest, pad) {
  if (ctx.json) return rest.includes(':') ? `"${key}"` : `"${key}": `;
  const k = /^\d/.test(key) ? `'${key}'` : key;
  if (rest.includes(':')) return k;
  const t = kindsOf(spec, ctx.version)[0];
  return t === 'obj' || t === 'map' ? `${k}:\n${pad}  ` : t === 'list' ? `${k}:\n${pad}  - ` : `${k}: `;
}

// a snippet's insertText; pad as in insertKey; dashed adds the `- ` of a new list item
export function render(lines, pad, dashed) {
  return (dashed ? lines.map((l, i) => (i ? '  ' : '- ') + l) : lines).join('\n' + pad);
}

const snippet = (label) => SNIPPETS.find((s) => s.label === label);
const PARAMS = ['parameter: query', 'parameter: path', 'parameter: header'];

// the snippets that fit a key position
function snippetsFor(ctx, raw, col) {
  const t = ctx.objectType;
  if (t === 'Paths') return [snippet('path')];
  if (t === 'Responses') return [snippet('response')];
  if (t === 'PathItem') {
    const free = ['get', 'post', 'put', 'patch', 'delete', ...(ctx.version >= 32 ? ['query'] : [])].filter((m) => !ctx.keysPresent.has(m));
    if (!free.length) return [];
    const s = snippet('operation');
    return [{ ...s, lines: [s.lines[0].replace('METHODS', free.join(',')), ...s.lines.slice(1)] }];
  }
  if (ctx.path.length === 2 && ctx.path[0] === 'components' && ctx.path[1] === 'schemas') return [snippet('schema')];
  if (t === 'Parameter' && !ctx.keysPresent.size && /^\s*- +[\w"']*$/.test(raw.slice(0, col - 1))) return PARAMS.map(snippet);
  if (ctx.container?.kind === 'list' && ctx.container.type === 'Parameter') return PARAMS.map((l) => ({ ...snippet(l), dashed: true }));
  return [];
}

// -> [{label, insertText, kind: 'key'|'value'|'snippet', doc, required?, sortText, snippet?, retrigger?}]
export function complete(text, line, col) {
  const ctx = contextAt(text, line, col);
  if (!ctx) return [];
  const raw = text.split(/\r?\n/)[line - 1] ?? '';
  const rest = raw.slice(col - 1);
  const pad = ' '.repeat(Math.max(0, ctx.indent - raw.search(/\S|$/)));
  const pre = lower(strip(ctx.prefix));
  const out = [];
  const seen = new Set();
  const add = (label, item) => {
    if (seen.has(label) || !lower(label).startsWith(pre)) return;
    seen.add(label);
    out.push({ label, ...item });
  };
  const ver = ctx.version;
  if (ctx.position === 'key') {
    const obj = OBJECTS[ctx.objectType];
    const keyItem = (key, spec, required) => {
      if (ctx.keysPresent.has(key)) return;
      add(key, { insertText: insertKey(key, spec, ctx, rest, pad), kind: 'key', doc: spec.doc, ...(required && { required: true }), sortText: (required ? '0' : '1') + key });
    };
    if (obj) {
      for (const [key, f] of Object.entries(obj.fields)) {
        if (active(f, ver)) keyItem(key, f, f.req && !(f.reqUntil && ver >= f.reqUntil));
      }
      for (const p of obj.patterns ?? []) for (const key of p.keyHints ?? []) keyItem(key, p);
      if (obj.ref && !ctx.keysPresent.has('$ref')) {
        add('$ref', { insertText: insertKey('$ref', member(ctx.objectType, '$ref', ver).spec, ctx, rest, pad), kind: 'key', doc: 'A reference to a component.', sortText: '1$ref', retrigger: true });
      }
    } else if (ctx.container?.kind === 'map') {
      for (const key of ctx.container.spec.keyHints ?? []) keyItem(key, itemSpec(ctx.container.spec));
    }
    // a snippet on a line that already has text after the cursor would mangle it
    if (!ctx.json && !rest.trim()) {
      for (const s of snippetsFor(ctx, raw, col)) {
        add(s.label, { insertText: render(s.lines, pad, s.dashed), kind: 'snippet', snippet: true, doc: s.doc, sortText: '2' + s.label });
      }
    }
    return out;
  }
  const kind = ctx.key === '$ref' && refKind(ctx.objectType, ver);
  if (kind) {
    // the YAML line being typed may hold an unclosed quote that would swallow the rest of the document
    const lines = text.split(/\r?\n/);
    if (!ctx.json) lines[line - 1] = '';
    // a full parse costs ~30 ms on 3k lines, so YAML parses only the top-level components block
    // shortcut: JSON and a YAML root without a block `components:` line still parse the whole text; fine until JSON specs get big
    const s = ctx.json ? -1 : lines.findIndex((l) => /^components\s*:/.test(l));
    const e = s < 0 ? -1 : lines.findIndex((l, i) => i > s && /^[^\s#]/.test(l));
    const src = s < 0 ? lines : lines.slice(s, e < 0 ? undefined : e);
    const sp = !ctx.json && raw[col - 2] === ':' ? ' ' : '';
    for (const name of targets(parse(src.join('\n')).root, kind)) {
      const label = `#/components/${kind}/${name.replace(/~/g, '~0').replace(/\//g, '~1')}`;
      if (seen.has(label) || !lower(label).includes(pre)) continue;
      seen.add(label);
      out.push({ label, insertText: sp + (ctx.json ? JSON.stringify(label) : `'${label.replace(/'/g, "''")}'`), kind: 'value', doc: `The ${kind} component '${name}'.`, sortText: '1' + label });
    }
    return out;
  }
  const f = ctx.objectType && ctx.key != null ? member(ctx.objectType, ctx.key, ver)?.spec : null;
  if (!f || f === EXT) return out;
  const values = enumOf(f, ver) ?? f.hints ?? (kindsOf(f, ver).includes('bool') ? ['true', 'false'] : []);
  const isStr = kindsOf(f, ver).includes('str');
  for (const v of values) {
    // a bare null/true/false would not be a string in YAML
    const ins = ctx.json ? (isStr ? `"${v}"` : v) : isStr && /^(null|true|false)$/.test(v) ? `'${v}'` : v;
    // `in:|` needs a space, or YAML reads `in:query` as one plain scalar
    add(v, { insertText: (!ctx.json && raw[col - 2] === ':' ? ' ' : '') + ins, kind: 'value', doc: f.doc, sortText: '1' + v });
  }
  return out;
}

const since = (v) => `${Math.floor(v / 10)}.${v % 10}`;
const PRIM = { str: 'string', num: 'number', int: 'integer', bool: 'boolean', any: 'any' };
const typeName = (t, of) => (t === 'obj' ? of : t === 'map' ? `map of ${OBJECTS[of] ? of : PRIM[of]}` : t === 'list' ? `list of ${OBJECTS[of] ? of : PRIM[of]}` : PRIM[t]);

// hover info for the key under the cursor -> {title, doc, type, required} or null
export function fieldDoc(text, line, col) {
  const raw = (text.split(/\r?\n/)[line - 1] ?? '');
  const re = /^( *(?:- +)?)("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s"'#{[\]][^#]*?)\s*:(?=\s|$)|"((?:[^"\\]|\\.)*)"\s*:/g;
  let hit = null;
  for (let mt; (mt = re.exec(raw)); ) {
    const start = mt.index + (mt[1]?.length ?? 0);
    const len = (mt[2] ?? `"${mt[3]}"`).length;
    if (col - 1 >= start && col - 1 <= start + len) hit = { start, quoted: mt[3] != null };
  }
  if (!hit) return null;
  const ctx = contextAt(text, line, hit.start + 1 + (hit.quoted ? 1 : 0));
  if (!ctx || ctx.position !== 'key' || ctx.key == null) return null;
  const key = ctx.key;
  const ver = ctx.version;
  if (key.startsWith('x-')) return { title: key, doc: EXT.doc, type: 'any', required: false };
  if (ctx.container?.kind === 'map') {
    const it = itemSpec(ctx.container.spec);
    return { title: key, doc: it.doc, type: typeName(it.t, it.of), required: false };
  }
  const mm = ctx.objectType && member(ctx.objectType, key, ver);
  if (!mm) return null;
  const f = mm.spec;
  const note = [f.since && `Since OpenAPI ${since(f.since)}.`, f.until && `Removed in OpenAPI ${since(f.until)}.`].filter(Boolean).join(' ');
  return {
    title: key,
    doc: note ? `${f.doc} ${note}` : f.doc,
    type: kindsOf(f, ver).map((t) => typeName(t, f.of)).join(' or '),
    required: !!f.req && !(f.reqUntil && ver >= f.reqUntil),
  };
}
