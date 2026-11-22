# SwaggerCompare

Windows desktop app that compares two Swagger 2.0 / OpenAPI 3.x documents (YAML or JSON). It shows a side-by-side text diff and a live list of structural changes (endpoints, parameters, responses, schemas, properties) that updates as you type. Click a change to jump to its line.

## Download

Two builds are attached to each [release](../../releases). Pick one:

- **`SwaggerCompare-web.zip`** (recommended where `.exe` files are blocked): unzip, double-click `SwaggerCompare.bat`. It opens the app in a Microsoft Edge app window; nothing is installed and no program of ours runs. If Windows asks about running the `.bat`, choose **Run** (or right-click the zip → Properties → **Unblock** before unzipping).
- **`SwaggerCompare-win.zip`**: unzip, run `SwaggerCompare.exe`. The exe is unsigned, so SmartScreen may warn: **More info** → **Run anyway**.

Paste text or drop a file onto each pane; the change list updates on its own.

## Development

```
npm install
node node_modules/electron/install.js   # once, if npm blocked Electron's install script
npm start      # bundle and run the app
npm test       # run tests
npm run web    # build dist/SwaggerCompare-web.zip (bat + static files)
npm run dist   # build both zips (Windows only)
```
