import {
  CaretRightFilled,
  HeartOutlined,
  LeftOutlined,
  MoreOutlined,
  PauseOutlined,
  PictureOutlined,
  RetweetOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  SwapOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Dropdown, message } from 'antd';
import type { MenuProps } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { MobileQueueSheet } from '../../../components/mobile/MobileQueueSheet';
import { usePlayer } from '../../../player/PlayerContext';
import { formatTime } from '../../../player/utils/formatTime';
import { AddToPlaylistModal } from '../../local-playlists/AddToPlaylistModal';
import type { LocalPlaylistSong } from '../../local-playlists/localPlaylistDB';
import type { LyricLine } from '../../../config/lrcApiConfig';
import type { Track } from '../../../player/types';
import { useNowPlayingLyrics } from '../hooks/useNowPlayingLyrics';

type TrackWithMeta = Track & {
  lyrics?: LyricLine[];
};

function extractSongId(trackId: string, trackPlatform?: string): string {
  const knownPlatforms = ['netease', 'qq', 'kuwo'];
  for (const p of knownPlatforms) {
    const prefix = `${p}:`;
    if (trackId.startsWith(prefix)) {
      return trackId.slice(prefix.length);
    }
  }
  if (trackPlatform && trackId.startsWith(`${trackPlatform}:`)) {
    return trackId.slice(trackPlatform.length + 1);
  }
  return trackId;
}

export function MobileNowPlaying() {
  const player = usePlayer();
  const navigate = useNavigate();
  const progressRef = useRef<HTMLDivElement>(null);
  const lyricsRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Array<HTMLDivElement | null>>([]);

  const [queueOpen, setQueueOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [showLyrics, setShowLyrics] = useState(true);

  const current = player.currentTrack as TrackWithMeta | null;
  const title = current?.title ?? '未选择歌曲';
  const artist = current?.artist ?? '—';
  const coverUrl = player.currentCoverUrl;
  const isPlaying = player.isPlaying;
  const isLoading = player.status === 'loading';
  const isEmby = current?.protocol === 'emby';

  // 获取歌词
  const { lyrics } = useNowPlayingLyrics(current);

  // 计算当前歌词行
  const activeIndex = useMemo(() => {
    if (!lyrics.length) return -1;
    let idx = 0;
    for (let i = 0; i < lyrics.length; i += 1) {
      if (lyrics[i].time <= player.currentTime) idx = i;
    }
    return idx;
  }, [lyrics, player.currentTime]);

  // 自动滚动到当前歌词
  useEffect(() => {
    if (activeIndex < 0 || !showLyrics) return;
    const target = lineRefs.current[activeIndex];
    if (!target) return;
    const raf = window.requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [activeIndex, showLyrics]);

  // 进度百分比
  const progressPercent = useMemo(() => {
    if (!player.duration) return 0;
    return Math.min((player.currentTime / player.duration) * 100, 100);
  }, [player.currentTime, player.duration]);

  // 播放模式图标
  const modeIcon = useMemo(() => {
    if (player.playbackMode === 'loop') return <RetweetOutlined />;
    if (player.playbackMode === 'one') return <span style={{ fontSize: 14 }}>1</span>;
    return <SwapOutlined />;
  }, [player.playbackMode]);

  // 准备添加到歌单的数据
  const songToAdd: LocalPlaylistSong | null = useMemo(() => {
    const track = player.currentTrack;
    if (!track || track.protocol !== 'custom') return null;
    const platform = track.platform ?? track.source ?? 'netease';
    const songId = extractSongId(track.id, platform);
    return {
      id: songId,
      name: track.title,
      artists: track.artists ?? (track.artist ? [track.artist] : []),
      platform,
      addedAt: Date.now(),
    };
  }, [player.currentTrack]);

  // 处理进度条点击/拖动
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!progressRef.current || !player.duration) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newTime = percent * player.duration;
    player.seek(newTime);
  }, [player]);

  // 处理歌词点击
  const handleLyricClick = useCallback((time: number) => {
    if (time >= 0) {
      player.seek(time);
    }
  }, [player]);

  // 更多菜单
  const moreMenu: MenuProps = {
    items: isEmby
      ? []
      : [
          { key: 'add', label: '添加到歌单', icon: <HeartOutlined />, disabled: !songToAdd },
          { key: 'share', label: '分享', disabled: true },
        ],
    onClick: ({ key }) => {
      if (key === 'add' && songToAdd) {
        setAddModalOpen(true);
      } else {
        message.info(`${key}（原型占位）`);
      }
    },
  };

  const canPrev = player.currentIndex > 0;
  const canNext = player.currentIndex + 1 < player.totalCount;

  return (
    <div className="mobile-now-playing">
      {/* Header */}
      <header className="mobile-now-playing__header">
        <button
          type="button"
          className="mobile-now-playing__back-btn"
          onClick={() => navigate(-1)}
        >
          <LeftOutlined />
        </button>

        <div className="mobile-now-playing__header-center">
          <div className="mobile-now-playing__source">
            {current?.platform?.toUpperCase() || '正在播放'}
          </div>
        </div>

        {!isEmby ? (
          <Dropdown menu={moreMenu} trigger={['click']} placement="bottomRight">
            <button type="button" className="mobile-now-playing__more-btn">
              <MoreOutlined />
            </button>
          </Dropdown>
        ) : (
          <div style={{ width: 32 }} />
        )}
      </header>

      {/* 主内容区 - 封面/歌词切换 */}
      <main className="mobile-now-playing__main">
        {showLyrics && lyrics.length > 0 ? (
          // 歌词视图
          <div
            ref={lyricsRef}
            className="mobile-now-playing__lyrics"
            onClick={() => setShowLyrics(false)}
          >
            {lyrics.map((line, idx) => (
              <div
                key={`${line.time}-${idx}`}
                ref={(el) => { lineRefs.current[idx] = el; }}
                className={`mobile-now-playing__lyric-line ${idx === activeIndex ? 'is-active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleLyricClick(line.time);
                }}
              >
                {line.text || '...'}
              </div>
            ))}
          </div>
        ) : (
          // 封面视图
          <div
            className="mobile-now-playing__cover-view"
            onClick={() => lyrics.length > 0 && setShowLyrics(true)}
            style={{ cursor: lyrics.length > 0 ? 'pointer' : 'default' }}
          >
            <div className="mobile-now-playing__cover">
              {coverUrl ? (
                <img src={coverUrl} alt={title} />
              ) : (
                <PictureOutlined className="mobile-now-playing__cover-placeholder" />
              )}
            </div>

            <div className="mobile-now-playing__info">
              <h1 className="mobile-now-playing__title">{title}</h1>
              <p className="mobile-now-playing__artist">{artist}</p>
            </div>

            {lyrics.length > 0 && (
              <div className="mobile-now-playing__lyric-hint">
                点击查看歌词
              </div>
            )}
          </div>
        )}
      </main>

      {/* 控制区域 */}
      <footer className="mobile-now-playing__footer">
        {/* 进度条 */}
        <div className="mobile-now-playing__progress-wrap">
          <div
            ref={progressRef}
            className="mobile-now-playing__progress-track"
            onClick={handleProgressClick}
            onTouchMove={handleProgressClick}
          >
            <div
              className="mobile-now-playing__progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mobile-now-playing__time-row">
            <span>{formatTime(player.currentTime)}</span>
            <span>{formatTime(player.duration)}</span>
          </div>
        </div>

        {/* 主控制按钮 */}
        <div className="mobile-now-playing__controls">
          <button
            type="button"
            className={`mobile-now-playing__control-btn ${player.playbackMode !== 'loop' ? 'is-active' : ''}`}
            onClick={() => player.cyclePlaybackMode()}
          >
            {modeIcon}
          </button>

          <button
            type="button"
            className="mobile-now-playing__control-btn mobile-now-playing__control-btn--skip"
            onClick={() => player.playPrev()}
            disabled={!canPrev}
          >
            <StepBackwardOutlined />
          </button>

          <button
            type="button"
            className="mobile-now-playing__control-btn mobile-now-playing__play-btn"
            onClick={() => player.toggle()}
            disabled={isLoading || !player.currentTrack}
          >
            {isPlaying ? <PauseOutlined /> : <CaretRightFilled />}
          </button>

          <button
            type="button"
            className="mobile-now-playing__control-btn mobile-now-playing__control-btn--skip"
            onClick={() => player.playNext()}
            disabled={!canNext}
          >
            <StepForwardOutlined />
          </button>

          <button
            type="button"
            className="mobile-now-playing__control-btn"
            onClick={() => setQueueOpen(true)}
          >
            <UnorderedListOutlined />
          </button>
        </div>

        {/* 底部操作按钮 */}
        {!isEmby && (
          <div className="mobile-now-playing__bottom-actions">
            <button
              type="button"
              className="mobile-now-playing__action-text-btn"
              onClick={() => songToAdd && setAddModalOpen(true)}
              disabled={!songToAdd}
            >
              <HeartOutlined /> 收藏
            </button>

            <button
              type="button"
              className="mobile-now-playing__action-text-btn"
              onClick={() => message.info('分享功能（占位）')}
            >
              分享
            </button>
          </div>
        )}
      </footer>

      {/* 播放队列 Sheet */}
      <MobileQueueSheet open={queueOpen} onClose={() => setQueueOpen(false)} />

      {/* 添加到歌单弹窗 */}
      {!isEmby && (
        <AddToPlaylistModal
          open={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          song={songToAdd}
        />
      )}
    </div>
  );
}
