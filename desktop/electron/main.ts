import { app, BrowserWindow } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

const ROOT_DIR = dirname(fileURLToPath(import.meta.url));

let win: BrowserWindow | null = null;

async function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 780,
    webPreferences: {
      preload: join(ROOT_DIR, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'GeoAI MetaPanel',
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    await win.loadURL(devUrl);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    await win.loadFile(join(ROOT_DIR, '../index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

