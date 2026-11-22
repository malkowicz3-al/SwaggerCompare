// Builds dist/SwaggerCompare-web.zip: SwaggerCompare.bat + app/ (static files opened in an Edge app window).
import { cpSync, rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const out = 'dist/web';
const app = `${out}/app`;
rmSync(out, { recursive: true, force: true });
mkdirSync(`${app}/src/gen`, { recursive: true });

for (const f of ['index.html', 'style.css', 'gen/renderer.js']) cpSync(`src/${f}`, `${app}/src/${f}`);
cpSync('node_modules/monaco-editor/min/vs', `${app}/node_modules/monaco-editor/min/vs`, { recursive: true });

// only the font weights index.html links
const fonts = { 'ibm-plex-sans': ['400', '500', '600'], 'jetbrains-mono': ['400', '500'] };
for (const [pkg, weights] of Object.entries(fonts)) {
  const src = `node_modules/@fontsource/${pkg}`;
  const dst = `${app}/node_modules/@fontsource/${pkg}`;
  mkdirSync(`${dst}/files`, { recursive: true });
  for (const w of weights) cpSync(`${src}/${w}.css`, `${dst}/${w}.css`);
  for (const f of readdirSync(`${src}/files`)) if (weights.some((w) => f.includes(`-${w}-normal.`))) cpSync(`${src}/files/${f}`, `${dst}/files/${f}`);
}

// cmd.exe needs CRLF line endings, whatever git checked out
writeFileSync(`${out}/SwaggerCompare.bat`, readFileSync('scripts/SwaggerCompare.bat', 'utf8').replace(/\r?\n/g, '\r\n'));

execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Force -Path '${out}/*' -DestinationPath 'dist/SwaggerCompare-web.zip'`], { stdio: 'inherit' });
console.log('built dist/SwaggerCompare-web.zip');
