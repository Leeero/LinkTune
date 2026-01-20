const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('linkTune', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  // 向主进程发送播放状态
  updatePlayerState: (state) => {
    ipcRenderer.send('player-state-update', state);
  },
  // 监听主进程发来的播放控制命令
  onPlayerControl: (callback) => {
    ipcRenderer.on('player-control', (_event, command) => {
      callback(command);
    });
  },
  // 移除播放控制监听
  removePlayerControlListener: () => {
    ipcRenderer.removeAllListeners('player-control');
  },
});
