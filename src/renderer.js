import { compare } from './compare.js';

const base = new URL('../node_modules/monaco-editor/min/', location.href).href;
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

// Change text with "GET /users" rendered as a method pill + route
function richText(text) {
  const span = el('span', 'text');
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

  // Pane header: file name + detected spec version
  const refreshHead = (side) => {
    const text = models[side].getValue();
    $(`file-${side}`).textContent = files[side] ?? (text.trim() ? 'Pasted text' : 'Empty');
    const spec = $(`spec-${side}`);
    spec.textContent = specLabel(text);
    spec.hidden = !spec.textContent;
    spec.classList.toggle('bad', spec.textContent === 'Not a spec?');
  };

  const load = (side, text, name) => {
    files[side] = name;
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
    load('left', r, fr);
    load('right', l, fl);
  });

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

  const applyFilters = () => {
    const q = $('search').value.trim().toLowerCase();
    let visible = 0;
    $('list-none')?.remove();
    for (const li of list.children) {
      const c = li._change;
      const show = !hidden.has(c.kind) && (!q || li._haystack.includes(q));
      li.hidden = !show;
      visible += show;
    }
    if (result?.changes.length && !visible) {
      const none = el('li', 'none', 'No changes match the filter.');
      none.id = 'list-none';
      list.append(none);
    }
  };

  // the reader's place in the list; survives re-runs that end in a parse error or empty side
  const keyOf = (c) => `${c.kind}|${c.text}|${c.path.join('/')}`;
  let selected = null;
  let selKey = null;
  let lastScroll = 0;

  function run() {
    clearTimeout(liveTimer);
    if (result) lastScroll = list.scrollTop;
    selected = null;
    list.replaceChildren();
    result = null;
    $('filters').hidden = $('search-wrap').hidden = true;
    $('total').textContent = '';

    const [l, r] = [models.left.getValue(), models.right.getValue()];
    if (!l.trim() || !r.trim()) {
      const missing = !l.trim() && !r.trim() ? 'both specs' : !l.trim() ? 'the original spec' : 'the modified spec';
      showState('idle', 'Two specs, one list of changes', [`Paste or drop ${missing}. Changes appear here as you type.`]);
      return;
    }
    const res = compare(l, r);
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
    res.changes.forEach((c, i) => {
      counts[c.kind]++;
      const li = el('li');
      li._change = c;
      li._haystack = `${c.text} ${c.path.join(' ')}`.toLowerCase();
      const b = el('button', `item ${c.kind}`);
      b.title = `${SIDE[c.side]}, line ${c.line}`;
      b.dataset.i = i;
      b.append(el('span', 'glyph', GLYPH[c.kind]), richText(c.text), el('span', 'path', c.path.join(' › ')));
      b.addEventListener('click', () => select(b, true));
      li.append(b);
      list.append(li);
    });
    for (const k in counts) $(`n-${k}`).textContent = counts[k];
    $('total').textContent = res.changes.length;
    $('filters').hidden = $('search-wrap').hidden = false;
    applyFilters();
    if (selKey) {
      const again = [...list.querySelectorAll('li:not([hidden]) .item')].find((b) => keyOf(b.parentElement._change) === selKey);
      if (again) (selected = again).classList.add('sel');
    }
    list.scrollTop = lastScroll;
  }

  const select = (b, focusEditor) => {
    selected?.classList.remove('sel');
    selected = b;
    selKey = keyOf(b.parentElement._change);
    b.classList.add('sel');
    b.scrollIntoView({ block: 'nearest' });
    const c = b.parentElement._change;
    const ed = editors[c.side];
    ed.revealLineInCenter(c.line);
    ed.setPosition({ lineNumber: c.line, column: 1 });
    if (focusEditor) ed.focus();
  };

  // ↑/↓ walk the visible items without leaving the list
  list.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...list.querySelectorAll('li:not([hidden]) .item')];
    const i = items.indexOf(document.activeElement);
    const next = items[Math.max(0, Math.min(items.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
    if (next) {
      next.focus();
      select(next, false);
    }
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
