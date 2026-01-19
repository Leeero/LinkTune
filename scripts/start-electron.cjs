const { spawn } = require('child_process');

// 在纯 Node 环境下：require('electron') 返回 Electron 可执行文件路径
const electronPath = require('electron');

const env = { ...process.env };
// 某些环境（或工具链）会设置该变量，导致 Electron 以“Node 模式”运行，从而拿不到 app/BrowserWindow。
delete env.ELECTRON_RUN_AS_NODE;

const port = env.VITE_PORT || '5174';
env.ELECTRON_START_URL = env.ELECTRON_START_URL || `http://localhost:${port}`;

const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env,
  windowsHide: false,
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
