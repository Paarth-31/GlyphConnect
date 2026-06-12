import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getSources: () => ipcRenderer.invoke('get-sources'),

  onSourcesResponse: (callback: (sources: any[]) => void) => {
    ipcRenderer.removeAllListeners('get-sources-response');
    ipcRenderer.on('get-sources-response', (_event, sources) => callback(sources));
  },

  selectSource: (sourceId: string) => {
    ipcRenderer.send('select-source', sourceId);
  },

  sendControlAction: (action: object) => {
    ipcRenderer.send('remote-control', action);
  },

  readClipboard: () => ipcRenderer.invoke('read-clipboard'),
  writeClipboard: (text: string) => ipcRenderer.invoke('write-clipboard', text),

  saveRecording: (data: number[], mimeType: string) => {
    ipcRenderer.send('save-recording', { data, mimeType });
  },

  onRecordingSaved: (callback: (info: { filePath: string }) => void) => {
    ipcRenderer.removeAllListeners('recording-saved');
    ipcRenderer.on('recording-saved', (_event, info) => callback(info));
  },

  getRecordingsDir: () => ipcRenderer.invoke('get-recordings-dir'),

  listRecordings: () => ipcRenderer.invoke('list-recordings'),

  openFile: (filePath: string) => {
    ipcRenderer.send('open-file', filePath);
  },

  exportRecording: (filePath: string) => {
    ipcRenderer.send('export-recording', filePath);
  },

  deleteRecording: (filePath: string) => ipcRenderer.invoke('delete-recording', filePath),

  startGoogleOAuth: (url: string) => ipcRenderer.invoke('start-google-oauth', url),
});
