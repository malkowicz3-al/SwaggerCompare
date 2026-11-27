import { isMap, isSeq, isScalar, isAlias } from 'yaml';
import { OBJECTS, active, kindsOf, member, enumOf, itemSpec } from './model.js';
import { parse, range, head, keyOf, pairOf } from './ast.js';

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

export const rules = [syntaxRule, versionRule, structureRule];

// -> [{severity: 'error'|'warning', message, startLine, startCol, endLine, endCol}] sorted by position
export function validate(text) {
  const ctx = { ...parse(text), text };
  return rules.flatMap((r) => r(ctx)).sort((a, b) => a.startLine - b.startLine || a.startCol - b.startCol);
}
