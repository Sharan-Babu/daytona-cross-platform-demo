const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('platformPulse', {
  getSystemInfo: () => ipcRenderer.invoke('system:info'),
  runDiagnostics: () => ipcRenderer.invoke('diagnostics:run'),
  loadNote: () => ipcRenderer.invoke('note:load'),
  saveNote: (note) => ipcRenderer.invoke('note:save', note),
  showNativeProof: () => ipcRenderer.invoke('native:proof'),
  openExternal: (url) => ipcRenderer.invoke('external:open', url)
});

