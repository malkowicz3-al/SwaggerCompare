# SwaggerCompare: architecture

Windows desktop app. Electron, Monaco diff editor, `yaml` parser. esbuild bundles the renderer into one classic script (ADR 0003); no UI framework, no preload. The same static files also run from file:// in an Edge app window (`SwaggerCompare.bat`).

## Files

```
package.json            "type": "module", scripts, electron-builder config ("build" key)
main.js                 app:// protocol handler, BrowserWindow + security settings, blocks navigation
src/index.html          CSP, Monaco AMD loader, bundled renderer, layout (title bar, pane headers, editor, change list); relative paths only
src/style.css
src/renderer.js         Monaco setup, drag&drop/open/clear/swap, live compare (300 ms debounce), list, filters, jump-to-line
src/gen/renderer.js     esbuild output (gitignored): renderer + compare + yaml as one IIFE
scripts/build-web.mjs   builds dist/SwaggerCompare-web.zip (static files + SwaggerCompare.bat)
scripts/SwaggerCompare.bat  opens app/src/index.html in `msedge --app`, falls back to the default browser
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
   - Otherwise: `{ changes: [{ kind: 'added'|'removed'|'changed', text, path: string[], side: 'left'|'right', line }] }`.
4. The list renders `kind`, `text` and `path.join(' › ')`. A click on an item calls `revealLineInCenter(line)` and `setPosition` on the original editor (side `left`, for removals) or the modified editor (side `right`, for added/changed items).

## compare.js internals

- `parseDocument(text, { lineCounter })` parses each side. YAML 1.2 is a superset of JSON, so one code path handles both. The first `doc.errors[0].linePos[0].line` is the reported error line. Duplicate keys are already errors (uniqueKeys).
- Line index: one walk over the CST nodes (`YAMLMap` pairs, `YAMLSeq` items) builds `Map<pathKey, line>`, with `pathKey = JSON.stringify(path)` and the line taken from `lineCounter.linePos(pair.key.range[0])`. A lookup that misses goes to the nearest existing ancestor path, so the line is always defined.
- The structural diff runs on `doc.toJS()` of both sides. Map keys are compared as sets, so key order produces no entries.
- Recognizers are path-context rules that run before the generic fallback:
  - `paths.<p>.<method>` add/remove: "Added endpoint POST /users".
  - `parameters` arrays are matched by `in+name`, never by index. They produce add/remove, `required` change and type change (`type` for 2.0, `schema.type` for 3.x). A 2.0 `in: body` param is treated as a parameter.
  - Schemas live under `definitions.*` (2.0) and `components.schemas.*` (3.x). Recognizers: whole schema add/remove; `properties.*` add/remove/type; the `required` array compared as a set ("User.email: now required" / "no longer required").
  - `responses.<code>` add/remove.
  - `requestBody` (3.x) is not special-cased. It goes through the generic walk.
  - Generic fallback: any remaining leaf or subtree difference gives "Added <path>", "Removed <path>" or "Changed <path>: old → new". A recognizer marks the subtree it consumed, and everything else always reaches the fallback, so no difference is lost. A recognizer consumes only the keys it actually reported on (e.g. a type read from `type` leaves a sibling `$ref` to the fallback). Repeated parameter labels are paired in order (`query 'a'#2`), and parameters without `in`/`name` or `$ref` are compared by position.
- Other arrays are compared by index. `$ref` is compared as a plain string and never resolved.
- Output order is depth-first in key order of the modified side; at each level, keys present only on the original side come after the modified side's keys. (JS objects list integer-like keys such as response codes first, in ascending order.)
- For a wholly added/removed path, the endpoint entries (one per HTTP method) cover the path; its other path-level keys produce no separate entries.
- The Monaco diff runs with `ignoreTrimWhitespace: false`, so whitespace changes are shown.

## Electron security

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, no preload. The renderer needs no Node or IPC.
- `will-navigate` and `setWindowOpenHandler` deny all navigation and new windows.
- CSP meta: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; font-src 'self' data:; img-src 'self' data:; object-src 'none'; base-uri 'none'`. No inline scripts. Monaco needs inline styles and data: images.
- The window loads `app://local/src/index.html`. main.js registers the privileged `app` scheme (standard, secure, supportFetchAPI) and serves files from the app root (works inside asar via `net.fetch` of a file URL). Only `src/` and `node_modules/` are served; anything else returns 403. Everything is local and nothing comes from a CDN.

## Loading Monaco and yaml

- `index.html` loads `../node_modules/monaco-editor/min/vs/loader.js`, then `gen/renderer.js`. The renderer calls `window.require.config({ paths: { vs } })` with a URL relative to the page, so it resolves under both `app://local/` and `file:///`.
- Workers: under app:// a blob worker `importScripts` `workerMain.js`. Under file:// `getWorkerUrl` throws, and Monaco runs the diff on the main thread.
- `compare.js` stays a plain ES module importing `yaml`; Node runs it directly in tests, esbuild inlines it (and `yaml`) into the bundle.

## Build and distribution

- `npm run bundle` runs esbuild; `npm start` bundles, then runs `electron .`
- `npm test` runs `node --test`
- `npm run web` bundles and builds `dist/SwaggerCompare-web.zip` (~4 MB): `SwaggerCompare.bat` + `app/` with the page, Monaco `min/vs` and the used font weights.
- `npm run dist` bundles, builds the portable exe, zips it as `SwaggerCompare-win.zip`, then builds the web zip.
- electron-builder config: `win.target: portable`, `artifactName: "SwaggerCompare.exe"`. `files` excludes `node_modules/monaco-editor/{esm,dev,min-maps}/**` to keep the exe small. asar is on.
- No code signing, no CI, no Linux.
