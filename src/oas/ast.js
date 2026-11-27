import { parseDocument, LineCounter, isMap, isSeq, isScalar } from 'yaml';
import { verOf } from './model.js';
import { pointer } from '../compare.js';

export const isJson = (text) => /^\s*[{[]/.test(text);

export function parse(text) {
  const lc = new LineCounter();
  const doc = parseDocument(text, { lineCounter: lc });
  return { doc, lc, ver: verOf(text), json: isJson(text), root: doc.contents };
}

// offsets [s, e] -> 1-based positions, end exclusive
export function range(lc, [s, e]) {
  const a = lc.linePos(s);
  const b = lc.linePos(e);
  return { startLine: a.line, startCol: a.col, endLine: b.line, endCol: b.col };
}

// node offsets cut to its first line, so a block value is not underlined whole
export const head = (text, [s, e]) => {
  const eol = text.indexOf('\n', s);
  return [s, eol < 0 ? e : Math.min(e, eol)];
};

export const keyOf = (pair) => (isScalar(pair.key) && pair.key.value != null ? String(pair.key.value) : null);

export const pairOf = (map, key) => (isMap(map) ? map.items.find((p) => keyOf(p) === key) : undefined);

// the node at a JSON pointer's segments -> {pair?, node} | undefined; pair is the last map entry on the way
export function lookup(root, segs) {
  let node = root;
  let pair;
  for (const seg of segs) {
    if (isMap(node)) {
      pair = pairOf(node, seg);
      if (!pair) return undefined;
      node = pair.value;
    } else if (isSeq(node) && /^\d+$/.test(seg) && node.items[Number(seg)]) {
      pair = undefined;
      node = node.items[Number(seg)];
    } else return undefined;
  }
  return { pair, node };
}

// a map holding a local string $ref -> its target node (chains followed, at most 10 hops); undefined if unresolved
export function deref(root, node) {
  for (let hop = 0; hop <= 10; hop++) {
    const ref = pairOf(node, '$ref')?.value;
    if (!isScalar(ref) || typeof ref.value !== 'string') return node;
    const segs = pointer(ref.value);
    node = segs && lookup(root, segs)?.node;
    if (!node) return undefined;
  }
  return undefined;
}

// JSON.parse rounds integers beyond 2^53 (int64 limits, ids), so refuse rather than change them
export function formatJson(text) {
  const big = text.replace(/"(?:[^"\\]|\\.)*"/g, '""').match(/(?<![\d.])-?\d+(?![\d.eE])/g)?.find((n) => !Number.isSafeInteger(Number(n)));
  if (big) throw new Error(`Not formatted: ${big} is too large for a JavaScript number and would change`);
  return JSON.stringify(JSON.parse(text), null, 2) + '\n';
}
