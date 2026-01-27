import { useEffect, useState } from 'react';

import { buildCoverUrl, loadLrcApiConfig } from '../../config/lrcApiConfig';
import type { Track } from '../types';

export function useLrcCover(currentTrack: Track | null) {
  const [lrcCoverUrl, setLrcCoverUrl] = useState<string | null>(null);

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
      let cancelled = false;
      const img = new Image();
      img.onload = () => {
        if (!cancelled) setLrcCoverUrl(cover);
      };
      img.onerror = () => {
        if (!cancelled) setLrcCoverUrl(null);
      };
      img.src = cover;

      return () => {
        cancelled = true;
        // 清理回调引用，帮助 GC
        img.onload = null;
        img.onerror = null;
      };
    }
  }, [currentTrack]);

  return lrcCoverUrl;
}
