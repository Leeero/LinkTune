import { Typography, theme } from 'antd';

import { useQueueAutoScroll } from '../hooks/useQueueAutoScroll';
import { usePlayer } from '../PlayerContext';

type Props = {
  classPrefix: string;
  open: boolean;
  onAfterSelect?: () => void;
};

export function PlayerQueuePopoverContent({ classPrefix, open, onAfterSelect }: Props) {
  const { token } = theme.useToken();
  const player = usePlayer();

  const { listRef, itemRefs } = useQueueAutoScroll(open, player.currentIndex, player.totalCount);

  return (
    <div className={`${classPrefix}__queue`}>
      <div className={`${classPrefix}__queueHeader`}>
        <Typography.Text style={{ color: token.colorText }}>当前播放清单</Typography.Text>
        <Typography.Text style={{ color: token.colorTextSecondary }}>{player.totalCount} 首</Typography.Text>
      </div>
      <div className={`${classPrefix}__queueList`} ref={listRef}>
        {player.tracks.length === 0 ? (
          <Typography.Text style={{ color: token.colorTextSecondary }}>暂无歌曲</Typography.Text>
        ) : (
          player.tracks.map((t, idx) => (
            <button
              type="button"
              key={`${t.id}-${idx}`}
              ref={(el) => {
                itemRefs.current[idx] = el;
              }}
              className={`${classPrefix}__queueItem` + (idx === player.currentIndex ? ' is-active' : '')}
              onClick={async () => {
                await player.playTrack(t);
                onAfterSelect?.();
              }}
            >
              <span className={`${classPrefix}__queueTitle`}>{t.title}</span>
              <span className={`${classPrefix}__queueArtist`}>{t.artist}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
