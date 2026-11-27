import { isMap, isSeq, isScalar } from 'yaml';
import { parse, keyOf, pairOf } from './ast.js';

const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace', 'query'];

// -> [{label, kind, line, detail?, method?, children}]; works on partly broken documents
export function outline(text) {
  const { root, lc } = parse(text);
  if (!isMap(root)) return [];
  const line = (node) => lc.linePos(node.range[0]).line;
  const str = (map, key) => {
    const v = pairOf(map, key)?.value;
    return isScalar(v) && v.value != null ? String(v.value) : undefined;
  };
  const node = (label, kind, at, extra) => ({ label, kind, line: line(at), ...extra, children: extra?.children ?? [] });
  const pairs = (map) => (isMap(map) ? map.items.filter((p) => keyOf(p) != null) : []);
  const op = (p) => node(keyOf(p).toUpperCase(), 'operation', p.key, { method: keyOf(p).toLowerCase(), ...(str(p.value, 'summary') && { detail: str(p.value, 'summary') }) });
  const ops = (item) => [
    ...pairs(item).filter((p) => METHODS.includes(keyOf(p))).map(op),
    ...pairs(pairOf(item, 'additionalOperations')?.value).map(op),
  ];
  const out = [];
  for (const p of root.items) {
    const key = keyOf(p);
    const val = p.value;
    if (key === 'info') {
      const detail = [str(val, 'title'), str(val, 'version')].filter(Boolean).join(' ');
      out.push(node('Info', 'info', p.key, detail ? { detail } : undefined));
    } else if (key === 'servers' && isSeq(val)) {
      out.push(node('Servers', 'servers', p.key, { children: val.items.filter(isMap).map((s) => node(str(s, 'url') ?? '(no url)', 'server', s)) }));
    } else if (key === 'paths' || key === 'webhooks') {
      out.push(node(key === 'paths' ? 'Paths' : 'Webhooks', key, p.key, { children: pairs(val).map((q) => node(keyOf(q), 'path', q.key, { children: ops(q.value) })) }));
    } else if (key === 'components') {
      out.push(node('Components', 'components', p.key, { children: pairs(val).map((g) => node(keyOf(g), 'group', g.key, { children: pairs(g.value).map((c) => node(keyOf(c), 'component', c.key)) })) }));
    } else if (key === 'tags' && isSeq(val)) {
      out.push(node('Tags', 'tags', p.key, { children: val.items.filter(isMap).map((t) => node(str(t, 'name') ?? '(no name)', 'tag', t)) }));
    }
  }
  return out;
}
