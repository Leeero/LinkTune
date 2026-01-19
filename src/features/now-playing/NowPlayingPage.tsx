import {
  CaretRightFilled,
  FileTextOutlined,
  LeftOutlined,
  PauseOutlined,
  PictureOutlined,
  RetweetOutlined,
  SoundOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  SwapOutlined,
  WarningFilled,
} from '@ant-design/icons';
import { Button, Popover, Slider, Tooltip, Typography, message, theme } from 'antd';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  fetchLyrics,
  loadLrcApiConfig,
  type LyricLine,
} from '../../config/lrcApiConfig';
import { usePlayer } from '../../player/PlayerContext';
import type { Track } from '../../player/types';

type TrackWithMeta = Track & {
  album?: string;
  lyricist?: string;
  composer?: string;
  lyrics?: LyricLine[];
};

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec <= 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function NowPlayingPage() {
  const { token } = theme.useToken();
  const player = usePlayer();
  const navigate = useNavigate();

  const [seekingValue, setSeekingValue] = useState<number | null>(null);
  const [coverError, setCoverError] = useState(false);

  // LrcApi 歌词
  const [lrcLyrics, setLrcLyrics] = useState<LyricLine[]>([]);
  const [lyricsLoading, setLyricsLoading] = useState(false);

  const isLoading = player.status === 'loading';
  const isError = player.status === 'error';
  const isEmpty = !player.currentTrack;
  const disabledAll = isLoading || isEmpty;

  const canPrev = player.currentIndex > 0;
  const canNext = player.currentIndex + 1 < player.totalCount;

  const duration = useMemo(() => Math.max(0, player.duration || 0), [player.duration]);
  const sliderValue = useMemo(() => {
    if (isError) return 0;
    return Math.min(seekingValue ?? player.currentTime, duration || player.currentTime);
  }, [duration, isError, player.currentTime, seekingValue]);

  const current = player.currentTrack as TrackWithMeta | null;
  const title = current?.title ?? '未选择歌曲';
  const artist = current?.artist ?? '—';
  const lyricist = current?.lyricist;
  const composer = current?.composer;

  // 使用 PlayerContext 中统一管理的封面 URL
  const coverUrl = player.currentCoverUrl;
  // 优先使用 LrcApi 歌词，其次是 Track 自带歌词
  const lyrics = useMemo(() => {
    const trackLyrics = current?.lyrics ?? [];
    return lrcLyrics.length > 0 ? lrcLyrics : trackLyrics;
  }, [lrcLyrics, current?.lyrics]);

  // 当切换歌曲时，从 LrcApi 获取歌词
  useEffect(() => {
    setCoverError(false);
    setSeekingValue(null);
    setLrcLyrics([]);

    if (!current) return;

    const config = loadLrcApiConfig();
    if (!config.enabled) return;

    let cancelled = false;

    // 获取歌词
    setLyricsLoading(true);
    fetchLyrics(current.title, current.artist ?? '', config)
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
  }, [current]);

  const modeMeta = useMemo(() => {
    if (player.playbackMode === 'loop') return { icon: <RetweetOutlined />, text: '列表循环', next: '单曲循环' };
    if (player.playbackMode === 'one') return { icon: <PauseOutlined />, text: '单曲循环', next: '随机播放' };
    return { icon: <SwapOutlined />, text: '随机播放', next: '列表循环' };
  }, [player.playbackMode]);

  const lyricsRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<Array<HTMLDivElement | null>>([]);

  // 播放清单
  const [queueOpen, setQueueOpen] = useState(false);
  const queueListRef = useRef<HTMLDivElement | null>(null);
  const queueItemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!queueOpen) return;
    const activeEl = queueItemRefs.current[player.currentIndex];
    if (activeEl && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ block: 'nearest' });
      return;
    }
    const listEl = queueListRef.current;
    if (listEl) listEl.scrollTop = 0;
  }, [queueOpen, player.currentIndex, player.totalCount]);

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

  const cssVars = useMemo<CSSProperties>(
    () =>
      ({
        '--np-primary': token.colorPrimary,
        '--np-primary-hover': token.colorPrimaryHover,
        '--np-text': token.colorText,
        '--np-text-secondary': token.colorTextSecondary,
        '--np-text-tertiary': token.colorTextTertiary,
        '--np-border': token.colorBorder,
        '--np-bg': token.colorBgLayout,
        '--np-card': token.colorBgElevated,
        '--np-muted': token.colorFillQuaternary,
        '--np-progress': token.colorPrimary,
        '--np-progress-muted': token.colorBorderSecondary,
        '--np-progress-accent': '#9D7CFF',
        '--np-error': token.colorError,
      }) as CSSProperties,
    [
      token.colorBgElevated,
      token.colorBgLayout,
      token.colorBorder,
      token.colorBorderSecondary,
      token.colorError,
      token.colorFillQuaternary,
      token.colorPrimary,
      token.colorPrimaryHover,
      token.colorText,
      token.colorTextSecondary,
      token.colorTextTertiary,
    ],
  );

  return (
    <div
      className={
        'linktune-now' +
        (isLoading ? ' is-loading' : '') +
        (isError ? ' is-error' : '')
      }
      style={cssVars}
    >
      <Tooltip title="返回">
        <button
          type="button"
          className="linktune-now__backBtn"
          onClick={() => {
            if (window.history.length > 1) navigate(-1);
            else navigate('/library');
          }}
        >
          <LeftOutlined />
        </button>
      </Tooltip>

      {isEmpty ? (
        <div className="linktune-now__empty">暂无播放内容</div>
      ) : (
        <div className="linktune-now__main">
          <div className="linktune-now__left">
            <div className="linktune-now__vinyl">
              <div className="linktune-now__disc">
                <div
                  className={
                    'linktune-now__discInner' +
                    (player.isPlaying ? ' is-rotating' : ' is-paused') +
                    (isLoading ? ' is-skeleton' : '')
                  }
                >
                  {coverUrl && !coverError ? (
                    <img src={coverUrl} alt="cover" onError={() => setCoverError(true)} />
                  ) : (
                    <span className="linktune-now__coverPlaceholder" aria-hidden>
                      <PictureOutlined />
                    </span>
                  )}
                </div>
              </div>
              <div className={'linktune-now__tonearm' + (player.isPlaying ? ' is-playing' : '')} />
            </div>
          </div>

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
                      className={
                        'linktune-now__lyricLine' + (idx === activeIndex ? ' is-active' : '')
                      }
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
        </div>
      )}

      {!isEmpty && (
        <div className="linktune-now__controlArea">
          <div className="linktune-now__controlCenter">
            <div className="linktune-now__controls">
              <Tooltip title={modeMeta.text}>
                <Button
                  type="text"
                  className={'linktune-now__iconBtn' + (player.playbackMode !== 'loop' ? ' is-active' : '')}
                  disabled={disabledAll}
                  icon={modeMeta.icon}
                  onClick={() => {
                    player.cyclePlaybackMode();
                    message.info(`已切换为${modeMeta.next}`);
                  }}
                />
              </Tooltip>

              <Button
                type="text"
                className="linktune-now__iconBtn"
                disabled={disabledAll || !canPrev}
                icon={<StepBackwardOutlined />}
                onClick={() => player.playPrev()}
              />

              <Tooltip title={isError ? player.errorMessage ?? '播放失败' : undefined}>
                <Button
                  type="primary"
                  shape="circle"
                  className="linktune-now__playBtn"
                  disabled={disabledAll}
                  icon={isError ? <WarningFilled /> : player.isPlaying ? <PauseOutlined /> : <CaretRightFilled />}
                  onClick={() => player.toggle()}
                />
              </Tooltip>

              <Button
                type="text"
                className="linktune-now__iconBtn"
                disabled={disabledAll || !canNext}
                icon={<StepForwardOutlined />}
                onClick={() => player.playNext()}
              />

              <Popover
                trigger="click"
                placement="top"
                content={
                  <div className="linktune-now__volumePopover">
                    <Slider
                      vertical
                      min={0}
                      max={1}
                      step={0.01}
                      value={player.volume}
                      tooltip={{ formatter: null }}
                      onChange={(v) => player.setVolume(Number(v))}
                      style={{ height: 120 }}
                    />
                  </div>
                }
              >
                <Button type="text" className="linktune-now__iconBtn" disabled={disabledAll} icon={<SoundOutlined />} />
              </Popover>

              <Popover
                trigger="click"
                placement="top"
                open={queueOpen}
                onOpenChange={setQueueOpen}
                content={
                  <div className="linktune-now__queue">
                    <div className="linktune-now__queueHeader">
                      <Typography.Text style={{ color: token.colorText }}>当前播放清单</Typography.Text>
                      <Typography.Text style={{ color: token.colorTextSecondary }}>{player.totalCount} 首</Typography.Text>
                    </div>
                    <div className="linktune-now__queueList" ref={queueListRef}>
                      {player.tracks.length === 0 ? (
                        <Typography.Text style={{ color: token.colorTextSecondary }}>暂无歌曲</Typography.Text>
                      ) : (
                        player.tracks.map((t, idx) => (
                          <button
                            type="button"
                            key={`${t.id}-${idx}`}
                            ref={(el) => {
                              queueItemRefs.current[idx] = el;
                            }}
                            className={
                              'linktune-now__queueItem' + (idx === player.currentIndex ? ' is-active' : '')
                            }
                            onClick={async () => {
                              await player.playTrack(t);
                              setQueueOpen(false);
                            }}
                          >
                            <span className="linktune-now__queueTitle">{t.title}</span>
                            <span className="linktune-now__queueArtist">{t.artist}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                }
              >
                <Button
                  type="text"
                  className={'linktune-now__iconBtn' + (queueOpen ? ' is-active' : '')}
                  icon={<FileTextOutlined />}
                />
              </Popover>
            </div>

            <div className="linktune-now__progress">
              <span className="linktune-now__time">{formatTime(isError ? 0 : player.currentTime)}</span>
              <div className="linktune-now__progressBar">
                <div
                  className="linktune-now__buffer"
                  style={{ width: `${Math.round(player.bufferedPercent * 100)}%` }}
                />
                <Slider
                  min={0}
                  max={duration}
                  value={sliderValue}
                  disabled={disabledAll}
                  tooltip={{ formatter: null }}
                  onChange={(v) => setSeekingValue(Array.isArray(v) ? v[0] : v)}
                  onChangeComplete={(v) => {
                    const next = Array.isArray(v) ? v[0] : v;
                    setSeekingValue(null);
                    player.seek(next);
                  }}
                />
              </div>
              <span className="linktune-now__time">{formatTime(player.duration)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
