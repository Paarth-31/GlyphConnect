import { app, BrowserWindow, desktopCapturer, ipcMain, dialog, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import http from 'http';

app.disableHardwareAcceleration();

const isProd = process.env.NODE_ENV === 'production';
let mainWindow: BrowserWindow | null = null;

// Recordings auto-save to ~/Videos/RDA-Recordings/
const RECORDINGS_DIR = path.join(app.getPath('videos'), 'RDA-Recordings');

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Strip CSP headers
  mainWindow.webContents.session.webRequest.onHeadersReceived(
    { urls: ['http://localhost:8180/*', 'http://localhost:5173/*', '*://*/*'] },
    (details, callback) => {
      const headers = { ...details.responseHeaders };
      delete headers['content-security-policy'];
      delete headers['Content-Security-Policy'];
      delete headers['x-frame-options'];
      delete headers['X-Frame-Options'];
      callback({ responseHeaders: headers });
    }
  );

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (
      url.startsWith('http://localhost:5173') ||
      url.startsWith('http://localhost:8180')
    ) return;
    event.preventDefault();
  });

  // Screen capture source picker
  let pendingCallback: ((streams: any) => void) | null = null;

  mainWindow.webContents.session.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
      pendingCallback = callback;
      mainWindow!.webContents.send(
        'get-sources-response',
        sources.map(s => ({ id: s.id, name: s.name, thumbnail: s.thumbnail.toDataURL() }))
      );
    });
  });

  ipcMain.on('select-source', (_event, sourceId: string) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
      const selected = sources.find(s => s.id === sourceId);
      if (selected && pendingCallback) {
        pendingCallback({ video: selected, audio: 'loopback' });
        pendingCallback = null;
      }
    });
  });

  // Certificate trust
  mainWindow.webContents.session.setCertificateVerifyProc((request, callback) => {
    const { hostname } = request;
    if (hostname === 'rda-signaling.duckdns.org' || hostname === 'localhost') {
      callback(0);
    } else {
      callback(-2);
    }
  });

  ipcMain.handle('get-sources', async () => {
    const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
    }));
  });

  // Save recording — auto-saves to RECORDINGS_DIR with no dialog
  ipcMain.on('save-recording', async (_event, { data, mimeType }: { data: number[]; mimeType: string }) => {
    if (!fs.existsSync(RECORDINGS_DIR)) {
      fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = mimeType.includes('webm') ? 'webm' : 'mp4';
    const defaultName = `RDA-Recording-${timestamp}.${ext}`;
    const autoPath = path.join(RECORDINGS_DIR, defaultName);

    try {
      const buffer = Buffer.from(data);
      fs.writeFileSync(autoPath, buffer);
      console.log(`[Recording] Saved to: ${autoPath}`);
      mainWindow?.webContents.send('recording-saved', { filePath: autoPath });
    } catch (err) {
      console.error('[Recording] Auto-save failed, showing dialog:', err);
      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow!, {
        title: 'Save Recording',
        defaultPath: autoPath,
        filters: [
          { name: 'WebM Video', extensions: ['webm'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      if (!canceled && filePath) {
        const buffer = Buffer.from(data);
        fs.writeFile(filePath, buffer, (e) => {
          if (e) console.error('Failed to save recording:', e);
          else console.log('Recording saved to:', filePath);
        });
      }
    }
  });

  // List recordings from disk
  ipcMain.handle('list-recordings', async () => {
    try {
      if (!fs.existsSync(RECORDINGS_DIR)) return [];
      const files = fs.readdirSync(RECORDINGS_DIR)
        .filter(f => f.endsWith('.webm') || f.endsWith('.mp4'))
        .map(f => {
          const fullPath = path.join(RECORDINGS_DIR, f);
          const stat = fs.statSync(fullPath);
          return {
            id: fullPath,
            name: f.replace(/^RDA-Recording-/, '').replace(/\.\w+$/, '').replace(/-/g, ' ').trim() || f,
            path: fullPath,
            size: stat.size,
            duration: 0,
            createdAt: stat.birthtime.toISOString(),
          };
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return files;
    } catch (err) {
      console.error('Failed to list recordings:', err);
      return [];
    }
  });

  ipcMain.on('open-file', (_event, filePath: string) => {
    shell.openPath(filePath);
  });

  ipcMain.on('export-recording', async (_event, filePath: string) => {
    const fileName = path.basename(filePath);
    const { filePath: destPath, canceled } = await dialog.showSaveDialog(mainWindow!, {
      title: 'Export Recording',
      defaultPath: path.join(app.getPath('downloads'), fileName),
      filters: [
        { name: 'Video Files', extensions: ['webm', 'mp4'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (!canceled && destPath) {
      fs.copyFile(filePath, destPath, (err) => {
        if (err) console.error('Export failed:', err);
      });
    }
  });

  ipcMain.handle('delete-recording', async (_event, filePath: string) => {
    try {
      if (!filePath.startsWith(RECORDINGS_DIR)) {
        console.warn('Refused to delete file outside recordings dir:', filePath);
        return false;
      }
      fs.unlinkSync(filePath);
      return true;
    } catch (err) {
      console.error('Delete failed:', err);
      return false;
    }
  });

  // Expose recordings directory path to renderer
  ipcMain.handle('get-recordings-dir', () => RECORDINGS_DIR);

  // Google OAuth handler
  let oauthCallbackServer: http.Server | null = null;
  ipcMain.handle('start-google-oauth', async (_event, url: string) => {
    return new Promise<string>((resolve, reject) => {
      oauthCallbackServer = http.createServer((req, res) => {
        const fullUrl = new URL(req.url!, 'http://localhost:5174');
        const code  = fullUrl.searchParams.get('code');
        const state = fullUrl.searchParams.get('state');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<html><body style="background:#080809;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2>✅ Signed in successfully</h2><p style="color:rgba(255,255,255,0.4)">You can close this tab and return to GlyphConnect</p></div></html>`);
        if (oauthCallbackServer) { oauthCallbackServer.close(); oauthCallbackServer = null; }
        if (code && state === 'google_oauth') resolve(code);
        else reject(new Error('OAuth callback missing code'));
      });
      oauthCallbackServer.listen(5174, () => { shell.openExternal(url); });
      setTimeout(() => {
        if (oauthCallbackServer) { oauthCallbackServer.close(); oauthCallbackServer = null; }
        reject(new Error('OAuth timeout'));
      }, 5 * 60 * 1000);
    });
  });

  if (isProd) {
    await mainWindow.loadURL(`file://${path.join(__dirname, '../renderer/out/index.html')}`);
  } else {
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  }
}

app.on('ready', createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });