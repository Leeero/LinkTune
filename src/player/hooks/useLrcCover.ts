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
      const img = new Image();
      img.onload = () => setLrcCoverUrl(cover);
      img.onerror = () => {
        // LrcApi 封面加载失败，回退到 Track 自带封面
        setLrcCoverUrl(null);
      };
      img.src = cover;
    }
  }, [currentTrack]);

  return lrcCoverUrl;
}
