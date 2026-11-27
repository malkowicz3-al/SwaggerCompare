import { parseDocument, LineCounter, isMap, isSeq, isScalar } from 'yaml';

const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

export function compare(leftText, rightText) {
  const L = parse(leftText, 'left');
  const R = parse(rightText, 'right');
  // null = that side didn't parse, so the UI can keep its last good meta
  const meta = { left: L.error ? null : metaOf(L.data), right: R.error ? null : metaOf(R.data) };
  if (L.error) return { ...L, meta };
  if (R.error) return { ...R, meta };
  const changes = [];
  const st = { changes, left: L.index, right: R.index, lData: L.data, rData: R.data, useL: usage(L.data), useR: usage(R.data), affects: new Map(), extracted: new Set(), inlined: new Set() };
  walk(L.data, R.data, { path: [], pl: [], pr: [], st });
  // an extracted/inlined definition is reported once, on the $ref entry
  const covered = (c) => (c.kind === 'added' ? st.extracted : c.kind === 'removed' ? st.inlined : new Set()).has(JSON.stringify(c.path));
  return { changes: changes.filter((c) => !covered(c)), meta };
}

const scalar = (v) => (typeof v === 'string' || typeof v === 'number' ? String(v) : undefined);
const metaOf = (d) => ({ title: scalar(d?.info?.title), version: scalar(d?.info?.version), spec: scalar(d?.openapi ?? d?.swagger) });

function parse(text, side) {
  const lc = new LineCounter();
  const doc = parseDocument(text, { lineCounter: lc });
  const fail = (line, message) => ({ error: { side, line, message } });
  if (doc.errors.length) {
    const e = doc.errors[0];
    return fail(e.linePos?.[0].line ?? 1, e.message.split('\n')[0]);
  }
  if (doc.contents == null) return fail(1, 'Empty document');
  if (!isMap(doc.contents)) return fail(1, 'Document root must be a mapping');
  try {
    return { data: doc.toJS(), index: buildIndex(doc, lc, text) };
  } catch (e) {
    return fail(1, e.message.split('\n')[0]); // e.g. alias count limit
  }
}

// pathKey → {start, end} lines of the whole fragment (key through the last content line of its value),
// plus key = {line, from, to} (1-based columns, to exclusive) of the node's name: map key, item's `name` value, or scalar item
function buildIndex(doc, lc, text) {
  const index = new Map([[JSON.stringify([]), { start: 1, end: 1 }]]);
  const span = (from, to, min) => {
    let off = Math.max(to - 1, min - 1);
    // a block's range runs past trailing newlines/blank lines; stop at its last non-blank char
    while (off > from && /\s/.test(text[off])) off--;
    return { start: lc.linePos(from).line, end: lc.linePos(off).line };
  };
  const keyAt = ([s, e]) => {
    const { line, col } = lc.linePos(s);
    return { line, from: col, to: col + e - s };
  };
  const visit = (node, path) => {
    if (isMap(node)) {
      for (const p of node.items) {
        if (!isScalar(p.key)) continue; // complex/null keys fall back to the parent's line
        const sub = [...path, String(p.key.value)];
        index.set(JSON.stringify(sub), { ...span(p.key.range[0], p.value?.range?.[1] ?? p.key.range[1], p.key.range[1]), key: keyAt(p.key.range) });
        visit(p.value, sub);
      }
    } else if (isSeq(node)) {
      node.items.forEach((item, i) => {
        const sub = [...path, i];
        const name = isMap(item) ? item.items.find((q) => isScalar(q.key) && q.key.value === 'name')?.value : item;
        if (item?.range) index.set(JSON.stringify(sub), { ...span(item.range[0], item.range[1], item.range[1]), ...(isScalar(name) && { key: keyAt(name.range) }) });
        visit(item, sub);
      });
    }
  };
  visit(doc.contents, []);
  return index;
}

function nearest(index, path) {
  for (let i = path.length; i >= 0; i--) {
    const r = index.get(JSON.stringify(path.slice(0, i)));
    if (r) return { r, exact: i === path.length };
  }
  return { r: { start: 1, end: 1 }, exact: false };
}

const lineOf = (index, path) => nearest(index, path).r.start;

// the fragment at path, or just the first line of its nearest existing ancestor
function rangeOf(index, path) {
  const { r, exact } = nearest(index, path);
  return exact ? { start: r.start, end: r.end, exact } : { start: r.start, end: r.start, exact };
}

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const has = (o, k) => Object.hasOwn(o, k);
const get = (o, k) => (has(o, k) ? o[k] : undefined);

function eq(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => eq(v, b[i]));
  if (isPlain(a) && isPlain(b)) {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => has(b, k) && eq(a[k], b[k]));
  }
  return false;
}

const fmt = (v) => (isPlain(v) ? '{…}' : Array.isArray(v) ? '[…]' : JSON.stringify(v));

function child(ctx, k, { l = k, r = k, shown = k } = {}) {
  return { ...ctx, path: [...ctx.path, shown], pl: [...ctx.pl, l], pr: [...ctx.pr, r] };
}

const SINGULAR = {
  definitions: 'schema',
  schemas: 'schema',
  parameters: 'parameter',
  responses: 'response',
  requestBodies: 'request body',
  headers: 'header',
  securitySchemes: 'security scheme',
  securityDefinitions: 'security definition',
  examples: 'example',
  links: 'link',
  callbacks: 'callback',
};

// index of the component name in a path (definitions.X, components.<sec>.X, 2.0 parameters.X…), or -1
function nameAt(P) {
  if (P[0] === 'components' && P.length > 2) return 2;
  return ['definitions', 'parameters', 'responses', 'securityDefinitions'].includes(P[0]) && P.length > 1 ? 1 : -1;
}

// "schema User", "parameter Limit"; undefined unless segs point exactly at a component
function compLabel(segs) {
  const i = nameAt(segs);
  return i > 0 && segs.length === i + 1 ? `${SINGULAR[segs[i - 1]] ?? segs[i - 1]} ${segs[i]}` : undefined;
}

const noProps = (segs) => segs.filter((s, i) => s !== 'properties' || i === segs.length - 1);

// Readable prefixes inside an operation: "request body", "response 200", a parameter's name.
function pretty(R) {
  if (R[0] === 'requestBody') {
    if (R[1] !== 'content' || R.length < 3) return ['request body', ...R.slice(1)];
    return R[3] === 'schema' ? ['request body', ...R.slice(4)] : [`request body (${R[2]})`, ...R.slice(3)];
  }
  if (R[0] === 'responses' && R.length > 1) {
    const n = R[2] === 'content' && R.length > 4 && R[4] === 'schema' ? 5 : R[2] === 'schema' ? 3 : 2;
    return [`response ${R[1]}`, ...R.slice(n)];
  }
  const m = R[0] === 'parameters' && /^[^:/#]+:(.*)$/.exec(R[1] ?? '');
  if (m) return [m[1], ...R.slice(R[2] === 'schema' ? 3 : 2)];
  return R;
}

// where = short object label ("GET /users", "User", "parameter Limit"); rest = path inside it
function locate(ctx, asObject = false) {
  const P = ctx.path.map(String);
  if (ctx.st.detail) return { where: '', rest: pretty(noProps(P)) };
  if (P[0] === 'paths') {
    if (P.length < 3) return { where: 'paths', rest: P.slice(1) };
    if (METHODS.includes(P[2])) return { where: `${P[2].toUpperCase()} ${P[1]}`, rest: pretty(noProps(P.slice(3))) };
    return { where: P[1], rest: pretty(noProps(P.slice(2))) };
  }
  const i = nameAt(P);
  if (i < 0) return { where: P[0], rest: noProps(P.slice(1)) };
  const sec = P[i - 1];
  const isSchema = sec === 'definitions' || sec === 'schemas';
  if (P.length === i + 1 && !asObject) return { where: isSchema ? 'schemas' : sec, rest: [P[i]] };
  if (!isSchema) return { where: compLabel(P.slice(0, i + 1)), rest: noProps(P.slice(i + 1)) };
  const parts = [P[i]];
  let lastPair;
  for (let j = i + 1; j < P.length; j++) {
    if (P[j] === 'properties' && j + 1 < P.length) {
      lastPair = parts.length;
      parts.push(P[++j]);
    } else parts.push(P[j]);
  }
  if (asObject) return { where: parts.join('.'), rest: [] };
  const cut = lastPair ?? 1;
  return { where: parts.slice(0, cut).join('.'), rest: parts.slice(cut) };
}

// default tag = last non-numeric path segment: enum.2 → 'enum', servers.0.url → 'url'
const tagOf = (p) => [...p].map(String).reverse().find((s) => !/^\d+$/.test(s)) ?? 'other';

// vals = {lv, rv} compared values, or {details} = the refactor's detail entries; both feed isBreaking
function emit(kind, text, ctx, tag = tagOf(ctx.path), where = locate(ctx).where, vals) {
  const st = ctx.st;
  const side = kind === 'removed' ? 'left' : 'right';
  const line = lineOf(st[side], side === 'left' ? ctx.pl : ctx.pr);
  const affects = st.detail ? [] : affectsOf(ctx);
  const ch = { kind, tag, text, where, path: ctx.path.map(String), side, line, left: rangeOf(st.left, ctx.pl), right: rangeOf(st.right, ctx.pr), affects, flash: flashOf(ctx) };
  ch.breaking = isBreaking(ch, st.detail ? st.dirs : dirsOf(affects), vals);
  st.changes.push(ch);
  return ch;
}

const dirsOf = (affects) => new Set(affects.map((a) => a.dir));

// Endpoints hit by a change: the endpoint itself (every method for a path-level change), a component's users, or none ("Other").
function affectsOf(ctx) {
  const P = ctx.path.map(String);
  const st = ctx.st;
  if (P[0] === 'paths' && P.length > 1) {
    const op = METHODS.includes(P[2]);
    const k = op ? P[3] : P[2];
    const dir = k === 'parameters' || k === 'requestBody' ? 'request' : k === 'responses' ? 'response' : 'endpoint';
    const item = (d) => (isPlain(d?.paths) && isPlain(get(d.paths, P[1])) ? d.paths[P[1]] : {});
    const methods = op ? [P[2]] : METHODS.filter((m) => has(item(st.lData), m) || has(item(st.rData), m));
    return methods.map((m) => ({ endpoint: `${m.toUpperCase()} ${P[1]}`, dir }));
  }
  const i = nameAt(P);
  if (i < 0) return [];
  const key = JSON.stringify(P.slice(0, i + 1));
  if (!st.affects.has(key)) st.affects.set(key, componentAffects(st.useL.get(key) ?? [], st.useR.get(key) ?? []));
  return st.affects.get(key);
}

// one entry per (endpoint, dir), its vias joined: "response 400, 404, 500"; a schema used in many responses stays one row
function componentAffects(useL, useR) {
  const out = new Map();
  for (const a of [...useL, ...useR]) {
    const k = `${a.endpoint}|${a.dir}`;
    if (!out.has(k)) out.set(k, { endpoint: a.endpoint, dir: a.dir, vias: [] });
    const vias = out.get(k).vias;
    if (!vias.includes(a.via)) vias.push(a.via);
  }
  const head = (v) => /^(response|parameter) /.exec(v)?.[0];
  return [...out.values()].map(({ endpoint, dir, vias }) => ({
    endpoint,
    via: vias.map((v, j) => (j && head(v) && head(v) === head(vias[j - 1]) ? v.slice(head(v).length) : v)).join(', '),
    dir,
  }));
}

// name ranges on the exact sides; a trailing $ref/allOf/oneOf/anyOf points at its owner, so refactors flash the property name
function flashOf(ctx) {
  const flash = {};
  for (const [side, p] of [['left', ctx.pl], ['right', ctx.pr]]) {
    const own = ['$ref', ...KW].includes(p.at(-1)) ? p.slice(0, -1) : p;
    const key = ctx.st[side].get(JSON.stringify(own))?.key;
    if (key) flash[side] = key;
  }
  return flash;
}

const MINS = ['minimum', 'exclusiveMinimum', 'minLength', 'minItems', 'minProperties'];
const MAXS = ['maximum', 'exclusiveMaximum', 'maxLength', 'maxItems', 'maxProperties'];

// dirs = how the changed spot is used (request/response/endpoint); unused components, info, servers… have none → never breaking.
// | endpoint removed, response code removed, type change, $ref retargeted | yes          |
// | new required parameter, required request body added                   | yes          |
// | content type removed                                                  | yes          |
// | now required                                                          | in a request |
// | no longer required                                                    | in a response |
// | property removed                                                      | in a response |
// | enum narrowed (a value gone, compared as sets)                        | in a request |
// | enum widened (a new value)                                            | in a response |
// | tighter min/max/pattern                                               | in a request |
// | refactor                                                              | any detail breaking |
// | anything else (additions, descriptions, examples, defaults, x-*)      | no           |
// shortcut: security, basePath and servers are never breaking; add rows here when needed
function isBreaking(c, dirs, { lv, rv, details, enums } = {}) {
  if (!dirs?.size || inValue(c.path)) return false;
  const req = dirs.has('request');
  const res = dirs.has('response');
  const { kind, tag } = c;
  if (tag === 'refactor') return !!details?.some((d) => d.breaking);
  if (kind === 'removed' && (tag === 'endpoint' || tag === 'response')) return true;
  if (kind === 'removed' && c.path.at(-2) === 'content' && !NAMES.includes(c.path.at(-3))) return true;
  if (tag === 'type' || tag === '$ref') return kind === 'changed';
  if (tag === 'parameter') return kind === 'added' && (rv?.required === true || rv?.in === 'path');
  if (tag === 'requestBody') return kind === 'added' && rv?.required === true;
  if (tag === 'required') {
    if (/now required$/.test(c.text) || rv === true) return req;
    if (/no longer required$/.test(c.text) || lv === true) return res;
    return false;
  }
  if (tag === 'property') return kind === 'removed' && res;
  if (tag === 'enum') {
    // a whole enum added restricts the values, a removed one lifts the restriction; otherwise compare the value sets,
    // since arrays are walked by index and an inserted value shows up as "changed" entries
    const whole = c.path.at(-1) === 'enum';
    const [l, r] = enums ?? [[], []];
    const missing = (a, b) => a.some((v) => !b.some((w) => eq(v, w)));
    const narrowed = whole ? kind === 'added' : missing(l, r);
    const widened = whole ? kind === 'removed' : missing(r, l);
    return (narrowed && req) || (widened && res);
  }
  if (tag === 'pattern' || MINS.includes(tag) || MAXS.includes(tag)) {
    const tighter = kind === 'added' || (kind === 'changed' && (tag === 'pattern' || (MINS.includes(tag) ? rv > lv : rv < lv)));
    return tighter && req;
  }
  return false;
}

// segments after which the next one is a name (a property "type", a header "x-rate", required.example), not a keyword
const NAMES = ['properties', 'headers', 'definitions', 'schemas', 'parameters', 'responses', 'required'];
const VALUES = ['example', 'examples', 'default'];
// inside an example/default value, an x-* extension or an enum value's own structure, keys are data, not schema keywords
const inValue = (path) =>
  path.some(
    (s, i) => !NAMES.includes(path[i - 1]) && (VALUES.includes(s) || s.startsWith('x-') || (s === 'enum' && i < path.length - 2)),
  );

const restOf = (ctx) => locate(ctx).rest.join('.');
// a refactor of a whole component belongs to that component's group ("Order"), not to "schemas"
const ownWhere = (ctx) => (compLabel(ctx.path.map(String)) ? locate(ctx, true).where : undefined);

function walk(l, r, ctx) {
  if (eq(l, r)) return;
  const vals = { lv: l, rv: r, enums: ctx.enums };
  if (l === undefined) return emit('added', restOf(ctx) ? `${restOf(ctx)} added` : 'Added', ctx, undefined, undefined, vals);
  if (r === undefined) return emit('removed', restOf(ctx) ? `${restOf(ctx)} removed` : 'Removed', ctx, undefined, undefined, vals);
  if (extract(l, r, ctx)) return;
  if (compose(l, r, ctx)) return;
  if (isPlain(l) && isPlain(r)) return walkObject(l, r, ctx);
  if (Array.isArray(l) && Array.isArray(r)) {
    // an enum's entries are judged on the whole arrays (isBreaking)
    const ac = ctx.path.at(-1) === 'enum' ? { ...ctx, enums: [l, r] } : ctx;
    for (let i = 0; i < Math.max(l.length, r.length); i++) walk(l[i], r[i], child(ac, i));
    return;
  }
  const p = restOf(ctx);
  emit('changed', `${p ? `${p}: ` : ''}${fmt(l)} → ${fmt(r)}`, ctx, undefined, undefined, vals);
}

function walkObject(l, r, ctx) {
  const P = ctx.st.detail ? [] : ctx.path;
  const isPaths = P.length === 1 && P[0] === 'paths';
  const isPathItem = P.length === 2 && P[0] === 'paths';
  const isOp = P.length === 3 && P[0] === 'paths';
  const isResponses = P.length === 4 && P[0] === 'paths' && P[3] === 'responses';
  const isSchemas =
    (P.length === 1 && P[0] === 'definitions') || (P.length === 2 && P[0] === 'components' && P[1] === 'schemas');
  const keys = [...Object.keys(r), ...Object.keys(l).filter((k) => !has(r, k))];

  for (const k of keys) {
    const lv = get(l, k);
    const rv = get(r, k);
    const oneSided = lv === undefined || rv === undefined;
    const kind = lv === undefined ? 'added' : 'removed';
    const verb = lv === undefined ? 'Added' : 'Removed';
    const c = child(ctx, k);

    if (isPaths && oneSided) {
      const item = lv ?? rv;
      const methods = isPlain(item) ? METHODS.filter((m) => has(item, m)) : [];
      if (!methods.length) walk(lv, rv, c);
      for (const m of methods) emit(kind, `${verb} endpoint`, child(c, m), 'endpoint');
    } else if (isPathItem && oneSided && METHODS.includes(k)) {
      emit(kind, `${verb} endpoint`, c, 'endpoint');
    } else if ((isPathItem || isOp) && k === 'parameters' && [lv, rv].every((v) => v === undefined || Array.isArray(v))) {
      walkParams(lv ?? [], rv ?? [], ctx);
    } else if (isResponses && oneSided) {
      emit(kind, `${verb} response ${k}`, c, 'response');
    } else if (isSchemas && oneSided) {
      emit(kind, `${verb} schema ${k}`, c, 'schema');
    } else if (isSchemas) {
      walk(lv, rv, c);
    } else if (k === 'properties' && [lv, rv].every((v) => v === undefined || isPlain(v))) {
      walkProps(lv ?? {}, rv ?? {}, ctx);
    } else if (k === 'required' && [lv, rv].every((v) => v === undefined || Array.isArray(v))) {
      walkRequired(lv ?? [], rv ?? [], ctx, l, r);
    } else {
      walk(lv, rv, c);
    }
  }
}

const pureRef = (v) => isPlain(v) && typeof v.$ref === 'string' && Object.keys(v).length === 1;

// local JSON pointer "#/a/b~1c" → ['a', 'b/c']; undefined for external refs
export function pointer(ref) {
  if (!ref.startsWith('#/')) return undefined;
  return ref
    .slice(2)
    .split('/')
    .map((s) => {
      s = s.replace(/~1/g, '/').replace(/~0/g, '~');
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
}

function resolve(doc, segs) {
  for (let hop = 0; hop < 10 && segs; hop++) {
    let v = doc;
    for (const s of segs) v = v !== null && typeof v === 'object' && has(v, s) ? v[s] : undefined;
    if (!pureRef(v)) return isPlain(v) ? v : undefined;
    segs = pointer(v.$ref);
  }
  return undefined;
}

// Inline value replaced by a pure $ref (or back): one entry, the definition's differences as details.
function extract(l, r, ctx, label) {
  const st = ctx.st;
  if (st.detail || !isPlain(l) || !isPlain(r)) return false;
  const ext = pureRef(r) && !has(l, '$ref');
  if (!ext && !(pureRef(l) && !has(r, '$ref'))) return false;
  const ref = (ext ? r : l).$ref;
  const segs = pointer(ref);
  const target = segs && resolve(ext ? st.rData : st.lData, segs);
  let details;
  const sink = [];
  if (!segs) details = ['definition not compared (external $ref)'];
  else if (!target) details = ['definition not compared (unresolved $ref)'];
  else {
    walk(ext ? l : target, ext ? target : r, { path: [], pl: [], pr: [], st: { ...st, changes: sink, detail: true, dirs: dirsOf(affectsOf(ctx)) } });
    details = sink.length ? sink.map((c) => c.text) : ['definition unchanged'];
  }
  const text = `${label ?? restOf(ctx)}: ${ext ? 'extracted to' : 'inlined from'} ${(segs && compLabel(segs)) ?? ref}`;
  emit('changed', text, ext ? { ...ctx, pr: [...ctx.pr, '$ref'] } : ctx, 'refactor', ownWhere(ctx), { details: sink }).details = details;
  // only a resolved, whole component is covered by this entry; a ref into a sub-path (W/properties/id) covers nothing
  if (target && compLabel(segs)) (ext ? st.extracted : st.inlined).add(JSON.stringify(segs));
  return true;
}

const KW = ['allOf', 'oneOf', 'anyOf'];
const compOf = (s) => KW.find((k) => Array.isArray(s[k]));
const refsOf = (arr) => [...new Set(arr.filter(pureRef).map((m) => m.$ref))].sort();
const refName = (ref) => {
  const segs = pointer(ref);
  return (segs && compLabel(segs)) ?? ref;
};
const isUnion = (s, k) => k !== undefined && k !== 'allOf' && s[k].length > 1;

// b refines a: properties merged recursively, required unioned, otherwise b wins, so a narrowing change can't vanish
function merge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (k === 'properties' && isPlain(v) && isPlain(out.properties)) {
      out.properties = { ...out.properties };
      for (const [n, p] of Object.entries(v)) {
        const q = out.properties[n];
        out.properties[n] = has(out.properties, n) && isPlain(q) && isPlain(p) ? merge(q, p) : p;
      }
    } else if (k === 'required' && Array.isArray(v) && Array.isArray(out.required)) {
      out.required = [...new Set([...out.required, ...v])];
    } else out[k] = v;
  }
  return out;
}

// Effective schema: $refs resolved, allOf (or a 1-member oneOf/anyOf) merged in order, own keys last; a real union stays as-is.
function flat(s, doc, seen = new Set()) {
  if (!isPlain(s)) return {};
  if (pureRef(s)) {
    const segs = pointer(s.$ref);
    const key = JSON.stringify(segs);
    // seen catches cycles; the hop limit only bounds absurdly deep chains
    if (!segs || seen.has(key) || seen.size >= 32) return {};
    return flat(resolve(doc, segs), doc, new Set([...seen, key]));
  }
  const k = compOf(s);
  if (!k || (k !== 'allOf' && s[k].length !== 1)) return s;
  return merge(s[k].reduce((acc, m) => merge(acc, flat(m, doc, seen)), {}), omit(s, k));
}

// Schema gaining/losing allOf/oneOf/anyOf (or changing its member $refs): one entry, the effective differences as details.
function compose(l, r, ctx, label) {
  const st = ctx.st;
  if (st.detail || !isPlain(l) || !isPlain(r)) return false;
  const cl = compOf(l);
  const cr = compOf(r);
  if (!cl && !cr) return false;
  if (cl === cr && eq(refsOf(l[cl]), refsOf(r[cr]))) return false;
  const sink = [];
  const dctx = { path: [], pl: [], pr: [], st: { ...st, changes: sink, detail: true, dirs: dirsOf(affectsOf(ctx)) } };
  const union = isUnion(l, cl) || isUnion(r, cr);
  if (union) walk(l, r, dctx);
  else walk(flat(l, st.lData), flat(r, st.rData), dctx);
  const details = sink.length ? sink.map((c) => c.text) : ['definition unchanged'];
  const desc = (m) => (pureRef(m) ? refName(m.$ref) : 'inline');
  let what;
  if (!cr) what = `${cl} flattened`;
  else if (cl === cr) {
    const [lr, rr] = [refsOf(l[cl]), refsOf(r[cr])];
    const ch = [...rr.filter((x) => !lr.includes(x)).map((x) => `+ ${refName(x)}`), ...lr.filter((x) => !rr.includes(x)).map((x) => `− ${refName(x)}`)];
    what = `${cr} members changed: ${ch.join(', ')}`;
  } else what = `now ${cr} [${r[cr].map(desc).join(cr === 'allOf' ? ' + ' : ', ')}]`;
  const ch = emit('changed', `${label ?? restOf(ctx)}: ${what}`, cr ? { ...ctx, pr: [...ctx.pr, cr] } : ctx, 'refactor', ownWhere(ctx), { details: sink });
  ch.details = details;
  if (!cr) {
    ch.side = 'left';
    ch.line = lineOf(st.left, [...ctx.pl, cl]);
    ch.left = rangeOf(st.left, [...ctx.pl, cl]);
  }
  // a component that exists only on the side using it as a member is covered by the flattened details;
  // a union's raw details don't contain its members, so those keep their own entries
  if (union) return true;
  for (const [s, k, doc, other, set] of [
    [l, cl, st.lData, st.rData, st.inlined],
    [r, cr, st.rData, st.lData, st.extracted],
  ]) {
    for (const ref of k ? refsOf(s[k]) : []) {
      const segs = pointer(ref);
      if (segs && compLabel(segs) && resolve(doc, segs) && !resolve(other, segs)) set.add(JSON.stringify(segs));
    }
  }
  return true;
}

// undefined = not identifiable; such items are paired by position instead
const label = (p) =>
  !isPlain(p) ? undefined : p.$ref ? `$ref ${p.$ref}` : p.in != null && p.name != null ? `${p.in} '${p.name}'` : undefined;
const fromSchema = (p) => isPlain(p?.schema) && stype(p.schema) !== undefined;
const ptype = (p) => (fromSchema(p) ? stype(p.schema) : p?.type);
const omit = (o, k) => {
  const { [k]: _, ...rest } = o;
  return rest;
};

// Strip required and only the key the type was read from; everything else goes to the generic walk.
function stripParam(p) {
  if (!isPlain(p)) return p;
  const { required, ...rest } = p;
  if (!fromSchema(p)) delete rest.type;
  // strip/drop schema on both sides alike, so an empty schema on one side isn't reported as "Added schema"
  if (isPlain(rest.schema)) {
    const schema = stripSchema(rest.schema);
    if (Object.keys(schema).length) rest.schema = schema;
    else delete rest.schema;
  }
  return rest;
}

// Labeled items → Map(key → {i, n}); repeated labels get "#2", "#3"… so occurrences pair up in order.
function byLabel(arr) {
  const m = new Map();
  const rest = [];
  arr.forEach((p, i) => {
    const lab = label(p);
    if (lab === undefined) return rest.push(i);
    let key = lab;
    let n = '';
    for (let k = 2; m.has(key); k++) key = lab + (n = `#${k}`);
    m.set(key, { i, n });
  });
  return { m, rest };
}

// A "$ref …" param whose local target is `in 'name'` pairs with that inline param on the other side.
function pairRefs(m, arr, doc, other) {
  for (const [k, v] of [...m]) {
    const p = arr[v.i];
    if (other.has(k) || !pureRef(p)) continue;
    const t = pointer(p.$ref) && resolve(doc, pointer(p.$ref));
    const key = t?.in != null && t.name != null ? `${t.in} '${t.name}'` : undefined;
    if (key === undefined || m.has(key) || !other.has(key)) continue;
    m.delete(k);
    m.set(key, { i: v.i, n: '' });
  }
}

function walkParams(lArr, rArr, ctx) {
  const { m: lm, rest: lRest } = byLabel(lArr);
  const { m: rm, rest: rRest } = byLabel(rArr);
  pairRefs(rm, rArr, ctx.st.rData, lm);
  pairRefs(lm, lArr, ctx.st.lData, rm);
  const pc = child(ctx, 'parameters');
  const labels = [...rm.keys(), ...[...lm.keys()].filter((k) => !rm.has(k))];

  for (const lab of labels) {
    const { i: il, n } = lm.get(lab) ?? {};
    const { i: ir } = rm.get(lab) ?? {};
    const lp = lArr[il];
    const rp = rArr[ir];
    const p = [lp, rp].find((q) => q && !q.$ref) ?? lp ?? rp; // for an inline ↔ $ref pair, the inline one
    const shown = (p.$ref ? p.$ref : `${p.in}:${p.name}`) + (n ?? rm.get(lab).n);
    const c = child(pc, shown, { l: il, r: ir });
    const nm = p.name ?? lab;
    if (il === undefined) emit('added', `Added parameter ${lab}`, c, 'parameter', undefined, { rv: pureRef(rp) ? resolve(ctx.st.rData, pointer(rp.$ref)) : rp });
    else if (ir === undefined) emit('removed', `Removed parameter ${lab}`, c, 'parameter');
    else {
      if (extract(lp, rp, c, nm)) continue;
      let [ls, rs] = [lp, rp];
      const sc = child(c, 'schema');
      if (extract(lp.schema, rp.schema, sc, p.name) || compose(lp.schema, rp.schema, sc, p.name)) [ls, rs] = [omit(lp, 'schema'), omit(rp, 'schema')];
      if (!!lp.required !== !!rp.required) emit('changed', `${nm}: ${rp.required ? 'now required' : 'no longer required'}`, c, 'required');
      if (!eq(ptype(ls), ptype(rs))) emit('changed', `${nm}: type ${tfmt(ptype(ls))} → ${tfmt(ptype(rs))}`, c, 'type');
      walk(stripParam(ls), stripParam(rs), c);
    }
  }
  for (let j = 0; j < Math.max(lRest.length, rRest.length); j++) {
    const il = lRest[j];
    const ir = rRest[j];
    walk(lArr[il], rArr[ir], child(pc, il ?? ir, { l: il, r: ir }));
  }
}

const tkey = (s) => (isPlain(s) && s.type !== undefined ? 'type' : '$ref');
const stype = (s) => (isPlain(s) ? s[tkey(s)] : undefined);
const tfmt = (t) => (typeof t === 'string' || t === undefined ? String(t) : JSON.stringify(t));

// Strip only the key stype read, so a sibling $ref next to type still reaches the generic walk.
const stripSchema = (s) => (isPlain(s) ? omit(s, tkey(s)) : s);

function walkProps(lProps, rProps, ctx) {
  const pc = child(ctx, 'properties');
  const names = [...Object.keys(rProps), ...Object.keys(lProps).filter((k) => !has(rProps, k))];

  for (const n of names) {
    const lv = get(lProps, n);
    const rv = get(rProps, n);
    const c = child(pc, n);
    const p = restOf(c);
    const t = stype(lv ?? rv);
    const suffix = t === undefined ? '' : ` (${tfmt(t)})`;
    if (lv === undefined) emit('added', `Added property ${p}${suffix}`, c, 'property');
    else if (rv === undefined) emit('removed', `Removed property ${p}${suffix}`, c, 'property');
    else if (!extract(lv, rv, c) && !compose(lv, rv, c)) {
      if (!eq(stype(lv), stype(rv))) emit('changed', `${p}: type ${tfmt(stype(lv))} → ${tfmt(stype(rv))}`, c, 'type');
      walk(stripSchema(lv), stripSchema(rv), c);
    }
  }
}

function walkRequired(lArr, rArr, ctx, lObj, rObj) {
  const { where, rest } = locate(ctx, true);
  const nm = (n) => [...rest, n].join('.');
  const ls = new Set(lArr);
  const rs = new Set(rArr);
  const props = (obj) => (isPlain(obj.properties) ? obj.properties : {});
  const lProps = props(lObj);
  const rProps = props(rObj);
  const at = (n, pl, pr) => ({ ...ctx, path: [...ctx.path, 'required', String(n)], pl, pr });

  rArr.forEach((n, i) => {
    if (!ls.has(n) && rArr.indexOf(n) === i) emit('changed', `${nm(n)}: now required`, at(n, [...ctx.pl, 'required'], [...ctx.pr, 'required', i]), 'required', where);
  });
  for (const n of ls) {
    // a name dropped together with its property is already reported as "Removed property"
    if (rs.has(n) || (has(lProps, n) && !has(rProps, n))) continue;
    const pr = has(rProps, n) ? [...ctx.pr, 'properties', n] : [...ctx.pr, 'required'];
    emit('changed', `${nm(n)}: no longer required`, at(n, [...ctx.pl, 'required', lArr.indexOf(n)], pr), 'required', where);
  }
}

// componentKey (JSON path of the component, e.g. ["definitions","User"]) → [{endpoint, via, dir}] of the operations
// reaching it through local $refs, transitively; dir is 'request' (parameters, requestBody) or 'response'
export function usage(data) {
  const use = new Map(); // component key → Map(`endpoint|via` → entry)
  const direct = new Map(); // memo: component key → keys of the components it references
  const closure = new Map(); // memo: component key → every component key reachable from it, itself included
  const refsIn = (node, out = new Set(), seen = new Set()) => {
    if (node === null || typeof node !== 'object' || seen.has(node)) return out;
    seen.add(node);
    const segs = isPlain(node) && typeof node.$ref === 'string' ? pointer(node.$ref) : undefined;
    const i = segs ? nameAt(segs) : -1;
    if (i > 0) out.add(JSON.stringify(segs.slice(0, i + 1)));
    for (const v of Object.values(node)) refsIn(v, out, seen);
    return out;
  };
  const from = (start) => {
    if (closure.has(start)) return closure.get(start);
    const seen = new Set();
    const todo = [start];
    while (todo.length) {
      const k = todo.pop();
      if (seen.has(k)) continue;
      seen.add(k);
      if (!direct.has(k)) direct.set(k, refsIn(JSON.parse(k).reduce((v, s) => (isPlain(v) ? get(v, s) : undefined), data)));
      todo.push(...direct.get(k));
    }
    closure.set(start, seen);
    return seen;
  };
  const reach = (node) => {
    const out = new Set();
    for (const k of refsIn(node)) for (const x of from(k)) out.add(x);
    return out;
  };
  for (const [p, item] of Object.entries(isPlain(data?.paths) ? data.paths : {})) {
    if (!isPlain(item)) continue;
    const shared = Array.isArray(item.parameters) ? item.parameters : [];
    for (const m of METHODS.filter((m) => isPlain(get(item, m)))) {
      const op = item[m];
      const endpoint = `${m.toUpperCase()} ${p}`;
      const parts = [...shared, ...(Array.isArray(op.parameters) ? op.parameters : [])].map((prm) => {
        const t = pureRef(prm) ? resolve(data, pointer(prm.$ref)) : prm;
        return [`parameter ${t?.name ?? prm?.$ref ?? '?'}`, 'request', prm];
      });
      if (op.requestBody !== undefined) parts.push(['request body', 'request', op.requestBody]);
      for (const [code, r] of Object.entries(isPlain(op.responses) ? op.responses : {})) parts.push([`response ${code}`, 'response', r]);
      for (const [via, dir, node] of parts) {
        for (const k of reach(node)) {
          if (!use.has(k)) use.set(k, new Map());
          const m = use.get(k);
          const id = `${endpoint}|${via}`; // via implies dir
          if (!m.has(id)) m.set(id, { endpoint, via, dir });
        }
      }
    }
  }
  return new Map([...use].map(([k, m]) => [k, [...m.values()]]));
}
