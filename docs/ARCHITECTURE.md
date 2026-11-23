# SwaggerCompare: architecture

Windows desktop app. Electron, Monaco diff editor, `yaml` parser. esbuild bundles the renderer into one classic script (ADR 0003); no UI framework, no preload. The same static files also run from file:// in an Edge app window (`SwaggerCompare.bat`).

## Files

```
package.json            "type": "module", scripts, electron-builder config ("build" key)
main.js                 app:// protocol handler, BrowserWindow + security settings, blocks navigation
src/index.html          CSP, Monaco AMD loader, bundled renderer, layout (title bar, pane headers, editor, change list); relative paths only
src/style.css
src/icon.svg            app logo (favicon, README); src/icon.png (256 px, window icon), build/icon.ico (exe icon)
src/renderer.js         Monaco setup, drag&drop/open/clear/swap, live compare (300 ms debounce), grouped list, filters, tag bar, F8 navigation, jump-to-line
src/gen/renderer.js     esbuild output (committed): renderer + compare + yaml as one IIFE
vendor/                 Monaco core + YAML highlighting and used font weights, copied from node_modules by scripts/vendor.mjs (committed)
scripts/build-web.mjs   builds dist/SwaggerCompare-web.zip with the repo-root layout (bat, src/, vendor/)
SwaggerCompare.bat      opens src/index.html in `msedge --app`, falls back to the default browser; CRLF, `-text` in .gitattributes
src/compare.js          ES module, pure, no DOM: compare(leftText, rightText) -> result (see below)
test/compare.test.js    node:test + node:assert
test/fixtures/          swagger2-old.yaml, swagger2-new.yaml, openapi3-old.yaml, openapi3-new.json
```

## Dependencies (exact versions pinned)

- dependencies: `monaco-editor@0.52.2` (last version where the AMD `min/vs` build is supported, see ADR 0002), `yaml@2` (exact 2.x).
- devDependencies: `electron` (current stable), `electron-builder`.
- Nothing else. Tests use `node --test`. The zip step uses PowerShell `Compress-Archive`.

## Data flow

1. The user pastes text or drops a file onto a pane. A capture-phase `drop` handler on each pane reads it with `file.text()` and calls `model.setValue()`. The document also gets `dragover`/`drop` `preventDefault`, so a drop outside a pane never navigates the window.
2. Monaco `createDiffEditor` with `originalEditable: true` and `renderSideBySide: true`. Monaco computes the text diff and colors it live. The text is never reformatted.
3. Live compare: 300 ms after any edit, `compare(original.getValue(), modified.getValue())` runs (no button). Parse errors never move the cursor; list scroll and selection survive re-runs.
   - If either side fails to parse: `{ error: { side: 'left'|'right', line, message } }`. The UI shows the message and no list.
   - Otherwise: `{ changes: [{ kind: 'added'|'removed'|'changed', tag, text, where, path: string[], side: 'left'|'right', line, details?: string[] }] }`. `text` is short ("Added property phone (string)"), `where` names the object it belongs to ("GET /users", "User", "User.address", "schemas", "parameter Limit"), `path` is the full path. `tag` is a one-word category: explicit for structural entries (`endpoint`, `response`, `schema`, `parameter`, `property`, `required`, `type`, `refactor` for $ref extraction/inlining and composition refactors), otherwise the last non-numeric path segment (`enum.2` -> `enum`, `info.version` -> `version`).
4. The list groups entries by `where` (first-appearance order). Each group is a `li.group` with a header button (chevron, `where` with a leading HTTP method as a pill, count of visible entries, coloured +a −r ~c, distinct tags below) and an `ol` of entries. Groups start collapsed; expanded ones are remembered by `where` in `openGroups` across re-runs, and any active filter (kind chips, tag bar, search) expands every matching group. The tag bar under the header has one chip per tag ("property **5**", sorted by count); pressed chips restrict the list to those tags. Navigation: ↑/↓ inside the list walk visible headers and entries; the ▲/▼ buttons and F8 / Shift+F8 step through visible entries (wrapping, opening the entry's group) and the header shows "3 / 17". F8 is caught by a capture-phase `keydown` listener on `document`, which runs before Monaco's own F8 (next marker) handler on the editor node. Each entry renders `kind`, `tag` (a small chip), `text` and `details` as an indented sub-list behind a collapsed "Details (n)" toggle (a sibling button; it only toggles, open state survives live re-runs). The tooltip shows `path.join(' › ')` and side/line; the search also matches `tag`, `where`, `path` and `details`. A click on an item calls `revealLineInCenter(line)` and `setPosition` on the original editor (side `left`, for removals) or the modified editor (side `right`, for added/changed items).

## compare.js internals

- `parseDocument(text, { lineCounter })` parses each side. YAML 1.2 is a superset of JSON, so one code path handles both. The first `doc.errors[0].linePos[0].line` is the reported error line. Duplicate keys are already errors (uniqueKeys).
- Line index: one walk over the CST nodes (`YAMLMap` pairs, `YAMLSeq` items) builds `Map<pathKey, line>`, with `pathKey = JSON.stringify(path)` and the line taken from `lineCounter.linePos(pair.key.range[0])`. A lookup that misses goes to the nearest existing ancestor path, so the line is always defined.
- The structural diff runs on `doc.toJS()` of both sides. Map keys are compared as sets, so key order produces no entries.
- Recognizers are path-context rules that run before the generic fallback:
  - `paths.<p>.<method>` add/remove: "Added endpoint" (where "POST /users").
  - `parameters` arrays are matched by `in+name`, never by index. They produce add/remove, `required` change and type change (`type` for 2.0, `schema.type` for 3.x). A 2.0 `in: body` param is treated as a parameter.
  - Schemas live under `definitions.*` (2.0) and `components.schemas.*` (3.x). Recognizers: whole schema add/remove; `properties.*` add/remove/type; the `required` array compared as a set ("email: now required" / "no longer required", where "User").
  - `responses.<code>` add/remove.
  - `requestBody` (3.x) is not special-cased. It goes through the generic walk.
  - Generic fallback: any remaining leaf or subtree difference gives "<rest> added", "<rest> removed" or "<rest>: old → new". A recognizer marks the subtree it consumed, and everything else always reaches the fallback, so no difference is lost. A recognizer consumes only the keys it actually reported on (e.g. a type read from `type` leaves a sibling `$ref` to the fallback). Repeated parameter labels are paired in order (`query 'a'#2`), and parameters without `in`/`name` or `$ref` are compared by position.
- `where`/`rest` (locate): inside `paths` where is "METHOD /path" (or the path for path-level keys) and rest drops `properties` segments and shortens `requestBody…schema` → "request body" (`request body (<mime>)` when the schema isn't reached), `responses.<code>…schema` → "response <code>", `parameters.<in:name>.schema` → the parameter name. Under a schema (`definitions.X`, `components.schemas.X`) where is the schema plus nested property names up to the last property, e.g. `User.address` for `User.properties.address.properties.zip`; other components get "parameter X", "response X", …; a whole added/removed component has where = its section ("schemas").
- Other arrays are compared by index. `$ref` strings are compared as plain strings; local `#/…` pointers are resolved only for extraction below.
- $ref extraction: when one side is a pure `{$ref}` and the other an inline object without `$ref` (a property, items, a parameter schema, a whole parameter, a response…), one changed entry is emitted: "requestId: extracted to schema RequestId" or "…: inlined from schema RequestId". Its `details` are the differences between the inline value and the resolved definition ("definition unchanged" if none; "definition not compared (external $ref)" / "(unresolved $ref)" when it can't be resolved). The matching "Added"/"Removed" entry of the target definition is then dropped. An inline parameter and a `$ref` parameter resolving to the same `in`+`name` are paired. Limitation: if the whole section is new (e.g. no `definitions` on the left), its single aggregate entry is not dropped.
- Composition refactors (`compose`, runs right after extraction in `walk`, `walkProps` and on parameter schemas): fires when a schema gains or loses `allOf`/`oneOf`/`anyOf`, switches keyword, or keeps the keyword but changes the set of member `$ref`s. Same keyword and same member `$ref`s → no entry here; the members are walked generically as before. One changed entry, tag `refactor`, line at the keyword (left side if only the original has it): "Order: now allOf [schema Entity + inline]", "Order: allOf flattened", "Order: allOf members changed: + schema X, − schema Y", "Pet: now oneOf [schema Dog, schema Cat]". A refactor entry (this or an extraction) on a whole component gets that component as `where` ("Order", not "schemas"), so it lands in the component's group. Details: for `allOf` (and a 1-member `oneOf`/`anyOf`, which is the member itself) both sides are flattened by `flat()` (local `$ref`s resolved, members merged in order, then the schema's own keys: `properties` merged recursively, `required` unioned, otherwise the later wins; cycle guard on visited refs, at most 32 `$ref` hops, unresolved → `{}`) and the effective schemas are diffed. If either side is a real union (`oneOf`/`anyOf` with 2+ members) there is no single effective schema, so the details are a raw diff of the two values. A member `$ref` to a whole component that exists only on that side drops its "Added/Removed schema X" entry (not for a 2+ member union, whose raw details don't contain the members). Limits: external `$ref`s flatten to nothing; `not`, `discriminator` and nested unions inside members are not interpreted.
- Output order is depth-first in key order of the modified side; at each level, keys present only on the original side come after the modified side's keys. (JS objects list integer-like keys such as response codes first, in ascending order.)
- For a wholly added/removed path, the endpoint entries (one per HTTP method) cover the path; its other path-level keys produce no separate entries.
- The Monaco diff runs with `ignoreTrimWhitespace: false`, so whitespace changes are shown.

## Electron security

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, no preload. The renderer needs no Node or IPC.
- `will-navigate` and `setWindowOpenHandler` deny all navigation and new windows.
- CSP meta: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; font-src 'self' data:; img-src 'self' data:; object-src 'none'; base-uri 'none'`. No inline scripts. Monaco needs inline styles and data: images.
- The window loads `app://local/src/index.html`. main.js registers the privileged `app` scheme (standard, secure, supportFetchAPI) and serves files from the app root (works inside asar via `net.fetch` of a file URL). Only `src/` and `vendor/` are served; anything else returns 403. Everything is local and nothing comes from a CDN.

## Loading Monaco and yaml

- `index.html` loads `../vendor/monaco/vs/loader.js`, then `gen/renderer.js`. The renderer calls `window.require.config({ paths: { vs } })` with a URL relative to the page, so it resolves under both `app://local/` and `file:///`.
- Workers: under app:// a blob worker `importScripts` `workerMain.js`. Under file:// `getWorkerUrl` throws, and Monaco runs the diff on the main thread.
- `compare.js` stays a plain ES module importing `yaml`; Node runs it directly in tests, esbuild inlines it (and `yaml`) into the bundle.

## Build and distribution

- `npm run build` runs esbuild and scripts/vendor.mjs; `npm start` builds, then runs `electron .`. All npm packages are devDependencies, since nothing ships from node_modules.
- `npm test` runs `node --test`
- `npm run web` builds and zips `dist/SwaggerCompare-web.zip` (~2 MB), the same layout as the repo root.
- `npm run dist` builds, builds the portable exe, zips it as `SwaggerCompare-win.zip`, then builds the web zip.
- electron-builder config: `win.target: portable`, `artifactName: "SwaggerCompare.exe"`, `win.icon: build/icon.ico`; the BrowserWindow uses `src/icon.png`. `files` is `main.js`, `src/**`, `vendor/**`. asar is on.
- No code signing, no CI, no Linux.
