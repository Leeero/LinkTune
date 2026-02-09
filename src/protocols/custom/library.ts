import type { AudioQuality } from '../../config/audioQualityConfig';
import type { CustomCredentials } from './types';
import { getCachedParse, setCachedParseMany } from './parseCache';

export type CustomSong = {
  id: string;
  name: string;
  artists: string[];
  album?: string;
  duration?: number; // 秒
  url?: string;
  cover?: string;
  /** 歌曲来源平台 */
  platform?: CustomPlatform;
};

export type CustomSongsPageResult = {
  items: CustomSong[];
  total: number;
};

/**
 * 平台类型（对应 TuneHub API 的 platform 参数）
 */
export type CustomPlatform = 'netease' | 'qq' | 'kuwo';

/**
 * 音质类型（内部使用，映射自 AudioQuality）
 */
type TuneHubQuality = '128k' | '320k' | 'flac' | 'flac24bit';

/**
 * 将通用 AudioQuality 转换为 TuneHub API 的音质参数
 */
export function toTuneHubQuality(quality?: AudioQuality): TuneHubQuality {
  if (!quality) return '320k';
  // 直接匹配
  if (quality === '128k' || quality === '320k' || quality === 'flac' || quality === 'flac24bit') {
    return quality;
  }
  // Emby 格式映射
  if (quality === 'low') return '128k';
  if (quality === 'medium') return '320k';
  if (quality === 'high') return '320k';
  if (quality === 'lossless') return 'flac';
  return '320k';
}

/**
 * 解析响应中的单首歌曲数据（TuneHub /v1/parse 接口返回的格式）
 */
export type ParsedSongData = {
  id: string;
  success: boolean;
  url: string;
  info?: {
    name: string;
    artist: string;
    album: string;
    duration: number;
  };
  cover?: string;
  lyrics?: string;
  wordByWordLyrics?: string | null;
  hasWordByWord?: boolean;
  requestedQuality?: string;
  actualQuality?: string;
  qualityMatch?: boolean;
  wasDowngraded?: boolean;
  fileSize?: number;
  responseTime?: number;
  expire?: number;
};

/**
 * TuneHub 解析 API 响应
 */
type ParseApiResponse = {
  code: number;
  success?: boolean;
  message?: string;
  data?: {
    data: ParsedSongData[];
    total: number;
    success_count: number;
    fail_count: number;
    cache_hit_count: number;
    cost: number;
  };
};

/**
 * 调用 TuneHub 解析接口获取歌曲播放信息
 * POST /v1/parse
 *
 * 优化：
 * 1. 优先检查客户端缓存（4.5 分钟有效期）
 * 2. 对于已缓存的歌曲，直接返回缓存结果
 * 3. 只请求未缓存的歌曲，减少积分消耗
 * 4. 将新解析的结果存入缓存
 */
export async function customParseSongs(params: {
  credentials: CustomCredentials;
  platform: CustomPlatform;
  ids: string | string[];
  quality?: AudioQuality;
  signal?: AbortSignal;
}): Promise<ParsedSongData[]> {
  const { credentials, platform, ids, quality, signal } = params;

  const tuneHubQuality = toTuneHubQuality(quality);
  const idList = Array.isArray(ids) ? ids : ids.split(',').map((s) => s.trim()).filter(Boolean);

  // 检查缓存，分离已缓存和未缓存的 ID
  const cachedResults: ParsedSongData[] = [];
  const uncachedIds: string[] = [];

  for (const id of idList) {
    const cached = getCachedParse(platform, id, tuneHubQuality);
    if (cached) {
      cachedResults.push(cached);
    } else {
      uncachedIds.push(id);
    }
  }

  // 如果所有 ID 都已缓存，直接返回
  if (uncachedIds.length === 0) {
    console.log(`[ParseCache] 全部命中缓存，共 ${cachedResults.length} 首`);
    // 按原始顺序返回
    return idList.map((id) => {
      const cached = cachedResults.find((r) => r.id === id);
      return cached!;
    }).filter(Boolean);
  }

  console.log(`[ParseCache] 缓存命中 ${cachedResults.length} 首，需请求 ${uncachedIds.length} 首`);

  // 请求未缓存的歌曲
  const idsStr = uncachedIds.join(',');

  const res = await fetch(`${credentials.baseUrl}/v1/parse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': credentials.apiKey,
      Accept: 'application/json',
    },
    body: JSON.stringify({
      platform,
      ids: idsStr,
      quality: tuneHubQuality,
    }),
    signal,
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('API Key 无效或未提供');
    }
    if (res.status === 403) {
      throw new Error('账户被封禁或 Key 已禁用');
    }
    if (res.status === 404) {
      throw new Error('请求的资源不存在');
    }
    throw new Error(`解析歌曲失败: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as ParseApiResponse;

  if (json.code === -2) {
    throw new Error('账户积分不足');
  }
  if (json.code !== 0 || !json.success) {
    throw new Error(json.message || '解析失败');
  }

  // 注意：数据在 data.data 中
  const freshResults = json.data?.data || [];

  // 将新解析的结果存入缓存
  setCachedParseMany(platform, tuneHubQuality, freshResults);

  // 合并缓存结果和新结果，按原始顺序返回
  const allResults = [...cachedResults, ...freshResults];
  return idList.map((id) => {
    return allResults.find((r) => r.id === id);
  }).filter(Boolean) as ParsedSongData[];
}

/**
 * 解析单首歌曲并获取播放 URL
 */
export async function customGetSongUrl(params: {
  credentials: CustomCredentials;
  song: CustomSong;
  quality?: AudioQuality;
  signal?: AbortSignal;
}): Promise<string> {
  const { credentials, song, quality, signal } = params;

  // 如果歌曲本身有 URL，直接返回
  if (song.url) {
    return song.url;
  }

  const platform = song.platform || 'netease';

  const parsed = await customParseSongs({
    credentials,
    platform,
    ids: song.id,
    quality,
    signal,
  });

  if (parsed.length === 0) {
    throw new Error('无法获取播放链接');
  }

  const result = parsed[0];
  if (!result.success || !result.url) {
    throw new Error('无法获取播放链接');
  }

  return result.url;
}

/**
 * 解析单首歌曲并获取完整播放信息（包含 URL、封面、歌词等）
 */
export async function customGetSongPlayInfo(params: {
  credentials: CustomCredentials;
  song: CustomSong;
  quality?: AudioQuality;
  signal?: AbortSignal;
}): Promise<{
  url: string;
  cover?: string;
  lyrics?: string;
  actualQuality?: string;
}> {
  const { credentials, song, quality, signal } = params;

  const platform = song.platform || 'netease';

  const parsed = await customParseSongs({
    credentials,
    platform,
    ids: song.id,
    quality,
    signal,
  });

  if (parsed.length === 0) {
    throw new Error('无法获取播放链接');
  }

  const result = parsed[0];
  if (!result.success || !result.url) {
    throw new Error('无法获取播放链接');
  }

  return {
    url: result.url,
    cover: result.cover,
    lyrics: result.lyrics,
    actualQuality: result.actualQuality,
  };
}

/**
 * 解析单个歌曲数据（从方法下发返回的原始数据）
 */
export function parseCustomSong(item: unknown, platform?: CustomPlatform): CustomSong {
  if (!item || typeof item !== 'object') {
    return { id: '', name: '未知歌曲', artists: [] };
  }

  const obj = item as Record<string, unknown>;

  // 尝试解析不同格式的歌曲数据
  // QQ音乐使用 mid 作为歌曲唯一标识（字符串），优先使用 mid
  const id = String(obj.mid ?? obj.id ?? obj.songId ?? obj.song_id ?? obj.rid ?? obj.musicrid ?? '');
  const name = String(obj.name ?? obj.title ?? obj.songName ?? obj.song_name ?? '未知歌曲');

  // 解析艺术家
  let artists: string[] = [];
  if (Array.isArray(obj.singer)) {
    // QQ音乐格式: singer 数组
    artists = obj.singer
      .map((s: unknown) => {
        if (typeof s === 'string') return s;
        if (s && typeof s === 'object') {
          const so = s as Record<string, unknown>;
          return String(so.name ?? so.title ?? '');
        }
        return '';
      })
      .filter(Boolean);
  } else if (Array.isArray(obj.artists)) {
    artists = obj.artists
      .map((a: unknown) => {
        if (typeof a === 'string') return a;
        if (a && typeof a === 'object') {
          const ao = a as Record<string, unknown>;
          return String(ao.name ?? ao.artistName ?? ao.artist_name ?? '');
        }
        return '';
      })
      .filter(Boolean);
  } else if (typeof obj.artist === 'string') {
    artists = obj.artist.split(/[,&/、]/).map((s) => s.trim()).filter(Boolean);
  } else if (typeof obj.singer === 'string') {
    artists = obj.singer.split(/[,&/、]/).map((s) => s.trim()).filter(Boolean);
  } else if (obj.artist && typeof obj.artist === 'object') {
    const ao = obj.artist as Record<string, unknown>;
    artists = [String(ao.name ?? '')].filter(Boolean);
  } else if (Array.isArray(obj.ar)) {
    // 网易云格式
    artists = obj.ar
      .map((a: unknown) => {
        if (a && typeof a === 'object') {
          return String((a as Record<string, unknown>).name ?? '');
        }
        return '';
      })
      .filter(Boolean);
  }

  // 解析专辑
  let album: string | undefined;
  if (typeof obj.album === 'string') {
    album = obj.album;
  } else if (obj.album && typeof obj.album === 'object') {
    // QQ音乐格式: album 对象有 name 属性
    album = String((obj.album as Record<string, unknown>).name ?? (obj.album as Record<string, unknown>).title ?? '');
  } else if (obj.al && typeof obj.al === 'object') {
    // 网易云格式
    album = String((obj.al as Record<string, unknown>).name ?? '');
  }

  // 解析时长
  let duration: number | undefined;
  if (typeof obj.interval === 'number') {
    // QQ音乐格式：interval 是秒
    duration = obj.interval;
  } else if (typeof obj.duration === 'number') {
    // 可能是秒或毫秒
    duration = obj.duration > 10000 ? Math.floor(obj.duration / 1000) : obj.duration;
  } else if (typeof obj.dt === 'number') {
    // 网易云格式，毫秒
    duration = Math.floor(obj.dt / 1000);
  } else if (typeof obj.songTimeMinutes === 'string') {
    // 酷我格式 "04:30"
    const parts = obj.songTimeMinutes.split(':');
    if (parts.length === 2) {
      duration = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
  }

  const url = typeof obj.url === 'string' ? obj.url : undefined;

  // 解析封面
  let cover: string | undefined;
  if (typeof obj.cover === 'string') {
    cover = obj.cover;
  } else if (typeof obj.pic === 'string') {
    cover = obj.pic;
  } else if (typeof obj.picUrl === 'string') {
    cover = obj.picUrl;
  } else if (typeof obj.albumpic === 'string') {
    // 酷我格式
    cover = obj.albumpic;
  } else if (obj.al && typeof obj.al === 'object') {
    // 网易云格式
    const al = obj.al as Record<string, unknown>;
    if (typeof al.picUrl === 'string') {
      cover = al.picUrl;
    }
  } else if (obj.album && typeof obj.album === 'object') {
    // QQ音乐：可以从 album.pmid 构造封面 URL
    const albumObj = obj.album as Record<string, unknown>;
    const pmid = albumObj.pmid ?? albumObj.mid;
    if (typeof pmid === 'string' && pmid) {
      cover = `https://y.qq.com/music/photo_new/T002R300x300M000${pmid}.jpg`;
    }
  }

  return { id, name, artists, album, duration, url, cover, platform };
}

/**
 * 构建歌曲播放 URL（同步方式，用于已有 URL 的歌曲）
 * 注意：对于没有 URL 的歌曲，应使用 customGetSongUrl 异步获取
 */
export function buildCustomAudioUrl(params: {
  credentials: CustomCredentials;
  song: CustomSong;
  platform: CustomPlatform;
  quality?: AudioQuality;
}): string | null {
  const { song } = params;

  // 如果歌曲本身有 URL，直接返回
  if (song.url) {
    return song.url;
  }

  // 没有 URL，返回 null，需要调用解析接口
  return null;
}
