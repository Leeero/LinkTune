import { PictureOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';

import { usePlayer } from '../../../player/PlayerContext';

export function NowPlayingVinylCover() {
  const player = usePlayer();

  const [coverError, setCoverError] = useState(false);

  const isLoading = player.status === 'loading';
  const currentTrackId = player.currentTrack?.id ?? '';

  // 切歌时重置封面错误
  useEffect(() => {
    setCoverError(false);
  }, [currentTrackId]);

  const coverUrl = player.currentCoverUrl;

  return (
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
  );
}
