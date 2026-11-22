# 0001: Electron + electron-builder portable target, zipped with PowerShell

## Context
Users download one file from GitHub Releases and have no Node installed. The release must be a single exe inside a zip. The build runs on Windows only.

## Decision
- The app is built on Electron. electron-builder produces `win.target: portable` with `artifactName: SwaggerCompare.exe`.
- PowerShell `Compress-Archive` then packs that exe into `SwaggerCompare-win.zip`. electron-builder's own `zip` target zips the unpacked folder, not the portable exe, so it does not fit.
- electron-packager was rejected because it outputs a folder, not a single exe.
- Runtime libraries (`monaco-editor`, `yaml`) go in `dependencies` so that electron-builder packs them.

## Consequences
- Each run of the portable exe self-extracts to %TEMP%, so startup takes a few seconds.
- The exe is unsigned, so SmartScreen shows a warning.
- `npm run dist` works only on Windows.
- Moving to an installer (NSIS) later would require changing only the target.
