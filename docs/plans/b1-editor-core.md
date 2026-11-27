# B1: editor core (v1.8.0), implementation plan

The approved design is in section B of the session plan. This file holds the implementation detail for release B1.

Scope: Edit mode (a Compare | Edit toggle), a standalone Monaco editor, completion, hover, validation, Problems and Outline. All OpenAPI knowledge lives in a single data module, `src/oas/model.js`. The logic lives in pure modules under `src/oas/*`, with no DOM and no Monaco.

## Decisions
- **`buildIndex` stays unexported in B1.** Validate and outline need key and value column ranges, so they walk the `yaml` AST in a new `src/oas/ast.js`. `pointer` and `resolve` get exported in B2.
- **`contextAt` uses an indentation scanner, not `parseDocument`.** The same path handles valid YAML and YAML broken mid-typing, in O(n).
  - Known limits: no flow style `{a: 1}`, no multi-line plain or quoted scalars, no nested `- - x`. Mark this with a `shortcut:` comment.
  - The bodies of block scalars `|` and `>` are skipped.
- **The Monaco language is always `yaml`, even for JSON.** Only `basic-languages/yaml` is vendored, and JSON is valid YAML for highlighting. Providers are registered for `yaml` only. JSON is detected by content (`^\s*[{[]`) inside the logic.
- **JSON completion in B1 is key names only** (`"key": `).
- **A document without `openapi` uses the newest version (3.2) for completion.**
- **Spec details:**
  - `Operation.responses` is required only before 3.1 (`reqUntil: 31`).
  - `Response.description` is required before 3.2 (`reqUntil: 32`), so it can't cause false errors on 3.2 documents.
  - Schema `items` may be a boolean from 3.1.
  - Parameter `style` gets `cookie` from 3.2.
  - Check anything unsure against the spec text; if in doubt, warn rather than error.

## Files

### New
**`src/oas/model.js`** holds data plus the helpers `verOf`, `active`, `kindsOf`, `member` and `typeAt`.
- **Versions** are numbers: `30`, `31`, `32`, computed from `openapi: 3.M.x` as `30 + M`.
  - A field has `since` (inclusive) and `until` (exclusive).
  - Adding 3.3 means data plus a template only.
- **Field type `t`** is a name or alternatives joined with `|`.
  - Primitives: `str num int bool any`.
  - Composites: `obj` (+`of`), `map` (+`of`), `list` (+`of`). `of` is an object name in `OBJECTS`, or `'str'`.
- **Other field keys:**
  - `req: true`, optionally with `reqUntil`.
  - `enum: ['a', ['b', 32]]`: an element written as `[value, since, until]` is gated by version.
  - `hints`: suggestions only, never validated (for example `format`, `openapi`).
  - `keyHints`: key suggestions for maps (status codes, media types).
  - `tFrom: [31, 'str|list']`: the type changes from that version on (`Schema.type`, `exclusiveMinimum`, `exclusiveMaximum`).
- **Object shape:** `doc`, `fields`, optional `patterns: [{re, t, of, doc, keyHints}]` (Paths, Responses, Callback, SecurityRequirement, map-like objects), and `ref: true` when `$ref` is allowed. `x-*` keys are always allowed.
- Every object and every field gets a one-sentence `doc` in our own words.
- **Objects:** OpenAPI, Info, Contact, License, Server, ServerVariable, Paths, PathItem, Operation, Parameter, RequestBody, MediaType, Encoding, Responses, Response, Header, Components, Schema, Discriminator, XML, Example, Link, Callback, SecurityScheme, OAuthFlows, OAuthFlow, Tag, ExternalDocs.
- **3.1 differences:**
  - `webhooks`, `jsonSchemaDialect`;
  - `info.summary`, `license.identifier`;
  - `components.pathItems`;
  - Schema `type` may be a list, `null` becomes a type, `nullable` is removed (`until: 31`);
  - Schema `const`, `examples`, `$defs`, `prefixItems`, `if`/`then`/`else`, `dependentSchemas`, `unevaluatedProperties`, `contentMediaType`, `contentEncoding`, `$id`, `$schema`, `$anchor`, `$comment`;
  - numeric `exclusiveMinimum`/`exclusiveMaximum`;
  - `items` may be a boolean.
- **3.2 differences:**
  - PathItem `query` and `additionalOperations` (a map from an UPPERCASE method to an Operation);
  - Parameter `in: querystring`, style `cookie`;
  - MediaType `itemSchema` and `itemEncoding`;
  - Tag `summary`, `parent`, `kind`;
  - OpenAPI `$self`;
  - `components.mediaTypes`;
  - Response `summary`, Server `name`;
  - Example `dataValue`, `serializedValue`;
  - Discriminator `defaultMapping`;
  - SecurityScheme `deprecated`, `oauth2MetadataUrl`;
  - OAuthFlows `deviceAuthorization` (an OAuthFlow with `deviceAuthorizationUrl`).
- **Exports:**
  - `OBJECTS` and `TEMPLATES = ['3.0.3', '3.1.1', '3.2.0']`.
  - `verOf(text)` → `30 + minor`, or `undefined`.
  - `active(f, ver)`.
  - `kindsOf(f, ver)`.
  - `member(type, key, ver)` → `{spec, via: 'field'|'pattern', gated?: true}` or `undefined`.
  - `typeAt(path, ver)` → `{kind: 'obj'|'map'|'list'|'prim', type, spec}`, or `null`.

**`src/oas/ast.js`**
- `parse(text)` → `{doc, lc, ver, json, root}`, using `parseDocument(text, {lineCounter})`.
- `range(lc, [s, e])` → `{startLine, startCol, endLine, endCol}`, 1-based with the end exclusive.
- Small pair and key helpers.

**`src/oas/context.js`**: `contextAt(text, line, col)` → `{path, objectType, container, keysPresent, position: 'key'|'value', key, prefix, indent, version}`.

YAML algorithm:
1. **Pre-pass** over the lines:
   - Blank lines, comment lines and block-scalar bodies map to `null`.
   - A block scalar is opened by a line ending in `:\s*[|>][+\-0-9]*` or `- [|>]`.
   - Every other line maps to `{dash, kc, key, hasVal}`: the dash column (or -1), the key column, the unquoted key, and whether a value follows.
2. **Cursor kind:**
   - Whitespace only → key position at column `before.length`.
   - Inside the key token → key position with a `prefix`.
   - After `key:` → value position.
   - A bare `- ` → key position for a new item.
3. **Parent walk**, going upward and skipping `null` lines:
   - `kc > c`: deeper, skip.
   - `kc == c` with no dash: a sibling.
   - `kc == c` with a dash: the item that owns the map. Push its index (the count of earlier dash lines at the same dash column, up to a line with a smaller column), then continue with `c = dash` and `allowEq`.
   - `kc < c` with a key: the parent. Push the key; if that line also has a dash, push its item index and continue with `c = dash`.
   - With `allowEq`, a line with `kc == c`, a key and no value is the parent too. This covers `parameters:\n- name: x`.
4. **`keysPresent`:** lines with `kc == c` in the same block, above and below the cursor. A dash line at `c` belongs to the item and ends the scan.
5. **Types:**
   - `typeAt(path)` gives the object type, or a `container` (a free map).
   - In value position, the field is `member(parent, key)`.
   - The version is `verOf(text)`, defaulting to 32.

JSON: a single token pass with a `{`/`[` stack.
- Frames are `{kind, key, keys: Set}`.
- Take a snapshot at the cursor, then keep scanning to gather the keys after it.
- Report key or value position.

Perf: no Monaco calls and no `parseDocument` here.

**`src/oas/complete.js`**: `complete(text, line, col)` → `[{label, insertText, kind: 'key'|'value'|'snippet', doc, required?, sortText}]`.
- **Key position:**
  - Active fields not already present, filtered by `prefix`. Required ones sort first (`'0' + label`), the rest after (`'1' + label`).
  - Plus `keyHints` from patterns or maps: status codes `200 201 204 400 401 403 404 409 422 500 default`, and media types `application/json`, `application/xml`, `text/plain`, `multipart/form-data`, `application/x-www-form-urlencoded`, `application/octet-stream`.
  - The HTTP methods are PathItem fields, so they are version-aware without extra code.
- **Insert text** is relative, with no base indent:
  - a scalar key: `key: `;
  - an `obj` or `map` key: `key:\n  `;
  - a `list` key: `key:\n  - `;
  - in JSON: `"key": `;
  - if the rest of the line already holds `:`, insert the key only;
  - a status code is quoted: `'200':\n  `.
  - Monaco re-indents multi-line inserts. The smoke test must confirm that; otherwise use `KeepWhitespace` and indent the continuation lines with `ctx.indent`.
- **Value position:** the active `enum`, else `hints`, else `true`/`false` for a bool, plus `openapi` → `TEMPLATES`.
- The `prefix` gives the replace range in `editor.js`.
- **`fieldDoc(text, line, col)`** → `{title, doc, type, required}` or `null`.
  - `type` is human-readable: `string`, `Schema`, `map of Schema`, `list of Parameter`.
  - The doc ends with a since/removed note.
  - A key under a free map gets the item object's doc.
  - An `x-*` key gets "Specification extension".

**`src/oas/validate.js`**
- `rules = [syntaxRule, versionRule, structureRule]`, each `(ctx) => marker[]`. B2 appends to this list.
- `validate(text)` → markers sorted by position.
- **`syntaxRule`:** `doc.errors` → error; `doc.warnings` → warning.
- **`versionRule`:**
  - `swagger` present → an error on that key: "Swagger 2.0 is not supported by the editor (OpenAPI 3.x only)".
  - `openapi` missing → an error at 1:1.
  - A value not 3.0, 3.1 or 3.2 → an error on the value; for 3.3 and above, "newer than this editor supports".
- **`structureRule`:** a recursive walk.
  - `x-*` keys are skipped.
  - A gated key → warning: "'nullable' was removed in OpenAPI 3.1" or "'webhooks' needs OpenAPI 3.1+".
  - Unknown key → warning: "Unknown key 'foo' in Operation".
  - Wrong type → error on the value: "Expected mapping (Info), found list". A null value is never an error.
  - Value not in the enum → error: "Invalid value 'x'. Allowed: …".
  - Missing required field → error at the parent key, the list item's start, or 1:1: "Missing required 'name' in Parameter".
  - A map holding `$ref` where the object allows refs skips the unknown and required checks (except Schema 3.1+, where siblings are normal keys).
  - Aliases are skipped.

**`src/oas/outline.js`**: `outline(text)` → `[{label, kind, line, detail?, method?, children}]`, tolerant of parse errors.
- Info (detail: title and version).
- Servers.
- Paths → methods, including `query` and the keys of `additionalOperations`; summary as detail.
- Webhooks.
- Components → kind → names.
- Tags.

**`src/oas/templates.js`**: `starter(ver)` for 3.0.3, 3.1.1 and 3.2.0.
- Each has info, one server, `GET /items` with a `$ref` response, and `components.schemas.Item`.
- 3.1 adds `info.summary` and `type: [string, 'null']`; 3.2 adds `$self`.

**`src/editor.js`**: `export function initEditor({ $, el })`, called at the end of `init()` in `renderer.js`.
1. **Mode:**
   - Toggles `body.edit`, `#edit.hidden` and `aria-pressed` on the toggle.
   - Stored in `localStorage['sc.mode']` (try/catch) and restored at start.
   - Calls `editor.layout()` when `#edit` is shown.
2. **Model and editor:**
   - Model: `monaco.editor.createModel(draft ?? starter('3.2.0'), 'yaml', Uri.parse('inmemory://edit/spec.yaml'))`.
   - Editor: `monaco.editor.create($('edit-editor'), {...})` with:
     - theme `swagger-compare`, `automaticLayout`;
     - minimap off;
     - `quickSuggestions` `{other: true, strings: true, comments: false}`, `wordBasedSuggestions: 'off'`;
     - `tabSize: 2`, `insertSpaces`, `detectIndentation: false`;
     - the same font options as the diff editor.
3. **Providers**, registered once for `yaml` and returning early when `model !== editModel`:
   - **Completion:**
     - trigger characters `[' ', ':', '\n', '-']`;
     - kinds Property, Value, Snippet;
     - detail `required`;
     - `sortText`;
     - the range taken from `prefix`;
     - `command: editor.action.triggerSuggest` after an insert that ends in a newline.
   - **Hover:**
     - `**title** · type` followed by the doc;
     - the title is escaped, since it is the user's key.
4. **Markers:** on change, debounce 300 ms → `validate` → `setModelMarkers(model, 'oas', …)`, Problems and Outline.
5. **Problems:**
   - Each row is a button: severity dot, message, "Ln N".
   - A click sets the position, reveals it centered and focuses the editor.
   - The `#n-problems` badge counts errors and warnings, with class `bad` when there is an error.
6. **Outline:**
   - A nested list.
   - Method rows reuse `.method m-<method>` pills.
   - A click reveals the line.
   - On cursor change, the deepest node with `line <= cursor` gets `.cur` and `scrollIntoView({block: 'nearest'})`.
7. **Toolbar:**
   - **New:** `select#new-ver` with the newest preselected; `confirm` first when dirty.
   - **Open:** `#edit-input`, plus capture-phase dragover/drop on `#edit-editor`, as in `renderer.js`.
   - **Save:** Blob download as `name ?? openapi.yaml|json`.
   - **Format:**
     - YAML: `parseDocument().toString({indent: 2, lineWidth: 0})`, refused while there are errors.
     - JSON: `stringify(parse, null, 2)`.
   - Every replace goes through `executeEdits` plus `pushUndoStop`, as `load()` does, so Ctrl+Z works.
   - `#ed-file` shows the name or "Untitled"; `#ed-spec` shows "OpenAPI x.y.z".
8. **Draft:** `localStorage['sc.draft'] = {text, name}`, debounced 500 ms, in try/catch.

### Changed
- **`src/renderer.js`:**
  - import `initEditor` and call `initEditor({ $, el })` at the end of `init()`;
  - the F8 capture listener ignores the key when `document.body.classList.contains('edit')`.
- **`src/index.html`:**
  - in the titlebar, a segmented toggle `<div class="seg" id="mode" role="group" aria-label="Mode">` with buttons `data-mode="compare"` and `data-mode="edit"`;
  - in `main.workspace`, a `<section class="edit" id="edit" hidden>` with:
    - `.edwrap` → `.edbar` (the `select#new-ver`, buttons `#ed-new`, `#ed-open`, `#ed-save`, `#ed-format`, spans `#ed-file`, `#ed-spec`, `input#edit-input[type=file][hidden]`) and `#edit-editor`;
    - an `aside.side` with tabs (`[data-tab=outline]`, `[data-tab=problems]` with `<b id="n-problems">`) and panes `#tab-outline > ul#outline`, `#tab-problems > ul#problems`.
  - B3 adds one tab and one pane; `editor.js` iterates `[data-tab]`.
- **`src/style.css`:**
  - Panels: `.edwrap, .side` join the `.diff, .changes` panel rule; `body.edit .diff, body.edit .changes {display: none}`.
  - Layout:
    - `.edit {display: grid; grid-column: 1/-1; grid-template-columns: minmax(0, 1fr) 380px; gap: 10px; min-height: 0}` and `.edit[hidden] {display: none}`;
    - `.edwrap` is a flex column and `#edit-editor {flex: 1; min-height: 0}`;
    - `.edbar` is a flex row.
  - Tabs: like `.seg`/`.tchip`, with the badge styled like `.tchip b` and `.bad` in `--removed`.
  - Rows: `padding: 4px 12px`; `.cur` gets `--raised`; indent comes from `data-depth`; severity dots use `--removed`, `--changed` and `--focus`.
  - Method pills: `.method` gets a default background, and `.m-query` joins the `.m-head, .m-options, .m-trace` rule.
  - `.versions` gets a `max-width` so it clears the toggle.
- **`package.json`:** version 1.8.0, no new dependencies.
- **Docs:**
  - README: an "Edit mode" section.
  - ARCHITECTURE: the `src/oas` module and the model shape, the limits of `contextAt`, the rules list, no Ajv (because of the CSP), and Modes with their `localStorage` keys.

## Tests (`test/oas.test.js`, table-driven, `node:test`)
- **Helper:** `at(text)` with a `|` cursor marker → `{text, line, col}`.
- **`contextAt`:**
  - valid YAML: an operation key, an `in:` value, a parameters item, item index 1, `responses.'200'.content`;
  - broken YAML: `res|` under `get:`, `in: |`, a dangling `- |`, a missing colon, a deeper blank line;
  - the same-column `parameters:\n- name: x` form;
  - a block scalar containing `get:`;
  - JSON: inside a key, after an array of objects, and `keysPresent` including keys after the cursor.
- **`complete`:**
  - Operation keys include `responses` and exclude keys already present, with no duplicates;
  - required keys come first (`name`, `in`);
  - `in:` values, with `querystring` only from 3.2;
  - `type:` values, with `null` only from 3.1;
  - path methods, with `query` only from 3.2;
  - status codes, media types and `openapi:` values;
  - version gates: `nullable`, `webhooks`, `$self`;
  - the three insert-text forms, and JSON quoted keys.
- **`fieldDoc`:** a known key, an `x-` key, an unknown key (`null`), and the since note on `query`.
- **`validate`:** one row per rule with exact positions:
  - syntax, `swagger: '2.0'`, missing `openapi`, `3.9.0`;
  - an unknown key (warning) and an allowed `x-` key;
  - a wrong type, a missing `info.title`, a Parameter missing `in`, `in: body`;
  - `nullable` in 3.1, `webhooks` in 3.0, `query` in 3.1.
- **No false positives:**
  - no errors on `examples/*.yaml` and on `test/fixtures/openapi3-*`;
  - zero errors and zero warnings on every template;
  - every `since`/`until` value in the model has a template at or above it.
- **`outline`:** on `orders-api-v1.yaml`, labels and lines; on a 3.2 document, `query` and `additionalOperations`.
- **Perf:** a generated ~3000-line spec. `validate` runs under 300 ms; `contextAt` and `complete` run under 50 ms each.

## Order
1. `model.js`
2. `ast.js`
3. `context.js` with its tests
4. `complete.js` and `fieldDoc` with their tests
5. `validate.js` with its tests
6. `outline.js` and `templates.js` with their tests
7. The perf test
8. HTML, CSS and the `renderer.js` hooks
9. `editor.js`
10. `npm run build` and `npm test`; version 1.8.0
11. README and ARCHITECTURE

The working tree has uncommitted release-A changes in `README.md`, `docs/ARCHITECTURE.md`, `scripts/build-web.mjs`, `index.html` and `test/web.test.js`. Keep them.
