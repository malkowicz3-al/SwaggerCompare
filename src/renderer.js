import { compare } from './compare.js';
import { heading, summary, byEndpoint, markdown } from './report.js';

const base = new URL('../vendor/monaco/', location.href).href;
// under file:// (SwaggerCompare.bat) a worker can't load file URLs; throwing here makes Monaco
// quietly run its diff in the main thread instead of failing a worker first
self.MonacoEnvironment = {
  getWorkerUrl: () => {
    if (location.protocol === 'file:') throw new Error('no workers under file://');
    return URL.createObjectURL(
      new Blob([`self.MonacoEnvironment={baseUrl:'${base}'};importScripts('${base}vs/base/worker/workerMain.js');`], {
        type: 'text/javascript',
      }),
    );
  },
};

window.require.config({ paths: { vs: base + 'vs' } });
window.require(['vs/editor/editor.main'], init);

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const GLYPH = { added: '+', removed: '−', changed: '~' };
const SIDE = { left: 'Original', right: 'Modified' };
const ROUTE = /\b(GET|PUT|POST|DELETE|OPTIONS|HEAD|PATCH|TRACE) (\/\S*)/;

function specLabel(text) {
  const m = text.match(/^\s*["']?(swagger|openapi)["']?\s*:\s*["']?([\w.-]+)/m);
  return m ? `${m[1] === 'swagger' ? 'Swagger' : 'OpenAPI'} ${m[2]}` : text.trim() ? 'Not a spec?' : '';
}

// "GET /users" rendered as a method pill + route
function richText(text, cls = 'text') {
  const span = el('span', cls);
  const m = text.match(ROUTE);
  if (!m) return (span.textContent = text), span;
  span.append(
    text.slice(0, m.index),
    el('span', `method m-${m[1].toLowerCase()}`, m[1]),
    el('span', 'route', m[2]),
    text.slice(m.index + m[0].length),
  );
  return span;
}

function defineTheme() {
  monaco.editor.defineTheme('swagger-compare', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'type', foreground: '8db4ff' },
      { token: 'string', foreground: 'c3d0e6' },
      { token: 'number', foreground: 'f2b84b' },
      { token: 'keyword', foreground: 'c792ea' },
      { token: 'comment', foreground: '5d6a84', fontStyle: 'italic' },
    ],
    colors: {
      'editor.background': '#151e31',
      'editor.foreground': '#e4e9f2',
      'editorLineNumber.foreground': '#3e4a66',
      'editorLineNumber.activeForeground': '#8a96ae',
      'editor.lineHighlightBackground': '#1b264080',
      'editor.lineHighlightBorder': '#00000000',
      'editor.selectionBackground': '#8db4ff33',
      'editorCursor.foreground': '#8db4ff',
      'editorIndentGuide.background1': '#25304a',
      'editorGutter.background': '#151e31',
      'diffEditor.insertedLineBackground': '#3ecf8e14',
      'diffEditor.insertedTextBackground': '#3ecf8e33',
      'diffEditor.removedLineBackground': '#ff6b7a14',
      'diffEditor.removedTextBackground': '#ff6b7a38',
      'diffEditorGutter.insertedLineBackground': '#3ecf8e22',
      'diffEditorGutter.removedLineBackground': '#ff6b7a22',
      'diffEditor.diagonalFill': '#25304a80',
      'diffEditor.border': '#25304a',
      'scrollbarSlider.background': '#25304a99',
      'scrollbarSlider.hoverBackground': '#334064',
      'editorOverviewRuler.border': '#00000000',
      'editorWidget.background': '#1b2640',
      'editorWidget.border': '#25304a',
      focusBorder: '#00000000',
    },
  });
}

function init() {
  defineTheme();
  const diff = monaco.editor.createDiffEditor($('editor'), {
    theme: 'swagger-compare',
    originalEditable: true,
    renderSideBySide: true,
    useInlineViewWhenSpaceIsLimited: false, // jump-to-left needs the original editor visible
    enableSplitViewResizing: false, // keeps panes aligned with their headers
    renderMarginRevertIcon: false,
    renderGutterMenu: false,
    automaticLayout: true,
    ignoreTrimWhitespace: false,
    fontFamily: "'JetBrains Mono', Consolas, monospace",
    fontSize: 13,
    lineHeight: 20,
    fontLigatures: false,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    renderOverviewRuler: false,
    padding: { top: 10 },
    renderLineHighlight: 'line',
    scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
  });
  document.fonts.ready.then(() => monaco.editor.remeasureFonts());

  const models = { left: monaco.editor.createModel('', 'yaml'), right: monaco.editor.createModel('', 'yaml') };
  diff.setModel({ original: models.left, modified: models.right });
  const editors = { left: diff.getOriginalEditor(), right: diff.getModifiedEditor() };
  const files = { left: null, right: null };
  const list = $('list');
  const state = $('state');
  let result = null; // last successful compare, for filtering
  let liveTimer;
  let hidden = new Set();
  const open = new Set(); // where of expanded groups (collapsed by default); survives re-runs
  const tagsOn = new Set();
  let breakOnly = false;
  let view = 'objects'; // or 'endpoints'
  const meta = { left: null, right: null }; // last good {title, version} per side, so a parse error doesn't flicker it
  let rows = []; // {li, btn, c, g, show}, in list order; in the endpoint view a change can have several rows
  let groups = []; // {where, li, head, ol, rows}

  const renderMeta = () => {
    for (const side of ['left', 'right']) {
      const m = meta[side];
      const t = $(`title-${side}`);
      // "Orders API · v1.4.0"; a spec version "v2" isn't shown as "vv2"
      t.textContent = [m?.title, m?.version && `v${m.version.replace(/^v/i, '')}`].filter(Boolean).join(' · ');
      t.title = t.textContent;
      t.hidden = !t.textContent;
    }
    const v = $('versions');
    v.textContent = v.title = heading(meta);
    v.hidden = !v.textContent;
  };

  // Pane header: file name + detected spec version
  const refreshHead = (side) => {
    const text = models[side].getValue();
    $(`file-${side}`).textContent = files[side] ?? (text.trim() ? 'Pasted text' : 'Empty');
    const spec = $(`spec-${side}`);
    spec.textContent = specLabel(text);
    spec.hidden = !spec.textContent;
    spec.classList.toggle('bad', spec.textContent === 'Not a spec?');
  };

  // m: the side's known meta (swap moves it along); a new or cleared file starts without the previous file's title
  const load = (side, text, name, m = null) => {
    files[side] = name;
    meta[side] = m;
    renderMeta();
    // an undoable edit (setValue would wipe undo), so Ctrl+Z recovers from an accidental clear/drop/swap
    const ed = editors[side];
    ed.pushUndoStop();
    ed.executeEdits('load', [{ range: models[side].getFullModelRange(), text }]);
    ed.pushUndoStop();
    refreshHead(side);
  };

  for (const side of ['left', 'right']) {
    const node = editors[side].getContainerDomNode();
    const hint = el('div', 'hint');
    hint.append(el('b', null, side === 'left' ? 'Paste the original spec' : 'Paste the modified spec'), el('span', null, 'or drop a YAML or JSON file here'));
    const drop = el('div', 'drop', `Drop to load as ${SIDE[side].toLowerCase()}`);
    node.append(hint, drop);

    let dropTimer;
    node.addEventListener(
      'dragover',
      (e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        drop.classList.add('on');
        clearTimeout(dropTimer);
        dropTimer = setTimeout(() => drop.classList.remove('on'), 120);
      },
      true,
    );
    node.addEventListener(
      'drop',
      async (e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        e.stopPropagation();
        drop.classList.remove('on');
        const file = e.dataTransfer.files[0];
        if (file) load(side, await file.text(), file.name);
      },
      true,
    );

    models[side].onDidChangeContent(() => {
      hint.hidden = models[side].getValueLength() > 0;
      if (!models[side].getValueLength()) files[side] = null;
      refreshHead(side);
      clearTimeout(liveTimer);
      liveTimer = setTimeout(run, 300); // live compare, debounced while typing
    });
  }
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => e.preventDefault());

  // Open / clear / swap
  const input = $('file-input');
  let openSide = 'left';
  document.querySelectorAll('[data-open]').forEach((b) =>
    b.addEventListener('click', () => {
      openSide = b.dataset.open;
      input.value = '';
      input.click();
    }),
  );
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (file) load(openSide, await file.text(), file.name);
  });
  document.querySelectorAll('[data-clear]').forEach((b) => b.addEventListener('click', () => load(b.dataset.clear, '', null)));
  $('swap').addEventListener('click', () => {
    const [l, r] = [models.left.getValue(), models.right.getValue()];
    const [fl, fr] = [files.left, files.right];
    const [ml, mr] = [meta.left, meta.right];
    load('left', r, fr, mr);
    load('right', l, fl, ml);
  });

  // the selected change's fragment in both editors; an inexact side only marks the nearest ancestor's line
  const hl = { left: editors.left.createDecorationsCollection(), right: editors.right.createDecorationsCollection() };
  // the changed object's or parameter's name, flashed briefly when the user moves to a change
  const flash = { left: editors.left.createDecorationsCollection(), right: editors.right.createDecorationsCollection() };
  let flashTimer;
  const clearFlash = () => {
    clearTimeout(flashTimer);
    flash.left.clear();
    flash.right.clear();
  };
  const clearHl = () => {
    hl.left.clear();
    hl.right.clear();
    clearFlash();
  };
  const showHl = (c, reveal) => {
    clearFlash();
    for (const side of ['left', 'right']) {
      const r = c[side];
      const ed = editors[side];
      const options = r.exact ? { isWholeLine: true, className: 'hl', linesDecorationsClassName: 'hl-bar' } : { isWholeLine: true, className: 'hl-anchor' };
      hl[side].set([{ range: new monaco.Range(r.start, 1, r.end, 1), options }]);
      const k = c.flash[side];
      if (reveal && k) flash[side].set([{ range: new monaco.Range(k.line, k.from, k.line, k.to), options: { inlineClassName: 'name-flash' } }]);
      // only the primary side scrolls: the diff editor syncs the other, and a second reveal would win
      if (!reveal || side !== c.side) continue;
      const rows = Math.floor(ed.getLayoutInfo().height / ed.getOption(monaco.editor.EditorOption.lineHeight));
      if (r.end - r.start + 1 > rows) ed.revealLineNearTop(r.start);
      else ed.revealLinesInCenterIfOutsideViewport(r.start, r.end);
    }
    if (reveal) flashTimer = setTimeout(clearFlash, 1600); // just past the 1.5 s CSS fade
  };

  const jump = (side, line) => {
    const ed = editors[side];
    ed.revealLineInCenter(line);
    ed.setPosition({ lineNumber: line, column: 1 });
    ed.focus();
  };

  const showState = (kind, title, text, action) => {
    state.className = `state ${kind}`;
    state.hidden = false;
    const icon = {
      idle: '<path d="M8 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2M16 4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2M12 8v8M8 12h8"/>',
      ok: '<path d="M5 12.5 10 17l9-10"/>',
      err: '<path d="M12 8v5M12 16.5v.01"/><path d="M10.3 4.2 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z"/>',
    }[kind];
    // icon markup is a constant above, never user text
    state.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>`;
    state.append(el('p', 'state-title', title));
    const p = el('p', 'state-text');
    p.append(...text);
    state.append(p);
    if (action) {
      const b = el('button', 'show-line', action.label);
      b.addEventListener('click', action.run);
      state.append(b);
    }
  };

  const filtering = () => !!(hidden.size || tagsOn.size || breakOnly || $('search').value.trim());

  // header shows counts and tags of the group's visible items only
  const renderHead = (g, vis) => {
    const n = { added: 0, removed: 0, changed: 0 };
    const tags = [];
    for (const r of vis) {
      n[r.c.kind]++;
      if (!tags.includes(r.c.tag)) tags.push(r.c.tag);
    }
    const mini = el('span', 'gmini');
    for (const k in n) if (n[k]) mini.append(el('span', k, GLYPH[k] + n[k]));
    const said = Object.keys(n).filter((k) => n[k]).map((k) => `${n[k]} ${k}`);
    const nb = vis.filter((r) => r.c.breaking).length;
    if (nb) said.push(`${nb} breaking`);
    g.head.setAttribute('aria-label', `${g.where}, ${vis.length} change${vis.length === 1 ? '' : 's'}: ${said.join(', ')}`);
    g.head.replaceChildren(el('span', 'chev'), richText(g.where, 'gwhere'), el('span', 'gcount', vis.length), mini, el('span', 'gtags', tags.join(' · ')));
  };

  const applyFilters = () => {
    const q = $('search').value.trim().toLowerCase();
    $('list-none')?.remove();
    for (const r of rows) {
      r.show = !hidden.has(r.c.kind) && (!tagsOn.size || tagsOn.has(r.c.tag)) && (!breakOnly || r.c.breaking) && (!q || r.li._haystack.includes(q));
      r.li.hidden = !r.show;
    }
    // with a filter on, every matching group is expanded
    const filtered = filtering();
    for (const g of groups) {
      const vis = g.rows.filter((r) => r.show);
      renderHead(g, vis);
      g.li.hidden = !vis.length;
      const isOpen = filtered || open.has(g.where);
      g.ol.hidden = !isOpen;
      g.head.setAttribute('aria-expanded', String(isOpen));
    }
    const all = groups.length > 0 && groups.every((g) => !open.has(g.where));
    const ta = $('toggle-all');
    ta.title = all ? 'Expand all' : 'Collapse all';
    ta.setAttribute('aria-label', ta.title);
    ta.dataset.collapsed = String(all);
    ta.disabled = filtered;
    if (result?.changes.length && !rows.some((r) => r.show)) {
      const none = el('li', 'none', 'No changes match the filter.');
      none.id = 'list-none';
      list.append(none);
    }
    updatePos();
  };

  const updatePos = () => {
    const vis = rows.filter((r) => r.show);
    const i = vis.findIndex((r) => r.btn === selected);
    $('pos').textContent = `${i < 0 ? '–' : i + 1} / ${vis.length}`;
    $('prev').disabled = $('next').disabled = !vis.length;
  };

  const toggleGroup = (g) => {
    if (!filtering()) open[open.has(g.where) ? 'delete' : 'add'](g.where);
    applyFilters();
    const first = g.rows.find((r) => r.show);
    if (!g.ol.hidden && first) select(first.btn, false);
  };

  const nav = (dir) => {
    const vis = rows.filter((r) => r.show);
    if (!vis.length) return;
    const i = vis.findIndex((r) => r.btn === selected);
    const t = i < 0 ? vis[dir > 0 ? 0 : vis.length - 1] : vis[(i + dir + vis.length) % vis.length];
    open.add(t.g.where);
    applyFilters();
    select(t.btn, false);
  };

  // the reader's place in the list; survives re-runs that end in a parse error or empty side
  const keyOf = (c) => `${c.kind}|${c.where}|${c.text}|${c.path.join('/')}`;
  let selected = null;
  let selKey = null;
  const expanded = new Set(); // keyOf of entries whose details are open
  let lastScroll = 0;

  function run(openSelected = false) {
    clearHl();
    clearTimeout(liveTimer);
    if (result) lastScroll = list.scrollTop;
    selected = null;
    list.replaceChildren();
    rows = [];
    groups = [];
    result = null;
    $('filters').hidden = $('search-wrap').hidden = $('nav').hidden = $('tagbar').hidden = $('toolbar').hidden = $('summary').hidden = true;
    $('total').textContent = '';

    const [l, r] = [models.left.getValue(), models.right.getValue()];
    // compare() also parses a lone spec (the empty side is an error), which gives that side's title and version
    const res = l.trim() || r.trim() ? compare(l, r) : null;
    for (const [side, text] of [['left', l], ['right', r]]) {
      if (!text.trim()) meta[side] = null;
      else if (res.meta[side]) meta[side] = res.meta[side];
    }
    renderMeta();
    if (!l.trim() || !r.trim()) {
      const missing = !l.trim() && !r.trim() ? 'both specs' : !l.trim() ? 'the original spec' : 'the modified spec';
      showState('idle', 'Two specs, one list of changes', [`Paste or drop ${missing}. Changes appear here as you type.`]);
      return;
    }
    if (res.error) {
      const { side, line, message } = res.error;
      // no auto-jump: the user may be mid-typing
      showState('err', `The ${SIDE[side].toLowerCase()} spec can't be parsed`, [`Line ${line}: `, el('code', null, message.replace(/ at line \d+, column \d+:?$/, ''))], {
        label: 'Show line',
        run: () => jump(side, line),
      });
      return;
    }
    if (!res.changes.length) {
      showState('ok', 'No structural differences', ['Both specs describe the same API. Formatting and key order may still differ in the editor.']);
      return;
    }

    result = res;
    state.hidden = true;
    const counts = { added: 0, removed: 0, changed: 0 };
    for (const c of res.changes) counts[c.kind]++;
    const index = new Map(res.changes.map((c, i) => [c, i]));
    // one entry per row: a change under its object, or under every endpoint it hits
    const entries =
      view === 'endpoints'
        ? byEndpoint(res.changes).flatMap((g) => g.rows.map((row) => ({ key: g.key, ...row })))
        : res.changes.map((c) => ({ key: c.where, c, text: c.text }));
    const byKey = new Map();
    entries.forEach(({ key, c, text }, n) => {
      let g = byKey.get(key);
      if (!g) {
        g = { where: key, li: el('li', 'group'), head: el('button', 'ghead'), ol: el('ol', 'gitems'), rows: [] };
        g.head.type = 'button';
        g.ol.id = `grp-${groups.length}`;
        g.head.setAttribute('aria-controls', g.ol.id);
        g.head.addEventListener('click', () => toggleGroup(g));
        g.li.append(g.head, g.ol);
        byKey.set(key, g);
        groups.push(g);
        list.append(g.li);
      }
      const li = el('li');
      li._change = c;
      const hits = c.affects.flatMap((a) => [a.endpoint, a.via ?? '']);
      li._haystack = [c.tag, c.text, c.where, c.path.join(' '), ...(c.details ?? []), c.breaking ? 'breaking' : '', ...hits].join(' ').toLowerCase();
      const b = el('button', `item ${c.kind}${c.breaking ? ' breaking' : ''}`);
      b.title = `${c.path.join(' › ')}\n${SIDE[c.side]}, line ${c.line}${c.breaking ? '\nBreaking change' : ''}`;
      b.dataset.i = index.get(c);
      const body = el('div');
      if (c.breaking) {
        const w = el('span', 'warn', '⚠');
        w.setAttribute('role', 'img');
        w.setAttribute('aria-label', 'Breaking');
        body.append(w);
      }
      body.append(el('span', c.tag === 'refactor' ? 'tag tag-refactor' : 'tag', c.tag), el('span', 'text', text));
      b.append(el('span', 'glyph', GLYPH[c.kind]), body);
      b.addEventListener('click', () => select(b, true));
      li.append(b);
      if (c.details) {
        const isOpen = expanded.has(keyOf(c));
        const tog = el('button', 'tog');
        tog.type = 'button';
        tog.setAttribute('aria-expanded', String(isOpen));
        tog.setAttribute('aria-controls', `det-${n}`);
        tog.append(el('span', 'chev'), `Details (${c.details.length})`);
        const d = el('div', 'details');
        d.id = `det-${n}`;
        d.hidden = !isOpen;
        d.append(...c.details.map((t) => el('div', 'detail', t)));
        tog.addEventListener('click', () => {
          d.hidden = !d.hidden;
          tog.setAttribute('aria-expanded', String(!d.hidden));
          expanded[d.hidden ? 'delete' : 'add'](keyOf(c));
        });
        li.append(tog, d);
      }
      g.ol.append(li);
      const row = { li, btn: b, c, g, show: true };
      rows.push(row);
      g.rows.push(row);
    });
    for (const k in counts) $(`n-${k}`).textContent = counts[k];
    $('total').textContent = res.changes.length;
    const nb = res.changes.filter((c) => c.breaking).length;
    $('n-breaking').textContent = nb;
    $('breaking').disabled = !nb && !breakOnly;
    $('summary').textContent = summary(res.changes);

    const tagCount = new Map();
    for (const c of res.changes) tagCount.set(c.tag, (tagCount.get(c.tag) ?? 0) + 1);
    // a selected tag missing from this run keeps a 0 chip, so a transient state while typing doesn't drop it
    for (const t of tagsOn) if (!tagCount.has(t)) tagCount.set(t, 0);
    const toggleAll = $('toggle-all');
    $('tagbar').replaceChildren(
      ...[...tagCount]
        .sort((a, b) => b[1] - a[1])
        .map(([t, n]) => {
          const chip = el('button', 'tchip', `${t} `);
          chip.type = 'button';
          chip.dataset.tag = t;
          chip.setAttribute('aria-pressed', String(tagsOn.has(t)));
          chip.append(el('b', null, n));
          return chip;
        }),
      toggleAll,
    );
    $('filters').hidden = $('search-wrap').hidden = $('nav').hidden = $('tagbar').hidden = $('toolbar').hidden = $('summary').hidden = false;
    // the same row (group + change), else the change's first row (e.g. after switching views); its group is opened only on a view switch, so a group the user collapsed stays collapsed while typing
    const want =
      selKey && (rows.find((r) => r.g.where === selKey.where && keyOf(r.c) === selKey.key) ?? rows.find((r) => keyOf(r.c) === selKey.key));
    if (want && openSelected) open.add(want.g.where);
    applyFilters();
    if (selKey) {
      const again = want?.show ? want : null;
      if (again) {
        (selected = again.btn).classList.add('sel');
        showHl(again.c, false); // no scroll while typing
      }
      updatePos();
    }
    list.scrollTop = lastScroll;
  }

  const setView = (v) => {
    view = v;
    document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
    run(true);
    if (selected) selected.scrollIntoView({ block: 'center' });
    else list.scrollTop = 0;
  };

  // navigator.clipboard is missing or refused in some contexts (file:// in an Edge app window); fall back to execCommand
  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = el('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    }
  };
  let copyTimer;
  $('copy').addEventListener('click', async () => {
    const b = $('copy');
    if (!result) return;
    const ok = await copyText(markdown(result));
    b.focus(); // the fallback textarea took it
    b.textContent = ok ? 'Copied' : 'Copy failed';
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => (b.textContent = 'Copy report'), 1500);
  });
  document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => view !== b.dataset.view && setView(b.dataset.view)));
  $('breaking').addEventListener('click', () => {
    breakOnly = !breakOnly;
    $('breaking').setAttribute('aria-pressed', String(breakOnly));
    applyFilters();
  });

  const select = (b, focusEditor) => {
    selected?.classList.remove('sel');
    selected = b;
    const row = rows.find((r) => r.btn === b);
    selKey = { where: row.g.where, key: keyOf(row.c) };
    b.classList.add('sel');
    b.scrollIntoView({ block: 'nearest' });
    const c = b.parentElement._change;
    const ed = editors[c.side];
    ed.setPosition({ lineNumber: c.line, column: 1 });
    showHl(c, true);
    if (focusEditor) ed.focus();
    updatePos();
  };

  // ↑/↓ walk the visible group headers and items without leaving the list
  list.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const btns = [...list.querySelectorAll('.ghead, .item')].filter((b) => b.offsetParent);
    const a = document.activeElement;
    // from a Details toggle, count from its own entry
    const i = btns.indexOf(a.closest('.ghead') ?? a.closest('li')?.querySelector('.item'));
    const next = btns[Math.max(0, Math.min(btns.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
    if (!next) return;
    next.focus();
    if (next.classList.contains('item')) select(next, false);
  });

  $('toggle-all').addEventListener('click', () => {
    const all = groups.every((g) => !open.has(g.where));
    for (const g of groups) open[all ? 'add' : 'delete'](g.where);
    applyFilters();
  });
  $('prev').addEventListener('click', () => nav(-1));
  $('next').addEventListener('click', () => nav(1));
  // capture on document runs before Monaco's own F8 (next marker) handler on its editor node
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'F8' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        nav(e.shiftKey ? -1 : 1);
      }
    },
    true,
  );

  $('tagbar').addEventListener('click', (e) => {
    const chip = e.target.closest('.tchip');
    if (!chip) return;
    const t = chip.dataset.tag;
    tagsOn[tagsOn.has(t) ? 'delete' : 'add'](t);
    chip.setAttribute('aria-pressed', String(tagsOn.has(t)));
    applyFilters();
  });

  document.querySelectorAll('.chip').forEach((chip) =>
    chip.addEventListener('click', () => {
      const on = chip.getAttribute('aria-pressed') === 'true';
      chip.setAttribute('aria-pressed', String(!on));
      hidden[on ? 'add' : 'delete'](chip.dataset.kind);
      applyFilters();
    }),
  );
  $('search').addEventListener('input', applyFilters);
}
