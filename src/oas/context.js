// Where is the cursor in the OpenAPI tree? Works on valid and half-typed text, O(n), no parser.
// shortcut: YAML is read by indentation only, so flow style {a: 1}, multi-line plain/quoted scalars
// and nested `- - x` are not understood; upgrade to a tolerant CST walk if users hit these.
import { typeAt, verOf } from './model.js';
import { isJson } from './ast.js';

const KEY = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s"'#{[\]][^#]*?)\s*:(?=\s|$)/;
const BLOCK = /(?::\s*|(?:^|\s)-\s+)[|>][-+0-9]*\s*(?:#.*)?$/;

function unq(k) {
  if (k[0] === "'") return k.slice(1, -1).replace(/''/g, "'");
  if (k[0] === '"') {
    try {
      return JSON.parse(k);
    } catch {
      return k.slice(1, -1);
    }
  }
  return k.trimEnd();
}

// one entry per line: null (blank/comment), false (block scalar body), or {dash, kc, key, hasVal}
function scan(lines) {
  const out = [];
  let block = -1; // a block scalar body is indented deeper than this column
  for (const raw of lines) {
    const ind = raw.search(/\S/);
    if (block >= 0 && (ind < 0 || ind > block)) {
      out.push(ind < 0 ? null : false);
      continue;
    }
    block = -1;
    if (ind < 0 || raw[ind] === '#') {
      out.push(null);
      continue;
    }
    const d = /^( *)(-(?: +|$))?/.exec(raw);
    const dash = d[2] ? d[1].length : -1;
    const rest = raw.slice(d[0].length);
    const kc = dash >= 0 && !rest ? dash + 2 : d[0].length;
    const k = KEY.exec(rest);
    const key = k ? unq(k[1]) : null;
    out.push({ dash, kc, key, hasVal: k ? /^\s*[^\s#]/.test(rest.slice(k[0].length)) : rest !== '' });
    if (BLOCK.test(raw)) block = key != null ? kc : dash;
  }
  return out;
}

// index of the list item whose dash is on line j at column d
function itemIndex(info, j, d) {
  let n = 0;
  for (let i = j - 1; i >= 0; i--) {
    const L = info[i];
    if (!L) continue;
    const col = L.dash >= 0 ? L.dash : L.kc;
    if (col < d || (col === d && L.dash < 0)) break;
    if (L.dash === d) n++;
  }
  return n;
}

function parents(info, i0, c, dash) {
  const path = [];
  let allowEq = false;
  if (dash >= 0) {
    path.push(itemIndex(info, i0, dash));
    c = dash;
    allowEq = true;
  }
  for (let j = i0 - 1; j >= 0 && (c > 0 || allowEq); j--) {
    const L = info[j];
    if (!L || L.kc > c) continue;
    // with allowEq, `parameters:` at the same column as its `- name: x` items is the parent
    const parent = L.kc < c || (allowEq && L.key != null && !L.hasVal);
    if (parent) {
      if (L.key == null) continue;
      path.push(L.key);
    } else if (L.dash < 0) continue; // a sibling key
    if (L.dash >= 0) {
      path.push(itemIndex(info, j, L.dash));
      c = L.dash;
      allowEq = true;
    } else {
      c = L.kc;
      allowEq = false;
    }
  }
  return path.reverse();
}

function siblings(info, i0, c, dash) {
  const keys = new Set();
  if (dash < 0) {
    for (let j = i0 - 1; j >= 0; j--) {
      const L = info[j];
      if (!L || L.kc > c) continue;
      if (L.kc < c) break;
      if (L.key != null) keys.add(L.key);
      if (L.dash >= 0) break; // the first key of our list item
    }
  }
  for (let j = i0 + 1; j < info.length; j++) {
    const L = info[j];
    if (!L || L.kc > c) continue;
    if (L.kc < c || L.dash >= 0) break;
    if (L.key != null) keys.add(L.key);
  }
  return keys;
}

function yamlCtx(text, line, col) {
  const lines = text.split(/\r?\n/);
  const info = scan(lines);
  const i0 = line - 1;
  const raw = lines[i0] ?? '';
  if (info[i0] === false) return null; // inside a block scalar
  const m = /^( *)(- +)?(.*)$/.exec(raw.slice(0, col - 1));
  const dash = m[2] ? m[1].length : -1;
  const c = m[1].length + (m[2]?.length ?? 0);
  const k = KEY.exec(m[3]);
  const kv = k
    ? { position: 'value', key: unq(k[1]), prefix: m[3].slice(k[0].length).trimStart() }
    : { position: 'key', key: info[i0]?.key ?? null, prefix: m[3] };
  return { path: parents(info, i0, c, dash), keysPresent: siblings(info, i0, c, dash), ...kv, indent: c };
}

const JSON_TOKEN = /"(?:[^"\\\n]|\\.)*"?|[{}[\]:,]|[^\s{}[\]:,"]+/g;

function jsonCtx(text, line, col) {
  let off = 0;
  for (let l = 1; l < line && off >= 0; l++) off = text.indexOf('\n', off) + 1;
  off += col - 1;
  const stack = [{ kind: 'arr', idx: 0, keys: new Set(), expect: 'value' }]; // virtual root
  let snap = null;
  const take = (top, prefix, inKey) => {
    const position = top.kind === 'obj' && (inKey || top.expect !== 'value') ? 'key' : 'value';
    snap = {
      path: stack.slice(2).map((f) => f.key),
      frame: top,
      position,
      key: position === 'value' ? (top.kind === 'obj' ? top.pending : null) : null,
      prefix,
    };
  };
  JSON_TOKEN.lastIndex = 0;
  for (let mt; (mt = JSON_TOKEN.exec(text)); ) {
    const tok = mt[0];
    const s = mt.index;
    const e = s + tok.length;
    const top = stack[stack.length - 1];
    const open = tok[0] === '"' && (tok.length === 1 || tok[tok.length - 1] !== '"');
    let inside = false;
    if (!snap) {
      if (s >= off) take(top, '', false);
      else if (tok[0] === '"' && off < e + (open ? 1 : 0)) {
        inside = true;
        take(top, text.slice(s, off), top.kind === 'obj' && top.expect === 'key');
        if (snap.position === 'key') snap.key = unqJson(tok);
      } else if (!/^[{}[\]:,"]/.test(tok) && off <= e) {
        // cursor in or right after a bare token (`tr|`): complete it where it stands
        inside = true;
        take(top, text.slice(s, off), top.kind === 'obj' && top.expect === 'key');
      }
    }
    if (tok === '{' || tok === '[') {
      stack.push({ kind: tok === '{' ? 'obj' : 'arr', key: top.kind === 'obj' ? top.pending : top.idx, idx: 0, keys: new Set(), expect: tok === '{' ? 'key' : 'value' });
      top.expect = 'comma';
    } else if (tok === '}' || tok === ']') {
      if (stack.length > 1 && stack.pop() === snap?.frame) break;
    } else if (tok === ':') top.expect = 'value';
    else if (tok === ',') {
      top.expect = top.kind === 'obj' ? 'key' : 'value';
      if (top.kind === 'arr') top.idx++;
    } else if (top.kind === 'obj' && top.expect === 'key') {
      top.pending = unqJson(tok);
      if (!inside) top.keys.add(top.pending);
      top.expect = 'colon';
    } else top.expect = 'comma';
  }
  if (!snap) take(stack[stack.length - 1], '', false);
  return { path: snap.path, keysPresent: snap.frame.keys, position: snap.position, key: snap.key, prefix: snap.prefix, indent: 0 };
}

function unqJson(tok) {
  try {
    return JSON.parse(tok);
  } catch {
    return tok.replace(/^"|"$/g, '');
  }
}

// line, col: 1-based, cursor before the character at col
export function contextAt(text, line, col) {
  const json = isJson(text);
  const ctx = json ? jsonCtx(text, line, col) : yamlCtx(text, line, col);
  if (!ctx) return null;
  const version = verOf(text) ?? 32;
  const t = typeAt(ctx.path, version);
  return { ...ctx, objectType: t?.kind === 'obj' ? t.type : null, container: t && t.kind !== 'obj' ? t : null, version, json };
}
