# SwaggerCompare

Windows desktop app that compares two Swagger 2.0 / OpenAPI 3.x documents (YAML or JSON). It shows a side-by-side text diff and a list of structural changes (endpoints, parameters, responses, schemas, properties). Click a change to jump to its line.

## Download

1. Download `SwaggerCompare-win.zip` from [Releases](../../releases).
2. Unzip it.
3. Run `SwaggerCompare.exe`. The exe is unsigned, so Windows SmartScreen may warn: click **More info** → **Run anyway**.

Paste text or drop a file onto each pane, then click **Compare**.

## Development

```
npm install
npm start      # run the app
npm test       # run tests
npm run dist   # build dist/SwaggerCompare.exe and dist/SwaggerCompare-win.zip (Windows only)
```
