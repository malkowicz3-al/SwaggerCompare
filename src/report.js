// Pure text views of a compare() result: title, summary line, by-endpoint rows, Markdown report.

// one value when only one side has it (e.g. the other spec isn't loaded yet)
const pair = (a, b) => (a == null || a === b ? (b ?? '') : b == null ? a : `${a} → ${b}`);

// "Orders API  1.4.0 → 2.0.0"; both titles when they differ; a side may be null
export function heading(meta) {
  const l = meta?.left ?? {};
  const r = meta?.right ?? {};
  const ver = (v) => v?.replace(/^v/i, ''); // same as the pane headers: "v2.0.0" and "2.0.0" read alike
  return [pair(l.title, r.title), pair(ver(l.version), ver(r.version))].filter(Boolean).join('  ');
}

const schemaOf = (p) => (p[0] === 'definitions' ? p[1] : p[0] === 'components' && p[1] === 'schemas' ? p[2] : undefined);

function counts(changes, ofKind, keyOf) {
  const added = new Set();
  const removed = new Set();
  const changed = new Set();
  for (const c of changes) {
    for (const k of keyOf(c)) {
      if (ofKind(c) && c.kind === 'added') added.add(k);
      else if (ofKind(c) && c.kind === 'removed') removed.add(k);
      else changed.add(k);
    }
  }
  const parts = [];
  if (added.size) parts.push(`${added.size} added`);
  if (removed.size) parts.push(`${removed.size} removed`);
  const n = [...changed].filter((k) => !added.has(k) && !removed.has(k)).length;
  if (n) parts.push(`${n} changed`);
  return parts.join(' · ');
}

// "Endpoints: 1 added · 2 removed · 3 changed · Schemas: 2 changed · ⚠ 5 breaking"; endpoints changed include those hit through schemas
export function summary(changes) {
  if (!changes.length) return 'No changes';
  const eps = counts(changes, (c) => c.tag === 'endpoint', (c) => c.affects.map((a) => a.endpoint));
  const schemaKey = (c) => (schemaOf(c.path) === undefined ? [] : [schemaOf(c.path)]);
  const sch = counts(changes, (c) => c.tag === 'schema', schemaKey);
  const nb = changes.filter((c) => c.breaking).length;
  return [eps && `Endpoints: ${eps}`, sch && `Schemas: ${sch}`, nb && `⚠ ${nb} breaking`].filter(Boolean).join(' · ');
}

// [{key: 'GET /orders', rows: [{c, text}]}] in first-seen order, 'Other' (changes hitting no endpoint) last;
// one row per endpoint and change, its vias joined ("request body, response 200 › currency: now required")
export function byEndpoint(changes) {
  const groups = new Map();
  const other = [];
  for (const c of changes) {
    if (!c.affects.length) other.push({ c, text: c.text });
    const vias = new Map();
    for (const a of c.affects) {
      if (!vias.has(a.endpoint)) vias.set(a.endpoint, []);
      if (a.via) vias.get(a.endpoint).push(a.via);
    }
    for (const [key, v] of vias) {
      if (!groups.has(key)) groups.set(key, { key, rows: [] });
      groups.get(key).rows.push({ c, text: v.length ? `${v.join(', ')} › ${c.text}` : c.text });
    }
  }
  return [...groups.values(), ...(other.length ? [{ key: 'Other', rows: other }] : [])];
}

const item = (text, c) => [`- ${c.breaking ? '⚠ ' : ''}${text}`, ...(c.details ?? []).map((d) => `  - ${d}`)];

export function markdown(res) {
  const title = `# ${heading(res.meta) || 'API changes'}`;
  if (res.error) return `${title}\n\nThe ${res.error.side} spec can't be parsed: line ${res.error.line}: ${res.error.message}\n`;
  const out = [title, '', summary(res.changes)];
  const breaking = res.changes.filter((c) => c.breaking);
  if (breaking.length) out.push('', '## Breaking', '', ...breaking.map((c) => `- ${c.where}: ${c.text}`));
  for (const g of byEndpoint(res.changes)) {
    const other = g.key === 'Other';
    out.push('', `## ${g.key}`, '', ...g.rows.flatMap(({ c, text }) => item(other ? `${c.where}: ${text}` : text, c)));
  }
  return out.join('\n') + '\n';
}
