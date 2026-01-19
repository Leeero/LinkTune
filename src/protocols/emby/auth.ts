import type { EmbyCredentials } from './types';
import { buildEmbyHeaders } from './headers';
import { fetchJson } from '../../core/http/fetchJson';
import { normalizeBaseUrl } from '../../core/http/url';

/**
 * Emby 用户认证（官方 Wiki/Legacy 文档）要点：
 * - 所有请求建议携带 `Authorization: Emby UserId="...", Client="...", Device="...", DeviceId="...", Version="..."`
 * - 认证成功后返回 `AccessToken`；后续请求用 `X-Emby-Token: {AccessToken}`
 * - `/Users/AuthenticateByName` 的密码字段使用明文 `pw`
 */

type EmbyPublicInfo = {
  ServerName?: string;
  Version?: string;
  Id?: string;
};

type EmbySystemInfo = {
  ServerName?: string;
  Version?: string;
  Id?: string;
};

type EmbyAuthResp = {
  AccessToken?: string;
  User?: {
    Id?: string;
    Name?: string;
  };
  ServerId?: string;
};

const DEFAULT_CLIENT = 'LinkTune';
const DEFAULT_VERSION = '0.1.0';
const DEVICE_ID_KEY = 'linktune:device-id';

function getDeviceId() {
  if (typeof window === 'undefined') return 'linktune';
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const created = `linktune-${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
    window.localStorage.setItem(DEVICE_ID_KEY, created);
    return created;
  } catch {
    return 'linktune';
  }
}

function getDeviceName() {
  if (typeof window === 'undefined') return 'Node';

  // Electron 里我们有 preload 暴露的基础信息
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (w.linkTune?.platform) return String(w.linkTune.platform);

  if (typeof navigator !== 'undefined') {
    // `navigator.platform` 已弃用，优先用 UA-CH；否则回退到 UA 字符串做粗略判断。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = navigator as any;
    const uaPlatform = nav.userAgentData?.platform ? String(nav.userAgentData.platform) : '';
    if (uaPlatform) return uaPlatform;

    const ua = navigator.userAgent || '';
    if (/mac\s?os/i.test(ua)) return 'macOS';
    if (/windows/i.test(ua)) return 'Windows';
    if (/android/i.test(ua)) return 'Android';
    if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
    if (/linux/i.test(ua)) return 'Linux';

    return 'Web';
  }

  return 'Web';
}

async function resolveEmbyApiBaseUrl(inputBaseUrl: string) {
  const baseUrl = normalizeBaseUrl(inputBaseUrl);

  // Emby 常见两种 API 根：
  // - http://host:8096/emby
  // - http://host:8096
  // 为了减少用户输入心智，这里自动探测。
  const candidates = [baseUrl, `${baseUrl}/emby`];

  let firstErr: unknown = null;
  for (const c of candidates) {
    try {
      await fetchJson<EmbyPublicInfo>(`${c}/System/Info/Public`, undefined, 8000);
      return c;
    } catch (e) {
      if (!firstErr) firstErr = e;
    }
  }

  const msg = firstErr instanceof Error ? firstErr.message : '无法连接到服务';
  throw new Error(`${msg}（已尝试 ${candidates.join(' , ')}）`);
}

function buildDefaults() {
  return {
    client: DEFAULT_CLIENT,
    device: getDeviceName(),
    deviceId: getDeviceId(),
    version: DEFAULT_VERSION,
  };
}

export async function embyLoginWithApiKey(params: { baseUrl: string; apiKey: string }): Promise<EmbyCredentials> {
  const apiBaseUrl = await resolveEmbyApiBaseUrl(params.baseUrl);
  const apiKey = params.apiKey.trim();
  const d = buildDefaults();

  // API Key 方式可直接用 X-Emby-Token / api_key 访问
  const info = await fetchJson<EmbyPublicInfo>(
    `${apiBaseUrl}/System/Info/Public?api_key=${encodeURIComponent(apiKey)}`,
    {
      headers: buildEmbyHeaders({
        accessTokenOrApiKey: apiKey,
        client: d.client,
        device: d.device,
        deviceId: d.deviceId,
        version: d.version,
      }),
    },
  );

  // 进一步拿一次 /System/Info（带 token）以获取稳定的 ServerId
  let serverId: string | undefined;
  try {
    const sys = await fetchJson<EmbySystemInfo>(`${apiBaseUrl}/System/Info`, {
      headers: buildEmbyHeaders({
        accessTokenOrApiKey: apiKey,
        client: d.client,
        device: d.device,
        deviceId: d.deviceId,
        version: d.version,
      }),
    });
    serverId = sys.Id;
  } catch {
    // ignore
  }

  return {
    protocol: 'emby',
    method: 'apiKey',
    baseUrl: apiBaseUrl,
    apiKey,
    deviceId: d.deviceId,
    client: d.client,
    device: d.device,
    version: d.version,
    serverId,
    serverName: info.ServerName,
  };
}

export async function embyLoginWithPassword(params: {
  baseUrl: string;
  username: string;
  password: string;
}): Promise<EmbyCredentials> {
  const apiBaseUrl = await resolveEmbyApiBaseUrl(params.baseUrl);
  const d = buildDefaults();

  // 先探测一次 PublicInfo，拿到 ServerName / Version 等（也能更早暴露 CORS/网络问题）
  const publicInfo = await fetchJson<EmbyPublicInfo>(`${apiBaseUrl}/System/Info/Public`, {
    headers: buildEmbyHeaders({
      client: d.client,
      device: d.device,
      deviceId: d.deviceId,
      version: d.version,
    }),
  });

  // 官方 legacy 文档强调 `pw` 明文字段
  const payload = {
    Username: params.username,
    pw: params.password,
    // 兼容：部分反代/分支实现可能用 Pw
    Pw: params.password,
  };

  const auth = await fetchJson<EmbyAuthResp>(`${apiBaseUrl}/Users/AuthenticateByName`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildEmbyHeaders({
        client: d.client,
        device: d.device,
        deviceId: d.deviceId,
        version: d.version,
      }),
    },
    body: JSON.stringify(payload),
  });

  const accessToken = auth.AccessToken;
  if (!accessToken) {
    throw new Error('登录失败：未获取到 AccessToken（请检查账号密码或 Emby 服务配置）');
  }

  let userId = auth.User?.Id;

  // 有些环境下 AuthenticateByName 返回的 User 可能不完整；尽量用 /Users/Me 补齐
  if (!userId) {
    try {
      const me = await fetchJson<{ Id?: string }>(`${apiBaseUrl}/Users/Me`, {
        headers: buildEmbyHeaders({
          accessTokenOrApiKey: accessToken,
          client: d.client,
          device: d.device,
          deviceId: d.deviceId,
          version: d.version,
        }),
      });
      if (me.Id) userId = me.Id;
    } catch {
      // ignore
    }
  }

  // 进一步获取 /System/Info（带 token）以获取稳定 ServerId（多服务器场景建议存储）
  let serverId: string | undefined;
  try {
    const sys = await fetchJson<EmbySystemInfo>(`${apiBaseUrl}/System/Info`, {
      headers: buildEmbyHeaders({
        accessTokenOrApiKey: accessToken,
        userId,
        client: d.client,
        device: d.device,
        deviceId: d.deviceId,
        version: d.version,
      }),
    });
    serverId = sys.Id;
  } catch {
    // ignore
  }

  return {
    protocol: 'emby',
    method: 'password',
    baseUrl: apiBaseUrl,
    username: params.username,
    accessToken,
    userId,
    deviceId: d.deviceId,
    client: d.client,
    device: d.device,
    version: d.version,
    serverId,
    serverName: publicInfo.ServerName,
  };
}
