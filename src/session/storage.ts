import type { AuthCredentials } from './types';

const STORAGE_KEY = 'linktune:auth';

export function loadAuthFromStorage(): AuthCredentials | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;

    // 最小校验：避免脏数据导致崩溃
    if (!parsed || typeof parsed !== 'object') return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = parsed as any;
    if (p.protocol !== 'emby' && p.protocol !== 'navidrome' && p.protocol !== 'custom') return null;
    if (p.protocol === 'custom') {
      // custom 协议：需要 apiKey
      if (typeof p.apiKey !== 'string') return null;
      return p as AuthCredentials;
    }
    if (typeof p.baseUrl !== 'string') return null;

    // 向后兼容：早期版本的 Emby 登录态可能缺少 device/client/version 等字段
    if (p.protocol === 'emby') {
      let changed = false;

      if (!p.deviceId || typeof p.deviceId !== 'string') {
        changed = true;
        try {
          const key = 'linktune:device-id';
          const existing = window.localStorage.getItem(key);
          if (existing) {
            p.deviceId = existing;
          } else {
            const created = `linktune-${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
            window.localStorage.setItem(key, created);
            p.deviceId = created;
          }
        } catch {
          p.deviceId = 'linktune';
        }
      }

      if (!p.client || typeof p.client !== 'string') {
        changed = true;
        p.client = 'LinkTune';
      }

      if (!p.device || typeof p.device !== 'string') {
        changed = true;
        p.device = 'Web';
      }

      if (!p.version || typeof p.version !== 'string') {
        changed = true;
        p.version = '0.1.0';
      }

      // 最佳努力：把修正后的结构写回存储
      if (changed) {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
        } catch {
          // ignore
        }
      }
    }

    return p as AuthCredentials;
  } catch {
    return null;
  }
}

export function saveAuthToStorage(credentials: AuthCredentials | null) {
  if (typeof window === 'undefined') return;

  try {
    if (!credentials) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
  } catch {
    // ignore
  }
}
