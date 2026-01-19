const net = require('net');
const { spawn } = require('child_process');

function npmCmd() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function isPortFree(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net
      .createServer()
      .once('error', () => resolve(false))
      .once('listening', () => server.close(() => resolve(true)))
      .listen(port, host);
  });
}

async function findFreePort(start, tries = 50) {
  for (let i = 0; i < tries; i += 1) {
    const port = start + i;
    // 同时检查 IPv4/IPv6（macOS 上经常是 ::1）
    // 只要有一个能占用，说明基本可用
    // 这里用两次 isPortFree，避免误判
    // eslint-disable-next-line no-await-in-loop
    const free4 = await isPortFree(port, '127.0.0.1');
    // eslint-disable-next-line no-await-in-loop
    const free6 = await isPortFree(port, '::1');
    if (free4 && free6) return port;
  }
  throw new Error(`No free port found from ${start}`);
}

async function waitForTcp(port, host = '127.0.0.1', timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise((resolve) => {
      const socket = net.connect({ port, host });
      socket.once('connect', () => {
        socket.end();
        resolve(true);
      });
      socket.once('error', () => resolve(false));
    });
    if (ok) return;
    // eslint-disable-next-line no-await-in-loop
    await sleep(200);
  }
  throw new Error(`Timed out waiting for ${host}:${port}`);
}

function killTree(child) {
  if (!child || child.killed) return;
  try {
    child.kill('SIGTERM');
  } catch {
    // ignore
  }
}

(async () => {
  const basePort = Number(process.env.VITE_PORT || 5174);
  const port = await findFreePort(basePort);

  const env = { ...process.env, VITE_PORT: String(port) };

  console.log(`[dev] Using Vite port: ${port}`);

  const renderer = spawn(npmCmd(), ['run', 'dev:renderer', '--', '--port', String(port), '--strictPort'], {
    stdio: 'inherit',
    env,
  });

  renderer.on('exit', (code) => {
    if (code && code !== 0) process.exit(code);
  });

  // 等待 Vite 启动后再拉起 Electron
  await waitForTcp(port, '127.0.0.1').catch(async () => {
    // fallback: 有些机器只监听 ::1
    await waitForTcp(port, '::1');
  });

  const electron = spawn(npmCmd(), ['run', 'dev:electron'], {
    stdio: 'inherit',
    env,
  });

  const shutdown = () => {
    killTree(renderer);
    killTree(electron);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  electron.on('exit', (code) => {
    shutdown();
    process.exit(code ?? 1);
  });
})();
