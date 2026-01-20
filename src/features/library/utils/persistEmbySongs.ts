import type { EmbySong } from '../../../protocols/emby/types';

export type PersistedSongsCache = {
  v: 1 | 2;
  at: number;
  songs: EmbySong[];
  total: number;
  hasMore: boolean;
};

const SONGS_PERSIST_MAX = 800;

export function makeSongsPersistKey(params: {
  baseUrl: string;
  serverId?: string;
  userKey?: string;
  scope: 'library' | 'playlist';
  playlistId?: string;
  searchTerm: string;
}) {
  // 注意：不要把 accessToken/apiKey 等敏感值放进 key
  const base = encodeURIComponent(params.baseUrl);
  const server = encodeURIComponent(params.serverId ?? '');
  const user = encodeURIComponent(params.userKey ?? '');
  const scope = encodeURIComponent(params.scope);
  const pid = encodeURIComponent(params.playlistId ?? '');
  const q = encodeURIComponent(params.searchTerm || '');
  return `linktune:cache:songs:v2:emby:${scope}:${pid}:${base}:${server}:${user}:${q}`;
}

export function loadPersistedSongs(key: string): PersistedSongsCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = parsed as any;
    if (p.v !== 1 && p.v !== 2) return null;
    if (!Array.isArray(p.songs)) return null;
    return p as PersistedSongsCache;
  } catch {
    return null;
  }
}

export function savePersistedSongs(key: string, value: PersistedSongsCache) {
  if (typeof window === 'undefined') return;

  const trySave = (v: PersistedSongsCache) => {
    window.localStorage.setItem(key, JSON.stringify(v));
  };

  try {
    trySave(value);
  } catch {
    // localStorage 容量有限：必要时截断已加载列表，保证“返回页面不重拉”这个体验
    try {
      const trimmed: PersistedSongsCache = {
        ...value,
        songs: value.songs.slice(0, SONGS_PERSIST_MAX),
      };
      trySave(trimmed);
    } catch {
      // ignore
    }
  }
}
