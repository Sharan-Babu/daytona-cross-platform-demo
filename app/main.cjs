const { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } = require('electron');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { normalizedSystemInfo } = require('../lib/platform.cjs');

// Keep automated QA notes separate from a person's normal app profile.
if (process.env.PLATFORM_PULSE_TEST === '1') {
  app.setPath('userData', path.join(os.tmpdir(), `platform-pulse-test-${process.pid}`));
}

const WINDOW = { width: 1000, height: 720, x: 24, y: 24 };

function notePath() {
  return path.join(app.getPath('userData'), 'platform-pulse-note.json');
}

async function loadNote() {
  try {
    const value = JSON.parse(await fs.readFile(notePath(), 'utf8'));
    return typeof value.note === 'string' ? value.note : '';
  } catch {
    return '';
  }
}

async function createWindow() {
  const window = new BrowserWindow({
    ...WINDOW,
    minWidth: 860,
    minHeight: 640,
    show: false,
    backgroundColor: '#090d18',
    title: 'Platform Pulse',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await window.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  window.once('ready-to-show', () => window.show());
  return window;
}

ipcMain.handle('system:info', () => ({
  ...normalizedSystemInfo({
    platform: process.platform,
    arch: process.arch,
    release: os.release(),
    hostname: os.hostname(),
    cpus: os.cpus(),
    totalmem: os.totalmem()
  }),
  node: process.versions.node,
  chrome: process.versions.chrome,
  electron: process.versions.electron,
  locale: app.getLocale(),
  darkMode: nativeTheme.shouldUseDarkColors
}));

ipcMain.handle('diagnostics:run', async () => {
  const tempFile = path.join(app.getPath('temp'), `platform-pulse-${Date.now()}.txt`);
  await fs.writeFile(tempFile, `Platform Pulse diagnostic on ${process.platform}\n`, 'utf8');
  const written = (await fs.stat(tempFile)).size > 0;
  await fs.unlink(tempFile);

  return [
    { name: 'Electron renderer', status: 'pass', detail: process.versions.electron },
    { name: 'Native filesystem', status: written ? 'pass' : 'fail', detail: app.getPath('temp') },
    { name: 'Secure IPC bridge', status: 'pass', detail: 'contextIsolation=true' },
    { name: 'Platform runtime', status: 'pass', detail: `${process.platform}/${process.arch}` }
  ];
});

ipcMain.handle('note:load', loadNote);
ipcMain.handle('note:save', async (_event, note) => {
  const safeNote = String(note).slice(0, 500);
  await fs.writeFile(notePath(), JSON.stringify({ note: safeNote }, null, 2), 'utf8');
  return { saved: true, bytes: Buffer.byteLength(safeNote) };
});

ipcMain.handle('native:proof', async () => {
  const result = await dialog.showMessageBox({
    type: 'info',
    title: 'Native desktop proof',
    message: `Hello from ${process.platform === 'win32' ? 'Windows' : process.platform}!`,
    detail: 'This is a native Electron dialog, not an HTML modal.',
    buttons: ['Looks good'],
    defaultId: 0
  });
  return result.response;
});

ipcMain.handle('external:open', (_event, url) => shell.openExternal(url));

app.whenReady().then(async () => {
  await createWindow();
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

