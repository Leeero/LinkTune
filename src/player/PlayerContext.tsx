import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { buildCoverUrl, loadLrcApiConfig } from '../config/lrcApiConfig';
import type { Track } from './types';

type PlaybackMode = 'loop' | 'one' | 'shuffle';
type PlayerStatus = 'idle' | 'loading' | 'ready' | 'error';

// 虚拟队列窗口大小：只在 state 中保留当前播放歌曲前后各 WINDOW_SIZE 首
const WINDOW_SIZE = 50;

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


function pickRandomIndex(len: number, excludeIndex: number) {
  if (len <= 1) return excludeIndex;

  let next = excludeIndex;
  // 最小实现：简单重试，避免选中同一首
  for (let i = 0; i < 8 && next === excludeIndex; i += 1) {
    next = Math.floor(Math.random() * len);
  }
  if (next === excludeIndex) next = (excludeIndex + 1) % len;
  return next;
}

/** 从完整列表中提取虚拟窗口 */
function extractWindow(fullList: Track[], globalIndex: number): { window: Track[]; windowIndex: number; windowStart: number } {
  const len = fullList.length;
  if (len === 0) return { window: [], windowIndex: 0, windowStart: 0 };

  const safeIndex = Math.max(0, Math.min(globalIndex, len - 1));
  const windowStart = Math.max(0, safeIndex - WINDOW_SIZE);
  const windowEnd = Math.min(len, safeIndex + WINDOW_SIZE + 1);
  const window = fullList.slice(windowStart, windowEnd);
  const windowIndex = safeIndex - windowStart;

  return { window, windowIndex, windowStart };
}

// 加载超时时间（毫秒）
const LOAD_TIMEOUT = 15000;
// 卡顿超时时间（毫秒）
const STALL_TIMEOUT = 8000;

// localStorage keys
const STORAGE_KEY_VOLUME = 'linktune_player_volume';
const STORAGE_KEY_MUTED = 'linktune_player_muted';
const STORAGE_KEY_PLAYBACK_MODE = 'linktune_player_mode';

/** 从 localStorage 加载设置 */
function loadSettings(): { volume: number; isMuted: boolean; playbackMode: PlaybackMode } {
  const defaults = { volume: 0.8, isMuted: false, playbackMode: 'loop' as PlaybackMode };

  try {
    const volumeStr = localStorage.getItem(STORAGE_KEY_VOLUME);
    const mutedStr = localStorage.getItem(STORAGE_KEY_MUTED);
    const modeStr = localStorage.getItem(STORAGE_KEY_PLAYBACK_MODE);

    const volume = volumeStr !== null ? parseFloat(volumeStr) : defaults.volume;
    const isMuted = mutedStr === 'true';
    const playbackMode = (modeStr === 'loop' || modeStr === 'one' || modeStr === 'shuffle')
      ? modeStr
      : defaults.playbackMode;

    return {
      volume: Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : defaults.volume,
      isMuted,
      playbackMode,
    };
  } catch {
    return defaults;
  }
}

/** 保存设置到 localStorage */
function saveVolume(volume: number) {
  try {
    localStorage.setItem(STORAGE_KEY_VOLUME, String(volume));
  } catch {
    // ignore
  }
}

function saveMuted(isMuted: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY_MUTED, String(isMuted));
  } catch {
    // ignore
  }
}

function savePlaybackMode(mode: PlaybackMode) {
  try {
    localStorage.setItem(STORAGE_KEY_PLAYBACK_MODE, mode);
  } catch {
    // ignore
  }
}

// 初始加载设置
const initialSettings = loadSettings();

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

  // LrcApi 封面
  const [lrcCoverUrl, setLrcCoverUrl] = useState<string | null>(null);

  // 当前封面：优先 LrcApi，其次 Track 自带
  const currentCoverUrl = lrcCoverUrl || currentTrack?.coverUrl || null;

  // 给事件用的最新引用（避免闭包）
  const playbackModeRef = useRef<PlaybackMode>(playbackMode);
  // playAtIndex 引用，供超时回调使用
  const playAtIndexRef = useRef<((idx: number) => Promise<void>) | null>(null);

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

  // 当歌曲切换时，获取 LrcApi 封面并预加载
  useEffect(() => {
    setLrcCoverUrl(null);

    if (!currentTrack) return;

    const config = loadLrcApiConfig();
    if (!config.enabled) {
      // 预加载 Track 自带封面
      if (currentTrack.coverUrl) {
        const img = new Image();
        img.src = currentTrack.coverUrl;
      }
      return;
    }

    // 构建并预加载 LrcApi 封面
    const cover = buildCoverUrl(currentTrack.title, currentTrack.artist ?? '', config);
    if (cover) {
      const img = new Image();
      img.onload = () => setLrcCoverUrl(cover);
      img.onerror = () => {
        // LrcApi 封面加载失败，回退到 Track 自带封面
        setLrcCoverUrl(null);
      };
      img.src = cover;
    }
  }, [currentTrack]);

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
      preloadAudioRef.current.preload = 'metadata';
    }

    // 避免重复加载同一首
    if (preloadAudioRef.current.src !== nextTrack.url) {
      preloadAudioRef.current.src = nextTrack.url;
    }
  }, []);

  /** 更新虚拟窗口 */
  const updateWindow = useCallback((globalIndex: number) => {
    const { window, windowIndex: wIdx } = extractWindow(fullTracksRef.current, globalIndex);
    setWindowTracks(window);
    setWindowIndex(wIdx);
    setTotalCount(fullTracksRef.current.length);
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

        audio.src = t.url;
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

  // 初始化 audio 实例
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.volume = volume;
    audio.muted = isMuted;

    const initTrack = fullTracksRef.current[globalIndexRef.current];
    if (initTrack?.url) audio.src = initTrack.url;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
      // 正常播放中，清除卡顿定时器
      if (stallTimeoutRef.current) {
        clearTimeout(stallTimeoutRef.current);
        stallTimeoutRef.current = null;
      }
    };
    const onDurationChange = () => {
      setDuration(audio.duration || 0);
      computeBuffered();
    };
    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      computeBuffered();
    };
    const onProgress = () => computeBuffered();

    const onLoadStart = () => {
      setStatus('loading');
      setErrorMessage(null);
    };

    const onCanPlay = () => {
      setStatus('ready');
      setErrorMessage(null);
      // 加载成功，清除超时定时器
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    };

    const onError = () => {
      setStatus('error');
      setIsPlaying(false);
      setErrorMessage('播放失败，请检查网络或文件路径');
      // 清除超时定时器
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
      // 自动跳到下一首
      skipToNextOnError();
    };

    // 播放卡住（waiting/stalled）时设置超时
    const onWaiting = () => {
      // 如果已经有卡顿定时器，不重复设置
      if (stallTimeoutRef.current) return;
      
      stallTimeoutRef.current = setTimeout(() => {
        console.warn('[Player] 播放卡顿超时，跳到下一首');
        setStatus('error');
        setErrorMessage('播放卡顿');
        skipToNextOnError();
      }, STALL_TIMEOUT);
    };

    const onStalled = () => {
      // stalled 表示浏览器尝试获取数据但数据不可用
      if (stallTimeoutRef.current) return;
      
      stallTimeoutRef.current = setTimeout(() => {
        console.warn('[Player] 数据获取卡顿，跳到下一首');
        setStatus('error');
        setErrorMessage('数据加载卡顿');
        skipToNextOnError();
      }, STALL_TIMEOUT);
    };

    // playing 事件：恢复播放时清除卡顿定时器
    const onPlaying = () => {
      if (stallTimeoutRef.current) {
        clearTimeout(stallTimeoutRef.current);
        stallTimeoutRef.current = null;
      }
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    const onEnded = () => {
      const list = fullTracksRef.current;
      const idx = globalIndexRef.current;
      const mode = playbackModeRef.current;

      if (mode === 'one') {
        audio.currentTime = 0;
        void audio.play();
        return;
      }

      if (mode === 'shuffle') {
        const next = pickRandomIndex(list.length, idx);
        void playAtIndexRef.current?.(next);
        return;
      }

      // loop：列表循环
      if (idx + 1 < list.length) {
        void playAtIndexRef.current?.(idx + 1);
      } else if (list.length > 0) {
        void playAtIndexRef.current?.(0);
      } else {
        setIsPlaying(false);
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('progress', onProgress);
    audio.addEventListener('loadstart', onLoadStart);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('error', onError);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('stalled', onStalled);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    audioRef.current = audio;

    return () => {
      audio.pause();
      // 清除所有定时器
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
      if (stallTimeoutRef.current) {
        clearTimeout(stallTimeoutRef.current);
        stallTimeoutRef.current = null;
      }
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('progress', onProgress);
      audio.removeEventListener('loadstart', onLoadStart);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('stalled', onStalled);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipToNextOnError]);

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
        await playAtIndex(existingIndex);
        return;
      }

      // 添加到完整列表末尾
      fullTracksRef.current = [...fullTracksRef.current, track];
      await playAtIndex(fullTracksRef.current.length - 1);
    };

    const playTracks = async (nextTracks: Track[], startIndex = 0) => {
      if (!nextTracks.length) return;
      
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

  return <PlayerContext.Provider value={api}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
