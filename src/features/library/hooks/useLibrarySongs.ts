import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { customGetPlaylistSongsPage, type CustomPlaylistSource } from '../../../protocols/custom/library';
import { embyGetPlaylistSongsPage, embyGetSongsPage } from '../../../protocols/emby/library';
import type { EmbySong } from '../../../protocols/emby/types';
import type { AuthCredentials } from '../../../session/types';
import type { UnifiedSong } from '../types';
import { loadPersistedSongs, makeSongsPersistKey, savePersistedSongs } from '../utils/persistEmbySongs';

type CacheValue = {
  at: number;
  items: EmbySong[];
  total: number;
};

type RequestIdleCallback = (
  cb: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void,
  opts?: { timeout: number },
) => number;

type CancelIdleCallback = (handle: number) => void;

type UseLibrarySongsParams = {
  credentials: AuthCredentials | null;
  playlistId: string;
  isPlaylistMode: boolean;
  customSource: CustomPlaylistSource;
  batchSize?: number;
};

type UseLibrarySongsResult = {
  batchSize: number;
  searchInput: string;
  setSearchInput: (v: string) => void;
  searchTerm: string;
  commitSearch: () => void;

  isEmby: boolean;
  isCustom: boolean;

  songs: UnifiedSong[];
  total: number;
  loadingFirstPage: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;

  tableWrapRef: React.RefObject<HTMLDivElement | null>;
  tableBodyY: number;
};

export function useLibrarySongs(params: UseLibrarySongsParams): UseLibrarySongsResult {
  const {
    credentials,
    playlistId,
    isPlaylistMode,
    customSource,
    batchSize: inputBatchSize,
  } = params;

  const batchSize = inputBatchSize ?? 80;

  const isEmby = credentials?.protocol === 'emby';
  const isCustom = credentials?.protocol === 'custom';

  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

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

  const songsPersistKey = useMemo(() => {
    const c = credentials;
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
  }, [credentials, isPlaylistMode, playlistId, searchTerm]);

  // 搜索输入做轻度防抖，避免每个按键都打到服务端
  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const commitSearch = useCallback(() => {
    setSearchTerm(searchInput.trim());
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
    async (args: { reset: boolean }) => {
      const c = credentials;
      if (!c) return;

      // 仅支持 emby 和 custom 协议
      if (c.protocol !== 'emby' && c.protocol !== 'custom') return;

      // reset 时取消进行中的请求，并重置自动补齐计数
      if (args.reset) {
        autoFillAttemptsRef.current = 0;
        activeReqAbortRef.current?.abort();
        activeReqAbortRef.current = null;
      }

      if (loadingFirstRef.current || loadingMoreRef.current) return;

      const currentSongs = songsRef.current;
      const startIndex = args.reset ? 0 : currentSongs.length;

      const currentTotal = totalRef.current;
      const currentHasMore = hasMoreRef.current;
      if (!args.reset && (!currentHasMore || (currentTotal > 0 && startIndex >= currentTotal))) return;

      const controller = new AbortController();
      activeReqAbortRef.current = controller;

      if (args.reset) {
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
            const next = args.reset ? res.items : [...prev, ...res.items];
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
              const next = args.reset ? cached.items : [...prev, ...cached.items];
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
            const next = args.reset ? res.items : [...prev, ...res.items];
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
    [batchSize, credentials, customSource, isPlaylistMode, playlistId, searchTerm],
  );

  // 当登录态/搜索条件变化：优先从本地恢复，避免每次切页都重新拉取
  useEffect(() => {
    if (!credentials) return;

    const protocol = credentials.protocol;

    // 自定义协议：直接加载
    if (protocol === 'custom') {
      const autoLoadKey = `custom:${customSource}|${credentials.baseUrl}`;
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

    const c = credentials;
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
        restoreIdleHandleRef.current = w.requestIdleCallback(
          () => {
            if (restoreTimeoutHandleRef.current) {
              window.clearTimeout(restoreTimeoutHandleRef.current);
              restoreTimeoutHandleRef.current = null;
            }
            runOnce();
          },
          { timeout: 200 },
        );

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
  }, [credentials, customSource, isPlaylistMode, loadSongsChunk, playlistId, searchTerm, songsPersistKey]);

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

  return {
    batchSize,
    searchInput,
    setSearchInput,
    searchTerm,
    commitSearch,

    isEmby,
    isCustom,

    songs,
    total,
    loadingFirstPage,
    loadingMore,
    hasMore,
    error,

    tableWrapRef,
    tableBodyY,
  };
}
