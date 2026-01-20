import { PlayCircleOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Input, Space, Table, Tag, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';

import { getMaxBitrate, loadAudioQuality } from '../../config/audioQualityConfig';
import { useAuth } from '../../session/AuthProvider';
import { embyGetPlaylistSongsPage, embyGetSongsPage } from '../../protocols/emby/library';
import { buildEmbyAudioUniversalUrl } from '../../protocols/emby/media';
import type { EmbySong } from '../../protocols/emby/types';
import {
  buildCustomAudioUrl,
  customGetPlaylistSongsPage,
  type CustomPlaylistSource,
  type CustomSong,
} from '../../protocols/custom/library';
import { usePlayer } from '../../player/PlayerContext';
import type { Track } from '../../player/types';

// 统一歌曲类型
type UnifiedSong = EmbySong | CustomSong;

function formatDurationFromTicks(ticks?: number) {
  if (!ticks || !Number.isFinite(ticks) || ticks <= 0) return '--:--';
  const totalSeconds = Math.floor(ticks / 10_000_000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDurationFromSeconds(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function joinArtists(artists: string[]) {
  return artists?.length ? artists.join(', ') : '未知艺术家';
}

type CacheValue = {
  at: number;
  items: EmbySong[];
  total: number;
};

type PersistedSongsCache = {
  v: 1 | 2;
  at: number;
  songs: EmbySong[];
  total: number;
  hasMore: boolean;
};

const SONGS_PERSIST_MAX = 800;

function makeSongsPersistKey(params: {
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

function loadPersistedSongs(key: string): PersistedSongsCache | null {
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

function savePersistedSongs(key: string, value: PersistedSongsCache) {
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

type RequestIdleCallback = (cb: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void, opts?: { timeout: number }) => number;

type CancelIdleCallback = (handle: number) => void;

export function LibraryPage() {
  const { token } = theme.useToken();
  const auth = useAuth();
  const player = usePlayer();
  const location = useLocation();
  const { playlistId: rawPlaylistId } = useParams();

  const playlistId = typeof rawPlaylistId === 'string' ? rawPlaylistId : '';
  const isPlaylistMode = Boolean(playlistId);

  // 获取歌单来源（用于自定义协议）
  const customSource = (() => {
    const s = location.state as unknown;
    if (!s || typeof s !== 'object') return playlistId as CustomPlaylistSource;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return String((s as any).source ?? playlistId) as CustomPlaylistSource;
  })();

  const playlistName = (() => {
    const s = location.state as unknown;
    if (!s || typeof s !== 'object') return '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return String((s as any).playlistName ?? '');
  })();

  const [batchSize] = useState(80);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [playAllLoading, setPlayAllLoading] = useState(false);

  const [songs, setSongs] = useState<UnifiedSong[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingFirstPage, setLoadingFirstPage] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cacheRef = useRef<Map<string, CacheValue>>(new Map());
  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  const activeReqAbortRef = useRef<AbortController | null>(null);
  const [tableBodyY, setTableBodyY] = useState<number>(420);

  const persistTimerRef = useRef<number | null>(null);
  const prevAutoLoadKeyRef = useRef<string>('');

  const restoreIdleHandleRef = useRef<number | null>(null);
  const restoreTimeoutHandleRef = useRef<number | null>(null);

  // 用 ref 避免 load 函数依赖 songs/hasMore/loading 造成闭包变化，从而触发重复请求
  const songsRef = useRef<UnifiedSong[]>([]);
  const totalRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingFirstRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const autoFillAttemptsRef = useRef(0);

  useEffect(() => {
    songsRef.current = songs;
  }, [songs]);
  useEffect(() => {
    totalRef.current = total;
  }, [total]);
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);
  useEffect(() => {
    loadingFirstRef.current = loadingFirstPage;
  }, [loadingFirstPage]);
  useEffect(() => {
    loadingMoreRef.current = loadingMore;
  }, [loadingMore]);

  const connectionTitle = useMemo(() => {
    const c = auth.credentials;
    if (!c) return '';
    try {
      const host = new URL(c.baseUrl).host;
      if (c.protocol === 'custom') {
        return `自定义 · ${host}`;
      }
      return `${c.protocol.toUpperCase()} · ${host}${'serverName' in c && c.serverName ? ` · ${c.serverName}` : ''}`;
    } catch {
      return c.protocol.toUpperCase();
    }
  }, [auth.credentials]);

  const isEmby = auth.credentials?.protocol === 'emby';
  const isCustom = auth.credentials?.protocol === 'custom';

  const pageTitle = isPlaylistMode ? (playlistName ? `歌单 · ${playlistName}` : '歌单') : '歌曲';

  const songsPersistKey = useMemo(() => {
    const c = auth.credentials;
    if (!c || c.protocol !== 'emby') return null;

    const userKey = c.method === 'password' ? c.userId || c.username : '';
    return makeSongsPersistKey({
      baseUrl: c.baseUrl,
      serverId: c.serverId,
      userKey,
      scope: isPlaylistMode ? 'playlist' : 'library',
      playlistId: isPlaylistMode ? playlistId : undefined,
      searchTerm,
    });
  }, [auth.credentials, isPlaylistMode, playlistId, searchTerm]);

  // 搜索输入做轻度防抖，避免每个按键都打到服务端
  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  // 让表格区域可纵向滚动：根据容器高度动态计算 Table body 的 scroll.y
  useEffect(() => {
    const el = tableWrapRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height;
      // Table header 高度大约 56px；这里留一点余量避免抖动
      const bodyY = Math.max(220, Math.floor(h - 60));
      setTableBodyY(bodyY);
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const loadSongsChunk = useCallback(
    async (params: { reset: boolean }) => {
      const c = auth.credentials;
      if (!c) return;

      // 仅支持 emby 和 custom 协议
      if (c.protocol !== 'emby' && c.protocol !== 'custom') return;

      // reset 时取消进行中的请求，并重置自动补齐计数
      if (params.reset) {
        autoFillAttemptsRef.current = 0;
        activeReqAbortRef.current?.abort();
        activeReqAbortRef.current = null;
      }

      if (loadingFirstRef.current || loadingMoreRef.current) return;

      const currentSongs = songsRef.current;
      const startIndex = params.reset ? 0 : currentSongs.length;

      const currentTotal = totalRef.current;
      const currentHasMore = hasMoreRef.current;
      if (!params.reset && (!currentHasMore || (currentTotal > 0 && startIndex >= currentTotal))) return;

      const controller = new AbortController();
      activeReqAbortRef.current = controller;

      if (params.reset) {
        setLoadingFirstPage(true);
        setError(null);
        setHasMore(true);
        setSongs([]);
        setTotal(0);
      } else {
        setLoadingMore(true);
      }

      try {
        if (c.protocol === 'custom') {
          // 自定义协议：调用 customGetPlaylistSongsPage
          const res = await customGetPlaylistSongsPage({
            credentials: c,
            source: customSource,
            startIndex,
            limit: batchSize,
            signal: controller.signal,
          });

          setTotal(res.total);
          setSongs((prev) => {
            const next = params.reset ? res.items : [...prev, ...res.items];
            const seen = new Set<string>();
            return next.filter((x) => {
              if (seen.has(x.id)) return false;
              seen.add(x.id);
              return true;
            });
          });

          setHasMore(startIndex + res.items.length < res.total);
        } else {
          // Emby 协议
          const modeKey = isPlaylistMode ? `playlist:${playlistId}` : 'library';
          const key = `${modeKey}|${c.baseUrl}|${c.method}|${'userId' in c ? c.userId ?? '' : ''}|${startIndex}|${batchSize}|${searchTerm}`;

          // 短缓存：避免滚动抖动/回弹导致的重复请求
          const cached = cacheRef.current.get(key);
          const now = Date.now();
          if (cached && now - cached.at < 30_000) {
            setSongs((prev) => {
              const next = params.reset ? cached.items : [...prev, ...cached.items];
              const seen = new Set<string>();
              return next.filter((x) => {
                if (seen.has(x.id)) return false;
                seen.add(x.id);
                return true;
              });
            });
            setTotal(cached.total);
            setHasMore(startIndex + cached.items.length < cached.total);
            setLoadingFirstPage(false);
            setLoadingMore(false);
            return;
          }

          const res = isPlaylistMode
            ? await embyGetPlaylistSongsPage({
                credentials: c,
                playlistId,
                startIndex,
                limit: batchSize,
                searchTerm: searchTerm || undefined,
                signal: controller.signal,
              })
            : await embyGetSongsPage({
                credentials: c,
                startIndex,
                limit: batchSize,
                searchTerm: searchTerm || undefined,
                signal: controller.signal,
              });

          const value: CacheValue = { at: Date.now(), items: res.items, total: res.total };
          cacheRef.current.set(key, value);
          if (cacheRef.current.size > 60) {
            const firstKey = cacheRef.current.keys().next().value as string | undefined;
            if (firstKey) cacheRef.current.delete(firstKey);
          }

          setTotal(res.total);
          setSongs((prev) => {
            const next = params.reset ? res.items : [...prev, ...res.items];
            const seen = new Set<string>();
            return next.filter((x) => {
              if (seen.has(x.id)) return false;
              seen.add(x.id);
              return true;
            });
          });

          setHasMore(startIndex + res.items.length < res.total);
        }
      } catch (e) {
        if (e instanceof Error && /取消/.test(e.message)) return;
        setError(e instanceof Error ? e.message : '拉取歌曲失败');
      } finally {
        setLoadingFirstPage(false);
        setLoadingMore(false);
        if (activeReqAbortRef.current === controller) {
          activeReqAbortRef.current = null;
        }
      }
    },
    [auth.credentials, batchSize, customSource, isPlaylistMode, playlistId, searchTerm],
  );

  // 当登录态/搜索条件变化：优先从本地恢复，避免每次切页都重新拉取
  useEffect(() => {
    if (!auth.credentials) return;

    const protocol = auth.credentials.protocol;

    // 自定义协议：直接加载
    if (protocol === 'custom') {
      const autoLoadKey = `custom:${customSource}|${auth.credentials.baseUrl}`;
      const isSameAutoLoadKey = autoLoadKey === prevAutoLoadKeyRef.current;
      if (isSameAutoLoadKey) {
        const hasAnyData = songsRef.current.length > 0 || totalRef.current > 0;
        if (hasAnyData || loadingFirstRef.current || loadingMoreRef.current) return;
      }
      prevAutoLoadKeyRef.current = autoLoadKey;
      void loadSongsChunk({ reset: true });
      return;
    }

    // 非 emby 协议（如 navidrome）暂不支持
    if (protocol !== 'emby') {
      setSongs([]);
      setTotal(0);
      setHasMore(false);
      setError(null);
      return;
    }

    const c = auth.credentials;
    const userKey = c.method === 'password' ? c.userId || c.username : '';
    const modeKey = isPlaylistMode ? `playlist:${playlistId}` : 'library';
    const autoLoadKey = `${modeKey}|${c.baseUrl}|${c.serverId ?? ''}|${userKey}|${searchTerm}`;

    // 避免 batchSize 改变导致不必要的 reset。
    // 注意：React 18 StrictMode(开发环境) 会对 effect 做“执行→清理→再执行”。
    // 如果这里无条件同 key 直接 return，会把第二次执行短路掉，导致首次进入既不恢复缓存也不拉取。
    const isSameAutoLoadKey = autoLoadKey === prevAutoLoadKeyRef.current;
    if (isSameAutoLoadKey) {
      const hasAnyData = songsRef.current.length > 0 || totalRef.current > 0;
      if (hasAnyData || loadingFirstRef.current || loadingMoreRef.current) return;
      // 同 key 但当前还没拿到任何数据：允许继续走恢复/拉取（用于 StrictMode 或异常中断后的兜底）。
    }
    prevAutoLoadKeyRef.current = autoLoadKey;

    // 清理上一次延迟恢复
    const w = window as unknown as {
      requestIdleCallback?: RequestIdleCallback;
      cancelIdleCallback?: CancelIdleCallback;
    };
    if (restoreIdleHandleRef.current && w.cancelIdleCallback) {
      w.cancelIdleCallback(restoreIdleHandleRef.current);
      restoreIdleHandleRef.current = null;
    }
    if (restoreTimeoutHandleRef.current) {
      window.clearTimeout(restoreTimeoutHandleRef.current);
      restoreTimeoutHandleRef.current = null;
    }

    // 关键优化：恢复缓存可能触发 JSON.parse + 一次性渲染大量行，容易卡住路由切换。
    // 做法：把缓存恢复延迟到浏览器空闲时（或至少下一拍），并用 startTransition 降低优先级。
    // 兼容性兜底：部分环境/时序下 requestIdleCallback 可能不触发或延迟较久，这里加一条 setTimeout 备援。
    if (songsPersistKey) {
      const schedule = () => {
        const persisted = loadPersistedSongs(songsPersistKey);
        if (persisted && persisted.songs.length > 0) {
          activeReqAbortRef.current?.abort();
          activeReqAbortRef.current = null;

          startTransition(() => {
            setError(null);
            setSongs(persisted.songs);
            setTotal(persisted.total);
            setHasMore(persisted.hasMore);
            setLoadingFirstPage(false);
            setLoadingMore(false);
          });
          return;
        }

        void loadSongsChunk({ reset: true });
      };

      let ran = false;
      const runOnce = () => {
        if (ran) return;
        ran = true;
        schedule();
      };

      if (w.requestIdleCallback) {
        restoreIdleHandleRef.current = w.requestIdleCallback(() => {
          if (restoreTimeoutHandleRef.current) {
            window.clearTimeout(restoreTimeoutHandleRef.current);
            restoreTimeoutHandleRef.current = null;
          }
          runOnce();
        }, { timeout: 200 });

        // 备援：如果 idle 回调没来（或被极度延后），保证 200ms 左右能至少恢复/拉取一次
        restoreTimeoutHandleRef.current = window.setTimeout(() => runOnce(), 220);
      } else {
        restoreTimeoutHandleRef.current = window.setTimeout(() => runOnce(), 0);
      }
    } else {
      void loadSongsChunk({ reset: true });
    }

    return () => {
      activeReqAbortRef.current?.abort();
      activeReqAbortRef.current = null;

      if (restoreIdleHandleRef.current && w.cancelIdleCallback) {
        w.cancelIdleCallback(restoreIdleHandleRef.current);
        restoreIdleHandleRef.current = null;
      }
      if (restoreTimeoutHandleRef.current) {
        window.clearTimeout(restoreTimeoutHandleRef.current);
        restoreTimeoutHandleRef.current = null;
      }
    };
  }, [auth.credentials, customSource, isPlaylistMode, loadSongsChunk, playlistId, searchTerm, songsPersistKey]);

  // 将已加载列表持久化到本地：回到本页时直接复用，不重复请求
  useEffect(() => {
    if (!isEmby) return;
    if (!songsPersistKey) return;
    if (typeof window === 'undefined') return;
    if (songs.length === 0) return;
    if (loadingFirstPage) return;

    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      savePersistedSongs(songsPersistKey, {
        v: 2,
        at: Date.now(),
        songs,
        total,
        hasMore,
      });
    }, 500);

    return () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    };
  }, [hasMore, isEmby, loadingFirstPage, songs, songsPersistKey, total]);

  // 监听表格滚动到底部：自动加载更多
  useEffect(() => {
    const wrap = tableWrapRef.current;
    if (!wrap) return;

    const body = wrap.querySelector<HTMLDivElement>('.ant-table-body');
    if (!body) return;

    const onScroll = () => {
      if (!isEmby && !isCustom) return;
      if (loadingFirstPage || loadingMore) return;
      if (!hasMore) return;

      const threshold = 220;
      const distanceToBottom = body.scrollHeight - body.scrollTop - body.clientHeight;
      if (distanceToBottom < threshold) {
        void loadSongsChunk({ reset: false });
      }
    };

    body.addEventListener('scroll', onScroll);
    return () => body.removeEventListener('scroll', onScroll);
  }, [hasMore, isCustom, isEmby, loadSongsChunk, loadingFirstPage, loadingMore]);

  // 首屏不足一屏时，最多补 2 次，避免用户看到空白又不触发滚动
  useEffect(() => {
    if (!isEmby && !isCustom) return;
    if (loadingFirstPage || loadingMore) return;
    if (!hasMore) return;
    if (autoFillAttemptsRef.current >= 2) return;

    const wrap = tableWrapRef.current;
    const body = wrap?.querySelector<HTMLDivElement>('.ant-table-body');
    if (!body) return;

    if (body.scrollHeight <= body.clientHeight + 40 && songs.length > 0) {
      autoFillAttemptsRef.current += 1;
      void loadSongsChunk({ reset: false });
    }
  }, [hasMore, isCustom, isEmby, loadSongsChunk, loadingFirstPage, loadingMore, songs.length, tableBodyY]);

  const buildTrack = useCallback(
    (row: UnifiedSong): Track | null => {
      const c = auth.credentials;
      if (!c) return null;

      const artist = joinArtists(row.artists);

      if (c.protocol === 'custom') {
        // 自定义协议
        const customRow = row as CustomSong;
        const url = buildCustomAudioUrl({
          credentials: c,
          song: customRow,
          source: customSource,
        });
        return {
          id: customRow.id,
          title: customRow.name,
          artist,
          url,
        };
      }

      if (c.protocol !== 'emby') return null;

      // Emby 协议
      const embyRow = row as EmbySong;
      const quality = loadAudioQuality();
      const maxBitrate = getMaxBitrate(quality);
      const url = buildEmbyAudioUniversalUrl({
        credentials: c,
        itemId: embyRow.id,
        maxStreamingBitrate: maxBitrate,
      });
      return {
        id: embyRow.id,
        title: embyRow.name,
        artist,
        url,
      };
    },
    [auth.credentials, customSource],
  );

  const columns: ColumnsType<UnifiedSong> = useMemo(() => {
    return [
      {
        title: '歌曲',
        dataIndex: 'name',
        key: 'name',
        ellipsis: true,
        render: (_: unknown, row) => {
          const isCurrent = player.currentTrack?.id === row.id;
          const artist = joinArtists(row.artists);

          return (
            <Space size={10} style={{ minWidth: 0 }}>
              <Button
                type={isCurrent ? 'primary' : 'text'}
                icon={<PlayCircleOutlined />}
                onClick={async () => {
                  const t = buildTrack(row);
                  if (!t) return;
                  await player.playTrack(t);
                }}
              />

              <div style={{ minWidth: 0 }}>
                <Typography.Text strong style={{ color: token.colorText }} ellipsis>
                  {row.name}
                </Typography.Text>
                <div>
                  <Typography.Text style={{ color: token.colorTextSecondary }} ellipsis>
                    {artist}
                    {'productionYear' in row && row.productionYear ? ` · ${row.productionYear}` : ''}
                  </Typography.Text>
                </div>
              </div>
            </Space>
          );
        },
      },
      {
        title: '专辑',
        dataIndex: 'album',
        key: 'album',
        width: 280,
        ellipsis: true,
        render: (v: unknown) => (
          <Typography.Text style={{ color: token.colorTextSecondary }}>{typeof v === 'string' ? v : ''}</Typography.Text>
        ),
      },
      {
        title: '时长',
        dataIndex: isCustom ? 'duration' : 'runTimeTicks',
        key: 'duration',
        width: 90,
        align: 'right',
        render: (_: unknown, row) => {
          if (isCustom) {
            const customRow = row as CustomSong;
            return (
              <Typography.Text style={{ color: token.colorTextSecondary }}>
                {formatDurationFromSeconds(customRow.duration)}
              </Typography.Text>
            );
          }
          const embyRow = row as EmbySong;
          return (
            <Typography.Text style={{ color: token.colorTextSecondary }}>
              {formatDurationFromTicks(embyRow.runTimeTicks)}
            </Typography.Text>
          );
        },
      },
    ];
  }, [buildTrack, isCustom, player, token.colorText, token.colorTextSecondary]);

  const c = auth.credentials;

  const handlePlayAll = useCallback(async () => {
    if (!c) return;
    if (c.protocol !== 'emby' && c.protocol !== 'custom') return;
    if (songs.length === 0) return;

    setPlayAllLoading(true);

    const seen = new Set<string>();
    const initialTracks = songs
      .map((s) => {
        const t = buildTrack(s);
        if (!t) return null;
        if (seen.has(t.id)) return null;
        seen.add(t.id);
        return t;
      })
      .filter(Boolean) as Track[];

    await player.playTracks(initialTracks, 0);

    // 大列表优化：先用已加载的歌曲启动播放，再在空闲/下一拍逐步补齐剩余队列
    if (total > songs.length) {
      let startIndex = songs.length;
      const limit = 200;
      while (startIndex < total) {
        try {
          if (c.protocol === 'custom') {
            const res = await customGetPlaylistSongsPage({
              credentials: c,
              source: customSource,
              startIndex,
              limit,
            });

            const chunkTracks = res.items
              .map((s) => {
                const t = buildTrack(s);
                if (!t) return null;
                if (seen.has(t.id)) return null;
                seen.add(t.id);
                return t;
              })
              .filter(Boolean) as Track[];

            if (chunkTracks.length) player.appendTracks(chunkTracks);
            if (res.items.length === 0) break;
            startIndex += res.items.length;
          } else {
            const res = isPlaylistMode
              ? await embyGetPlaylistSongsPage({
                  credentials: c,
                  playlistId,
                  startIndex,
                  limit,
                  searchTerm: searchTerm || undefined,
                })
              : await embyGetSongsPage({
                  credentials: c,
                  startIndex,
                  limit,
                  searchTerm: searchTerm || undefined,
                });

            const chunkTracks = res.items
              .map((s) => {
                const t = buildTrack(s);
                if (!t) return null;
                if (seen.has(t.id)) return null;
                seen.add(t.id);
                return t;
              })
              .filter(Boolean) as Track[];

            if (chunkTracks.length) player.appendTracks(chunkTracks);
            if (res.items.length === 0) break;
            startIndex += res.items.length;
          }

          await new Promise((r) => window.setTimeout(r, 0));
        } catch {
          break;
        }
      }
    }

    setPlayAllLoading(false);
  }, [buildTrack, c, customSource, isPlaylistMode, player, playlistId, searchTerm, songs, total]);

  return (
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Card
        style={{ height: '100%' }}
        styles={{
          body: {
            height: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <Typography.Title level={3} style={{ color: token.colorText, marginBottom: 0 }}>
                {pageTitle}
              </Typography.Title>
              <Space size={8} wrap style={{ marginTop: 6 }}>
                {connectionTitle ? <Tag color="blue">{connectionTitle}</Tag> : null}
                <Typography.Text style={{ color: token.colorTextSecondary }}>
                  {(isEmby || isCustom)
                    ? `已加载 ${songs.length.toLocaleString()} / ${total.toLocaleString()} 首`
                    : ''}
                </Typography.Text>
              </Space>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {!isCustom && (
                <Input
                  style={{ width: 320, maxWidth: '100%' }}
                  allowClear
                  placeholder={isPlaylistMode ? '搜索歌单内歌曲 / 歌手 / 专辑（服务端搜索）' : '搜索歌曲 / 歌手 / 专辑（服务端搜索）'}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onPressEnter={() => setSearchTerm(searchInput.trim())}
                />
              )}

              <Button type="primary" loading={playAllLoading} disabled={(!isEmby && !isCustom) || songs.length === 0} onClick={handlePlayAll}>
                播放全部
              </Button>
            </div>
          </div>

          {c?.protocol === 'navidrome' ? (
            <Alert
              type="info"
              showIcon
              message="当前仅完善了 Emby 的歌曲列表"
              description="Navidrome 的歌曲列表接口后续再接入；你可以先切到 Emby 体验歌曲列表与播放。"
            />
          ) : null}

          {error ? <Alert type="error" showIcon message={error} /> : null}

          <div ref={tableWrapRef} style={{ flex: 1, minHeight: 0 }}>
            <Table<UnifiedSong>
              virtual
              rowKey={(r) => r.id}
              columns={columns}
              dataSource={songs}
              loading={loadingFirstPage}
              size="middle"
              pagination={false}
              sticky
              scroll={{ y: tableBodyY }}
              onRow={(record) => {
                return {
                  onDoubleClick: async () => {
                    const t = buildTrack(record);
                    if (!t) return;
                    await player.playTrack(t);
                  },
                };
              }}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
