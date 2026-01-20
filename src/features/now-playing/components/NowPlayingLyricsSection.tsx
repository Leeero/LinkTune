import type { LyricLine } from '../../../config/lrcApiConfig';
import { useEffect, useMemo, useRef } from 'react';

import { usePlayer } from '../../../player/PlayerContext';
import type { Track } from '../../../player/types';
import { useNowPlayingLyrics } from '../hooks/useNowPlayingLyrics';

type TrackWithMeta = Track & {
  lyricist?: string;
  composer?: string;
  lyrics?: LyricLine[];
};

export function NowPlayingLyricsSection() {
  const player = usePlayer();
  const current = player.currentTrack as TrackWithMeta | null;

  const isLoading = player.status === 'loading';
  const isEmpty = !current;
  const disabledAll = isLoading || isEmpty;

  const title = current?.title ?? '未选择歌曲';
  const artist = current?.artist ?? '—';
  const lyricist = current?.lyricist;
  const composer = current?.composer;

  const { lyrics, lyricsLoading } = useNowPlayingLyrics(current);

  const lyricsRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<Array<HTMLDivElement | null>>([]);

  const activeIndex = useMemo(() => {
    if (!lyrics.length) return -1;
    let idx = 0;
    for (let i = 0; i < lyrics.length; i += 1) {
      if (lyrics[i].time <= player.currentTime) idx = i;
    }
    return idx;
  }, [lyrics, player.currentTime]);

  useEffect(() => {
    if (activeIndex < 0) return;
    const target = lineRefs.current[activeIndex];
    if (!target) return;
    const raf = window.requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [activeIndex]);

  return (
    <div className="linktune-now__right">
      <div className="linktune-now__info">
        <h1 className="linktune-now__song">{title}</h1>
        <p className="linktune-now__artist">{artist}</p>
      </div>

      <div className="linktune-now__lyricSection">
        <h2 className="linktune-now__lyricTitle">{title} - {artist}</h2>
        {lyricist && <p className="linktune-now__credit">词：{lyricist}</p>}
        {composer && <p className="linktune-now__credit">曲：{composer}</p>}

        <div className="linktune-now__lyrics" ref={lyricsRef}>
          {isLoading || lyricsLoading ? (
            <div className="linktune-now__lyricsEmpty">加载中...</div>
          ) : lyrics.length === 0 ? (
            <div className="linktune-now__lyricsEmpty">暂无歌词</div>
          ) : (
            lyrics.map((line, idx) => (
              <div
                key={`${line.time}-${idx}`}
                ref={(el) => {
                  lineRefs.current[idx] = el;
                }}
                className={'linktune-now__lyricLine' + (idx === activeIndex ? ' is-active' : '')}
                onClick={() => {
                  if (!disabledAll && line.time >= 0) {
                    player.seek(line.time);
                  }
                }}
              >
                {line.text}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
