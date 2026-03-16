import {
  CaretRightFilled,
  CloseOutlined,
  EllipsisOutlined,
  HeartOutlined,
  PauseOutlined,
  PictureOutlined,
  RetweetOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  SwapOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { message } from 'antd';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AddToPlaylistModal } from '../../features/local-playlists/AddToPlaylistModal';
import type { LocalPlaylistSong } from '../../features/local-playlists/localPlaylistDB';
import { usePlayer } from '../../player/PlayerContext';
import { formatTime } from '../../player/utils/formatTime';
import { MobileQueueSheet } from './MobileQueueSheet';

/**
 * 从 track 中提取纯净的歌曲 ID
 */
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

interface MobileFullPlayerProps {
  open: boolean;
  onClose: () => void;
}

export function MobileFullPlayer({ open, onClose }: MobileFullPlayerProps) {
  const player = usePlayer();
  const navigate = useNavigate();
  const progressRef = useRef<HTMLDivElement>(null);

  const [queueOpen, setQueueOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const title = player.currentTrack?.title ?? '未选择歌曲';
  const artist = player.currentTrack?.artist ?? '—';
  const coverUrl = player.currentCoverUrl;
  const isPlaying = player.isPlaying;
  const isLoading = player.status === 'loading';
  const isEmby = player.currentTrack?.protocol === 'emby';

  // 进度百分比
  const progressPercent = useMemo(() => {
    if (!player.duration) return 0;
    return Math.min((player.currentTime / player.duration) * 100, 100);
  }, [player.currentTime, player.duration]);

  // 播放模式图标
  const modeIcon = useMemo(() => {
    if (player.playbackMode === 'loop') return <RetweetOutlined />;
    if (player.playbackMode === 'one') return <PauseOutlined style={{ fontSize: 16 }} />;
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

  // 处理进度条点击
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !player.duration) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = percent * player.duration;
    player.seek(newTime);
  }, [player]);

  // 处理收藏
  const handleAddToPlaylist = useCallback(() => {
    if (!songToAdd) {
      message.warning('当前歌曲不支持收藏');
      return;
    }
    setAddModalOpen(true);
  }, [songToAdd]);

  // 处理关闭 - 导航回去
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // 背景颜色（从封面提取或默认渐变）
  const bgStyle = useMemo(() => {
    // 可以后续实现从封面提取主题色
    return {
      '--player-bg-top': '#1E1B4B',
      '--player-bg-bottom': '#0F0F23',
    } as React.CSSProperties;
  }, []);

  return (
    <>
      <div
        className={`mobile-full-player ${open ? 'is-open' : ''}`}
        style={bgStyle}
      >
        {/* 顶部 Header */}
        <div className="mobile-full-player__header">
          <button
            type="button"
            className="mobile-full-player__close"
            onClick={handleClose}
          >
            <CloseOutlined />
          </button>

          <span className="mobile-full-player__source">
            {player.currentTrack?.platform?.toUpperCase() || 'LINKTUNE'}
          </span>

          <button
            type="button"
            className="mobile-full-player__actions"
            onClick={() => message.info('更多操作（占位）')}
          >
            <EllipsisOutlined />
          </button>
        </div>

        {/* 封面区域 */}
        <div className="mobile-full-player__cover-area">
          <div className="mobile-full-player__cover">
            {coverUrl ? (
              <img src={coverUrl} alt={title} />
            ) : (
              <PictureOutlined className="mobile-full-player__cover-placeholder" />
            )}
          </div>

          {/* 歌曲信息 */}
          <div className="mobile-full-player__info">
            <h2 className="mobile-full-player__title">{title}</h2>
            <p className="mobile-full-player__artist">{artist}</p>
          </div>
        </div>

        {/* 控制区域 */}
        <div className="mobile-full-player__control-area">
          {/* 进度条 */}
          <div className="mobile-full-player__progress">
            <div
              ref={progressRef}
              className="mobile-full-player__progress-bar"
              onClick={handleProgressClick}
            >
              <div
                className="mobile-full-player__progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
              <div
                className="mobile-full-player__progress-thumb"
                style={{ left: `${progressPercent}%` }}
              />
            </div>
            <div className="mobile-full-player__time">
              <span>{formatTime(player.currentTime)}</span>
              <span>{formatTime(player.duration)}</span>
            </div>
          </div>

          {/* 主控制按钮 */}
          <div className="mobile-full-player__controls">
            <button
              type="button"
              className={`mobile-full-player__control-btn ${
                player.playbackMode !== 'loop' ? 'is-active' : ''
              }`}
              onClick={() => player.cyclePlaybackMode()}
            >
              {modeIcon}
            </button>

            <button
              type="button"
              className="mobile-full-player__control-btn mobile-full-player__control-btn--prev"
              onClick={() => player.playPrev()}
              disabled={player.currentIndex <= 0}
            >
              <StepBackwardOutlined />
            </button>

            <button
              type="button"
              className="mobile-full-player__control-btn mobile-full-player__play-btn"
              onClick={() => player.toggle()}
              disabled={isLoading || !player.currentTrack}
            >
              {isPlaying ? <PauseOutlined /> : <CaretRightFilled />}
            </button>

            <button
              type="button"
              className="mobile-full-player__control-btn mobile-full-player__control-btn--next"
              onClick={() => player.playNext()}
              disabled={player.currentIndex + 1 >= player.totalCount}
            >
              <StepForwardOutlined />
            </button>

            <button
              type="button"
              className="mobile-full-player__control-btn"
              onClick={() => setQueueOpen(true)}
            >
              <UnorderedListOutlined />
            </button>
          </div>

          {/* 底部操作按钮 */}
          <div className="mobile-full-player__bottom-actions">
            {!isEmby && (
              <button
                type="button"
                className="mobile-full-player__action-btn"
                onClick={handleAddToPlaylist}
                disabled={!songToAdd}
              >
                <HeartOutlined />
              </button>
            )}

            <button
              type="button"
              className="mobile-full-player__action-btn"
              onClick={() => {
                onClose();
                // 延迟导航确保动画完成
                setTimeout(() => navigate('/now-playing'), 350);
              }}
            >
              歌词
            </button>

            {!isEmby && (
              <button
                type="button"
                className="mobile-full-player__action-btn"
                onClick={() => message.info('分享（占位）')}
              >
                分享
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 播放队列 Sheet */}
      <MobileQueueSheet
        open={queueOpen}
        onClose={() => setQueueOpen(false)}
      />

      {/* 添加到歌单弹窗 */}
      {!isEmby && (
        <AddToPlaylistModal
          open={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          song={songToAdd}
        />
      )}
    </>
  );
}
