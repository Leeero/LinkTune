const path = require('path');
const { app, BrowserWindow, session } = require('electron');

function setupCorsProxy() {
  // 允许来自 api.lrc.cx 的跨域请求
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['https://api.lrc.cx/*', 'http://api.lrc.cx/*'] },
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Access-Control-Allow-Origin': ['*'],
          'Access-Control-Allow-Methods': ['GET, POST, OPTIONS'],
          'Access-Control-Allow-Headers': ['*'],
        },
      });
    }
  );
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'LinkTune',
    // macOS: 使用隐藏式标题栏，让内容延伸到顶部
    titleBarStyle: 'hiddenInset',
    // 设置窗口背景色，与应用主题一致
    backgroundColor: '#141414',
    // Windows: 启用窗口控制覆盖
    ...(process.platform === 'win32' && {
      titleBarOverlay: {
        color: '#141414',
        symbolColor: '#ffffff',
        height: 32,
      },
    }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());

  const devUrl = process.env.ELECTRON_START_URL;
  if (devUrl) {
    win.loadURL(devUrl);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  return win;
}

app.whenReady().then(() => {
  setupCorsProxy();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  // macOS 习惯：关闭全部窗口但保留进程
  if (process.platform !== 'darwin') app.quit();
});
