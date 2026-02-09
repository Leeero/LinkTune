import {
  ArrowsAltOutlined,
  CaretRightFilled,
  EllipsisOutlined,
  FileTextOutlined,
  HeartOutlined,
  PauseOutlined,
  PictureOutlined,
  RetweetOutlined,
  SoundOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  SwapOutlined,
  WarningFilled,
} from '@ant-design/icons';
import { Button, Dropdown, Popover, Slider, Tooltip, Typography, message, theme } from 'antd';
import type { MenuProps } from 'antd';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AddToPlaylistModal } from '../../features/local-playlists/AddToPlaylistModal';
import type { LocalPlaylistSong } from '../../features/local-playlists/localPlaylistDB';
import { usePlayer } from '../PlayerContext';
import { formatTime } from '../utils/formatTime';
import { PlayerQueuePopoverContent } from './PlayerQueuePopoverContent';

/**
 * 从 track 中提取纯净的歌曲 ID（去除可能的平台前缀）
 * Track id 可能是 "netease:123456" 或 "123456" 格式
 */
function extractSongId(trackId: string, trackPlatform?: string): string {
  // 如果 id 包含平台前缀（如 "netease:123456"），提取纯 id
  const knownPlatforms = ['netease', 'qq', 'kuwo'];
  for (const p of knownPlatforms) {
    const prefix = `${p}:`;
    if (trackId.startsWith(prefix)) {
      return trackId.slice(prefix.length);
    }
  }
  // 如果有 platform 且 id 以 platform: 开头
  if (trackPlatform && trackId.startsWith(`${trackPlatform}:`)) {
    return trackId.slice(trackPlatform.length + 1);
  }
  return trackId;
}

export function PlayerBar() {
  const { token } = theme.useToken();
  const player = usePlayer();

  const title = player.currentTrack?.title ?? '未选择歌曲';
  const artist = player.currentTrack?.artist ?? '—';
  const coverUrl = player.currentCoverUrl;

  const canPrev = player.currentIndex > 0;
  const canNext = player.currentIndex + 1 < player.totalCount;

  const max = useMemo(() => Math.max(0, player.duration || 0), [player.duration]);
  const value = useMemo(() => Math.min(player.currentTime, max || player.currentTime), [max, player.currentTime]);

  // 进度条拖拽时，如果每次 onChange 都 seek，会导致音频频繁跳转 + timeupdate 抢状态，体感会“卡/不灵敏”。
  // 因此：拖动中只更新本地值，松手（onChangeComplete）再真正 seek。
  const [seekingValue, setSeekingValue] = useState<number | null>(null);
  const sliderValue = seekingValue ?? value;

  const toScalar = (v: number | number[]) => (Array.isArray(v) ? v[0] : v);

  const isLoading = player.status === 'loading';
  const isError = player.status === 'error';
  const disabledAll = isLoading || !player.currentTrack;

  const navigate = useNavigate();

  const [queueOpen, setQueueOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const songToAdd: LocalPlaylistSong | null = useMemo(() => {
    const track = player.currentTrack;
    if (!track || track.protocol !== 'custom') return null;
    const platform = track.platform ?? track.source ?? 'netease';
    // 提取纯净的歌曲 ID，避免重复添加平台前缀
    const songId = extractSongId(track.id, platform);
    return {
      id: songId,
      name: track.title,
      artists: track.artists ?? (track.artist ? [track.artist] : []),
      platform,
      addedAt: Date.now(),
    };
  }, [player.currentTrack]);

  const handleAddToPlaylist = useCallback(() => {
    if (!songToAdd) {
      message.warning('当前歌曲不支持收藏');
      return;
    }
    setAddModalOpen(true);
  }, [songToAdd]);

  const moreMenu: MenuProps = {
    items: [
      { key: 'add', label: '添加到歌单', icon: <HeartOutlined />, disabled: !songToAdd },
      { type: 'divider' },
      { key: 'remove', label: '从队列移除（占位）', danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'add') {
        handleAddToPlaylist();
      } else {
        message.info(`点击：${key}（原型占位）`);
      }
    },
  };

  const modeIcon = (() => {
    if (player.playbackMode === 'loop') return <RetweetOutlined />;
    if (player.playbackMode === 'one') return <PauseOutlined />;
    return <SwapOutlined />;
  })();

  const modeText = (() => {
    if (player.playbackMode === 'loop') return '顺序播放';
    if (player.playbackMode === 'one') return '单曲循环';
    return '随机播放';
  })();

  const cssVars = useMemo<CSSProperties>(
    () =>
      ({
        '--lt-primary': token.colorPrimary,
        '--lt-primary-hover': token.colorPrimaryHover,
        '--lt-text': token.colorText,
        '--lt-text-secondary': token.colorTextSecondary,
        '--lt-unplayed': token.colorBorderSecondary,
        '--lt-hover-bg': token.colorFillQuaternary,
        '--lt-buffer': token.colorFillSecondary,
        '--lt-error': token.colorError,
        '--lt-accent': '#9D7CFF',
        '--lt-cover-placeholder': token.colorFillQuaternary,
      }) as CSSProperties,
    [
      token.colorPrimary,
      token.colorPrimaryHover,
      token.colorText,
      token.colorTextSecondary,
      token.colorBorderSecondary,
      token.colorFillQuaternary,
      token.colorFillSecondary,
      token.colorError,
    ],
  );

  const [playPulse, setPlayPulse] = useState(false);
  const pulseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pulseTimerRef.current) window.clearTimeout(pulseTimerRef.current);
    };
  }, []);

  const triggerPlayPulse = () => {
    setPlayPulse(false);
    if (pulseTimerRef.current) window.clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = window.setTimeout(() => {
      setPlayPulse(true);
      pulseTimerRef.current = window.setTimeout(() => setPlayPulse(false), 260);
    }, 0);
  };

  return (
    <div
      className={
        'linktune-playerbar' +
        (isLoading ? ' linktune-playerbar--loading' : '') +
        (isError ? ' linktune-playerbar--error' : '')
      }
      style={{
        background: token.colorBgElevated,
        borderTop: `1px solid ${token.colorBorder}`,
        color: token.colorText,
        ...cssVars,
      }}
    >
      {/* 左侧：200px */}
      <div className="linktune-playerbar__left">
        <Tooltip title="打开播放页" placement="top">
          <button
            type="button"
            className="linktune-playerbar__cover"
            onClick={() => {
              if (!player.currentTrack) return;
              navigate('/now-playing');
            }}
            disabled={!player.currentTrack}
          >
            {coverUrl ? (
              <img src={coverUrl} alt="cover" />
            ) : (
              <span className="linktune-playerbar__coverPlaceholder" aria-hidden>
                <PictureOutlined />
              </span>
            )}
            <span className="linktune-playerbar__coverHover" aria-hidden>
              <ArrowsAltOutlined />
            </span>
          </button>
        </Tooltip>

        <div className="linktune-playerbar__meta">
          <Tooltip title={title} placement="topLeft">
            <Typography.Text className="linktune-playerbar__title" ellipsis>
              {title}
            </Typography.Text>
          </Tooltip>

          <Tooltip title={artist} placement="topLeft">
            <Typography.Text
              className="linktune-playerbar__artist"
              ellipsis
              onClick={() => message.info('歌手页：原型占位')}
            >
              {artist}
            </Typography.Text>
          </Tooltip>
        </div>
      </div>

      {/* 中间：自适应，按钮/进度相对“去掉左侧信息后”的可用区域居中 */}
      <div className="linktune-playerbar__center">
        <div className="linktune-playerbar__controlsRow">
          <Tooltip title={`播放模式：${modeText}`}>
            <Button
              type="text"
              className={'linktune-playerbar__modeBtn' + (player.playbackMode !== 'loop' ? ' is-active' : '')}
              disabled={disabledAll}
              icon={modeIcon}
              onClick={() => player.cyclePlaybackMode()}
            />
          </Tooltip>

          <Button
            type="text"
            className="linktune-playerbar__controlBtn"
            disabled={disabledAll || !canPrev}
            icon={<StepBackwardOutlined />}
            onClick={() => player.playPrev()}
          />

          <Button
            type="primary"
            shape="circle"
            className={'linktune-playerbar__playBtn' + (playPulse ? ' is-pulse' : '')}
            disabled={disabledAll}
            icon={isError ? <WarningFilled /> : player.isPlaying ? <PauseOutlined /> : <CaretRightFilled />}
            onClick={() => {
              triggerPlayPulse();
              void player.toggle();
            }}
          />

          <Button
            type="text"
            className="linktune-playerbar__controlBtn"
            disabled={disabledAll || !canNext}
            icon={<StepForwardOutlined />}
            onClick={() => player.playNext()}
          />
        </div>

        <div className="linktune-playerbar__progressRow">
          <span className="linktune-playerbar__time linktune-playerbar__time--current">{formatTime(player.currentTime)}</span>

          <div className="linktune-playerbar__progresswrap">
            <div className="linktune-playerbar__buffer" style={{ width: `${Math.round(player.bufferedPercent * 100)}%` }} />
            <Slider
              min={0}
              max={max}
              value={sliderValue}
              disabled={disabledAll}
              tooltip={{ formatter: null }}
              onChange={(v) => setSeekingValue(toScalar(v))}
              onChangeComplete={(v) => {
                const next = toScalar(v);
                setSeekingValue(null);
                player.seek(next);
              }}
              style={{ margin: 0 }}
            />
          </div>

          <span className="linktune-playerbar__time linktune-playerbar__time--duration">{formatTime(player.duration)}</span>
        </div>
      </div>

      {/* 右侧：160px */}
      <div className="linktune-playerbar__right">
        <Tooltip title="收藏到歌单">
          <Button
            type="text"
            className="linktune-playerbar__iconBtn"
            icon={<HeartOutlined />}
            disabled={!songToAdd}
            onClick={handleAddToPlaylist}
          />
        </Tooltip>

        <Popover
          trigger="click"
          placement="top"
          content={
            <div className="linktune-playerbar__volumePopover">
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
          <Button type="text" className="linktune-playerbar__iconBtn" icon={<SoundOutlined />} />
        </Popover>

        <Popover
          trigger="click"
          placement="topRight"
          open={queueOpen}
          onOpenChange={setQueueOpen}
          content={
            <PlayerQueuePopoverContent
              open={queueOpen}
              classPrefix="linktune-playerbar"
              onAfterSelect={() => setQueueOpen(false)}
            />
          }
        >
          <Button type="text" className={'linktune-playerbar__iconBtn' + (queueOpen ? ' is-active' : '')} icon={<FileTextOutlined />} />
        </Popover>

        <Dropdown menu={moreMenu} trigger={['click']}>
          <Button type="text" className="linktune-playerbar__iconBtn" icon={<EllipsisOutlined />} />
        </Dropdown>
      </div>

      <AddToPlaylistModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        song={songToAdd}
      />
    </div>
  );
}
