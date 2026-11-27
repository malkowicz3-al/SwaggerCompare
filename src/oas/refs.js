// Local $ref helpers for the editor: the ref under the cursor, its target, a hover summary. Pure, no DOM.
import { isMap } from 'yaml';
import { parse, lookup, deref, pairOf, keyOf } from './ast.js';
import { pointer } from '../compare.js';

// the local $ref value under the cursor -> {ref, from, to} (1-based columns, to exclusive) or null
// shortcut: one line at a time, so a $ref split over lines is missed; upgrade to an AST lookup if that shows up
export function refAt(text, line, col) {
  const raw = text.split(/\r?\n/)[line - 1] ?? '';
  const re = /(["']?)\$ref\1\s*:\s*(["'])?(#[^"'\s,}]*)\2?/g;
  for (let mt; (mt = re.exec(raw)); ) {
    const from = mt.index + mt[0].indexOf('#') + 1;
    const to = from + mt[3].length;
    if (from <= col && col <= to) return { ref: mt[3], from, to };
  }
  return null;
}

// the names under components.<kind>
export function targets(root, kind) {
  const sec = pairOf(pairOf(root, 'components')?.value, kind)?.value;
  return isMap(sec) ? sec.items.map(keyOf).filter((k) => k != null) : [];
}

const resolveAt = (text, line, col) => {
  const hit = refAt(text, line, col);
  const segs = hit && pointer(hit.ref);
  if (!segs) return null;
  const p = parse(text);
  return { hit, segs, p, found: lookup(p.root, segs) };
};

// Go to definition: the start of the target's key (or of the item, for a list item) -> {line, col} or null
export function definitionAt(text, line, col) {
  const r = resolveAt(text, line, col);
  if (!r?.found) return null;
  const pos = r.p.lc.linePos((r.found.pair?.key ?? r.found.node).range[0]);
  return { line: pos.line, col: pos.col };
}

const cut = (s, n = 120) => ((s = s.replace(/\s*\n\s*/g, ' ').trim()), s.length > n ? s.slice(0, n - 1) + '…' : s);
const typeOf = (s) => (s && typeof s === 'object' ? [s.type].flat().filter(Boolean).join(' | ') || (typeof s.$ref === 'string' ? s.$ref.split('/').pop() : '') : '');

// hover on a $ref -> {title, kind, rows, from, to} or null when unresolved
export function refHover(text, line, col) {
  const r = resolveAt(text, line, col);
  const node = r?.found && deref(r.p.root, r.found.node);
  if (!node) return null;
  const v = node.toJS(r.p.doc);
  const kind = r.segs[0] === 'components' ? r.segs[1] : r.segs[0];
  const o = v && typeof v === 'object' ? v : {};
  const str = (x) => (typeof x === 'string' ? x : '');
  let rows;
  if (kind === 'schemas') {
    const props = o.properties && typeof o.properties === 'object' ? Object.entries(o.properties).slice(0, 5) : [];
    rows = [str(o.title), cut(str(o.description)), typeOf(o) && `type: ${typeOf(o)}`, ...props.map(([k, p]) => `${k}: ${typeOf(p) || 'any'}`)];
  } else if (kind === 'parameters') {
    rows = [o.in && `in: ${o.in}`, o.required === true && 'required: true'];
  } else rows = [cut(str(o.summary) || str(o.description))];
  return { title: r.segs.at(-1), kind, rows: rows.filter(Boolean), from: r.hit.from, to: r.hit.to };
}
