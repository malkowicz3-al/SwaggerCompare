import { app, BrowserWindow, protocol, net } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

app.whenReady().then(() => {
  const root = app.getAppPath();
  const allowed = [path.join(root, 'src') + path.sep, path.join(root, 'node_modules') + path.sep];
  protocol.handle('app', (req) => {
    const file = path.join(root, decodeURIComponent(new URL(req.url).pathname));
    if (!allowed.some((dir) => file.startsWith(dir))) return new Response('forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).href);
  });

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0E1525',
    // custom title bar; native window buttons drawn by the OS over the top-right corner
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0E1525', symbolColor: '#8A96AE', height: 48 },
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.loadURL('app://local/src/index.html');
});

app.on('window-all-closed', () => app.quit());
