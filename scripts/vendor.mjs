// Copies the runtime files the page needs from node_modules into vendor/ (committed to git),
// so a plain "Download ZIP" of the repo runs via SwaggerCompare.bat without npm install.
import { cpSync, rmSync, mkdirSync, readdirSync, existsSync } from 'node:fs';

const vs = 'node_modules/monaco-editor/min/vs';
rmSync('vendor', { recursive: true, force: true });

// Monaco core + YAML highlighting only; other languages and translations are never used
for (const p of ['loader.js', 'editor', 'base', 'basic-languages/yaml']) cpSync(`${vs}/${p}`, `vendor/monaco/vs/${p}`, { recursive: true });
cpSync('node_modules/monaco-editor/LICENSE', 'vendor/monaco/LICENSE');

// only the font weights index.html links
const fonts = { 'ibm-plex-sans': ['400', '500', '600'], 'jetbrains-mono': ['400', '500'] };
for (const [pkg, weights] of Object.entries(fonts)) {
  const src = `node_modules/@fontsource/${pkg}`;
  const dst = `vendor/fonts/${pkg}`;
  mkdirSync(`${dst}/files`, { recursive: true });
  cpSync(`${src}/LICENSE`, `${dst}/LICENSE`);
  for (const w of weights) cpSync(`${src}/${w}.css`, `${dst}/${w}.css`);
  for (const f of readdirSync(`${src}/files`)) if (weights.some((w) => f.includes(`-${w}-normal.`))) cpSync(`${src}/files/${f}`, `${dst}/files/${f}`);
  if (!readdirSync(`${dst}/files`).length) throw new Error(`no font files copied for ${pkg}`);
}

for (const f of ['vendor/monaco/vs/loader.js', 'vendor/monaco/vs/editor/editor.main.js', 'vendor/monaco/vs/base/worker/workerMain.js', 'vendor/monaco/vs/basic-languages/yaml/yaml.js'])
  if (!existsSync(f)) throw new Error(`missing ${f}`);
console.log('vendor/ ready');
