// import { app, BrowserWindow, desktopCapturer, ipcMain, dialog, shell } from 'electron';
// import fs from 'fs';
// import path from 'path';
// import http from 'http';

// app.disableHardwareAcceleration();

// const isProd = process.env.NODE_ENV === 'production';
// let mainWindow: BrowserWindow | null = null;

// // Recordings auto-save to ~/Videos/RDA-Recordings/
// const RECORDINGS_DIR = path.join(app.getPath('videos'), 'RDA-Recordings');

// async function createWindow() {
//   mainWindow = new BrowserWindow({
//     width: 1280,
//     height: 720,
//     webPreferences: {
//       nodeIntegration: false,
//       contextIsolation: true,
//       preload: path.join(__dirname, 'preload.js'),
//     },
//   });

//   // Strip CSP headers
//   mainWindow.webContents.session.webRequest.onHeadersReceived(
//     { urls: ['http://localhost:8180/*', 'http://localhost:5173/*', '*://*/*'] },
//     (details, callback) => {
//       const headers = { ...details.responseHeaders };
//       delete headers['content-security-policy'];
//       delete headers['Content-Security-Policy'];
//       delete headers['x-frame-options'];
//       delete headers['X-Frame-Options'];
//       callback({ responseHeaders: headers });
//     }
//   );

//   mainWindow.webContents.on('will-navigate', (event, url) => {
//     if (
//       url.startsWith('http://localhost:5173') ||
//       url.startsWith('http://localhost:8180')
//     ) return;
//     event.preventDefault();
//   });

//   // Screen capture source picker
//   let pendingCallback: ((streams: any) => void) | null = null;

//   mainWindow.webContents.session.setDisplayMediaRequestHandler((_request, callback) => {
//     desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
//       pendingCallback = callback;
//       mainWindow!.webContents.send(
//         'get-sources-response',
//         sources.map(s => ({ id: s.id, name: s.name, thumbnail: s.thumbnail.toDataURL() }))
//       );
//     });
//   });

//   ipcMain.on('select-source', (_event, sourceId: string) => {
//     desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
//       const selected = sources.find(s => s.id === sourceId);
//       if (selected && pendingCallback) {
//         pendingCallback({ video: selected, audio: 'loopback' });
//         pendingCallback = null;
//       }
//     });
//   });

//   // Certificate trust
//   mainWindow.webContents.session.setCertificateVerifyProc((request, callback) => {
//     const { hostname } = request;
//     if (hostname === 'rda-signaling.duckdns.org' || hostname === 'localhost') {
//       callback(0);
//     } else {
//       callback(-2);
//     }
//   });

//   ipcMain.handle('get-sources', async () => {
//     const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
//     return sources.map(source => ({
//       id: source.id,
//       name: source.name,
//       thumbnail: source.thumbnail.toDataURL(),
//     }));
//   });

//   // Save recording — auto-saves to RECORDINGS_DIR with no dialog
//   ipcMain.on('save-recording', async (_event, { data, mimeType }: { data: number[]; mimeType: string }) => {
//     if (!fs.existsSync(RECORDINGS_DIR)) {
//       fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
//     }

//     const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
//     const ext = mimeType.includes('webm') ? 'webm' : 'mp4';
//     const defaultName = `RDA-Recording-${timestamp}.${ext}`;
//     const autoPath = path.join(RECORDINGS_DIR, defaultName);

//     try {
//       const buffer = Buffer.from(data);
//       fs.writeFileSync(autoPath, buffer);
//       console.log(`[Recording] Saved to: ${autoPath}`);
//       mainWindow?.webContents.send('recording-saved', { filePath: autoPath });
//     } catch (err) {
//       console.error('[Recording] Auto-save failed, showing dialog:', err);
//       const { filePath, canceled } = await dialog.showSaveDialog(mainWindow!, {
//         title: 'Save Recording',
//         defaultPath: autoPath,
//         filters: [
//           { name: 'WebM Video', extensions: ['webm'] },
//           { name: 'All Files', extensions: ['*'] },
//         ],
//       });
//       if (!canceled && filePath) {
//         const buffer = Buffer.from(data);
//         fs.writeFile(filePath, buffer, (e) => {
//           if (e) console.error('Failed to save recording:', e);
//           else console.log('Recording saved to:', filePath);
//         });
//       }
//     }
//   });

//   // List recordings from disk
//   ipcMain.handle('list-recordings', async () => {
//     try {
//       if (!fs.existsSync(RECORDINGS_DIR)) return [];
//       const files = fs.readdirSync(RECORDINGS_DIR)
//         .filter(f => f.endsWith('.webm') || f.endsWith('.mp4'))
//         .map(f => {
//           const fullPath = path.join(RECORDINGS_DIR, f);
//           const stat = fs.statSync(fullPath);
//           return {
//             id: fullPath,
//             name: f.replace(/^RDA-Recording-/, '').replace(/\.\w+$/, '').replace(/-/g, ' ').trim() || f,
//             path: fullPath,
//             size: stat.size,
//             duration: 0,
//             createdAt: stat.birthtime.toISOString(),
//           };
//         })
//         .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
//       return files;
//     } catch (err) {
//       console.error('Failed to list recordings:', err);
//       return [];
//     }
//   });

//   ipcMain.on('open-file', (_event, filePath: string) => {
//     shell.openPath(filePath);
//   });

//   ipcMain.on('export-recording', async (_event, filePath: string) => {
//     const fileName = path.basename(filePath);
//     const { filePath: destPath, canceled } = await dialog.showSaveDialog(mainWindow!, {
//       title: 'Export Recording',
//       defaultPath: path.join(app.getPath('downloads'), fileName),
//       filters: [
//         { name: 'Video Files', extensions: ['webm', 'mp4'] },
//         { name: 'All Files', extensions: ['*'] },
//       ],
//     });
//     if (!canceled && destPath) {
//       fs.copyFile(filePath, destPath, (err) => {
//         if (err) console.error('Export failed:', err);
//       });
//     }
//   });

//   ipcMain.handle('delete-recording', async (_event, filePath: string) => {
//     try {
//       if (!filePath.startsWith(RECORDINGS_DIR)) {
//         console.warn('Refused to delete file outside recordings dir:', filePath);
//         return false;
//       }
//       fs.unlinkSync(filePath);
//       return true;
//     } catch (err) {
//       console.error('Delete failed:', err);
//       return false;
//     }
//   });

//   // Expose recordings directory path to renderer
//   ipcMain.handle('get-recordings-dir', () => RECORDINGS_DIR);

//   // Google OAuth handler
//   let oauthCallbackServer: http.Server | null = null;
//   ipcMain.handle('start-google-oauth', async (_event, url: string) => {
//     return new Promise<string>((resolve, reject) => {
//       oauthCallbackServer = http.createServer((req, res) => {
//         const fullUrl = new URL(req.url!, 'http://localhost:5174');
//         const code  = fullUrl.searchParams.get('code');
//         const state = fullUrl.searchParams.get('state');
//         res.writeHead(200, { 'Content-Type': 'text/html' });
//         res.end(`<html><body style="background:#080809;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2>✅ Signed in successfully</h2><p style="color:rgba(255,255,255,0.4)">You can close this tab and return to GlyphConnect</p></div></html>`);
//         if (oauthCallbackServer) { oauthCallbackServer.close(); oauthCallbackServer = null; }
//         if (code && state === 'google_oauth') resolve(code);
//         else reject(new Error('OAuth callback missing code'));
//       });
//       oauthCallbackServer.listen(5174, () => { shell.openExternal(url); });
//       setTimeout(() => {
//         if (oauthCallbackServer) { oauthCallbackServer.close(); oauthCallbackServer = null; }
//         reject(new Error('OAuth timeout'));
//       }, 5 * 60 * 1000);
//     });
//   });

//   if (isProd) {
//     await mainWindow.loadURL(`file://${path.join(__dirname, '../renderer/out/index.html')}`);
//   } else {
//     await mainWindow.loadURL('http://localhost:5173');
//     mainWindow.webContents.openDevTools();
//   }
// }

// app.on('ready', createWindow);
// app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
// app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });



import { app, BrowserWindow, desktopCapturer, ipcMain, dialog, shell, clipboard, session } from 'electron';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { mouse, keyboard, Point, Button, Key, screen } from '@nut-tree-fork/nut-js';

// Map DOM KeyboardEvent key/code to nut-js Key enum
function mapKey(keyName?: string, code?: string): Key | null {
  if (code) {
    if (code.startsWith('Key') && code.length === 4) {
      const letter = code.charCodeAt(3) - 65;
      if (letter >= 0 && letter <= 25) {
        return [Key.A, Key.B, Key.C, Key.D, Key.E, Key.F, Key.G, Key.H, Key.I, Key.J, Key.K, Key.L, Key.M, Key.N, Key.O, Key.P, Key.Q, Key.R, Key.S, Key.T, Key.U, Key.V, Key.W, Key.X, Key.Y, Key.Z][letter];
      }
    }
    if (code.startsWith('Digit') && code.length === 6) {
      const digit = code.charCodeAt(5) - 48;
      if (digit >= 0 && digit <= 9) {
        return [Key.Num0, Key.Num1, Key.Num2, Key.Num3, Key.Num4, Key.Num5, Key.Num6, Key.Num7, Key.Num8, Key.Num9][digit];
      }
    }
    const codeMap: Record<string, Key> = {
      Enter: Key.Enter, NumpadEnter: Key.Enter,
      Backspace: Key.Backspace, Tab: Key.Tab, Escape: Key.Escape, Space: Key.Space,
      ShiftLeft: Key.LeftShift, ShiftRight: Key.RightShift,
      ControlLeft: Key.LeftControl, ControlRight: Key.RightControl,
      AltLeft: Key.LeftAlt, AltRight: Key.RightAlt,
      MetaLeft: Key.LeftSuper, MetaRight: Key.RightSuper, OSLeft: Key.LeftSuper, OSRight: Key.RightSuper,
      ArrowUp: Key.Up, ArrowDown: Key.Down, ArrowLeft: Key.Left, ArrowRight: Key.Right,
      Delete: Key.Delete, Home: Key.Home, End: Key.End,
      PageUp: Key.PageUp, PageDown: Key.PageDown,
      Insert: Key.Insert, CapsLock: Key.CapsLock,
      F1: Key.F1, F2: Key.F2, F3: Key.F3, F4: Key.F4, F5: Key.F5, F6: Key.F6,
      F7: Key.F7, F8: Key.F8, F9: Key.F9, F10: Key.F10, F11: Key.F11, F12: Key.F12,
      Minus: Key.Minus, Equal: Key.Equal, BracketLeft: Key.LeftBracket, BracketRight: Key.RightBracket,
      Backslash: Key.Backslash, Semicolon: Key.Semicolon, Quote: Key.Quote,
      Comma: Key.Comma, Period: Key.Period, Slash: Key.Slash, Backquote: Key.Grave,
    };
    if (codeMap[code]) return codeMap[code];
  }

  if (!keyName) return null;
  const k = keyName.toLowerCase();
  if (k === 'enter') return Key.Enter;
  if (k === 'backspace') return Key.Backspace;
  if (k === 'tab') return Key.Tab;
  if (k === 'escape') return Key.Escape;
  if (k === 'shift') return Key.LeftShift;
  if (k === 'control') return Key.LeftControl;
  if (k === 'alt') return Key.LeftAlt;
  if (k === 'meta' || k === 'os') return Key.LeftSuper;
  if (k === 'arrowup') return Key.Up;
  if (k === 'arrowdown') return Key.Down;
  if (k === 'arrowleft') return Key.Left;
  if (k === 'arrowright') return Key.Right;
  if (k === 'delete') return Key.Delete;
  if (k === 'home') return Key.Home;
  if (k === 'end') return Key.End;
  if (k === ' ') return Key.Space;
  if (k.length === 1 && k >= 'a' && k <= 'z') {
    const keys = [Key.A, Key.B, Key.C, Key.D, Key.E, Key.F, Key.G, Key.H, Key.I, Key.J, Key.K, Key.L, Key.M, Key.N, Key.O, Key.P, Key.Q, Key.R, Key.S, Key.T, Key.U, Key.V, Key.W, Key.X, Key.Y, Key.Z];
    return keys[k.charCodeAt(0) - 97];
  }
  if (k.length === 1 && k >= '0' && k <= '9') {
    const keys = [Key.Num0, Key.Num1, Key.Num2, Key.Num3, Key.Num4, Key.Num5, Key.Num6, Key.Num7, Key.Num8, Key.Num9];
    return keys[k.charCodeAt(0) - 48];
  }
  return null;
}

app.disableHardwareAcceleration();

const isProd = app.isPackaged;
let mainWindow: BrowserWindow | null = null;

// ── [FIX 1] Recordings are always saved to ~/Videos/RDA-Recordings on the
//    SERVER (host) machine. The path is created if it doesn't exist.
//    The save-dialog default path points there, so the user just clicks Save.
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

  // Allow camera/microphone/screen capture in the Electron renderer (required on Windows)
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['media', 'display-capture', 'mediaKeySystem', 'clipboard-read', 'clipboard-sanitized-write'];
    callback(allowed.includes(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    const allowed = ['media', 'display-capture', 'mediaKeySystem', 'clipboard-read', 'clipboard-sanitized-write'];
    return allowed.includes(permission);
  });

  // Strip CSP headers so Vite/Keycloak can communicate freely
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

  // ── [FIX 1] Save recording to RECORDINGS_DIR (~/Videos/RDA-Recordings) ──────
  // The directory is created automatically. A save dialog opens defaulting to
  // that folder so the user always knows where their recordings land.
  ipcMain.on('save-recording', async (_event, { data, mimeType }: { data: number[]; mimeType: string }) => {
    // Ensure the recordings directory exists
    if (!fs.existsSync(RECORDINGS_DIR)) {
      fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('webm') ? 'webm' : 'mp4';
    const defaultName = `RDA-Recording-${timestamp}.${ext}`;
    // Auto-save path (no dialog) — goes straight to RECORDINGS_DIR
    const autoPath = path.join(RECORDINGS_DIR, defaultName);

    try {
      const buffer = Buffer.from(data);
      fs.writeFileSync(autoPath, buffer);
      console.log(`[Recording] Saved to: ${autoPath}`);

      // Notify renderer of where the file was saved
      mainWindow?.webContents.send('recording-saved', { filePath: autoPath });
    } catch (err) {
      console.error('[Recording] Auto-save failed, showing dialog:', err);
      // Fallback: show save dialog if auto-save fails (e.g. permission error)
      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow!, {
        title: 'Save Recording',
        defaultPath: autoPath,
        filters: [
          { name: 'MP4 Video', extensions: ['mp4'] },
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

  ipcMain.on('open-file', (_event, filePath: string) => { shell.openPath(filePath); });

  ipcMain.on('export-recording', async (_event, filePath: string) => {
    const fileName = path.basename(filePath);
    const { filePath: destPath, canceled } = await dialog.showSaveDialog(mainWindow!, {
      title: 'Export Recording',
      defaultPath: path.join(app.getPath('downloads'), fileName),
      filters: [{ name: 'Video Files', extensions: ['webm', 'mp4'] }, { name: 'All Files', extensions: ['*'] }],
    });
    if (!canceled && destPath) {
      fs.copyFile(filePath, destPath, (err) => { if (err) console.error('Export failed:', err); });
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

  // ── [FIX 1] Expose recordings directory path to renderer ──────────────────
  ipcMain.handle('get-recordings-dir', () => RECORDINGS_DIR);

  ipcMain.handle('read-clipboard', () => clipboard.readText());
  ipcMain.handle('write-clipboard', (_event, text: string) => {
    if (typeof text === 'string') clipboard.writeText(text);
  });

  // ── [FIX 3] Remote control execution ─────────────────────────────────────────
  ipcMain.on('remote-control', async (_event, action: any) => {
    try {
      const sw = await screen.width();
      const sh = await screen.height();
      
      switch (action.type) {
        case 'mousemove': {
          if (action.normX !== undefined && action.normY !== undefined) {
            const x = Math.max(0, Math.min(sw - 1, Math.round(action.normX * sw)));
            const y = Math.max(0, Math.min(sh - 1, Math.round(action.normY * sh)));
            await mouse.setPosition(new Point(x, y));
          }
          break;
        }
        case 'mousedown': {
          const btn = action.button === 'right' ? Button.RIGHT : action.button === 'middle' ? Button.MIDDLE : Button.LEFT;
          await mouse.pressButton(btn);
          break;
        }
        case 'mouseup': {
          const btn = action.button === 'right' ? Button.RIGHT : action.button === 'middle' ? Button.MIDDLE : Button.LEFT;
          await mouse.releaseButton(btn);
          break;
        }
        case 'click': {
          const btn = action.button === 'right' ? Button.RIGHT : action.button === 'middle' ? Button.MIDDLE : Button.LEFT;
          await mouse.click(btn);
          break;
        }
        case 'scroll': {
          if (action.scrollY !== undefined && action.scrollY !== 0) {
            if (action.scrollY > 0) await mouse.scrollDown(action.scrollY);
            else await mouse.scrollUp(-action.scrollY);
          }
          if (action.scrollX !== undefined && action.scrollX !== 0) {
            if (action.scrollX > 0) await mouse.scrollRight(action.scrollX);
            else await mouse.scrollLeft(-action.scrollX);
          }
          break;
        }
        case 'keydown':
        case 'keyup': {
          const nutKey = mapKey(action.key, action.code);
          if (nutKey !== null) {
            if (action.type === 'keydown') await keyboard.pressKey(nutKey);
            else await keyboard.releaseKey(nutKey);
          }
          break;
        }
      }
    } catch (e) {
      console.error('[RemoteControl] action error:', e);
    }
  });

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