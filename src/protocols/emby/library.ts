import { fetchJson } from '../../core/http/fetchJson';
import type { EmbyCredentials, EmbyPlaylist, EmbySong } from './types';
import { buildEmbyHeaders } from './headers';

type EmbyItemsResult<T> = {
  Items?: T[];
  TotalRecordCount?: number;
};

type EmbySongItemDto = {
  Id?: string;
  Name?: string;
  Artists?: string[];
  Album?: string;
  RunTimeTicks?: number;
  ProductionYear?: number;
};

type EmbyPlaylistItemDto = {
  Id?: string;
  Name?: string;
  ChildCount?: number;
};

export async function embyGetSongsPage(params: {
  credentials: EmbyCredentials;
  startIndex: number;
  limit: number;
  searchTerm?: string;
  signal?: AbortSignal;
}): Promise<{ items: EmbySong[]; total: number }> {
  const { credentials } = params;

  if (credentials.method === 'password' && !credentials.userId) {
    throw new Error('Emby 登录态缺少 UserId，请退出后重新登录');
  }

  const token = credentials.method === 'password' ? credentials.accessToken : credentials.apiKey;
  const userId = credentials.method === 'password' ? credentials.userId : undefined;

  // 为了控制服务端压力：
  // - 使用分页 StartIndex/Limit
  // - 只取必要字段 Fields
  // - 不做全量拉取/不预加载图片
  const q = new URLSearchParams();
  if (userId) q.set('UserId', userId);
  q.set('Recursive', 'true');
  q.set('IncludeItemTypes', 'Audio');
  q.set('StartIndex', String(Math.max(0, params.startIndex)));
  q.set('Limit', String(Math.max(1, Math.min(200, params.limit))));
  q.set('SortBy', 'SortName');
  q.set('SortOrder', 'Ascending');
  q.set('Fields', 'RunTimeTicks,Album,Artists,ProductionYear');
  q.set('EnableTotalRecordCount', 'true');
  if (params.searchTerm) q.set('SearchTerm', params.searchTerm);

  const url = userId
    ? `${credentials.baseUrl}/Users/${encodeURIComponent(userId)}/Items?${q.toString()}`
    : `${credentials.baseUrl}/Items?${q.toString()}`;

  const data = await fetchJson<EmbyItemsResult<EmbySongItemDto>>(url, {
    signal: params.signal,
    headers: buildEmbyHeaders({
      accessTokenOrApiKey: token,
      userId,
      client: credentials.client,
      device: credentials.device,
      deviceId: credentials.deviceId,
      version: credentials.version,
    }),
  });

  const items = (data.Items ?? [])
    .map((it) => {
      const id = it.Id?.trim();
      if (!id) return null;
      return {
        id,
        name: it.Name ?? '未命名',
        artists: it.Artists ?? [],
        album: it.Album,
        runTimeTicks: it.RunTimeTicks,
        productionYear: it.ProductionYear,
      } satisfies EmbySong;
    })
    .filter(Boolean) as EmbySong[];

  return { items, total: Number(data.TotalRecordCount ?? 0) };
}

export async function embyGetPlaylists(params: {
  credentials: EmbyCredentials;
  signal?: AbortSignal;
}): Promise<EmbyPlaylist[]> {
  const { credentials } = params;

  if (credentials.method === 'password' && !credentials.userId) {
    throw new Error('Emby 登录态缺少 UserId，请退出后重新登录');
  }

  const token = credentials.method === 'password' ? credentials.accessToken : credentials.apiKey;
  const userId = credentials.method === 'password' ? credentials.userId : undefined;

  const q = new URLSearchParams();
  if (userId) q.set('UserId', userId);
  q.set('Recursive', 'true');
  q.set('IncludeItemTypes', 'Playlist');
  q.set('SortBy', 'SortName');
  q.set('SortOrder', 'Ascending');
  q.set('Fields', 'ChildCount');
  q.set('StartIndex', '0');
  q.set('Limit', '2000');
  q.set('EnableTotalRecordCount', 'true');

  const url = userId
    ? `${credentials.baseUrl}/Users/${encodeURIComponent(userId)}/Items?${q.toString()}`
    : `${credentials.baseUrl}/Items?${q.toString()}`;

  const data = await fetchJson<EmbyItemsResult<EmbyPlaylistItemDto>>(url, {
    signal: params.signal,
    headers: buildEmbyHeaders({
      accessTokenOrApiKey: token,
      userId,
      client: credentials.client,
      device: credentials.device,
      deviceId: credentials.deviceId,
      version: credentials.version,
    }),
  });

  return (data.Items ?? [])
    .map((it) => {
      const id = it.Id?.trim();
      if (!id) return null;
      return {
        id,
        name: it.Name ?? '未命名歌单',
        songCount: typeof it.ChildCount === 'number' ? it.ChildCount : undefined,
      } satisfies EmbyPlaylist;
    })
    .filter(Boolean) as EmbyPlaylist[];
}

export async function embyGetPlaylistSongsPage(params: {
  credentials: EmbyCredentials;
  playlistId: string;
  startIndex: number;
  limit: number;
  searchTerm?: string;
  signal?: AbortSignal;
}): Promise<{ items: EmbySong[]; total: number }> {
  const { credentials } = params;

  if (credentials.method === 'password' && !credentials.userId) {
    throw new Error('Emby 登录态缺少 UserId，请退出后重新登录');
  }

  const token = credentials.method === 'password' ? credentials.accessToken : credentials.apiKey;
  const userId = credentials.method === 'password' ? credentials.userId : undefined;

  const playlistId = params.playlistId.trim();
  if (!playlistId) throw new Error('歌单 id 不能为空');

  const q = new URLSearchParams();
  if (userId) q.set('UserId', userId);
  q.set('StartIndex', String(Math.max(0, params.startIndex)));
  q.set('Limit', String(Math.max(1, Math.min(200, params.limit))));
  q.set('IncludeItemTypes', 'Audio');
  q.set('SortBy', 'SortName');
  q.set('SortOrder', 'Ascending');
  q.set('Fields', 'RunTimeTicks,Album,Artists,ProductionYear');
  q.set('EnableTotalRecordCount', 'true');
  if (params.searchTerm) q.set('SearchTerm', params.searchTerm);

  const url = `${credentials.baseUrl}/Playlists/${encodeURIComponent(playlistId)}/Items?${q.toString()}`;

  const data = await fetchJson<EmbyItemsResult<EmbySongItemDto>>(url, {
    signal: params.signal,
    headers: buildEmbyHeaders({
      accessTokenOrApiKey: token,
      userId,
      client: credentials.client,
      device: credentials.device,
      deviceId: credentials.deviceId,
      version: credentials.version,
    }),
  });

  const items = (data.Items ?? [])
    .map((it) => {
      const id = it.Id?.trim();
      if (!id) return null;
      return {
        id,
        name: it.Name ?? '未命名',
        artists: it.Artists ?? [],
        album: it.Album,
        runTimeTicks: it.RunTimeTicks,
        productionYear: it.ProductionYear,
      } satisfies EmbySong;
    })
    .filter(Boolean) as EmbySong[];

  return { items, total: Number(data.TotalRecordCount ?? 0) };
}
