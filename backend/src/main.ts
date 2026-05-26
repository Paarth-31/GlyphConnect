// // import { app, BrowserWindow, desktopCapturer, ipcMain, dialog } from 'electron';
// // import path from 'path';
// // import fs from 'fs';

// // app.disableHardwareAcceleration();

// // const isProd = process.env.NODE_ENV === 'production';
// // let mainWindow: BrowserWindow | null = null;

// // async function createWindow() {
// //   mainWindow = new BrowserWindow({
// //     width: 1280,
// //     height: 720,
// //     webPreferences: {
// //       nodeIntegration: false,
// //       contextIsolation: true,
// //       preload: path.join(__dirname, 'preload.js'),
// //     },
// //   });

// //   let pendingCallback: ((streams: any) => void) | null = null;

// //   // ── Screen capture handler — now passes audio:'loopback' ─────────────────
// //   // 'loopback' tells Chromium/Electron to capture system audio alongside video.
// //   // On Windows this works natively. On Linux you may need PulseAudio loopback.
// //   // On macOS system audio capture requires a virtual audio driver (e.g. BlackHole).
// //   mainWindow.webContents.session.setDisplayMediaRequestHandler(
// //     (_request, callback) => {
// //       desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
// //         pendingCallback = callback;
// //         mainWindow!.webContents.send(
// //           'get-sources-response',
// //           sources.map((s) => ({
// //             id: s.id,
// //             name: s.name,
// //             thumbnail: s.thumbnail.toDataURL(),
// //           }))
// //         );
// //       });
// //     },
// //   );

// //   ipcMain.on('select-source', (_event, sourceId: string) => {
// //     desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
// //       const selected = sources.find((s) => s.id === sourceId);
// //       if (selected && pendingCallback) {
// //         // audio: 'loopback' → captures system audio output (what you hear)
// //         pendingCallback({ video: selected, audio: 'loopback' });
// //         pendingCallback = null;
// //       }
// //     });
// //   });

// //   // ── Trust our own signaling server's self-signed cert ───────────────────
// //   mainWindow.webContents.session.setCertificateVerifyProc((request, callback) => {
// //     if (request.hostname === 'rda-signaling.duckdns.org') {
// //       callback(0); // 0 = trust
// //     } else {
// //       callback(-2); // -2 = reject
// //     }
// //   });

// //   // ── IPC: get sources list (kept for compatibility) ───────────────────────
// //   ipcMain.handle('get-sources', async () => {
// //     const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
// //     return sources.map((source) => ({
// //       id: source.id,
// //       name: source.name,
// //       thumbnail: source.thumbnail.toDataURL(),
// //     }));
// //   });

// //   // ── IPC: robot.js mouse/keyboard forwarding ──────────────────────────────
// //   // The renderer sends control events; main process executes them via robotjs.
// //   // robotjs must be installed: npm install @jitsi/robotjs (Electron-compatible fork)
// //   // If not installed, control events are silently ignored.
// //   ipcMain.on('remote-control', (_event, action: RemoteControlAction) => {
// //     try {
// //       // eslint-disable-next-line @typescript-eslint/no-var-requires
// //       const robot = require('@jitsi/robotjs');
// //       executeControlAction(robot, action);
// //     } catch {
// //       // robotjs not installed — control feature silently unavailable
// //     }
// //   });

// //   // --- 🎥 5. Save Recording Handler ---
// //   ipcMain.on('save-recording', async (_event, { data, mimeType }) => {
// //     // Generate filename with timestamp
// //     const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
// //     const ext = mimeType.includes('webm') ? 'webm' : 'mp4';
// //     const defaultName = `RDA-Recording-${timestamp}.${ext}`;

// //     // Open save dialog so user can choose where to save
// //     const { filePath, canceled } = await dialog.showSaveDialog(mainWindow!, {
// //         title: 'Save Recording',
// //         defaultPath: path.join(app.getPath('videos'), defaultName),
// //         filters: [
// //             { name: 'WebM Video', extensions: ['webm'] },
// //             { name: 'All Files', extensions: ['*'] },
// //         ],
// //     });

// //     if (canceled || !filePath) return;

// //     // Write the file
// //     const buffer = Buffer.from(data);
// //     fs.writeFile(filePath, buffer, (err) => {
// //         if (err) {
// //             console.error('Failed to save recording:', err);
// //         } else {
// //             console.log(`Recording saved to: ${filePath}`);
// //         }
// //     });
// //   });

// //   if (isProd) {
// //     await mainWindow.loadURL(`file://${path.join(__dirname, '../renderer/out/index.html')}`);
// //   } else {
// //     await mainWindow.loadURL('http://localhost:5173');
// //     mainWindow.webContents.openDevTools();
// //   }
// // }

// // // ── Control action types ─────────────────────────────────────────────────────
// // interface RemoteControlAction {
// //   type: 'mousemove' | 'mousedown' | 'mouseup' | 'click' | 'scroll' | 'keydown' | 'keyup' | 'type';
// //   x?: number;
// //   y?: number;
// //   button?: 'left' | 'right' | 'middle';
// //   key?: string;
// //   text?: string;
// //   scrollX?: number;
// //   scrollY?: number;
// //   // Normalised coordinates 0-1 so sender doesn't need to know target resolution
// //   normX?: number;
// //   normY?: number;
// // }

// // function executeControlAction(robot: any, action: RemoteControlAction) {
// //   const screenSize = robot.getScreenSize();

// //   // Convert normalised coords to absolute pixels
// //   const ax = action.normX != null
// //     ? Math.round(action.normX * screenSize.width)
// //     : action.x ?? 0;
// //   const ay = action.normY != null
// //     ? Math.round(action.normY * screenSize.height)
// //     : action.y ?? 0;

// //   switch (action.type) {
// //     case 'mousemove':
// //       robot.moveMouse(ax, ay);
// //       break;
// //     case 'mousedown':
// //       robot.moveMouse(ax, ay);
// //       robot.mouseToggle('down', action.button ?? 'left');
// //       break;
// //     case 'mouseup':
// //       robot.moveMouse(ax, ay);
// //       robot.mouseToggle('up', action.button ?? 'left');
// //       break;
// //     case 'click':
// //       robot.moveMouse(ax, ay);
// //       robot.mouseClick(action.button ?? 'left');
// //       break;
// //     case 'scroll':
// //       robot.scrollMouse(action.scrollX ?? 0, action.scrollY ?? 0);
// //       break;
// //     case 'keydown':
// //       if (action.key) robot.keyToggle(action.key, 'down');
// //       break;
// //     case 'keyup':
// //       if (action.key) robot.keyToggle(action.key, 'up');
// //       break;
// //     case 'type':
// //       if (action.text) robot.typeString(action.text);
// //       break;
// //   }
// // }

// // app.on('ready', createWindow);

// // app.on('window-all-closed', () => {
// //   if (process.platform !== 'darwin') app.quit();
// // });

// // app.on('activate', () => {
// //   if (BrowserWindow.getAllWindows().length === 0) createWindow();
// // });




// import { app, BrowserWindow, desktopCapturer, ipcMain, dialog } from 'electron';
// import fs from 'fs';
// import path from 'path';

// app.disableHardwareAcceleration();

// const isProd = process.env.NODE_ENV === 'production';
// let mainWindow: BrowserWindow | null = null;

// async function createWindow() {
//   mainWindow = new BrowserWindow({
//     width: 1280,
//     height: 720,
//     webPreferences: {
//       nodeIntegration: false,
//       contextIsolation: true,
//       preload: path.join(__dirname, 'preload.js'),
//       // webSecurity: false, // ← allows localhost cross-origin requests in dev
//     },
//   });

//   // --- 1. Strip CSP headers so our index.html meta tag takes control ---
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

//   // --- 2. Handle Keycloak redirect back to app ---
//   mainWindow.webContents.on('will-navigate', (event, url) => {
//     console.log('Navigating to:', url);
//     if (
//       url.startsWith('http://localhost:5173') ||
//       url.startsWith('http://localhost:8180')
//     ) {
//       return; // Allow these — our app and Keycloak
//     }
//     event.preventDefault();
//   });

//   // --- 3. Media Request Handler ---
//   let pendingCallback: ((streams: any) => void) | null = null;

//   mainWindow.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
//     desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
//       pendingCallback = callback;
//       mainWindow!.webContents.send(
//         'get-sources-response',
//         sources.map(s => ({
//           id: s.id,
//           name: s.name,
//           thumbnail: s.thumbnail.toDataURL(),
//         }))
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

//   // --- 4. Certificate verification ---
//   mainWindow.webContents.session.setCertificateVerifyProc((request, callback) => {
//     const { hostname } = request;
//     if (
//       hostname === 'rda-signaling.duckdns.org' ||
//       hostname === 'localhost'
//     ) {
//       callback(0);
//     } else {
//       callback(-2);
//     }
//   });

//   // --- 5. IPC Handlers ---
//   ipcMain.handle('get-sources', async () => {
//     const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
//     return sources.map(source => ({
//       id: source.id,
//       name: source.name,
//       thumbnail: source.thumbnail.toDataURL(),
//     }));
//   });

//   ipcMain.on('save-recording', async (_event, { data, mimeType }) => {
//     const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
//     const ext = mimeType.includes('webm') ? 'webm' : 'mp4';
//     const defaultName = `RDA-Recording-${timestamp}.${ext}`;

//     const { filePath, canceled } = await dialog.showSaveDialog(mainWindow!, {
//       title: 'Save Recording',
//       defaultPath: path.join(app.getPath('videos'), defaultName),
//       filters: [
//         { name: 'WebM Video', extensions: ['webm'] },
//         { name: 'All Files', extensions: ['*'] },
//       ],
//     });

//     if (canceled || !filePath) return;

//     const buffer = Buffer.from(data);
//     fs.writeFile(filePath, buffer, (err) => {
//       if (err) console.error('Failed to save recording:', err);
//       else console.log('Recording saved to:', filePath);
//     });
//   });

//   // --- 6. Load app ---
//   if (isProd) {
//     await mainWindow.loadURL(`file://${path.join(__dirname, '../renderer/out/index.html')}`);
//   } else {
//     await mainWindow.loadURL('http://localhost:5173');
//     mainWindow.webContents.openDevTools();
//   }
// }

// app.on('ready', createWindow);

// app.on('window-all-closed', () => {
//   if (process.platform !== 'darwin') app.quit();
// });

// app.on('activate', () => {
//   if (BrowserWindow.getAllWindows().length === 0) createWindow();
// });



import { app, BrowserWindow, desktopCapturer, ipcMain, dialog, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import http from 'http';

app.disableHardwareAcceleration();

const isProd = process.env.NODE_ENV === 'production';
let mainWindow: BrowserWindow | null = null;

// Folder where recordings are saved — user's Videos directory
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

  // --- 1. Strip CSP headers so Vite/Keycloak can communicate freely ---
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

  // --- 2. Handle Keycloak redirect back to app ---
  mainWindow.webContents.on('will-navigate', (event, url) => {
    console.log('Navigating to:', url);
    if (
      url.startsWith('http://localhost:5173') ||
      url.startsWith('http://localhost:8180')
    ) {
      return;
    }
    event.preventDefault();
  });

  // --- 3. Screen capture source picker ---
  let pendingCallback: ((streams: any) => void) | null = null;

  mainWindow.webContents.session.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
      pendingCallback = callback;
      mainWindow!.webContents.send(
        'get-sources-response',
        sources.map(s => ({
          id: s.id,
          name: s.name,
          thumbnail: s.thumbnail.toDataURL(),
        }))
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

  // --- 4. Certificate trust ---
  mainWindow.webContents.session.setCertificateVerifyProc((request, callback) => {
    const { hostname } = request;
    if (hostname === 'rda-signaling.duckdns.org' || hostname === 'localhost') {
      callback(0);
    } else {
      callback(-2);
    }
  });

  // --- 5. Legacy get-sources handle ---
  ipcMain.handle('get-sources', async () => {
    const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
    }));
  });

  // --- 6. Save recording to disk ---
  ipcMain.on('save-recording', async (_event, { data, mimeType }) => {
    // Ensure recordings folder exists
    if (!fs.existsSync(RECORDINGS_DIR)) {
      fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = mimeType.includes('webm') ? 'webm' : 'mp4';
    const defaultName = `RDA-Recording-${timestamp}.${ext}`;

    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow!, {
      title: 'Save Recording',
      defaultPath: path.join(RECORDINGS_DIR, defaultName),
      filters: [
        { name: 'WebM Video', extensions: ['webm'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (canceled || !filePath) return;

    const buffer = Buffer.from(data);
    fs.writeFile(filePath, buffer, (err) => {
      if (err) console.error('Failed to save recording:', err);
      else console.log('Recording saved to:', filePath);
    });
  });

  // --- 7. List recordings from disk ---
  ipcMain.handle('list-recordings', async () => {
    try {
      if (!fs.existsSync(RECORDINGS_DIR)) return [];

      const files = fs.readdirSync(RECORDINGS_DIR)
        .filter(f => f.endsWith('.webm') || f.endsWith('.mp4'))
        .map(f => {
          const fullPath = path.join(RECORDINGS_DIR, f);
          const stat = fs.statSync(fullPath);
          return {
            id: fullPath,           // use full path as unique ID
            name: f.replace(/^RDA-Recording-/, '').replace(/\.\w+$/, '').replace(/-/g, ' ').trim() || f,
            path: fullPath,
            size: stat.size,
            duration: 0,            // would need ffprobe for real duration
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

  // --- 8. Open recording in system video player ---
  ipcMain.on('open-file', (_event, filePath: string) => {
    shell.openPath(filePath);
  });

  // --- 9. Export (Save As copy) ---
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

    if (canceled || !destPath) return;
    fs.copyFile(filePath, destPath, (err) => {
      if (err) console.error('Export failed:', err);
    });
  });

  // --- 10. Delete recording from disk ---
  ipcMain.handle('delete-recording', async (_event, filePath: string) => {
    try {
      // Safety check — only delete files inside RECORDINGS_DIR
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

  // Handle Google OAuth — open in system browser, catch callback locally
  let oauthCallbackServer: http.Server | null = null;
  ipcMain.handle('start-google-oauth', async (_event, url: string) => {
  return new Promise<string>((resolve, reject) => {
    // Start a one-time local HTTP server on port 5174 to catch the callback
    oauthCallbackServer = http.createServer((req, res) => {
      const fullUrl = new URL(req.url!, 'http://localhost:5174');
      const code  = fullUrl.searchParams.get('code');
      const state = fullUrl.searchParams.get('state');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html><body style="background:#080809;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
          <div style="text-align:center">
            <h2>✅ Signed in successfully</h2>
            <p style="color:rgba(255,255,255,0.4)">You can close this tab and return to StreamLink</p>
          </div>
        </html>
      `);

      if (oauthCallbackServer) {
        oauthCallbackServer.close();
        oauthCallbackServer = null;
      }

      if (code && state === 'google_oauth') {
        resolve(code);
      } else {
        reject(new Error('OAuth callback missing code'));
      }
    });

    oauthCallbackServer.listen(5174, () => {
      // Open Google consent screen in system browser
      shell.openExternal(url);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      if (oauthCallbackServer) {
        oauthCallbackServer.close();
        oauthCallbackServer = null;
      }
      reject(new Error('OAuth timeout'));
    }, 5 * 60 * 1000);
  });
});

  // --- 11. Load app ---
  if (isProd) {
    await mainWindow.loadURL(`file://${path.join(__dirname, '../renderer/out/index.html')}`);
  } else {
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  }
}

app.on('ready', createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});