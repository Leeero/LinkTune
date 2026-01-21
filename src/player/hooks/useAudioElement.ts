import { useEffect, useRef } from 'react';

import type { PlaybackMode, PlayerStatus } from '../playerTypes';
import type { Track } from '../types';
import { pickRandomIndex } from '../utils/queueWindow';

type Params = {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  volume: number;
  isMuted: boolean;

  fullTracksRef: React.RefObject<Track[]>;
  globalIndexRef: React.RefObject<number>;
  playbackModeRef: React.RefObject<PlaybackMode>;
  playAtIndexRef: React.RefObject<((idx: number) => Promise<void>) | null>;

  loadTimeoutRef: React.RefObject<ReturnType<typeof setTimeout> | null>;
  stallTimeoutRef: React.RefObject<ReturnType<typeof setTimeout> | null>;
  stallTimeoutMs: number;

  consecutiveErrorCountRef: React.RefObject<number>;

  setCurrentTime: (v: number) => void;
  setDuration: (v: number) => void;
  setStatus: (v: PlayerStatus) => void;
  setErrorMessage: (v: string | null) => void;
  setIsPlaying: (v: boolean) => void;

  computeBuffered: () => void;
  skipToNextOnError: () => void;
  onStallRetry?: (audio: HTMLAudioElement, resumeAt: number) => boolean;
};

export function useAudioElement(params: Params) {
  const {
    audioRef,
    volume,
    isMuted,
    fullTracksRef,
    globalIndexRef,
    playbackModeRef,
    playAtIndexRef,
    loadTimeoutRef,
    stallTimeoutRef,
    stallTimeoutMs,
    consecutiveErrorCountRef,
    setCurrentTime,
    setDuration,
    setStatus,
    setErrorMessage,
    setIsPlaying,
    computeBuffered,
    skipToNextOnError,
    onStallRetry,
  } = params;

  const stallRetryRef = useRef(0);
  const MAX_STALL_RETRY = 1;

  // 初始化 audio 实例
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
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
      stallRetryRef.current = 0;
      setStatus('loading');
      setErrorMessage(null);
    };

    const onCanPlay = () => {
      stallRetryRef.current = 0;
      setStatus('ready');
      setErrorMessage(null);
      // 播放成功，重置连续失败计数器
      consecutiveErrorCountRef.current = 0;
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
        if (stallRetryRef.current < MAX_STALL_RETRY) {
          stallRetryRef.current += 1;
          const resumeAt = audio.currentTime || 0;
          if (onStallRetry?.(audio, resumeAt)) return;
          console.warn('[Player] 播放卡顿，尝试重试');
          setStatus('loading');
          setErrorMessage('播放卡顿，正在重试');
          try {
            audio.load();
            if (resumeAt > 0) {
              audio.currentTime = Math.max(0, resumeAt - 1);
            }
            void audio.play();
          } catch {
            // ignore
          }
          return;
        }

        console.warn('[Player] 播放卡顿超时，跳到下一首');
        setStatus('error');
        setErrorMessage('播放卡顿');
        skipToNextOnError();
      }, stallTimeoutMs);
    };

    const onStalled = () => {
      // stalled 表示浏览器尝试获取数据但数据不可用
      if (stallTimeoutRef.current) return;

      stallTimeoutRef.current = setTimeout(() => {
        if (stallRetryRef.current < MAX_STALL_RETRY) {
          stallRetryRef.current += 1;
          const resumeAt = audio.currentTime || 0;
          if (onStallRetry?.(audio, resumeAt)) return;
          console.warn('[Player] 数据加载卡顿，尝试重试');
          setStatus('loading');
          setErrorMessage('数据加载卡顿，正在重试');
          try {
            audio.load();
            if (resumeAt > 0) {
              audio.currentTime = Math.max(0, resumeAt - 1);
            }
            void audio.play();
          } catch {
            // ignore
          }
          return;
        }

        console.warn('[Player] 数据获取卡顿，跳到下一首');
        setStatus('error');
        setErrorMessage('数据加载卡顿');
        skipToNextOnError();
      }, stallTimeoutMs);
    };

    // playing 事件：恢复播放时清除卡顿定时器
    const onPlaying = () => {
      stallRetryRef.current = 0;
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
  }, [skipToNextOnError]);
  /* eslint-enable react-hooks/exhaustive-deps */
}
