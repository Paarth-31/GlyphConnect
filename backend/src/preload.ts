import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Screen capture
  getSources: () => ipcRenderer.invoke('get-sources'),

  onSourcesResponse: (callback: (sources: any[]) => void) => {
    ipcRenderer.removeAllListeners('get-sources-response');
    ipcRenderer.on('get-sources-response', (_event, sources) => callback(sources));
  },

  selectSource: (sourceId: string) => {
    ipcRenderer.send('select-source', sourceId);
  },

  // Remote control forwarding to robot.js
  sendControlAction: (action: object) => {
    ipcRenderer.send('remote-control', action);
  },

  // Recording — auto-saves to ~/Videos/RDA-Recordings/
  saveRecording: (data: number[], mimeType: string) => {
    ipcRenderer.send('save-recording', { data, mimeType });
  },

  // Called when recording is saved — receives { filePath }
  onRecordingSaved: (callback: (info: { filePath: string }) => void) => {
    ipcRenderer.removeAllListeners('recording-saved');
    ipcRenderer.on('recording-saved', (_event, info) => callback(info));
  },

  // Get the recordings directory path
  getRecordingsDir: () => ipcRenderer.invoke('get-recordings-dir'),

  // List saved recordings from disk
  listRecordings: () => ipcRenderer.invoke('list-recordings'),

  // Open a recording in the system's default video player
  openFile: (filePath: string) => {
    ipcRenderer.send('open-file', filePath);
  },

  // Export/copy a recording to a user-chosen location
  exportRecording: (filePath: string) => {
    ipcRenderer.send('export-recording', filePath);
  },

  // Delete a recording from disk
  deleteRecording: (filePath: string) => ipcRenderer.invoke('delete-recording', filePath),

  // Google OAuth
  startGoogleOAuth: (url: string) => ipcRenderer.invoke('start-google-oauth', url),
});