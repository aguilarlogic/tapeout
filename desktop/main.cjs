// Tapeout's desktop shell (doc section 13a): one window showing the same single-file game, sandboxed and offline.
// No preload and no Node in the page. Window size, position and fullscreen are remembered in userData.
const { app, BrowserWindow, Menu, screen, session, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const dev = process.argv.includes('--dev');
const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');

function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    // forget a position that is no longer on any screen (a monitor was unplugged)
    const visible = screen.getAllDisplays().some(({ workArea: a }) => s.x < a.x + a.width && s.x + s.width > a.x && s.y < a.y + a.height && s.y + s.height > a.y);
    return visible ? s : { width: s.width, height: s.height, fullscreen: s.fullscreen, maximized: s.maximized };
  } catch {
    return null;
  }
}

function saveState(win) {
  try {
    fs.writeFileSync(stateFile(), JSON.stringify({ ...win.getNormalBounds(), fullscreen: win.isFullScreen(), maximized: win.isMaximized() }));
  } catch { /* not fatal: the next launch opens at the default size */ }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, done) => done(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  const s = loadState();
  const win = new BrowserWindow({
    title: 'Tapeout',
    width: s?.width ?? 1280,
    height: s?.height ?? 720,
    x: s?.x,
    y: s?.y,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: '#0B0A1A',
    show: false,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, devTools: dev },
  });
  win.once('ready-to-show', () => {
    if (s?.maximized) win.maximize();
    if (s?.fullscreen) win.setFullScreen(true);
    win.show();
  });
  win.on('page-title-updated', (e) => e.preventDefault());
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && (input.key === 'F11' || (input.alt && input.key === 'Enter'))) {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    }
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.on('close', () => saveState(win));
  if (dev) win.webContents.openDevTools({ mode: 'detach' });
  void win.loadFile(path.join(__dirname, 'app', 'Tapeout.html'));
});

app.on('window-all-closed', () => app.quit());
