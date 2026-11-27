// Readable API docs from the edited spec for the Preview tab. Pure, no DOM.
import { isMap } from 'yaml';
import { parse, lookup } from './ast.js';
import { METHODS } from './outline.js';
import { pointer } from '../compare.js';

const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : null);
const txt = (x) => (x == null || typeof x === 'object' ? undefined : String(x));
const list = (x) => (Array.isArray(x) ? x : []);
const MAX_DEPTH = 6;

// one local $ref hop in the plain JS value; own keys only, so "__proto__" segments resolve to nothing
const target = (js, ref) => pointer(ref)?.reduce((n, s) => (n && typeof n === 'object' && Object.hasOwn(n, s) ? n[s] : undefined), js);
const resolve = (js, v) => {
  for (let hop = 0; hop < 10 && typeof obj(v)?.$ref === 'string'; hop++) v = target(js, v.$ref);
  return v;
};

// $ref@depth -> Node, one Map per preview() call (keyed by its fresh js value); without it wide $ref fanout is exponential in depth
const memos = new WeakMap();

// schema -> Node (see docs/ARCHITECTURE.md); seen = the $refs on the current path, for the cycle guard
// shortcut: 3.1 $ref siblings (description next to $ref) are ignored; add them if people ask
// shortcut: a memoised $ref subtree keeps the cycle markers of the path it was first built on; fine for docs, exact would need per-path keys
function node(s, js, seen = [], depth = 0) {
  if (typeof obj(s)?.$ref === 'string') {
    const ref = pointer(s.$ref)?.at(-1) ?? s.$ref;
    if (seen.includes(s.$ref)) return { type: ref, ref, cycle: true };
    const memo = memos.get(js) ?? memos.set(js, new Map()).get(js);
    const key = `${depth} ${s.$ref}`;
    if (!memo.has(key)) memo.set(key, { ...node(target(js, s.$ref), js, [...seen, s.$ref], depth), ref });
    return memo.get(key);
  }
  if (s === false) return { type: 'never' };
  s = obj(s);
  if (!s) return { type: 'any' };
  if (Array.isArray(s.allOf)) {
    const { allOf, ...own } = s;
    const parts = [...allOf, own].map((p) => node(p, js, seen, depth));
    const req = [...new Set(parts.flatMap((p) => p.required ?? []))];
    const kids = new Map(parts.flatMap((p) => p.children ?? []).map((c) => [c.name, c]));
    // enum, format, items, variants... come from the parts; the rest is merged below
    const n = Object.assign({}, ...parts.map(({ children, required, ...p }) => p));
    n.type = parts.find((p) => p.type !== 'any' && p.type !== 'null')?.type ?? 'object';
    if (parts.some((p) => p.nullable)) {
      n.nullable = true;
      if (!/(^| \| )null\b/.test(n.type)) n.type += ' | null';
    }
    if (parts.filter((p) => p.ref).length !== 1) {
      delete n.ref;
      delete n.cycle;
    }
    const description = txt(s.description) ?? parts.find((p) => p.description)?.description;
    if (description) n.description = description;
    else delete n.description;
    if (req.length) n.required = req;
    if (kids.size) n.children = [...kids.values()].map((c) => ({ ...c, required: req.includes(c.name) }));
    return n;
  }
  const deeper = depth < MAX_DEPTH;
  const n = {};
  let types = [s.type].flat().filter((t) => typeof t === 'string');
  if (!types.length) types = obj(s.properties) ? ['object'] : s.items ? ['array'] : [];
  if (s.nullable === true && !types.includes('null')) types.push('null');
  if (types.includes('null')) n.nullable = true;
  if (types.includes('array') && deeper) {
    n.items = node(s.items, js, seen, depth + 1);
    types = types.map((t) => (t === 'array' ? `array of ${n.items.ref ?? n.items.type}` : t));
  }
  n.type = types.join(' | ') || 'any';
  if (txt(s.format)) {
    n.format = txt(s.format);
    n.type += ` (${n.format})`;
  }
  if (txt(s.description)) n.description = txt(s.description);
  if (Array.isArray(s.enum)) n.enum = s.enum;
  const req = list(s.required).filter((r) => typeof r === 'string');
  if (req.length) n.required = req;
  if (obj(s.properties) && deeper) {
    n.children = Object.entries(s.properties).map(([name, p]) => ({ name, required: req.includes(name), node: node(p, js, seen, depth + 1) }));
  }
  for (const kind of ['oneOf', 'anyOf']) {
    if (Array.isArray(s[kind]) && deeper) {
      n.variants = { kind, list: s[kind].map((p) => node(p, js, seen, depth + 1)) };
      if (n.type === 'any') n.type = kind;
      break;
    }
  }
  return n;
}

const content = (c, js) => Object.entries(obj(c) ?? {}).map(([media, m]) => ({ media, schema: obj(m) && m.schema !== undefined ? node(m.schema, js) : null }));

// text -> {title, version, description, servers, groups} or null when the text does not parse
export function preview(text) {
  const { doc, root, lc } = parse(text);
  if (doc.errors.length || !isMap(root)) return null;
  let js;
  try {
    js = doc.toJS();
  } catch {
    return null; // e.g. too many aliases
  }
  const groups = new Map();
  const group = (name, description) => groups.get(name) ?? groups.set(name, { name, description, ops: [] }).get(name);
  for (const t of list(js.tags)) if (txt(obj(t)?.name)) group(txt(t.name), txt(t.description));

  const op = (o, method, segs, item) => {
    const params = new Map();
    for (const p of [...list(item.parameters), ...list(o.parameters)].map((p) => obj(resolve(js, p))).filter(Boolean)) params.set(`${p.in}:${p.name}`, p);
    const rb = obj(resolve(js, o.requestBody));
    const found = lookup(root, segs) ?? lookup(root, segs.slice(0, 2));
    return {
      key: segs.join('/'),
      method,
      path: segs[1],
      line: found?.pair ? lc.linePos(found.pair.key.range[0]).line : undefined,
      summary: txt(o.summary),
      description: txt(o.description),
      operationId: txt(o.operationId),
      deprecated: o.deprecated === true,
      params: [...params.values()].map((p) => ({
        name: txt(p.name),
        in: txt(p.in),
        required: p.required === true,
        type: p.schema !== undefined ? node(p.schema, js, [], MAX_DEPTH - 1).type : 'any',
        description: txt(p.description),
      })),
      body: rb && { required: rb.required === true, description: txt(rb.description), content: content(rb.content, js) },
      responses: Object.entries(obj(o.responses) ?? {}).map(([code, r]) => ((r = obj(resolve(js, r)) ?? {}), { code, description: txt(r.description), content: content(r.content, js) })),
    };
  };
  // shortcut: a path item that is itself a $ref (3.1 pathItems) is followed for values but jumps to the path key's line
  const ops = (section) =>
    Object.entries(obj(js[section]) ?? {}).flatMap(([name, raw]) => {
      const item = obj(resolve(js, raw)) ?? {};
      return [
        ...METHODS.filter((m) => obj(item[m])).map((m) => [item[m], m, [section, name, m]]),
        ...Object.entries(obj(item.additionalOperations) ?? {})
          .filter(([, o]) => obj(o))
          .map(([m, o]) => [o, m.toLowerCase(), [section, name, 'additionalOperations', m]]),
      ].map(([o, m, segs]) => [txt(list(o.tags)[0]), op(o, m, segs, item)]);
    });

  const untagged = [];
  for (const [tag, o] of ops('paths')) (tag ? group(tag).ops : untagged).push(o);
  const webhooks = ops('webhooks').map(([, o]) => o);
  const out = [...groups.values()].filter((g) => g.ops.length);
  if (untagged.length) out.push({ name: 'default', ops: untagged });
  if (webhooks.length) out.push({ name: 'Webhooks', ops: webhooks });
  const info = obj(js.info) ?? {};
  return {
    title: txt(info.title),
    version: txt(info.version),
    description: txt(info.description),
    servers: list(js.servers).map((s) => txt(obj(s)?.url)).filter(Boolean),
    groups: out,
  };
}
