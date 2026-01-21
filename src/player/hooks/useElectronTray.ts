import { useEffect } from 'react';

import type { Track } from '../types';

type PlayerControlApi = {
  toggle: () => Promise<void>;
  playPrev: () => Promise<void>;
  playNext: () => Promise<void>;
};

export function useElectronTray(params: { isPlaying: boolean; currentTrack: Track | null; api: PlayerControlApi }) {
  const { isPlaying, currentTrack, api } = params;

  // 同步播放状态到 Electron 主进程（托盘菜单）
  useEffect(() => {
    if (window.linkTune?.updatePlayerState) {
      const safeTrack = currentTrack
        ? {
            id: currentTrack.id,
            title: currentTrack.title,
            artist: currentTrack.artist,
            coverUrl: currentTrack.coverUrl,
            url: currentTrack.url,
            protocol: currentTrack.protocol,
            quality: currentTrack.quality,
          }
        : null;
      window.linkTune.updatePlayerState({
        isPlaying,
        currentTrack: safeTrack,
      });
    }
  }, [isPlaying, currentTrack]);

  // 监听来自 Electron 主进程的播放控制命令
  useEffect(() => {
    if (!window.linkTune?.onPlayerControl) return;

    window.linkTune.onPlayerControl((command) => {
      switch (command) {
        case 'toggle':
          api.toggle();
          break;
        case 'prev':
          api.playPrev();
          break;
        case 'next':
          api.playNext();
          break;
      }
    });

    return () => {
      window.linkTune?.removePlayerControlListener?.();
    };
  }, [api]);
}
