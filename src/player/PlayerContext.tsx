import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { getAudioQualityLabel, getLowerAudioQuality } from '../config/audioQualityConfig';
import { addPlayHistory } from '../features/history/historyDB';
import { useAudioElement } from './hooks/useAudioElement';
import { useElectronTray } from './hooks/useElectronTray';
import { useLrcCover } from './hooks/useLrcCover';
import type { PlaybackMode, PlayerStatus } from './playerTypes';
import { extractWindow, pickRandomIndex } from './utils/queueWindow';
import { loadPlayerSettings, saveMuted, savePlaybackMode, saveVolume } from './utils/playerSettingsStorage';
import type { Track } from './types';

type PlayerState = {
  /** 播放队列（虚拟窗口，仅包含当前播放附近的歌曲） */
  tracks: Track[];
  /** 当前歌曲在虚拟窗口中的索引 */
  currentIndex: number;
  /** 完整播放列表的总数 */
  totalCount: number;
  currentTrack: Track | null;

  /** 当前封面 URL（优先 LrcApi，其次 Track 自带） */
  currentCoverUrl: string | null;

  /** 播放状态 */
  status: PlayerStatus;
  errorMessage: string | null;

  /** 播放模式：列表循环 / 单曲循环 / 随机 */
  playbackMode: PlaybackMode;
  cyclePlaybackMode: () => void;

  isPlaying: boolean;
  currentTime: number;
  duration: number;

  /** 已缓冲到的时间（秒） */
  bufferedTime: number;
  /** 已缓冲比例（0-1） */
  bufferedPercent: number;

  volume: number;
  isMuted: boolean;
  toggleMuted: () => void;

  playTrack: (track: Track) => Promise<void>;
  playTracks: (tracks: Track[], startIndex?: number) => Promise<void>;
  appendTracks: (tracks: Track[]) => void;
  playPrev: () => Promise<void>;
  playNext: () => Promise<void>;
  toggle: () => Promise<void>;
  seek: (time: number) => void;
  setVolume: (v: number) => void;
};

const PlayerContext = createContext<PlayerState | null>(null);


// 加载超时时间（毫秒）
const LOAD_TIMEOUT = 20000;
// 卡顿超时时间（毫秒）
const STALL_TIMEOUT = 12000;

// 初始加载设置
const initialSettings = loadPlayerSettings();

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // 预加载用的 Audio 实例
  const preloadAudioRef = useRef<HTMLAudioElement | null>(null);

  // 完整播放列表（存在 ref 中，不触发渲染）
  const fullTracksRef = useRef<Track[]>([]);
  // 当前播放歌曲在完整列表中的索引
  const globalIndexRef = useRef<number>(0);

  // 加载超时定时器
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 卡顿超时定时器
  const stallTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 虚拟窗口（只包含当前播放附近的歌曲，用于 UI 展示）
  const [windowTracks, setWindowTracks] = useState<Track[]>([]);
  const [windowIndex, setWindowIndex] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const currentTrack = windowTracks[windowIndex] ?? null;

  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(initialSettings.playbackMode);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedTime, setBufferedTime] = useState(0);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [volume, _setVolume] = useState(initialSettings.volume);
  const [isMuted, setIsMuted] = useState(initialSettings.isMuted);

  // LrcApi 封面（内部会做预加载）
  const lrcCoverUrl = useLrcCover(currentTrack);

  // 当前封面：优先 LrcApi，其次 Track 自带
  const currentCoverUrl = lrcCoverUrl || currentTrack?.coverUrl || null;

  // 给事件用的最新引用（避免闭包）
  const playbackModeRef = useRef<PlaybackMode>(playbackMode);
  // playAtIndex 引用，供超时回调使用
  const playAtIndexRef = useRef<((idx: number) => Promise<void>) | null>(null);

  // 连续播放失败计数器
  const consecutiveErrorCountRef = useRef<number>(0);
  const MAX_CONSECUTIVE_ERRORS = 5;

  // 组件卸载时清理预加载 Audio
  useEffect(() => {
    return () => {
      if (preloadAudioRef.current) {
        preloadAudioRef.current.src = '';
        preloadAudioRef.current = null;
      }
    };
  }, []);

  /** 清除加载相关的定时器 */
  const clearLoadTimers = useCallback(() => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
    if (stallTimeoutRef.current) {
      clearTimeout(stallTimeoutRef.current);
      stallTimeoutRef.current = null;
    }
  }, []);

  /** 加载失败时自动跳到下一首 */
  const skipToNextOnError = useCallback(() => {
    // 增加连续失败计数
    consecutiveErrorCountRef.current += 1;

    // 如果连续失败次数达到上限，停止播放
    if (consecutiveErrorCountRef.current >= MAX_CONSECUTIVE_ERRORS) {
      console.warn(`[Player] 连续 ${MAX_CONSECUTIVE_ERRORS} 首歌曲播放失败，停止播放`);
      setStatus('error');
      setErrorMessage(`连续 ${MAX_CONSECUTIVE_ERRORS} 首播放失败，已停止`);
      setIsPlaying(false);
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
      }
      return;
    }

    const list = fullTracksRef.current;
    const idx = globalIndexRef.current;
    const mode = playbackModeRef.current;

    if (list.length <= 1) return;

    let nextIdx: number;
    if (mode === 'shuffle') {
      nextIdx = pickRandomIndex(list.length, idx);
    } else {
      nextIdx = (idx + 1) % list.length;
    }

    // 使用 setTimeout 避免递归调用栈过深
    setTimeout(() => {
      playAtIndexRef.current?.(nextIdx);
    }, 500);
  }, []);

  useEffect(() => {
    playbackModeRef.current = playbackMode;
  }, [playbackMode]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = isMuted;
  }, [isMuted]);


  const computeBuffered = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const dur = Number.isFinite(audio.duration) ? audio.duration : 0;
    const ranges = audio.buffered;

    let end = 0;
    try {
      if (ranges && ranges.length > 0) {
        end = ranges.end(ranges.length - 1) || 0;
      }
    } catch {
      end = 0;
    }

    const safeEnd = Math.max(0, end);
    setBufferedTime(safeEnd);

    const percent = dur > 0 ? Math.min(1, safeEnd / dur) : 0;
    setBufferedPercent(Number.isFinite(percent) ? percent : 0);
  }, []);

  /** 更新虚拟窗口 */
  const updateWindow = useCallback((globalIndex: number) => {
    const { window, windowIndex: wIdx } = extractWindow(fullTracksRef.current, globalIndex);
    setWindowTracks(window);
    setWindowIndex(wIdx);
    setTotalCount(fullTracksRef.current.length);
  }, []);

  /** 卡顿时自动降码率并重试 */
  const handleStallRetry = useCallback(
    async (audio: HTMLAudioElement, resumeAt: number) => {
      const list = fullTracksRef.current;
      const idx = globalIndexRef.current;
      const track = list[idx];
      if (!track || !track.buildUrl || !track.protocol || !track.quality) return false;

      const nextQuality = getLowerAudioQuality(track.protocol, track.quality);
      if (!nextQuality) return false;

      try {
        const result = track.buildUrl(nextQuality);
        const nextUrl = result instanceof Promise ? await result : result;
        track.quality = nextQuality;
        track.url = nextUrl;
        list[idx] = track;
        updateWindow(idx);

        const label = getAudioQualityLabel(track.protocol, nextQuality);
        setStatus('loading');
        setErrorMessage(`网络卡顿，已降码率至 ${label}`);

        audio.src = nextUrl;
        audio.load();
        if (resumeAt > 0) {
          audio.currentTime = Math.max(0, resumeAt - 1);
        }
        void audio.play();

        return true;
      } catch {
        return false;
      }
    },
    [updateWindow, setStatus, setErrorMessage],
  );

  /** 预加载下一首歌曲 */
  const preloadNext = useCallback(() => {
    const list = fullTracksRef.current;
    const idx = globalIndexRef.current;
    const mode = playbackModeRef.current;

    if (list.length <= 1) return;

    // 随机模式不预加载（无法预测下一首）
    if (mode === 'shuffle') return;

    const nextIdx = (idx + 1) % list.length;
    const nextTrack = list[nextIdx];
    if (!nextTrack?.url) return;

    // 创建或复用预加载 Audio
    if (!preloadAudioRef.current) {
      preloadAudioRef.current = new Audio();
      preloadAudioRef.current.preload = 'auto';
    }

    // 避免重复加载同一首
    if (preloadAudioRef.current.src !== nextTrack.url) {
      preloadAudioRef.current.src = nextTrack.url;
    }
  }, []);

  const playAtIndex = useCallback(
    async (nextGlobalIndex: number) => {
      const audio = audioRef.current;
      if (!audio) return;

      // 清除之前的超时定时器
      clearLoadTimers();

      const list = fullTracksRef.current;
      const idx = Math.max(0, Math.min(nextGlobalIndex, Math.max(0, list.length - 1)));
      const t = list[idx];
      if (!t) return;

      const currentGlobalIndex = globalIndexRef.current;
      const switching = list[currentGlobalIndex]?.id !== t.id;
      
      globalIndexRef.current = idx;
      updateWindow(idx);

      if (switching) {
        setStatus('loading');
        setErrorMessage(null);

        // 如果 URL 为空且有 buildUrl 函数，需要异步获取 URL
        let audioUrl = t.url;
        if (!audioUrl && t.buildUrl && t.quality) {
          try {
            const result = t.buildUrl(t.quality);
            audioUrl = result instanceof Promise ? await result : result;
            // 更新 track 的 URL
            t.url = audioUrl;
            list[idx] = t;
            updateWindow(idx);
          } catch (e) {
            console.error('[Player] 获取播放链接失败:', e);
            setStatus('error');
            setErrorMessage(e instanceof Error ? e.message : '获取播放链接失败');
            skipToNextOnError();
            return;
          }
        }

        if (!audioUrl) {
          console.error('[Player] 无法获取播放链接');
          setStatus('error');
          setErrorMessage('无法获取播放链接');
          skipToNextOnError();
          return;
        }

        audio.src = audioUrl;
        // 保险起见触发一次 load，让加载态更可控
        try {
          audio.load();
        } catch {
          // ignore
        }

        setCurrentTime(0);
        setBufferedTime(0);
        setBufferedPercent(0);
        computeBuffered();

        // 设置加载超时：如果超时还未 canplay，自动跳下一首
        loadTimeoutRef.current = setTimeout(() => {
          if (status === 'loading') {
            console.warn('[Player] 加载超时，跳到下一首');
            setStatus('error');
            setErrorMessage('加载超时');
            skipToNextOnError();
          }
        }, LOAD_TIMEOUT);
      }

      try {
        await audio.play();
        // 播放成功后预加载下一首
        preloadNext();
        // 播放成功后重置连续错误计数器
        consecutiveErrorCountRef.current = 0;
        // 记录播放历史（仅 custom 协议）
        if (t.protocol === 'custom' && t.platform) {
          void addPlayHistory({
            id: t.id,
            name: t.title,
            artists: t.artists || (t.artist ? [t.artist] : []),
            platform: t.platform,
            coverUrl: t.coverUrl,
          });
        }
      } catch {
        // 常见原因：平台阻止自动播放；由用户点击触发即可
      }
    },
    [computeBuffered, updateWindow, clearLoadTimers, skipToNextOnError, preloadNext, status],
  );

  // 更新 playAtIndexRef
  useEffect(() => {
    playAtIndexRef.current = playAtIndex;
  }, [playAtIndex]);

  useAudioElement({
    audioRef,
    volume,
    isMuted,
    fullTracksRef,
    globalIndexRef,
    playbackModeRef,
    playAtIndexRef,
    loadTimeoutRef,
    stallTimeoutRef,
    stallTimeoutMs: STALL_TIMEOUT,
    consecutiveErrorCountRef,
    setCurrentTime,
    setDuration,
    setStatus,
    setErrorMessage,
    setIsPlaying,
    computeBuffered,
    skipToNextOnError,
    onStallRetry: handleStallRetry,
  });

  const api = useMemo<PlayerState>(() => {
    const cyclePlaybackMode = () => {
      setPlaybackMode((prev) => {
        let next: PlaybackMode;
        if (prev === 'loop') next = 'one';
        else if (prev === 'one') next = 'shuffle';
        else next = 'loop';
        savePlaybackMode(next);
        return next;
      });
    };

    const toggleMuted = () => {
      setIsMuted((m) => {
        const next = !m;
        saveMuted(next);
        return next;
      });
    };

    const playTrack = async (track: Track) => {
      const audio = audioRef.current;
      if (!audio) return;

      const list = fullTracksRef.current;
      const existingIndex = list.findIndex((t) => t.id === track.id);

      if (existingIndex >= 0) {
        // 更新已存在的 track，合并新的字段（如 platform、artists 等）
        const existingTrack = list[existingIndex];
        const updatedTrack = {
          ...existingTrack,
          // 如果新 track 有这些字段，优先使用新值
          platform: track.platform || existingTrack.platform,
          artists: track.artists || existingTrack.artists,
          coverUrl: track.coverUrl || existingTrack.coverUrl,
        };
        list[existingIndex] = updatedTrack;
        fullTracksRef.current = [...list];
        await playAtIndex(existingIndex);
        return;
      }

      // 添加到完整列表末尾
      fullTracksRef.current = [...fullTracksRef.current, track];
      await playAtIndex(fullTracksRef.current.length - 1);
    };

    const playTracks = async (nextTracks: Track[], startIndex = 0) => {
      if (!nextTracks.length) return;
      
      const audio = audioRef.current;
      
      // 先停止当前播放
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      
      // 重置 globalIndexRef 避免旧索引影响切换判断
      globalIndexRef.current = -1;
      
      // 使用 setTimeout 避免阻塞 UI
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          fullTracksRef.current = nextTracks;
          resolve();
        }, 0);
      });
      
      await playAtIndex(Math.max(0, Math.min(startIndex, nextTracks.length - 1)));
    };

    const appendTracks = (nextTracks: Track[]) => {
      if (!nextTracks.length) return;
      fullTracksRef.current = [...fullTracksRef.current, ...nextTracks];
      // 更新 totalCount
      setTotalCount(fullTracksRef.current.length);
    };

    const playPrev = async () => {
      const list = fullTracksRef.current;
      const idx = globalIndexRef.current;
      const mode = playbackModeRef.current;

      if (list.length === 0) return;

      if (mode === 'shuffle') {
        // 随机模式：随机选一首
        const next = pickRandomIndex(list.length, idx);
        await playAtIndex(next);
        return;
      }

      // loop / one 模式：播放上一首，到头则循环到末尾
      if (idx <= 0) {
        await playAtIndex(list.length - 1);
      } else {
        await playAtIndex(idx - 1);
      }
    };

    const playNext = async () => {
      const list = fullTracksRef.current;
      const idx = globalIndexRef.current;
      const mode = playbackModeRef.current;

      if (list.length === 0) return;

      if (mode === 'shuffle') {
        // 随机模式：随机选一首
        const next = pickRandomIndex(list.length, idx);
        await playAtIndex(next);
        return;
      }

      // loop / one 模式：播放下一首，到末尾则循环到开头
      if (idx + 1 >= list.length) {
        await playAtIndex(0);
      } else {
        await playAtIndex(idx + 1);
      }
    };

    const toggle = async () => {
      const audio = audioRef.current;
      if (!audio) return;

      if (audio.paused) {
        if (status === 'error') {
          try {
            audio.load();
          } catch {
            // ignore
          }
        }
        try {
          await audio.play();
        } catch {
          // ignore
        }
      } else {
        audio.pause();
      }
    };

    const seek = (time: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = time;
      setCurrentTime(time);
    };

    const setVolume = (v: number) => {
      const next = Math.min(1, Math.max(0, v));
      _setVolume(next);
      saveVolume(next);
      if (next > 0) {
        setIsMuted(false);
        saveMuted(false);
      }
    };

    return {
      tracks: windowTracks,
      currentIndex: windowIndex,
      totalCount,
      currentTrack,
      currentCoverUrl,
      status,
      errorMessage,
      playbackMode,
      cyclePlaybackMode,
      isPlaying,
      currentTime,
      duration,
      bufferedTime,
      bufferedPercent,
      volume,
      isMuted,
      toggleMuted,
      playTrack,
      playTracks,
      appendTracks,
      playPrev,
      playNext,
      toggle,
      seek,
      setVolume,
    };
  }, [windowTracks, windowIndex, totalCount, currentTrack, currentCoverUrl, status, errorMessage, playbackMode, isPlaying, currentTime, duration, bufferedTime, bufferedPercent, volume, isMuted, playAtIndex]);

  // stop 函数引用，用于 useElectronTray
  const stopRef = useRef<() => void>(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
  });

  useElectronTray({
    isPlaying,
    currentTrack,
    api: {
      toggle: api.toggle,
      playPrev: api.playPrev,
      playNext: api.playNext,
      stop: stopRef.current,
    },
  });

  return <PlayerContext.Provider value={api}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
