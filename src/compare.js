import { parseDocument, LineCounter, isMap, isSeq, isScalar } from 'yaml';

const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

export function compare(leftText, rightText) {
  const L = parse(leftText, 'left');
  if (L.error) return L;
  const R = parse(rightText, 'right');
  if (R.error) return R;
  const changes = [];
  walk(L.data, R.data, { path: [], pl: [], pr: [], name: undefined, st: { changes, left: L.index, right: R.index } });
  return { changes };
}

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
    return { data: doc.toJS(), index: buildIndex(doc, lc) };
  } catch (e) {
    return fail(1, e.message.split('\n')[0]); // e.g. alias count limit
  }
}

function buildIndex(doc, lc) {
  const index = new Map([[JSON.stringify([]), 1]]);
  const visit = (node, path) => {
    if (isMap(node)) {
      for (const p of node.items) {
        if (!isScalar(p.key)) continue; // complex/null keys fall back to the parent's line
        const sub = [...path, String(p.key.value)];
        index.set(JSON.stringify(sub), lc.linePos(p.key.range[0]).line);
        visit(p.value, sub);
      }
    } else if (isSeq(node)) {
      node.items.forEach((item, i) => {
        const sub = [...path, i];
        if (item?.range) index.set(JSON.stringify(sub), lc.linePos(item.range[0]).line);
        visit(item, sub);
      });
    }
  };
  visit(doc.contents, []);
  return index;
}

function lineOf(index, path) {
  for (let i = path.length; i >= 0; i--) {
    const line = index.get(JSON.stringify(path.slice(0, i)));
    if (line) return line;
  }
  return 1;
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
  const name = ctx.name === undefined ? undefined : `${ctx.name}.${shown}`;
  return { ...ctx, name, path: [...ctx.path, shown], pl: [...ctx.pl, l], pr: [...ctx.pr, r] };
}

function emit(kind, text, ctx, side = kind === 'removed' ? 'left' : 'right') {
  const line = lineOf(ctx.st[side], side === 'left' ? ctx.pl : ctx.pr);
  ctx.st.changes.push({ kind, text, path: ctx.path.map(String), side, line });
}

function walk(l, r, ctx) {
  if (eq(l, r)) return;
  const p = ctx.path.join('.');
  if (l === undefined) return emit('added', `Added ${p}`, ctx);
  if (r === undefined) return emit('removed', `Removed ${p}`, ctx);
  if (isPlain(l) && isPlain(r)) return walkObject(l, r, ctx);
  if (Array.isArray(l) && Array.isArray(r)) {
    for (let i = 0; i < Math.max(l.length, r.length); i++) walk(l[i], r[i], child(ctx, i));
    return;
  }
  emit('changed', `Changed ${p}: ${fmt(l)} → ${fmt(r)}`, ctx);
}

function walkObject(l, r, ctx) {
  const P = ctx.path;
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
      for (const m of methods) emit(kind, `${verb} endpoint ${m.toUpperCase()} ${k}`, child(c, m));
    } else if (isPathItem && oneSided && METHODS.includes(k)) {
      emit(kind, `${verb} endpoint ${k.toUpperCase()} ${P[1]}`, c);
    } else if ((isPathItem || isOp) && k === 'parameters' && [lv, rv].every((v) => v === undefined || Array.isArray(v))) {
      walkParams(lv ?? [], rv ?? [], ctx);
    } else if (isResponses && oneSided) {
      emit(kind, `${verb} response ${k} on ${P[2].toUpperCase()} ${P[1]}`, c);
    } else if (isSchemas && oneSided) {
      emit(kind, `${verb} schema ${k}`, c);
    } else if (isSchemas) {
      walk(lv, rv, { ...c, name: k });
    } else if (k === 'properties' && [lv, rv].every((v) => v === undefined || isPlain(v))) {
      walkProps(lv ?? {}, rv ?? {}, ctx);
    } else if (k === 'required' && [lv, rv].every((v) => v === undefined || Array.isArray(v))) {
      walkRequired(lv ?? [], rv ?? [], ctx, l, r);
    } else {
      walk(lv, rv, c);
    }
  }
}

// undefined = not identifiable; such items are paired by position instead
const label = (p) =>
  !isPlain(p) ? undefined : p.$ref ? `$ref ${p.$ref}` : p.in != null && p.name != null ? `${p.in} '${p.name}'` : undefined;
const fromSchema = (p) => isPlain(p?.schema) && stype(p.schema) !== undefined;
const ptype = (p) => (fromSchema(p) ? stype(p.schema) : p?.type);

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

// Labeled items → Map(key → index); repeated labels get "#2", "#3"… so occurrences pair up in order.
function byLabel(arr) {
  const m = new Map();
  const rest = [];
  arr.forEach((p, i) => {
    const lab = label(p);
    if (lab === undefined) return rest.push(i);
    let key = lab;
    for (let n = 2; m.has(key); n++) key = `${lab}#${n}`;
    m.set(key, i);
  });
  return { m, rest };
}

function walkParams(lArr, rArr, ctx) {
  const P = ctx.path;
  const where = P.length === 3 ? `${P[2].toUpperCase()} ${P[1]}` : P[1];
  const { m: lm, rest: lRest } = byLabel(lArr);
  const { m: rm, rest: rRest } = byLabel(rArr);
  const pc = child(ctx, 'parameters');
  const labels = [...rm.keys(), ...[...lm.keys()].filter((k) => !rm.has(k))];

  for (const lab of labels) {
    const il = lm.get(lab);
    const ir = rm.get(lab);
    const lp = lArr[il];
    const rp = rArr[ir];
    const p = lp ?? rp;
    const shown = (p.$ref ? p.$ref : `${p.in}:${p.name}`) + lab.slice(label(p).length);
    const c = child(pc, shown, { l: il, r: ir });
    if (il === undefined) emit('added', `Added parameter ${lab} on ${where}`, c);
    else if (ir === undefined) emit('removed', `Removed parameter ${lab} on ${where}`, c);
    else {
      if (!!lp.required !== !!rp.required) {
        emit('changed', `Parameter ${lab} on ${where}: ${rp.required ? 'now required' : 'no longer required'}`, c);
      }
      if (!eq(ptype(lp), ptype(rp))) {
        emit('changed', `Parameter ${lab} on ${where}: type ${tfmt(ptype(lp))} → ${tfmt(ptype(rp))}`, c);
      }
      walk(stripParam(lp), stripParam(rp), c);
    }
  }
  for (let j = 0; j < Math.max(lRest.length, rRest.length); j++) {
    const il = lRest[j];
    const ir = rRest[j];
    walk(lArr[il], rArr[ir], child(pc, il ?? ir, { l: il, r: ir }));
  }
}

const owner = (ctx) => ctx.name ?? ctx.path.join('.');
const tkey = (s) => (isPlain(s) && s.type !== undefined ? 'type' : '$ref');
const stype = (s) => (isPlain(s) ? s[tkey(s)] : undefined);
const tfmt = (t) => (typeof t === 'string' || t === undefined ? String(t) : JSON.stringify(t));

// Strip only the key stype read, so a sibling $ref next to type still reaches the generic walk.
function stripSchema(s) {
  if (!isPlain(s)) return s;
  const { [tkey(s)]: _, ...rest } = s;
  return rest;
}

function walkProps(lProps, rProps, ctx) {
  const o = owner(ctx);
  const pc = child(ctx, 'properties');
  const names = [...Object.keys(rProps), ...Object.keys(lProps).filter((k) => !has(rProps, k))];

  for (const n of names) {
    const lv = get(lProps, n);
    const rv = get(rProps, n);
    const c = { ...child(pc, n), name: `${o}.${n}` };
    const t = stype(lv ?? rv);
    const suffix = t === undefined ? '' : ` (${tfmt(t)})`;
    if (lv === undefined) emit('added', `Added property ${o}.${n}${suffix}`, c);
    else if (rv === undefined) emit('removed', `Removed property ${o}.${n}${suffix}`, c);
    else {
      if (!eq(stype(lv), stype(rv))) emit('changed', `${o}.${n}: type ${tfmt(stype(lv))} → ${tfmt(stype(rv))}`, c);
      walk(stripSchema(lv), stripSchema(rv), c);
    }
  }
}

function walkRequired(lArr, rArr, ctx, lObj, rObj) {
  const o = owner(ctx);
  const ls = new Set(lArr);
  const rs = new Set(rArr);
  const props = (obj) => (isPlain(obj.properties) ? obj.properties : {});
  const lProps = props(lObj);
  const rProps = props(rObj);
  const at = (n, pr) => ({ ...ctx, path: [...ctx.path, 'required', String(n)], pr });

  rArr.forEach((n, i) => {
    if (!ls.has(n) && rArr.indexOf(n) === i) emit('changed', `${o}.${n}: now required`, at(n, [...ctx.pr, 'required', i]));
  });
  for (const n of ls) {
    // a name dropped together with its property is already reported as "Removed property"
    if (rs.has(n) || (has(lProps, n) && !has(rProps, n))) continue;
    const pr = has(rProps, n) ? [...ctx.pr, 'properties', n] : [...ctx.pr, 'required'];
    emit('changed', `${o}.${n}: no longer required`, at(n, pr));
  }
}
