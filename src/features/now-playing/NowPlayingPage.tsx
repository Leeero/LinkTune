import { LeftOutlined } from '@ant-design/icons';
import { Tooltip, theme } from 'antd';
import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { usePlayer } from '../../player/PlayerContext';
import { NowPlayingControls } from './components/NowPlayingControls';
import { NowPlayingLyricsSection } from './components/NowPlayingLyricsSection';
import { NowPlayingVinylCover } from './components/NowPlayingVinylCover';

export function NowPlayingPage() {
  const { token } = theme.useToken();
  const player = usePlayer();
  const navigate = useNavigate();

  const isLoading = player.status === 'loading';
  const isError = player.status === 'error';
  const isEmpty = !player.currentTrack;

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
      className={'linktune-now' + (isLoading ? ' is-loading' : '') + (isError ? ' is-error' : '')}
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
          <NowPlayingVinylCover />
          <NowPlayingLyricsSection />
        </div>
      )}

      <NowPlayingControls />
    </div>
  );
}
