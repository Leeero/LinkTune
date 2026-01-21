import type { CustomCredentials } from './types';
import type { CustomPlaylistSource, CustomSong } from './library';

export type CustomToplist = {
  id: string;
  name: string;
  updateFrequency?: string;
  pic?: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object';
}

function extractList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];

  const data = payload.data;
  if (Array.isArray(data)) return data;

  if (isRecord(data)) {
    const list = data.list;
    if (Array.isArray(list)) return list;
  }

  const list = payload.list;
  if (Array.isArray(list)) return list;

  return [];
}

function parseToplist(item: unknown): CustomToplist {
  if (!isRecord(item)) return { id: '', name: '' };

  const id = String(item.id ?? '');
  const name = String(item.name ?? item.title ?? '');
  const updateFrequency = typeof item.updateFrequency === 'string' ? item.updateFrequency : undefined;
  const pic = typeof item.pic === 'string' ? item.pic : undefined;

  return { id, name, updateFrequency, pic };
}

function parseSong(item: unknown): CustomSong {
  if (!isRecord(item)) {
    return { id: '', name: '未知歌曲', artists: [] };
  }

  const id = String(item.id ?? item.songId ?? item.song_id ?? '');
  const name = String(item.name ?? item.title ?? item.songName ?? item.song_name ?? '未知歌曲');

  let artists: string[] = [];
  if (Array.isArray(item.artists)) {
    artists = item.artists
      .map((a) => {
        if (typeof a === 'string') return a;
        if (isRecord(a)) return String(a.name ?? a.artistName ?? a.artist_name ?? '');
        return '';
      })
      .filter(Boolean);
  } else if (typeof item.artist === 'string') {
    artists = [item.artist];
  } else if (typeof item.singer === 'string') {
    artists = [item.singer];
  } else if (isRecord(item.artist)) {
    artists = [String(item.artist.name ?? '')].filter(Boolean);
  }

  const album = item.album
    ? typeof item.album === 'string'
      ? item.album
      : isRecord(item.album)
        ? String(item.album.name ?? '')
        : undefined
    : undefined;

  const duration = typeof item.duration === 'number'
    ? item.duration
    : typeof item.dt === 'number'
      ? Math.floor(item.dt / 1000)
      : undefined;

  const url = typeof item.url === 'string' ? item.url : undefined;
  const cover = typeof item.cover === 'string'
    ? item.cover
    : typeof item.pic === 'string'
      ? item.pic
      : typeof item.picUrl === 'string'
        ? item.picUrl
        : undefined;

  return { id, name, artists, album, duration, url, cover };
}

export async function customGetToplists(params: {
  credentials: CustomCredentials;
  source: CustomPlaylistSource;
  signal?: AbortSignal;
}): Promise<CustomToplist[]> {
  const { credentials, source, signal } = params;

  const url = new URL('/api/', credentials.baseUrl);
  url.searchParams.set('source', source);
  url.searchParams.set('type', 'toplists');

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!res.ok) {
    throw new Error(`获取热门榜单失败: ${res.status} ${res.statusText}`);
  }

  const json: unknown = await res.json();
  const list = extractList(json);

  return list.map(parseToplist).filter((x) => Boolean(x.id && x.name));
}

export async function customGetToplistSongs(params: {
  credentials: CustomCredentials;
  source: CustomPlaylistSource;
  toplistId: string;
  signal?: AbortSignal;
}): Promise<CustomSong[]> {
  const { credentials, source, toplistId, signal } = params;

  const url = new URL('/api/', credentials.baseUrl);
  url.searchParams.set('source', source);
  url.searchParams.set('type', 'toplist');
  url.searchParams.set('id', toplistId);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!res.ok) {
    throw new Error(`获取榜单歌曲失败: ${res.status} ${res.statusText}`);
  }

  const json: unknown = await res.json();
  const list = extractList(json);

  return list.map(parseSong).filter((x) => Boolean(x.id));
}
