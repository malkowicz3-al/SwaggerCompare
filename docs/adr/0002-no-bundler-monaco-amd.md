# 0002: No bundler; Monaco via AMD loader pinned to 0.52.2; yaml via import map

## Context
The app should stay simple and use no bundler. The renderer needs Monaco and `yaml`, and the comparison module has to run both in `node --test` and in the renderer. Monaco 0.53 deprecated the AMD build (it still ships but is no longer supported), and 0.56 removed AMD internals.

## Decision
- `monaco-editor` is pinned exactly to `0.52.2`. It loads through `node_modules/monaco-editor/min/vs/loader.js` and `require(['vs/editor/editor.main'])`.
- `src/compare.js` is a plain ES module that imports the bare specifier `yaml`. Node resolves it normally. In the renderer, an import map points `yaml` to `node_modules/yaml/browser/index.js`.

## Consequences
- There is no build step: the files are loaded as they are.
- Upgrading Monaco past 0.52 means introducing a bundler (for example esbuild) for the ESM build. That decision is deferred until a needed feature or a security fix requires it.
- If file:// ES modules or Monaco web workers ever break under asar, the fix is a custom `app://` protocol (`protocol.handle`) in main.js. The structure does not change.
