import {
  CaretRightFilled,
  PauseOutlined,
  PictureOutlined,
  StepForwardOutlined,
} from '@ant-design/icons';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { usePlayer } from '../../player/PlayerContext';

export function MobileMiniPlayer() {
  const player = usePlayer();
  const navigate = useNavigate();

  const title = player.currentTrack?.title ?? '未选择歌曲';
  const artist = player.currentTrack?.artist ?? '—';
  const coverUrl = player.currentCoverUrl;
  const isPlaying = player.isPlaying;
  const isLoading = player.status === 'loading';

  // 计算进度百分比
  const progressPercent = useMemo(() => {
    if (!player.duration) return 0;
    return Math.min((player.currentTime / player.duration) * 100, 100);
  }, [player.currentTime, player.duration]);

  // 如果没有当前歌曲，不显示迷你播放器
  if (!player.currentTrack) {
    return null;
  }

  const handlePlayerClick = () => {
    navigate('/now-playing');
  };

  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    void player.toggle();
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    player.playNext();
  };

  return (
    <div className="mobile-mini-player" onClick={handlePlayerClick}>
      {/* 封面 */}
      <div className="mobile-mini-player__cover">
        {coverUrl ? (
          <img src={coverUrl} alt={title} />
        ) : (
          <PictureOutlined className="mobile-mini-player__cover-placeholder" />
        )}
      </div>

      {/* 信息 */}
      <div className="mobile-mini-player__info">
        <div className="mobile-mini-player__title">{title}</div>
        <div className="mobile-mini-player__artist">{artist}</div>
      </div>

      {/* 控制按钮 */}
      <div className="mobile-mini-player__controls">
        <button
          type="button"
          className="mobile-mini-player__btn mobile-mini-player__play-btn"
          onClick={handlePlayPause}
          disabled={isLoading}
        >
          {isPlaying ? <PauseOutlined /> : <CaretRightFilled />}
        </button>
        <button
          type="button"
          className="mobile-mini-player__btn"
          onClick={handleNext}
        >
          <StepForwardOutlined />
        </button>
      </div>

      {/* 进度条 */}
      <div className="mobile-mini-player__progress">
        <div
          className="mobile-mini-player__progress-bar"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
