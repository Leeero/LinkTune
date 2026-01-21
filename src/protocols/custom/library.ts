import type { CustomCredentials } from './types';

export type CustomSong = {
  id: string;
  name: string;
  artists: string[];
  album?: string;
  duration?: number; // 秒
  url?: string;
  cover?: string;
};

export type CustomSongsPageResult = {
  items: CustomSong[];
  total: number;
};

/**
 * 歌单来源类型
 */
export type CustomPlaylistSource = 'netease' | 'kuwo' | 'qq';

/**
 * 获取自定义协议歌单的歌曲列表（分页）
 */
export async function customGetPlaylistSongsPage(params: {
  credentials: CustomCredentials;
  source: CustomPlaylistSource;
  startIndex?: number;
  limit?: number;
  signal?: AbortSignal;
}): Promise<CustomSongsPageResult> {
  const { credentials, source, startIndex = 0, limit = 50, signal } = params;

  // 构建 API URL
  // 根据 tunefree.fun 的 API 格式，这里假设接口格式为：
  // GET {baseUrl}/getPlayList?source={source}&offset={offset}&limit={limit}
  const url = new URL('/getPlayList', credentials.baseUrl);
  url.searchParams.set('source', source);
  url.searchParams.set('offset', String(startIndex));
  url.searchParams.set('limit', String(limit));

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

  if (!res.ok) {
    throw new Error(`获取歌单失败: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  // 解析响应数据，适配不同的响应格式
  // 假设响应格式为 { data: [...], total: number } 或 { list: [...], total: number }
  const items: CustomSong[] = [];
  let total = 0;

  if (Array.isArray(data)) {
    // 直接返回数组
    for (const item of data) {
      items.push(parseCustomSong(item));
    }
    total = data.length;
  } else if (data && typeof data === 'object') {
    const list = data.data || data.list || data.songs || data.result || [];
    if (Array.isArray(list)) {
      for (const item of list) {
        items.push(parseCustomSong(item));
      }
    }
    total = typeof data.total === 'number' ? data.total : items.length;
  }

  return { items, total };
}

/**
 * 解析单个歌曲数据
 */
function parseCustomSong(item: unknown): CustomSong {
  if (!item || typeof item !== 'object') {
    return { id: '', name: '未知歌曲', artists: [] };
  }

  const obj = item as Record<string, unknown>;

  // 尝试解析不同格式的歌曲数据
  const id = String(obj.id ?? obj.songId ?? obj.song_id ?? '');
  const name = String(obj.name ?? obj.title ?? obj.songName ?? obj.song_name ?? '未知歌曲');

  // 解析艺术家
  let artists: string[] = [];
  if (Array.isArray(obj.artists)) {
    artists = obj.artists.map((a: unknown) => {
      if (typeof a === 'string') return a;
      if (a && typeof a === 'object') {
        const ao = a as Record<string, unknown>;
        return String(ao.name ?? ao.artistName ?? ao.artist_name ?? '');
      }
      return '';
    }).filter(Boolean);
  } else if (typeof obj.artist === 'string') {
    artists = [obj.artist];
  } else if (typeof obj.singer === 'string') {
    artists = [obj.singer];
  } else if (obj.artist && typeof obj.artist === 'object') {
    const ao = obj.artist as Record<string, unknown>;
    artists = [String(ao.name ?? '')].filter(Boolean);
  }

  const album = obj.album
    ? typeof obj.album === 'string'
      ? obj.album
      : String((obj.album as Record<string, unknown>).name ?? '')
    : undefined;

  const duration = typeof obj.duration === 'number'
    ? obj.duration
    : typeof obj.dt === 'number'
      ? Math.floor(obj.dt / 1000)
      : undefined;

  const url = typeof obj.url === 'string' ? obj.url : undefined;
  const cover = typeof obj.cover === 'string'
    ? obj.cover
    : typeof obj.pic === 'string'
      ? obj.pic
      : typeof obj.picUrl === 'string'
        ? obj.picUrl
        : undefined;

  return { id, name, artists, album, duration, url, cover };
}

/**
 * 构建歌曲播放 URL
 */
export function buildCustomAudioUrl(params: {
  credentials: CustomCredentials;
  song: CustomSong;
  source: CustomPlaylistSource;
  quality?: string;
}): string {
  const { credentials, song, source, quality } = params;

  // 如果歌曲本身有 URL，直接返回
  if (song.url) {
    return song.url;
  }

  // 否则构建获取播放 URL 的接口
  // 格式：{baseUrl}/api/?source={source}&id={id}&type=url&br={quality}
  const url = new URL('/api/', credentials.baseUrl);
  url.searchParams.set('source', source);
  url.searchParams.set('id', song.id);
  url.searchParams.set('type', 'url');
  const br = (quality ?? '320k').trim();
  if (br) url.searchParams.set('br', `[${br}]`);

  return url.toString();
}
