// Builds dist/SwaggerCompare-web.zip with the same layout as the repo root:
// SwaggerCompare.bat, src/ (page + bundled renderer), vendor/ (Monaco, fonts).
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const out = 'dist/web';
rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/src/gen`, { recursive: true });

cpSync('SwaggerCompare.bat', `${out}/SwaggerCompare.bat`);
for (const f of ['index.html', 'style.css', 'gen/renderer.js']) cpSync(`src/${f}`, `${out}/src/${f}`);
cpSync('vendor', `${out}/vendor`, { recursive: true });
cpSync('examples', `${out}/examples`, { recursive: true }); // sample specs to try the app with

execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Force -Path '${out}/*' -DestinationPath 'dist/SwaggerCompare-web.zip'`], { stdio: 'inherit' });
console.log('built dist/SwaggerCompare-web.zip');
