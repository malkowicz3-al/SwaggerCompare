# 0003: esbuild bundle and an Edge launcher next to the exe

Status: accepted (supersedes the import-map part of ADR 0002)

## Context

Some Windows machines block unsigned .exe files. A page opened from file:// can't use ES modules or import maps (origin `null`), and can't start Monaco workers.

## Decision

- esbuild (dev dependency) bundles `src/renderer.js` with `compare.js` and `yaml` into `src/gen/renderer.js`, an IIFE loaded as a classic script. Monaco stays on its AMD `min/vs` build.
- All page URLs are relative, so one `index.html` works under Electron's `app://` and under file://.
- `SwaggerCompare-web.zip` ships those files with `SwaggerCompare.bat`, which opens the page in `msedge --app` (default browser as a fallback). Edge is present on every Windows 10/11 machine.
- Under file://, Monaco's diff runs on the main thread, which is fine for normal spec sizes.

## Consequences

- `npm start`, `web` and `dist` run the bundle step first; `src/gen/` is gitignored.
- The exe build stays as a second download.
