const path = require('path');
const { app, BrowserWindow, session, Tray, Menu, ipcMain, nativeImage } = require('electron');

let mainWindow = null;
let tray = null;

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

  // 点击关闭按钮时隐藏窗口而不是退出（macOS 和 Windows 都支持托盘）
  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  const devUrl = process.env.ELECTRON_START_URL;
  if (devUrl) {
    win.loadURL(devUrl);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  return win;
}

function createTray() {
  // 使用应用图标
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png');
  let icon = nativeImage.createFromPath(iconPath);
  
  // macOS 托盘图标需要较小尺寸
  if (process.platform === 'darwin') {
    icon = icon.resize({ width: 18, height: 18, borderRadius: 9});
  } else {
    icon = icon.resize({ width: 24, height: 24, borderRadius: 12});
  }

  tray = new Tray(icon);
  tray.setToolTip('LinkTune');

  updateTrayMenu();

  // 点击托盘图标显示窗口
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    }
  });
}

// 当前播放状态（从渲染进程同步）
let playerState = {
  isPlaying: false,
  currentTrack: null,
};

function updateTrayMenu() {
  const trackName = playerState.currentTrack?.title || '未在播放';
  const artistName = playerState.currentTrack?.artist || '';
  const displayName = artistName ? `${trackName} - ${artistName}` : trackName;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: displayName,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: playerState.isPlaying ? '暂停' : '播放',
      click: () => {
        mainWindow?.webContents.send('player-control', 'toggle');
      },
    },
    {
      label: '上一曲',
      click: () => {
        mainWindow?.webContents.send('player-control', 'prev');
      },
    },
    {
      label: '下一曲',
      click: () => {
        mainWindow?.webContents.send('player-control', 'next');
      },
    },
    { type: 'separator' },
    {
      label: '显示窗口',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray?.setContextMenu(contextMenu);
}

// 监听渲染进程发送的播放状态更新
ipcMain.on('player-state-update', (_event, state) => {
  playerState = state;
  updateTrayMenu();
});

app.whenReady().then(() => {
  setupCorsProxy();
  mainWindow = createMainWindow();
  createTray();

  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show();
    } else {
      mainWindow = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // macOS 习惯：关闭全部窗口但保留进程
  if (process.platform !== 'darwin') {
    // Windows/Linux：窗口关闭后也保持托盘运行
    // 如果想完全退出，用户需要通过托盘菜单退出
  }
});

// 应用退出前清理
app.on('before-quit', () => {
  app.isQuitting = true;
});
