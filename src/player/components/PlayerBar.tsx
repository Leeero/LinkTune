import {
  ArrowsAltOutlined,
  CaretRightFilled,
  EllipsisOutlined,
  FileTextOutlined,
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
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { usePlayer } from '../PlayerContext';

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec <= 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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

  const moreMenu: MenuProps = {
    items: [
      { key: 'add', label: '添加到歌单（占位）' },
      { key: 'artist', label: '查看歌手（占位）' },
      { key: 'report', label: '举报（占位）' },
      { type: 'divider' },
      { key: 'remove', label: '从队列移除（占位）', danger: true },
    ],
    onClick: ({ key }) => message.info(`点击：${key}（原型占位）`),
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

  const queueContent = (
    <div className="linktune-playerbar__queue">
      <div className="linktune-playerbar__queueHeader">
        <Typography.Text style={{ color: token.colorText }}>当前播放清单</Typography.Text>
        <Typography.Text style={{ color: token.colorTextSecondary }}>{player.totalCount} 首</Typography.Text>
      </div>
      <div className="linktune-playerbar__queueList" ref={queueListRef}>
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
                'linktune-playerbar__queueItem' + (idx === player.currentIndex ? ' is-active' : '')
              }
              onClick={async () => {
                await player.playTrack(t);
                setQueueOpen(false);
              }}
            >
              <span className="linktune-playerbar__queueTitle">{t.title}</span>
              <span className="linktune-playerbar__queueArtist">{t.artist}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );

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
          content={queueContent}
        >
         <Button type="text" className={'linktune-playerbar__iconBtn' + (queueOpen ? ' is-active' : '')} icon={<FileTextOutlined />} />
        </Popover>

        <Dropdown menu={moreMenu} trigger={['click']}>
          <Button type="text" className="linktune-playerbar__iconBtn" icon={<EllipsisOutlined />} />
        </Dropdown>
      </div>

    </div>
  );
}
