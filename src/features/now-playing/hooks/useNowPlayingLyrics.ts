import { useEffect, useMemo, useState } from 'react';

import { fetchLyrics, loadLrcApiConfig, type LyricLine } from '../../../config/lrcApiConfig';
import type { Track } from '../../../player/types';

type TrackWithLyrics = Track & {
  lyrics?: LyricLine[];
};

export function useNowPlayingLyrics(track: TrackWithLyrics | null) {
  const [lrcLyrics, setLrcLyrics] = useState<LyricLine[]>([]);
  const [lyricsLoading, setLyricsLoading] = useState(false);

  const title = track?.title ?? '';
  const artist = track?.artist ?? '';
  const trackId = track?.id ?? '';

  // 当切换歌曲时，从 LrcApi 获取歌词
  useEffect(() => {
    setLrcLyrics([]);
    setLyricsLoading(false);

    if (!track) return;

    const config = loadLrcApiConfig();
    if (!config.enabled) return;

    let cancelled = false;

    setLyricsLoading(true);
    fetchLyrics(title, artist, config)
      .then((result) => {
        if (!cancelled && result.length > 0) {
          setLrcLyrics(result);
        }
      })
      .finally(() => {
        if (!cancelled) setLyricsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [artist, title, track, trackId]);

  // 优先使用 LrcApi 歌词，其次是 Track 自带歌词
  const lyrics = useMemo(() => {
    const trackLyrics = track?.lyrics ?? [];
    return lrcLyrics.length > 0 ? lrcLyrics : trackLyrics;
  }, [lrcLyrics, track?.lyrics]);

  return { lyrics, lyricsLoading };
}
