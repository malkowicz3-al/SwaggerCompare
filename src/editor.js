// Edit mode: one standalone Monaco editor with OpenAPI completion, hover, problems and outline.
// All OpenAPI knowledge is in src/oas/*; this file only wires it to Monaco and the DOM.
import { parseDocument } from 'yaml';
import { complete, fieldDoc } from './oas/complete.js';
import { contextAt } from './oas/context.js';
import { definitionAt, refHover } from './oas/refs.js';
import { validate } from './oas/validate.js';
import { outline } from './oas/outline.js';
import { preview } from './oas/preview.js';
import { starter } from './oas/templates.js';
import { TEMPLATES } from './oas/model.js';
import { isJson, formatJson } from './oas/ast.js';

// localStorage throws when storage is disabled (some file:// and private contexts)
const store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

const md = (s) => s.replace(/[\\`*_{}[\]()#+\-.!|<>~]/g, '\\$&');
const specOf = (text) => text.match(/^\s*["']?openapi["']?\s*:\s*["']?([\w.-]+)/m)?.[1];

export function initEditor({ $, el, compareWith }) {
  let draft = null;
  try {
    draft = JSON.parse(store.get('sc.draft'));
  } catch {}
  if (typeof draft?.text !== 'string') draft = null;
  let file = draft?.name ?? null;
  let saved = draft ? null : starter(TEMPLATES.at(-1)); // a restored draft may never have been saved

  const model = monaco.editor.createModel(draft?.text ?? saved, 'yaml', monaco.Uri.parse('inmemory://edit/spec.yaml'));
  const editor = monaco.editor.create($('edit-editor'), {
    model,
    theme: 'swagger-compare',
    automaticLayout: true,
    minimap: { enabled: false },
    quickSuggestions: { other: true, strings: true, comments: false },
    wordBasedSuggestions: 'off',
    tabSize: 2,
    insertSpaces: true,
    detectIndentation: false,
    fontFamily: "'JetBrains Mono', Consolas, monospace",
    fontSize: 13,
    lineHeight: 20,
    fontLigatures: false,
    scrollBeyondLastLine: false,
    padding: { top: 10 },
    renderLineHighlight: 'line',
    scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
  });

  // Mode
  const setMode = (m) => {
    document.body.classList.toggle('edit', m === 'edit');
    $('edit').hidden = m !== 'edit';
    document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
    store.set('sc.mode', m);
    if (m === 'edit') editor.layout();
  };
  document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

  // Providers: registered for every yaml model, so they ignore the compare editors' models
  const KIND = { key: 'Property', value: 'Value', snippet: 'Snippet' };
  monaco.languages.registerCompletionItemProvider('yaml', {
    triggerCharacters: [' ', ':', '\n', '-', '/'],
    provideCompletionItems(m, pos) {
      if (m !== model) return;
      const text = m.getValue();
      const ctx = contextAt(text, pos.lineNumber, pos.column);
      if (!ctx) return;
      const pre = ctx.prefix;
      // Monaco may have auto-closed the quote the user opened; replace it too
      const closing = /^["']/.test(pre) && m.getLineContent(pos.lineNumber)[pos.column - 1] === pre[0];
      const range = new monaco.Range(pos.lineNumber, pos.column - pre.length, pos.lineNumber, pos.column + (closing ? 1 : 0));
      const q = /^["']/.test(pre) ? pre[0] : '';
      return {
        suggestions: complete(text, pos.lineNumber, pos.column).map((c) => ({
          label: c.label,
          insertText: c.insertText,
          filterText: q + c.label,
          kind: monaco.languages.CompletionItemKind[KIND[c.kind]],
          detail: c.required ? 'required' : undefined,
          documentation: c.doc,
          sortText: c.sortText,
          range,
          ...(c.snippet && { insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet }),
          ...((c.retrigger || /\n[ -]*$/.test(c.insertText)) && { command: { id: 'editor.action.triggerSuggest', title: 'Suggest' } }),
        })),
      };
    },
  });
  monaco.languages.registerHoverProvider('yaml', {
    provideHover(m, pos) {
      if (m !== model) return;
      const r = refHover(m.getValue(), pos.lineNumber, pos.column);
      if (r) {
        return {
          range: new monaco.Range(pos.lineNumber, r.from, pos.lineNumber, r.to),
          contents: [{ value: `**${md(r.title)}** · ${md(r.kind)}` }, ...(r.rows.length ? [{ value: r.rows.map(md).join('  \n') }] : [])],
        };
      }
      const d = fieldDoc(m.getValue(), pos.lineNumber, pos.column);
      if (!d) return;
      return { contents: [{ value: `**${md(d.title)}** · ${d.type}${d.required ? ' · required' : ''}` }, { value: md(d.doc) }] };
    },
  });

  monaco.languages.registerDefinitionProvider('yaml', {
    provideDefinition(m, pos) {
      if (m !== model) return;
      const d = definitionAt(m.getValue(), pos.lineNumber, pos.column);
      return d && { uri: m.uri, range: new monaco.Range(d.line, d.col, d.line, d.col) };
    },
  });

  // Tabs
  const tabs = document.querySelectorAll('[data-tab]');
  const showTab = (name) => {
    tabs.forEach((t) => {
      t.setAttribute('aria-selected', String(t.dataset.tab === name));
      $(`tab-${t.dataset.tab}`).hidden = t.dataset.tab !== name;
    });
    $('edit').classList.toggle('wide', name === 'preview');
    if (name === 'preview') renderPreview();
  };
  tabs.forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));

  const reveal = (line, col = 1) => {
    editor.setPosition({ lineNumber: line, column: col });
    editor.revealPositionInCenter({ lineNumber: line, column: col });
    editor.focus();
  };

  // Problems
  let markers = [];
  const renderProblems = () => {
    const ul = $('problems');
    ul.replaceChildren(
      ...markers.map((p) => {
        const b = el('button');
        b.type = 'button';
        b.append(el('span', `dot ${p.severity}`), el('span', null, p.message), el('span', 'ln', `Ln ${p.startLine}`));
        b.addEventListener('click', () => reveal(p.startLine, p.startCol));
        const li = el('li');
        li.append(b);
        return li;
      }),
    );
    if (!markers.length) ul.append(el('li', 'none', 'No problems'));
    const n = $('n-problems');
    n.textContent = markers.filter((p) => p.severity !== 'info').length;
    n.classList.toggle('bad', markers.some((p) => p.severity === 'error'));
  };

  // Outline
  let nodes = []; // [{line, btn}] in document order, so the last one at or above the cursor is the deepest
  const renderOutline = () => {
    nodes = [];
    const list = (items, depth) => {
      const ul = el('ul', 'tree');
      for (const it of items) {
        const b = el('button');
        b.type = 'button';
        b.dataset.depth = depth;
        b.append(it.method ? el('span', `method m-${it.method}`, it.label) : el('span', null, it.label));
        if (it.detail) b.append(el('span', 'sub', it.detail));
        b.addEventListener('click', () => reveal(it.line));
        nodes.push({ line: it.line, btn: b });
        const li = el('li');
        li.append(b);
        if (it.children.length) li.append(list(it.children, depth + 1));
        ul.append(li);
      }
      return ul;
    };
    $('outline').replaceChildren(...list(outline(model.getValue()), 0).children);
    markCurrent();
  };
  let cur = null;
  const markCurrent = () => {
    const line = editor.getPosition()?.lineNumber ?? 1;
    const hit = nodes.findLast((n) => n.line <= line)?.btn ?? null;
    if (hit === cur) return;
    cur?.classList.remove('cur');
    cur = hit;
    if (cur) {
      cur.classList.add('cur');
      cur.scrollIntoView({ block: 'nearest' });
    }
  };
  editor.onDidChangeCursorPosition(markCurrent);

  // Preview: user text goes in via textContent only (el), never as HTML
  const opened = new Set(); // op.key of the open operations, kept across re-renders
  const h = (tag, cls, ...kids) => {
    const n = el(tag, cls);
    n.append(...kids.filter((k) => k != null && k !== false && k !== ''));
    return n;
  };
  const kids = (n) => (n.children?.length || n.variants ? n : n.items && kids(n.items));
  const schemaTree = (n, depth) => {
    const at = kids(n);
    const ul = el('ul', 'pv-schema');
    for (const c of at.children ?? []) ul.append(field(c.name, c.required, c.node, depth));
    at.variants?.list.forEach((v, i) => ul.append(field(`${at.variants.kind} ${i + 1}`, false, v, depth)));
    return ul;
  };
  const enumText = (e) => e.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join(', ');
  const field = (name, req, n, depth) => {
    const row = h(
      'span',
      'pv-field',
      name != null && h('code', 'pv-name', name, req && el('span', 'pv-req', '*')),
      el('span', 'pv-type', n.cycle ? `↻ ${n.ref}` : n.type),
      n.ref && !n.cycle && !n.type.includes(n.ref) && el('span', 'pv-ref', n.ref),
      n.description && el('span', 'pv-fdesc', `— ${n.description}`),
      n.enum && el('span', 'pv-enum', `enum: ${enumText(n.enum)}`),
    );
    const li = el('li');
    if (!kids(n)) li.append(row);
    else if (depth >= 1) {
      const d = el('details');
      d.append(h('summary', null, row));
      // built on first open: the Node tree shares memoised $ref subtrees, the DOM would not
      d.addEventListener('toggle', () => d.open && d.childElementCount === 1 && d.append(schemaTree(n, depth + 1)));
      li.append(d);
    } else li.append(row, schemaTree(n, depth + 1));
    return li;
  };
  const media = (content) =>
    content.map((c) => h('div', 'pv-media', el('span', 'pv-mt', c.media), c.schema && h('ul', 'pv-schema pv-root', field(null, false, c.schema, 0))));
  const opBody = (o) => {
    const body = h('div', 'pv-body', o.description && el('p', 'pv-desc', o.description), o.operationId && el('p', 'pv-opid', `operationId: ${o.operationId}`));
    if (o.params.length) {
      const tr = (tag, cells) => h('tr', null, ...cells.map((c) => h(tag, null, c)));
      const name = (p) => h('span', null, el('code', 'pv-name', p.name ?? ''), p.required && el('span', 'pv-req', '*'));
      body.append(
        el('h4', null, 'Parameters'),
        h('table', 'pv-table', h('thead', null, tr('th', ['Name', 'In', 'Type', 'Description'])), h('tbody', null, ...o.params.map((p) => tr('td', [name(p), p.in, el('code', 'pv-type', p.type), p.description])))),
      );
    }
    if (o.body) body.append(h('h4', null, 'Request body', o.body.required && el('span', 'pv-req', ' *')), ...(o.body.description ? [el('p', 'pv-desc', o.body.description)] : []), ...media(o.body.content));
    if (o.responses.length) body.append(el('h4', null, 'Responses'), ...o.responses.map((r) => h('div', 'pv-resp', h('p', null, el('span', 'tag', r.code), r.description), ...media(r.content))));
    return body;
  };
  // the body is built on first open only: closed operations of a big spec cost one summary each
  const opEl = (o) => {
    const d = el('details', 'pv-op');
    d.append(
      h(
        'summary',
        null,
        el('span', `method m-${o.method.replace(/[^a-z]/g, '')}`, o.method.toUpperCase()),
        el('span', 'pv-path', o.path),
        o.summary && el('span', 'pv-sum', o.summary),
        o.deprecated && el('span', 'tag pv-dep', 'deprecated'),
      ),
    );
    const open = () => d.childElementCount === 1 && d.append(opBody(o));
    if (opened.has(o.key)) {
      d.open = true;
      open();
    }
    d.addEventListener('toggle', () => (d.open ? (opened.add(o.key), open()) : opened.delete(o.key)));
    const w = h('div', 'pv-opw', d);
    if (o.line) {
      // outside <summary>: no interactive content nested in it
      const go = el('button', 'tbtn pv-go', 'Go to');
      go.type = 'button';
      go.title = `Line ${o.line}`;
      go.setAttribute('aria-label', `Go to ${o.method.toUpperCase()} ${o.path} (line ${o.line})`);
      go.addEventListener('click', () => reveal(o.line));
      w.append(go);
    }
    return w;
  };
  const renderPreview = () => {
    const p = preview(model.getValue());
    const box = $('preview');
    if (!p) {
      for (const b of box.querySelectorAll('.pv-go')) b.disabled = true; // their lines are stale
      if (!box.querySelector('.pv-stale')) box.prepend(el('p', 'pv-stale', box.childElementCount ? 'Showing the last valid version' : 'Fix the YAML/JSON errors to see a preview'));
      return;
    }
    box.replaceChildren(
      h('header', 'pv-head', h('h2', null, p.title ?? 'Untitled API', p.version && el('span', 'tag', p.version)), p.description && el('p', 'pv-desc', p.description), p.servers.length > 0 && h('ul', 'pv-servers', ...p.servers.map((u) => el('li', null, u)))),
      ...p.groups.map((g) => h('section', 'pv-group', el('h3', null, g.name), g.description && el('p', 'pv-desc', g.description), ...g.ops.map(opEl))),
    );
    if (!p.groups.length) box.append(el('p', 'none', 'No operations'));
  };

  const head = () => {
    $('ed-file').textContent = file ?? 'Untitled';
    const v = specOf(model.getValue());
    $('ed-spec').textContent = v ? `OpenAPI ${v}` : '';
    $('ed-spec').hidden = !v;
  };
  const check = () => {
    markers = validate(model.getValue());
    const sev = { error: monaco.MarkerSeverity.Error, warning: monaco.MarkerSeverity.Warning, info: monaco.MarkerSeverity.Info };
    monaco.editor.setModelMarkers(
      model,
      'oas',
      markers.map((p) => ({ severity: sev[p.severity], message: p.message, startLineNumber: p.startLine, startColumn: p.startCol, endLineNumber: p.endLine, endColumn: p.endCol })),
    );
    renderProblems();
    renderOutline();
    if (!$('tab-preview').hidden) renderPreview();
  };
  let checkTimer, draftTimer;
  const saveDraft = () => store.set('sc.draft', JSON.stringify({ text: model.getValue(), name: file }));
  model.onDidChangeContent(() => {
    head();
    clearTimeout(checkTimer);
    checkTimer = setTimeout(check, 300);
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 500);
  });

  // an undoable edit, as load() in renderer.js, so Ctrl+Z gets the previous text back
  const replace = (text) => {
    editor.pushUndoStop();
    editor.executeEdits('load', [{ range: model.getFullModelRange(), text }]);
    editor.pushUndoStop();
  };
  const load = (text, name) => {
    file = name;
    saved = text;
    replace(text);
    head();
    saveDraft();
  };

  // Toolbar
  const ver = $('new-ver');
  ver.append(...TEMPLATES.map((v) => el('option', null, v)));
  ver.value = TEMPLATES.at(-1);
  const discardOk = () => model.getValue() === saved || confirm('Replace the unsaved text?');
  $('ed-new').addEventListener('click', () => {
    if (discardOk()) load(starter(ver.value), null);
  });

  const input = $('edit-input');
  $('ed-open').addEventListener('click', () => {
    input.value = '';
    input.click();
  });
  input.addEventListener('change', async () => {
    const f = input.files[0];
    if (f) {
      const text = await f.text();
      if (discardOk()) load(text, f.name);
    }
  });
  const node = $('edit-editor');
  const drop = el('div', 'drop', 'Drop to open');
  node.append(drop);
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
      const f = e.dataTransfer.files[0];
      if (f) {
        const text = await f.text();
        if (discardOk()) load(text, f.name);
      }
    },
    true,
  );

  $('ed-save').addEventListener('click', () => {
    const text = model.getValue();
    const a = el('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = file ?? (isJson(text) ? 'openapi.json' : 'openapi.yaml');
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    saved = text;
  });

  $('ed-format').addEventListener('click', () => {
    const text = model.getValue();
    let out, why;
    try {
      if (isJson(text)) out = formatJson(text);
      else {
        const doc = parseDocument(text);
        if (!doc.errors.length) out = doc.toString({ indent: 2, lineWidth: 0 });
      }
    } catch (e) {
      why = e.message;
    }
    if (out == null) {
      // formatting broken text would lose it; show why instead
      check();
      if (why) {
        markers.unshift({ severity: 'error', message: why, startLine: 1, startCol: 1 });
        renderProblems();
      }
      showTab('problems');
      return;
    }
    if (out !== text) replace(out);
  });

  $('ed-compare').addEventListener('click', () => {
    const text = model.getValue();
    compareWith({ original: saved != null && saved !== text ? saved : null, originalName: file ? file + ' (saved)' : 'Baseline', modified: text, modifiedName: file });
    setMode('compare');
  });

  head();
  check();
  if (store.get('sc.mode') === 'edit') setMode('edit');
}
