const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  ipc: {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    on: (channel, listener) => ipcRenderer.on(channel, (event, ...rest) => listener(event, ...rest)),
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  },
});


