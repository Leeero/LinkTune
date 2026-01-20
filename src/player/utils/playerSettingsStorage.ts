import type { PlaybackMode } from '../playerTypes';

// localStorage keys
const STORAGE_KEY_VOLUME = 'linktune_player_volume';
const STORAGE_KEY_MUTED = 'linktune_player_muted';
const STORAGE_KEY_PLAYBACK_MODE = 'linktune_player_mode';

export function loadPlayerSettings(): { volume: number; isMuted: boolean; playbackMode: PlaybackMode } {
  const defaults = { volume: 0.8, isMuted: false, playbackMode: 'loop' as PlaybackMode };

  try {
    const volumeStr = localStorage.getItem(STORAGE_KEY_VOLUME);
    const mutedStr = localStorage.getItem(STORAGE_KEY_MUTED);
    const modeStr = localStorage.getItem(STORAGE_KEY_PLAYBACK_MODE);

    const volume = volumeStr !== null ? parseFloat(volumeStr) : defaults.volume;
    const isMuted = mutedStr === 'true';
    const playbackMode = (modeStr === 'loop' || modeStr === 'one' || modeStr === 'shuffle') ? modeStr : defaults.playbackMode;

    return {
      volume: Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : defaults.volume,
      isMuted,
      playbackMode,
    };
  } catch {
    return defaults;
  }
}

export function saveVolume(volume: number) {
  try {
    localStorage.setItem(STORAGE_KEY_VOLUME, String(volume));
  } catch {
    // ignore
  }
}

export function saveMuted(isMuted: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY_MUTED, String(isMuted));
  } catch {
    // ignore
  }
}

export function savePlaybackMode(mode: PlaybackMode) {
  try {
    localStorage.setItem(STORAGE_KEY_PLAYBACK_MODE, mode);
  } catch {
    // ignore
  }
}
