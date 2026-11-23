# SwaggerCompare

Windows desktop app that compares two Swagger 2.0 / OpenAPI 3.x documents (YAML or JSON). It shows a side-by-side text diff and a live list of structural changes (endpoints, parameters, responses, schemas, properties) that updates as you type. Click a change to jump to its line.

## Run it

Any of these works; no install, no Node.js:

- **Code → Download ZIP** on this page (or `SwaggerCompare-web.zip` from [Releases](../../releases)): unzip, double-click `SwaggerCompare.bat` in the unzipped folder. It opens the app in a Microsoft Edge app window. If Windows asks about running the `.bat`, choose **Run** (or right-click the zip → Properties → **Unblock** before unzipping). If `.bat` files are blocked too, open `src\index.html` in Edge or Chrome.
- **`SwaggerCompare-win.zip`** from Releases: unzip, run `SwaggerCompare.exe`. The exe is unsigned, so SmartScreen may warn: **More info** → **Run anyway**.

Paste text or drop a file onto each pane; the change list updates on its own.

## Development

```
npm install
node node_modules/electron/install.js   # once, if npm blocked Electron's install script
npm start      # build and run the Electron app
npm test       # run tests
npm run dist   # build dist/SwaggerCompare-win.zip and dist/SwaggerCompare-web.zip (Windows only)
```

`npm run build` regenerates `src/gen/renderer.js` (esbuild bundle) and `vendor/` (Monaco and fonts copied from node_modules). Both are committed so the repo itself runs from `SwaggerCompare.bat`: run `npm run build` and commit them after changing `src/`.
