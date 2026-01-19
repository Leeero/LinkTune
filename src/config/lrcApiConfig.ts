const STORAGE_KEY = 'linktune:lrcapi';

// 开发环境使用代理地址，生产环境/Electron 直接请求
const isDev = import.meta.env.DEV;
const PROXY_LYRICS_URL = '/api/lrc/lyrics';
const PROXY_COVER_URL = '/api/lrc/cover';
const DIRECT_LYRICS_URL = 'https://api.lrc.cx/lyrics';
const DIRECT_COVER_URL = 'https://api.lrc.cx/cover';

export type LrcApiConfig = {
  /** 歌词 API 地址，如 https://api.lrc.cx/lyrics */
  lyricsUrl: string;
  /** 封面 API 地址，如 https://api.lrc.cx/cover */
  coverUrl: string;
  /** 是否启用 */
  enabled: boolean;
  /** 鉴权 key（可选） */
  authKey?: string;
};

const DEFAULT_CONFIG: LrcApiConfig = {
  lyricsUrl: isDev ? PROXY_LYRICS_URL : DIRECT_LYRICS_URL,
  coverUrl: isDev ? PROXY_COVER_URL : DIRECT_COVER_URL,
  enabled: false,
  authKey: '',
};

/** 获取默认配置（区分开发/生产环境） */
export function getDefaultLrcApiConfig(): LrcApiConfig {
  return { ...DEFAULT_CONFIG };
}

export function loadLrcApiConfig(): LrcApiConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<LrcApiConfig>;

    // 兼容旧版配置（只有 baseUrl）
    if ('baseUrl' in parsed && typeof (parsed as { baseUrl?: string }).baseUrl === 'string') {
      const oldBaseUrl = ((parsed as { baseUrl?: string }).baseUrl ?? '').replace(/\/$/, '');
      return {
        lyricsUrl: typeof parsed.lyricsUrl === 'string' ? parsed.lyricsUrl : `${oldBaseUrl}/lyrics`,
        coverUrl: typeof parsed.coverUrl === 'string' ? parsed.coverUrl : `${oldBaseUrl}/cover`,
        enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_CONFIG.enabled,
        authKey: typeof parsed.authKey === 'string' ? parsed.authKey : DEFAULT_CONFIG.authKey,
      };
    }

    return {
      lyricsUrl: typeof parsed.lyricsUrl === 'string' ? parsed.lyricsUrl : DEFAULT_CONFIG.lyricsUrl,
      coverUrl: typeof parsed.coverUrl === 'string' ? parsed.coverUrl : DEFAULT_CONFIG.coverUrl,
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_CONFIG.enabled,
      authKey: typeof parsed.authKey === 'string' ? parsed.authKey : DEFAULT_CONFIG.authKey,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveLrcApiConfig(config: LrcApiConfig) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

export type LyricLine = { time: number; text: string };

function parseLrc(lrcText: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const regex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)$/;

  for (const rawLine of lrcText.split('\n')) {
    const match = regex.exec(rawLine.trim());
    if (!match) continue;

    const min = parseInt(match[1], 10);
    const sec = parseInt(match[2], 10);
    const ms = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;
    const time = min * 60 + sec + ms / 1000;
    const text = match[4].trim();

    if (text) {
      lines.push({ time, text });
    }
  }

  return lines.sort((a, b) => a.time - b.time);
}

export async function fetchLyrics(
  title: string,
  artist: string,
  config?: LrcApiConfig,
): Promise<LyricLine[]> {
  const cfg = config ?? loadLrcApiConfig();
  if (!cfg.enabled || !cfg.lyricsUrl) return [];

  try {
    const params = new URLSearchParams({ title, artist });
    const url = `${cfg.lyricsUrl.replace(/\/$/, '')}?${params.toString()}`;
    const headers: HeadersInit = {};
    if (cfg.authKey) {
      headers['Authorization'] = cfg.authKey;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) return [];

    const text = await res.text();
    return parseLrc(text);
  } catch {
    return [];
  }
}

export function buildCoverUrl(
  title: string,
  artist: string,
  config?: LrcApiConfig,
): string | null {
  const cfg = config ?? loadLrcApiConfig();
  if (!cfg.enabled || !cfg.coverUrl) return null;

  const params = new URLSearchParams({ title, artist });

  // 如果有 authKey，需要通过 header 传递，但 img src 不支持 header
  // 部分 LrcApi 实现支持 auth query param
  if (cfg.authKey) {
    params.set('auth', cfg.authKey);
  }

  return `${cfg.coverUrl.replace(/\/$/, '')}?${params.toString()}`;
}
