/// <reference types="vite/client" />

declare global {
  interface Window {
    linkTune?: {
      platform: string;
      versions: { node: string; chrome: string; electron: string };
      updatePlayerState?: (state: { isPlaying: boolean; currentTrack: { id: string; title: string; artist?: string } | null }) => void;
      onPlayerControl?: (callback: (command: string) => void) => void;
      removePlayerControlListener?: () => void;
    };
  }
}

export {};
