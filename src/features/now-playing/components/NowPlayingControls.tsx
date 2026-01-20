import {
  CaretRightFilled,
  FileTextOutlined,
  PauseOutlined,
  RetweetOutlined,
  SoundOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  SwapOutlined,
  WarningFilled,
} from '@ant-design/icons';
import { Button, Popover, Slider, Tooltip, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import { PlayerQueuePopoverContent } from '../../../player/components/PlayerQueuePopoverContent';
import { usePlayer } from '../../../player/PlayerContext';
import { formatTime } from '../../../player/utils/formatTime';

export function NowPlayingControls() {
  const player = usePlayer();

  const [seekingValue, setSeekingValue] = useState<number | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);

  const isLoading = player.status === 'loading';
  const isError = player.status === 'error';
  const isEmpty = !player.currentTrack;
  const disabledAll = isLoading || isEmpty;

  const canPrev = player.currentIndex > 0;
  const canNext = player.currentIndex + 1 < player.totalCount;

  const duration = useMemo(() => Math.max(0, player.duration || 0), [player.duration]);

  // 切歌时重置拖拽进度
  useEffect(() => {
    setSeekingValue(null);
  }, [player.currentTrack?.id]);

  const sliderValue = useMemo(() => {
    if (isError) return 0;
    return Math.min(seekingValue ?? player.currentTime, duration || player.currentTime);
  }, [duration, isError, player.currentTime, seekingValue]);

  const modeMeta = useMemo(() => {
    if (player.playbackMode === 'loop') return { icon: <RetweetOutlined />, text: '列表循环', next: '单曲循环' };
    if (player.playbackMode === 'one') return { icon: <PauseOutlined />, text: '单曲循环', next: '随机播放' };
    return { icon: <SwapOutlined />, text: '随机播放', next: '列表循环' };
  }, [player.playbackMode]);

  if (isEmpty) return null;

  return (
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
              <PlayerQueuePopoverContent
                open={queueOpen}
                classPrefix="linktune-now"
                onAfterSelect={() => setQueueOpen(false)}
              />
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
  );
}
