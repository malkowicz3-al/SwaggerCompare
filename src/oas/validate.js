import { isMap, isSeq, isScalar, isAlias } from 'yaml';
import { OBJECTS, active, kindsOf, member, enumOf, itemSpec, typeAt, refKind } from './model.js';
import { parse, range, head, keyOf, pairOf, lookup, deref } from './ast.js';
import { targets } from './refs.js';
import { METHODS } from './outline.js';
import { pointer } from '../compare.js';

const START = { startLine: 1, startCol: 1, endLine: 1, endCol: 2 };
const mark = (severity, message, where) => ({ severity, message, ...where });
const v = (n) => `${Math.floor(n / 10)}.${n % 10}`;

export function syntaxRule({ doc, lc }) {
  const one = (severity) => (e) => mark(severity, e.message.split('\n')[0], range(lc, e.pos));
  return [...doc.errors.map(one('error')), ...doc.warnings.map(one('warning'))];
}

export function versionRule({ doc, lc, root }) {
  if (doc.errors.length) return [];
  const sw = pairOf(root, 'swagger');
  if (sw) return [mark('error', 'Swagger 2.0 is not supported by the editor (OpenAPI 3.x only)', range(lc, sw.key.range))];
  const p = pairOf(root, 'openapi');
  if (!p) return [mark('error', "Missing required 'openapi' field", START)];
  const val = isScalar(p.value) ? String(p.value.value) : '';
  const mm = /^3\.(\d+)\.\d+/.exec(val);
  if (mm && Number(mm[1]) <= 2) return [];
  const where = p.value?.range ? range(lc, p.value.range) : range(lc, p.key.range);
  if (mm) return [mark('error', `OpenAPI ${val} is newer than this editor supports (up to 3.2)`, where)];
  return [mark('error', `Invalid OpenAPI version '${val}'. Expected 3.0.x, 3.1.x or 3.2.x`, where)];
}

const NAMES = { str: 'string', num: 'number', int: 'integer', bool: 'boolean', map: 'mapping', list: 'list' };

export function structureRule({ doc, lc, ver, root, text }) {
  if (doc.errors.length || !ver || !isMap(root)) return [];
  const out = [];
  const at = (node) => range(lc, head(text, node.range));

  const object = (map, type, owner) => {
    const obj = OBJECTS[type];
    const hasRef = obj.ref && pairOf(map, '$ref') && !(type === 'Schema' && ver >= 31);
    for (const pair of map.items) {
      const key = keyOf(pair);
      if (key == null || key.startsWith('x-') || key === '<<') continue;
      const mm = member(type, key, ver);
      if (!mm) {
        if (!hasRef) out.push(mark('warning', `Unknown key '${key}' in ${type}`, range(lc, pair.key.range)));
        continue;
      }
      if (mm.gated) {
        const msg = mm.spec.until && ver >= mm.spec.until ? `'${key}' was removed in OpenAPI ${v(mm.spec.until)}` : `'${key}' needs OpenAPI ${v(mm.spec.since)}+`;
        out.push(mark('warning', msg, range(lc, pair.key.range)));
        continue;
      }
      value(pair.value, mm.spec, range(lc, pair.key.range));
    }
    if (hasRef) return;
    for (const [key, f] of Object.entries(obj.fields)) {
      if (f.req && active(f, ver) && !(f.reqUntil && ver >= f.reqUntil) && !pairOf(map, key)) {
        out.push(mark('error', `Missing required '${key}' in ${type}`, owner));
      }
    }
  };

  const value = (node, spec, owner) => {
    if (!node || isAlias(node) || (isScalar(node) && node.value === null)) return;
    const kinds = kindsOf(spec, ver);
    if (kinds.includes('any')) return;
    if (isMap(node)) {
      if (kinds.includes('obj')) return object(node, spec.of, owner ?? at(node));
      if (kinds.includes('map')) return node.items.forEach((p) => value(p.value, itemSpec(spec), p.key && range(lc, p.key.range)));
    } else if (isSeq(node)) {
      if (kinds.includes('list')) return node.items.forEach((it) => value(it, itemSpec(spec)));
    } else if (isScalar(node)) {
      const x = node.value;
      const ok = typeof x === 'string' ? kinds.includes('str')
        : typeof x === 'number' ? kinds.includes('num') || (kinds.includes('int') && Number.isInteger(x))
        : typeof x === 'boolean' ? kinds.includes('bool') || (ver >= 31 && spec.of === 'Schema') // 3.1 boolean schemas
        : false;
      if (ok) return scalar(node, spec);
      // `version: 1.0` parses as a number; a nudge, not an error
      if (kinds.includes('str') && (typeof x === 'number' || typeof x === 'boolean')) return out.push(mark('warning', 'Expected string; quote the value', at(node)));
    }
    const want = kinds.map((k) => (k === 'obj' ? `mapping (${spec.of})` : NAMES[k])).join(' or ');
    const found = isMap(node) ? 'mapping' : isSeq(node) ? 'list' : NAMES[{ string: 'str', number: 'num', boolean: 'bool' }[typeof node.value]] ?? typeof node.value;
    out.push(mark('error', `Expected ${want}, found ${found}`, at(node)));
  };

  const scalar = (node, spec) => {
    const allowed = enumOf(spec, ver);
    const x = String(node.value);
    if (!allowed || allowed.includes(x)) return;
    const gated = spec.enum.find((e) => Array.isArray(e) && e[0] === x);
    if (gated) out.push(mark('warning', gated[2] && ver >= gated[2] ? `'${x}' was removed in OpenAPI ${v(gated[2])}` : `'${x}' needs OpenAPI ${v(gated[1])}+`, at(node)));
    else out.push(mark('error', `Invalid value '${x}'. Allowed: ${allowed.join(', ')}`, at(node)));
  };

  object(root, 'OpenAPI', START);
  return out;
}

// Semantic rules share one walk of the document (collect), memoised on ctx.
const at = (ctx, node) => range(ctx.lc, head(ctx.text, node.range));
const keyAt = (ctx, pair) => range(ctx.lc, pair.key.range);
const str = (map, key) => {
  const val = pairOf(map, key)?.value;
  return isScalar(val) && typeof val.value === 'string' ? val.value : undefined;
};
// ['components', kind, name, …] -> 'kind/name'
const compOf = (segs) => (segs?.[0] === 'components' && segs.length >= 3 ? `${segs[1]}/${segs[2]}` : null);
const add = (map, key, x) => (map.get(key) ?? map.set(key, []).get(key)).push(x);

function collect({ doc, ver, root }) {
  if (doc.errors.length || !ver || !isMap(root)) return null;
  const sem = { sites: [], ops: [], items: [], servers: [], secUses: [], mapping: [], discs: new Set(), alias: false };
  const walk = (node, path) => {
    if (isAlias(node)) sem.alias = true;
    if (isSeq(node)) return node.items.forEach((it, i) => walk(it, [...path, i]));
    if (!isMap(node)) return;
    const t = typeAt(path, ver);
    if (!t || t.kind === 'prim') return;
    if (t.kind !== 'obj') {
      for (const p of node.items) {
        if (keyOf(p) === '<<') sem.alias = true;
        else if (keyOf(p) != null) walk(p.value, [...path, keyOf(p)]);
      }
      return;
    }
    const type = t.type;
    if (type === 'Operation') sem.ops.push(node);
    else if (type === 'PathItem' && path.length === 2 && path[0] === 'paths') sem.items.push({ node, key: path[1] });
    else if (type === 'Server') sem.servers.push(node);
    else if (type === 'SecurityRequirement') sem.secUses.push(...node.items.filter((p) => keyOf(p) != null));
    else if (type === 'Discriminator') {
      const mp = pairOf(node, 'mapping')?.value;
      if (isMap(mp)) for (const p of mp.items) if (isScalar(p.value) && typeof p.value.value === 'string') sem.mapping.push({ value: p.value.value, path });
      const dm = str(node, 'defaultMapping');
      if (dm != null) sem.mapping.push({ value: dm, path });
      if (path.length === 4) sem.discs.add(compOf(path));
    }
    for (const p of node.items) {
      const key = keyOf(p);
      if (key === '<<') sem.alias = true;
      if (key == null || key === '<<') continue;
      const spec = member(type, key, ver)?.spec;
      if (!spec || spec.t === 'any') continue; // example, default, const, value and x- hold data, not references
      if (key === '$ref') {
        if (isScalar(p.value) && typeof p.value.value === 'string') sem.sites.push({ node: p.value, path, type });
      } else walk(p.value, [...path, key]);
    }
  };
  walk(root, []);
  return sem;
}

const semOf = (ctx) => (ctx.sem ??= collect(ctx));
// shortcut: aliases and << merge keys are not expanded, so the rules that read through them skip such documents; expand them if specs use anchors
const plainOf = (ctx) => (semOf(ctx)?.alias ? null : semOf(ctx));

export function refRule(ctx) {
  const sem = semOf(ctx);
  if (!sem) return [];
  const out = [];
  for (const s of sem.sites) {
    const ref = s.node.value;
    const segs = pointer(ref);
    if (!segs) continue; // external refs and a bare '#'
    if (!lookup(ctx.root, segs)) {
      out.push(mark('error', `Unresolved reference '${ref}'`, at(ctx, s.node)));
      continue;
    }
    const want = refKind(s.type, ctx.ver);
    if (want && segs.length === 3 && segs[0] === 'components' && segs[1] !== want && Object.hasOwn(OBJECTS.Components.fields, segs[1])) {
      out.push(mark('warning', `Expected a reference to components/${want}, but this points to components/${segs[1]}`, at(ctx, s.node)));
    }
  }
  return out;
}

export function pathParamRule(ctx) {
  const sem = plainOf(ctx);
  if (!sem) return [];
  const out = [];
  const err = (message, where) => out.push(mark('error', message, where));
  // one parameter list -> [{name, in, required, where}], each item dereferenced
  const params = (seq) =>
    (isSeq(seq) ? seq.items : []).flatMap((it) => {
      const n = deref(ctx.root, it);
      const name = isMap(n) ? str(n, 'name') : undefined;
      if (name == null) return [];
      const where = pairOf(it, '$ref') ? at(ctx, it) : at(ctx, pairOf(n, 'name').value);
      return [{ name, in: str(n, 'in'), required: pairOf(n, 'required')?.value?.value, where }];
    });
  // shortcut: a path item that is itself a $ref is not followed; follow it if specs use components.pathItems under paths
  for (const { node, key } of sem.items) {
    const names = [...key.matchAll(/\{([^}]+)\}/g)].map((mt) => mt[1]);
    const check = (list) => {
      const seen = new Map();
      for (const p of list) {
        add(seen, `${p.in}:${p.name}`, p);
        if (p.in !== 'path') continue;
        if (!names.includes(p.name)) err(`Path parameter '${p.name}' is not in the path '${key}'`, p.where);
        if (p.required !== true) err(`Path parameter '${p.name}' must have required: true`, p.where);
      }
      for (const dup of seen.values()) if (dup.length > 1) for (const p of dup) err(`Duplicate parameter '${p.name}' (in ${p.in})`, p.where);
    };
    // a $ref that does not resolve here (external, broken) may define a path parameter
    const opaque = (seq) => isSeq(seq) && seq.items.some((it) => pairOf(it, '$ref') && !isMap(deref(ctx.root, it)));
    const sharedOpaque = opaque(pairOf(node, 'parameters')?.value);
    const shared = params(pairOf(node, 'parameters')?.value);
    check(shared);
    const extra = pairOf(node, 'additionalOperations')?.value;
    const ops = [...node.items.filter((p) => METHODS.includes(keyOf(p))), ...(isMap(extra) ? extra.items : [])].filter((p) => isMap(p.value));
    for (const op of ops) {
      const own = params(pairOf(op.value, 'parameters')?.value);
      check(own);
      if (sharedOpaque || opaque(pairOf(op.value, 'parameters')?.value)) continue;
      const merged = new Map([...shared, ...own].map((p) => [`${p.in}:${p.name}`, p]));
      for (const n of names) if (!merged.has(`path:${n}`)) err(`Path '{${n}}' has no 'in: path' parameter named '${n}'`, keyAt(ctx, op));
    }
  }
  return out;
}

export function operationIdRule(ctx) {
  const sem = semOf(ctx);
  if (!sem) return [];
  const ids = new Map();
  for (const op of sem.ops) {
    const val = pairOf(op, 'operationId')?.value;
    if (isScalar(val) && val.value != null) add(ids, String(val.value), val);
  }
  return [...ids].flatMap(([id, nodes]) => (nodes.length > 1 ? nodes.map((n) => mark('error', `Duplicate operationId '${id}'`, at(ctx, n))) : []));
}

export function securityRule(ctx) {
  const sem = plainOf(ctx);
  if (!sem) return [];
  const defined = new Set(targets(ctx.root, 'securitySchemes'));
  // 3.2 allows a URI reference to a scheme as the key
  const uri = (k) => ctx.ver >= 32 && /[#/]/.test(k);
  return sem.secUses.filter((p) => !defined.has(keyOf(p)) && !uri(keyOf(p))).map((p) => mark('error', `Security scheme '${keyOf(p)}' is not defined in components.securitySchemes`, keyAt(ctx, p)));
}

export function tagRule(ctx) {
  const sem = semOf(ctx);
  const tags = pairOf(ctx.root, 'tags')?.value;
  if (!sem || !tags) return [];
  const declared = new Set(isSeq(tags) ? tags.items.map((t) => str(t, 'name')) : []);
  const out = [];
  for (const op of sem.ops) {
    const list = pairOf(op, 'tags')?.value;
    for (const t of isSeq(list) ? list.items : []) {
      if (isScalar(t) && typeof t.value === 'string' && !declared.has(t.value)) out.push(mark('info', `Tag '${t.value}' is used but not declared in tags`, at(ctx, t)));
    }
  }
  return out;
}

export function serverVarRule(ctx) {
  const sem = plainOf(ctx);
  if (!sem) return [];
  const out = [];
  for (const s of sem.servers) {
    const url = pairOf(s, 'url')?.value;
    if (!isScalar(url) || typeof url.value !== 'string') continue;
    const vars = pairOf(s, 'variables')?.value;
    for (const x of new Set([...url.value.matchAll(/\{([^}]+)\}/g)].map((mt) => mt[1]))) {
      if (!pairOf(vars, x)) out.push(mark('error', `Server variable '{${x}}' is not defined in 'variables'`, at(ctx, url)));
    }
  }
  return out;
}

export function unusedRule(ctx) {
  const sem = semOf(ctx);
  if (!sem) return [];
  const defined = new Map(); // 'kind/name' -> its name pair
  const comps = pairOf(ctx.root, 'components')?.value;
  for (const g of isMap(comps) ? comps.items : []) {
    if (!Object.hasOwn(OBJECTS.Components.fields, keyOf(g)) || !isMap(g.value)) continue;
    for (const p of g.value.items) if (keyOf(p) != null) defined.set(`${keyOf(g)}/${keyOf(p)}`, p);
  }
  const edges = new Map(); // owner ('kind/name', or null outside components) -> targets
  const edge = (owner, target) => target && add(edges, owner, target);
  for (const s of sem.sites) {
    const target = compOf(pointer(s.node.value));
    edge(compOf(s.path), target);
    // implicit discriminator: a child that allOf-refs a parent with a discriminator is selectable from the parent
    if (s.path.length === 5 && s.path[3] === 'allOf' && sem.discs.has(target)) edge(target, compOf(s.path));
  }
  for (const p of sem.secUses) edge(null, `securitySchemes/${keyOf(p)}`);
  for (const mp of sem.mapping) edge(compOf(mp.path), mp.value.startsWith('#') ? compOf(pointer(mp.value)) : `schemas/${mp.value}`);
  const reached = new Set();
  const queue = [...(edges.get(null) ?? [])];
  while (queue.length) {
    const c = queue.pop();
    if (reached.has(c)) continue;
    reached.add(c);
    queue.push(...(edges.get(c) ?? []));
  }
  return [...defined].filter(([c]) => !reached.has(c)).map(([c, p]) => mark('info', `Component '${c}' is never referenced`, keyAt(ctx, p)));
}

export const rules = [syntaxRule, versionRule, structureRule, refRule, pathParamRule, operationIdRule, securityRule, tagRule, serverVarRule, unusedRule];

// -> [{severity: 'error'|'warning'|'info', message, startLine, startCol, endLine, endCol}] sorted by position
export function validate(text) {
  const ctx = { ...parse(text), text };
  return rules.flatMap((r) => r(ctx)).sort((a, b) => a.startLine - b.startLine || a.startCol - b.startCol);
}
