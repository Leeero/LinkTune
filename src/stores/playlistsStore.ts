import { create } from 'zustand';

import { embyGetPlaylistsPage } from '../protocols/emby/library';
import type { EmbyCredentials, EmbyPlaylist } from '../protocols/emby/types';
import { getLocalPlaylists, type LocalPlaylist } from '../features/local-playlists/localPlaylistDB';

/* ---------- Emby 歌单 ---------- */

type EmbyPlaylistsSlice = {
  /** 所有已加载的 Emby 歌单 */
  embyPlaylists: EmbyPlaylist[];
  /** 歌单总数（服务端） */
  embyTotal: number;
  /** 是否还有更多（分页） */
  embyHasMore: boolean;
  /** 初始加载中 */
  embyLoading: boolean;
  /** 加载更多中 */
  embyLoadingMore: boolean;
  /** 错误信息 */
  embyError: string | null;
  /** 数据是否至少加载过一次（用于判断缓存有效） */
  embyInitialized: boolean;

  /**
   * 加载 Emby 歌单（首次 / 刷新 / 加载更多）
   * @param credentials Emby 凭证
   * @param reset true=重新从头加载（刷新），false=追加加载更多
   */
  fetchEmbyPlaylists: (credentials: EmbyCredentials, reset: boolean) => Promise<void>;
  /** 清空缓存（切换账号 / 退出登录时调用） */
  resetEmbyPlaylists: () => void;
};

/* ---------- 本地歌单 ---------- */

type LocalPlaylistsSlice = {
  localPlaylists: LocalPlaylist[];
  localLoading: boolean;
  localInitialized: boolean;

  fetchLocalPlaylists: () => Promise<void>;
  resetLocalPlaylists: () => void;
};

/* ---------- 合并 ---------- */

type PlaylistsState = EmbyPlaylistsSlice & LocalPlaylistsSlice;

const PAGE_SIZE = 30;

export const usePlaylistsStore = create<PlaylistsState>((set, get) => ({
  /* ====== Emby 初始值 ====== */
  embyPlaylists: [],
  embyTotal: 0,
  embyHasMore: true,
  embyLoading: false,
  embyLoadingMore: false,
  embyError: null,
  embyInitialized: false,

  fetchEmbyPlaylists: async (credentials, reset) => {
    const state = get();

    // 防重入
    if (reset ? state.embyLoading : state.embyLoadingMore) return;
    if (!reset && !state.embyHasMore) return;

    if (reset) {
      set({ embyLoading: true, embyError: null });
    } else {
      set({ embyLoadingMore: true });
    }

    try {
      const startIndex = reset ? 0 : state.embyPlaylists.length;
      const res = await embyGetPlaylistsPage({
        credentials,
        startIndex,
        limit: PAGE_SIZE,
      });

      set((s) => {
        const merged = reset ? res.items : [...s.embyPlaylists, ...res.items];
        // 去重
        const seen = new Set<string>();
        const deduped = merged.filter((x) => {
          if (seen.has(x.id)) return false;
          seen.add(x.id);
          return true;
        });

        return {
          embyPlaylists: deduped,
          embyTotal: res.total,
          embyHasMore: startIndex + res.items.length < res.total,
          embyLoading: false,
          embyLoadingMore: false,
          embyInitialized: true,
        };
      });
    } catch (e) {
      set({
        embyError: e instanceof Error ? e.message : '加载歌单失败',
        embyLoading: false,
        embyLoadingMore: false,
      });
    }
  },

  resetEmbyPlaylists: () =>
    set({
      embyPlaylists: [],
      embyTotal: 0,
      embyHasMore: true,
      embyLoading: false,
      embyLoadingMore: false,
      embyError: null,
      embyInitialized: false,
    }),

  /* ====== 本地歌单初始值 ====== */
  localPlaylists: [],
  localLoading: false,
  localInitialized: false,

  fetchLocalPlaylists: async () => {
    set({ localLoading: true });
    try {
      const list = await getLocalPlaylists();
      set({ localPlaylists: list, localLoading: false, localInitialized: true });
    } catch {
      set({ localLoading: false });
    }
  },

  resetLocalPlaylists: () =>
    set({
      localPlaylists: [],
      localLoading: false,
      localInitialized: false,
    }),
}));
