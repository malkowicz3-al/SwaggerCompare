import { parseDocument, LineCounter, isMap, isScalar } from 'yaml';
import { verOf } from './model.js';

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

// JSON.parse rounds integers beyond 2^53 (int64 limits, ids), so refuse rather than change them
export function formatJson(text) {
  const big = text.replace(/"(?:[^"\\]|\\.)*"/g, '""').match(/(?<![\d.])-?\d+(?![\d.eE])/g)?.find((n) => !Number.isSafeInteger(Number(n)));
  if (big) throw new Error(`Not formatted: ${big} is too large for a JavaScript number and would change`);
  return JSON.stringify(JSON.parse(text), null, 2) + '\n';
}
